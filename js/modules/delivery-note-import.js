/* global module */
(function initDeliveryNoteImport(/** @type {any} */ global, factory) {
  const api = factory(global);
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (global) {
    global.DeliveryNoteImport = api;
    global.openDeliveryNoteImportPicker = api.openFilePicker;
    global.handleDeliveryNoteImportFiles = api.handleFiles;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function createDeliveryNoteImport(global) {
    "use strict";

    const CREATE_NEW_VALUE = "__new__";
    const IMPORT_SUPPLIER_NAME = "历史送货单导入";
    const MAX_FILE_COUNT = 50;
    const MAX_FILE_SIZE = 15 * 1024 * 1024;
    const WORKFLOW_DRAFT_KEY = "inventory-system.history-import-draft.v1";
    const WORKFLOW_DRAFT_VERSION = 1;
    const DOCUMENT_DRAFT_FIELDS = Object.freeze([
      "enabled",
      "orderNo",
      "issueDate",
      "companyId",
      "companyName",
      "companyContact",
      "companyPhone",
      "companyAddress",
      "customerId",
      "customerName",
      "customerContact",
      "customerPhone",
      "customerAddress",
      "paymentTerms",
      "priceTaxMode",
    ]);
    const ITEM_DRAFT_FIELDS = Object.freeze([
      "enabled",
      "productId",
      "productName",
      "specification",
      "unit",
      "quantity",
      "unitPrice",
      "notes",
    ]);
    let activeWorkflowState = null;

    function getWorkflowStorage() {
      try {
        return global.sessionStorage || null;
      } catch {
        return null;
      }
    }

    function clearWorkflowDraft() {
      try {
        getWorkflowStorage()?.removeItem(WORKFLOW_DRAFT_KEY);
      } catch (error) {
        console.warn("Failed to clear the historical import draft.", error);
      }
    }

    function readWorkflowDraft() {
      try {
        const rawDraft = getWorkflowStorage()?.getItem(WORKFLOW_DRAFT_KEY);
        if (!rawDraft) return null;
        const draft = JSON.parse(rawDraft);
        if (
          draft?.version !== WORKFLOW_DRAFT_VERSION ||
          !Array.isArray(draft.reviewDocuments) ||
          !draft.reviewDocuments.length
        ) {
          clearWorkflowDraft();
          return null;
        }
        return draft;
      } catch (error) {
        console.warn("Failed to restore the historical import draft.", error);
        clearWorkflowDraft();
        return null;
      }
    }

    function writeWorkflowDraft(draft) {
      try {
        getWorkflowStorage()?.setItem(
          WORKFLOW_DRAFT_KEY,
          JSON.stringify({
            ...draft,
            version: WORKFLOW_DRAFT_VERSION,
            updatedAt: new Date().toISOString(),
          }),
        );
        return true;
      } catch (error) {
        console.warn("Failed to save the historical import draft.", error);
        return false;
      }
    }

    function text(value) {
      return String(value ?? "")
        .replace(/\u00a0/g, " ")
        .trim();
    }

    function compact(value) {
      return text(value).replace(/\s+/g, "");
    }

    function escapeHTML(value) {
      if (typeof global.escapeHTML === "function") {
        return global.escapeHTML(value);
      }
      return text(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function parseNumber(value) {
      if (typeof value === "number") return Number.isFinite(value) ? value : 0;
      const source = text(value).replace(/,/g, "");
      const negative = /^\(.*\)$/.test(source);
      const match = source.match(/-?\d+(?:\.\d+)?/);
      if (!match) return 0;
      const result = Number(match[0]);
      return negative ? -Math.abs(result) : result;
    }

    function roundMoney(value) {
      return Math.round((Number(value) || 0) * 100) / 100;
    }

    function normalizeDate(value) {
      const source = compact(value);
      const digits = source.replace(/\D/g, "");
      if (/^\d{8}$/.test(digits)) {
        return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
      }
      const match = source.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
      if (!match) return "";
      return `${match[1]}-${String(match[2]).padStart(2, "0")}-${String(match[3]).padStart(2, "0")}`;
    }

    function normalizeMatchValue(value) {
      return compact(value)
        .toLowerCase()
        .replace(/[（）()【】[\]，,。.·•:：;；_'"“”‘’.-]/g, "");
    }

    function findBestMatch(items, name, unit) {
      const target = normalizeMatchValue(name);
      if (!target) return null;
      const exact = (items || []).filter(
        (item) => normalizeMatchValue(item.name) === target,
      );
      if (exact.length === 1) return exact[0];
      if (exact.length > 1 && unit) {
        return (
          exact.find(
            (item) =>
              normalizeMatchValue(item.unit) === normalizeMatchValue(unit),
          ) || exact[0]
        );
      }
      if (target.length < 4) return null;
      const partial = (items || []).filter((item) => {
        const candidate = normalizeMatchValue(item.name);
        return (
          candidate.length >= 4 &&
          (candidate.includes(target) || target.includes(candidate))
        );
      });
      return partial.length === 1 ? partial[0] : null;
    }

    function rowText(row) {
      return (row || []).map(text).filter(Boolean).join(" ");
    }

    function extractTaggedValue(source, startLabel, nextLabels) {
      const normalized = compact(source);
      const start = normalized.indexOf(startLabel);
      if (start < 0) return "";
      let valueStart = start + startLabel.length;
      while ([":", "："].includes(normalized[valueStart])) valueStart += 1;
      let valueEnd = normalized.length;
      (nextLabels || []).forEach((label) => {
        const index = normalized.indexOf(label, valueStart);
        if (index >= 0 && index < valueEnd) valueEnd = index;
      });
      return normalized.slice(valueStart, valueEnd).trim();
    }

    function findTaggedValue(rows, startLabel, nextLabels, rowPredicate) {
      for (const row of rows || []) {
        const source = rowText(row);
        if (rowPredicate && !rowPredicate(compact(source))) continue;
        const value = extractTaggedValue(source, startLabel, nextLabels);
        if (value) return value;
      }
      return "";
    }

    function findPhones(source) {
      const matches = compact(source).match(
        /(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8})/g,
      );
      return matches || [];
    }

    function primaryPhone(source) {
      const phones = findPhones(source);
      return phones.find((item) => /^1[3-9]/.test(item)) || phones[0] || "";
    }

    function parseContactLine(rows) {
      const source = (rows || [])
        .map(rowText)
        .find((value) => compact(value).includes("收货人"));
      if (!source) return { contact: "", phone: "" };
      const segment = extractTaggedValue(source, "收货人", [
        "结款方式",
        "付款方式",
        "NO",
      ]);
      const phones = findPhones(segment);
      const phone = phones.join(" / ");
      let contact = compact(segment);
      phones.forEach((item) => {
        contact = contact.replace(item, "");
      });
      contact = contact.replace(/电话[:：]?/g, "").trim();
      return { contact, phone };
    }

    function findHeaderIndex(row, matcher) {
      return (row || []).findIndex((value) => matcher(compact(value)));
    }

    function parseDeliverySheetRows(rows, options = {}) {
      const usefulRows = (rows || []).map((row) =>
        Array.isArray(row) ? row : [],
      );
      const warnings = [];
      const headerRowIndex = usefulRows.findIndex((row) => {
        const normalized = row.map(compact);
        return (
          normalized.some((value) => value.includes("产品名称")) &&
          normalized.some(
            (value) => value.includes("出库数量") || value === "数量",
          )
        );
      });

      if (headerRowIndex < 0) {
        return {
          ok: false,
          fileName: options.fileName || "",
          sheetName: options.sheetName || "",
          errors: ["未找到包含“产品名称”和“出库数量”的明细表头。"],
          warnings,
          items: [],
        };
      }

      const header = usefulRows[headerRowIndex];
      const indexes = {
        sequence: findHeaderIndex(header, (value) => value === "序号"),
        productName: findHeaderIndex(header, (value) =>
          value.includes("产品名称"),
        ),
        specification: findHeaderIndex(header, (value) => value === "规格"),
        unit: findHeaderIndex(header, (value) => value === "单位"),
        quantity: findHeaderIndex(
          header,
          (value) => value.includes("出库数量") || value === "数量",
        ),
        unitPrice: findHeaderIndex(header, (value) => value.includes("单价")),
        amount: findHeaderIndex(header, (value) => value.includes("金额")),
        notes: findHeaderIndex(header, (value) => value === "备注"),
      };

      if (
        indexes.productName < 0 ||
        indexes.quantity < 0 ||
        indexes.unitPrice < 0
      ) {
        return {
          ok: false,
          fileName: options.fileName || "",
          sheetName: options.sheetName || "",
          errors: ["表头缺少产品名称、出库数量或单价字段。"],
          warnings,
          items: [],
        };
      }

      const metadataRows = usefulRows.slice(0, headerRowIndex);
      const firstTitle = metadataRows
        .flatMap((row) => row.map(text))
        .find(
          (value) =>
            value &&
            !value.includes("销售出库单") &&
            !value.includes("制单日期"),
        );
      const companyRow = metadataRows
        .map(rowText)
        .find((value) => compact(value).includes("订货电话"));
      const contactLine = parseContactLine(metadataRows);
      const companyPhones = findPhones(companyRow || "");
      let companyContact = "";
      if (companyRow && companyPhones.length) {
        companyContact = extractTaggedValue(companyRow, "订货电话", [])
          .replace(/(?:1[3-9]\d{9}|0\d{2,3}-?\d{7,8})/g, "")
          .replace(/[，,。.;；]/g, "")
          .trim();
      }

      const issueDateSource = metadataRows
        .map(rowText)
        .find((value) => compact(value).includes("制单日期"));
      const orderNoSource = metadataRows
        .map(rowText)
        .find((value) => /NO\s*[:：]/i.test(value));
      const orderNoMatch = compact(orderNoSource || "").match(
        /NO[:：]?([A-Z0-9_-]+)/i,
      );
      const issueDate = normalizeDate(
        extractTaggedValue(issueDateSource || "", "制单日期", [
          "收货单位",
          "收货地址",
          "订货电话",
        ]),
      );

      const metadata = {
        companyName: firstTitle || "",
        companyAddress: findTaggedValue(
          metadataRows,
          "地址",
          ["订货电话"],
          (source) => source.includes("订货电话"),
        ),
        companyPhone: companyPhones.join(" / "),
        companyContact,
        customerName: findTaggedValue(metadataRows, "收货单位", [
          "收货地址",
          "收货人",
          "结款方式",
          "付款方式",
          "NO",
        ]),
        customerAddress: findTaggedValue(metadataRows, "收货地址", [
          "收货人",
          "结款方式",
          "付款方式",
          "NO",
        ]),
        customerContact: contactLine.contact,
        customerPhone: contactLine.phone,
        paymentTerms:
          findTaggedValue(metadataRows, "结款方式", ["NO", "收货人"]) ||
          findTaggedValue(metadataRows, "付款方式", ["NO", "收货人"]),
        orderNo: orderNoMatch ? orderNoMatch[1] : "",
        issueDate,
      };

      if (!metadata.companyName) warnings.push("未识别到发货公司名称。");
      if (!metadata.customerName) warnings.push("未识别到收货单位。");
      if (!metadata.orderNo) warnings.push("未识别到送货单号。");
      if (!metadata.issueDate) warnings.push("未识别到制单日期。 ");
      if (!metadata.customerContact)
        warnings.push("模板中未识别到收货联系人，可在导入前补充。 ");
      if (!metadata.customerPhone)
        warnings.push("模板中未识别到收货联系电话，可在导入前补充。 ");

      const items = [];
      let sourceTotal = null;
      for (
        let rowIndex = headerRowIndex + 1;
        rowIndex < usefulRows.length;
        rowIndex += 1
      ) {
        const row = usefulRows[rowIndex];
        const joined = compact(rowText(row));
        if (!joined) continue;
        if (joined.includes("合计") || joined.includes("大写")) {
          for (
            let totalRowIndex = rowIndex;
            totalRowIndex < Math.min(usefulRows.length, rowIndex + 4);
            totalRowIndex += 1
          ) {
            const totalRow = usefulRows[totalRowIndex];
            const totalRowText = compact(rowText(totalRow));
            if (
              !totalRowText.includes("合计金额") &&
              !totalRowText.includes("大写") &&
              !totalRow.some((value) => /[￥¥]/.test(text(value)))
            ) {
              continue;
            }
            const numbers = totalRow
              .map((value) => parseNumber(value))
              .filter((value) => value > 0);
            if (numbers.length) {
              sourceTotal = numbers[numbers.length - 1];
              break;
            }
          }
          break;
        }
        if (/^(协议|注[:：]|发货单位|收货单位及)/.test(joined)) break;

        const productName = text(row[indexes.productName]);
        const quantity = parseNumber(row[indexes.quantity]);
        const unitPrice = parseNumber(row[indexes.unitPrice]);
        const notes = indexes.notes >= 0 ? text(row[indexes.notes]) : "";
        if (!productName) {
          const hasNonSequenceContent = row.some(
            (value, cellIndex) =>
              cellIndex !== indexes.sequence && Boolean(text(value)),
          );
          if (hasNonSequenceContent && (quantity || unitPrice || notes)) {
            warnings.push(
              `第 ${rowIndex + 1} 行没有产品名称，已跳过${notes ? `（备注：${notes}）` : ""}。`,
            );
          }
          continue;
        }
        if (quantity <= 0) {
          warnings.push(`产品“${productName}”的出库数量无效，已跳过。`);
          continue;
        }
        const hasExplicitUnit = indexes.unit >= 0;
        const specification =
          indexes.specification >= 0 && hasExplicitUnit
            ? text(row[indexes.specification])
            : "";
        const unit = hasExplicitUnit
          ? text(row[indexes.unit])
          : indexes.specification >= 0
            ? text(row[indexes.specification])
            : "";
        const providedAmount =
          indexes.amount >= 0 ? parseNumber(row[indexes.amount]) : 0;
        const calculatedAmount = roundMoney(quantity * unitPrice);
        items.push({
          productName,
          specification,
          unit,
          quantity,
          unitPrice,
          amount: providedAmount || calculatedAmount,
          notes,
          sourceRow: rowIndex + 1,
        });
        if (
          providedAmount &&
          Math.abs(roundMoney(providedAmount) - calculatedAmount) > 0.01
        ) {
          warnings.push(
            `产品“${productName}”的金额与数量 × 单价不一致，导入时将重新计算。`,
          );
        }
      }

      const calculatedTotal = roundMoney(
        items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0),
      );
      if (
        sourceTotal !== null &&
        Math.abs(roundMoney(sourceTotal) - calculatedTotal) > 0.01
      ) {
        warnings.push(
          `原表合计 ${roundMoney(sourceTotal).toFixed(2)} 与明细重算 ${calculatedTotal.toFixed(2)} 不一致。`,
        );
      }

      if (!items.length) warnings.push("没有识别到可导入的商品明细。 ");

      return {
        ok: Boolean(items.length),
        fileName: options.fileName || "",
        sheetName: options.sheetName || "",
        errors: items.length ? [] : ["没有可导入的商品明细。"],
        warnings,
        metadata,
        items,
        sourceTotal,
        calculatedTotal,
        priceTaxMode: header.some((value) => compact(value).includes("含税"))
          ? "inclusive"
          : "exclusive",
      };
    }

    function normalizeStatementDate(value, fallbackYear = 0) {
      const normalized = normalizeDate(value);
      if (normalized) return normalized;
      const source = compact(value);
      let match = source.match(/(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);
      if (match) {
        const year = Number(match[3]) < 100 ? 2000 + Number(match[3]) : match[3];
        return `${year}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
      }
      match = source.match(/(\d{1,2})[-/.](\d{1,2})/);
      if (!match || !fallbackYear) return "";
      return `${fallbackYear}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
    }

    function parseStatementPeriod(rows) {
      for (const row of rows || []) {
        for (const value of row || []) {
          const match = compact(value).match(
            /(\d{2,4})年(\d{1,2})月对账单/,
          );
          if (!match) continue;
          const year = Number(match[1]) < 100 ? 2000 + Number(match[1]) : Number(match[1]);
          return { year, month: Number(match[2]) };
        }
      }
      return { year: 0, month: 0 };
    }

    function getMonthBounds(year, month) {
      if (!year || !month) return { periodStart: "", periodEnd: "" };
      const endDay = new Date(year, month, 0).getDate();
      return {
        periodStart: `${year}-${String(month).padStart(2, "0")}-01`,
        periodEnd: `${year}-${String(month).padStart(2, "0")}-${String(endDay).padStart(2, "0")}`,
      };
    }

    function parseStatementSpecUnit(value) {
      const source = text(value);
      if (!source.includes("/")) {
        return { specification: "", unit: source };
      }
      const separatorIndex = source.lastIndexOf("/");
      return {
        specification: source.slice(0, separatorIndex).trim(),
        unit: source.slice(separatorIndex + 1).trim(),
      };
    }

    function lastPositiveNumber(row) {
      const values = (row || [])
        .map((value) => parseNumber(value))
        .filter((value) => value > 0);
      return values.length ? values[values.length - 1] : 0;
    }

    function isStatementSheetRows(rows) {
      const sources = (rows || []).map(rowText);
      const hasStatementTitle = sources.some((value) =>
        compact(value).includes("对账单"),
      );
      const hasStatementHeader = (rows || []).some((row) => {
        const cells = (row || []).map(compact);
        return (
          cells.some((value) => value === "送货日期") &&
          cells.some((value) => value === "送货单号") &&
          cells.some((value) => value.includes("产品名称"))
        );
      });
      return hasStatementTitle && hasStatementHeader;
    }

    function parseStatementSheetRows(rows, options = {}) {
      const usefulRows = (rows || []).map((row) =>
        Array.isArray(row) ? row : [],
      );
      const headerRowIndex = usefulRows.findIndex((row) => {
        const cells = row.map(compact);
        return (
          cells.some((value) => value === "送货日期") &&
          cells.some((value) => value === "送货单号") &&
          cells.some((value) => value.includes("产品名称"))
        );
      });
      if (headerRowIndex < 0) {
        return {
          ok: false,
          fileName: options.fileName || "",
          sheetName: options.sheetName || "",
          errors: ["未找到包含送货日期、送货单号和产品名称的对账明细表头。"],
          warnings: [],
          documents: [],
        };
      }

      const header = usefulRows[headerRowIndex];
      const indexes = {
        deliveryDate: findHeaderIndex(header, (value) => value === "送货日期"),
        orderNo: findHeaderIndex(header, (value) => value === "送货单号"),
        productName: findHeaderIndex(header, (value) =>
          value.includes("产品名称"),
        ),
        specification: findHeaderIndex(header, (value) => value === "规格"),
        unit: findHeaderIndex(header, (value) => value === "单位"),
        quantity: findHeaderIndex(header, (value) => value === "数量"),
        unitPrice: findHeaderIndex(header, (value) => value.includes("单价")),
        amount: findHeaderIndex(header, (value) => value.includes("金额")),
        notes: findHeaderIndex(header, (value) => value === "备注"),
      };
      const metadataRows = usefulRows.slice(0, headerRowIndex);
      const titlePeriod = parseStatementPeriod(metadataRows);
      const statementDateSource = metadataRows
        .map(rowText)
        .find((value) => compact(value).includes("对账日期"));
      const statementDate = normalizeStatementDate(
        extractTaggedValue(statementDateSource || "", "对账日期", []),
        titlePeriod.year,
      );
      const fallbackYear =
        Number(statementDate.slice(0, 4)) || titlePeriod.year || new Date().getFullYear();
      const companyName =
        metadataRows
          .flatMap((row) => row.map(text))
          .find((value) => value && !compact(value).includes("对账单")) || "";
      const companyLine = metadataRows
        .map(rowText)
        .find((value) => compact(value).startsWith("电话"));
      const companyPhones = findPhones(companyLine || "");
      let companyContact = compact(companyLine || "").replace(/^电话[:：]?/, "");
      companyPhones.forEach((phone) => {
        companyContact = companyContact.replace(phone, "");
      });
      companyContact = companyContact.replace(/[，,。.;；]/g, "").trim();
      const customerLine = metadataRows
        .map(rowText)
        .find((value) => compact(value).includes("联系人"));
      const customerContact = extractTaggedValue(customerLine || "", "联系人", [
        "联系电话",
      ]);
      const customerPhone = findPhones(customerLine || "").join(" / ");
      const customerName = findTaggedValue(metadataRows, "客户名称", [
        "对账日期",
        "联系人",
        "联系电话",
      ]);
      const customerAddress = findTaggedValue(metadataRows, "客户地址", []);
      const declaredDocumentCount = parseNumber(
        findTaggedValue(metadataRows, "单据", []),
      );
      const warningMessages = [];
      const groupedDocuments = new Map();
      const detailMonths = new Map();
      let footerStartIndex = usefulRows.length;

      for (
        let rowIndex = headerRowIndex + 1;
        rowIndex < usefulRows.length;
        rowIndex += 1
      ) {
        const row = usefulRows[rowIndex];
        const orderNo = text(row[indexes.orderNo]);
        const productName = text(row[indexes.productName]);
        const quantity = parseNumber(row[indexes.quantity]);
        const unitPrice = parseNumber(row[indexes.unitPrice]);
        if (!orderNo || !productName || quantity <= 0) {
          if (groupedDocuments.size) {
            footerStartIndex = rowIndex;
            break;
          }
          continue;
        }
        const issueDate = normalizeStatementDate(
          row[indexes.deliveryDate],
          fallbackYear,
        );
        if (!issueDate) {
          warningMessages.push(
            `送货单 ${orderNo} 的日期“${text(row[indexes.deliveryDate])}”无法识别。`,
          );
          continue;
        }
        const monthKey = issueDate.slice(0, 7);
        detailMonths.set(monthKey, (detailMonths.get(monthKey) || 0) + 1);
        const rawSpecification =
          indexes.specification >= 0 ? row[indexes.specification] : "";
        const parsedSpecUnit =
          indexes.unit >= 0
            ? {
                specification: text(rawSpecification),
                unit: text(row[indexes.unit]),
              }
            : parseStatementSpecUnit(rawSpecification);
        const providedAmount =
          indexes.amount >= 0 ? parseNumber(row[indexes.amount]) : 0;
        const calculatedAmount = roundMoney(quantity * unitPrice);
        if (
          providedAmount &&
          Math.abs(roundMoney(providedAmount) - calculatedAmount) > 0.01
        ) {
          warningMessages.push(
            `送货单 ${orderNo} 中商品“${productName}”的金额与数量 × 单价不一致。`,
          );
        }
        if (!groupedDocuments.has(orderNo)) {
          groupedDocuments.set(orderNo, {
            orderNo,
            issueDate,
            items: [],
          });
        }
        groupedDocuments.get(orderNo).items.push({
          productName,
          specification: parsedSpecUnit.specification,
          unit: parsedSpecUnit.unit,
          quantity,
          unitPrice,
          amount: providedAmount || calculatedAmount,
          notes: indexes.notes >= 0 ? text(row[indexes.notes]) : "",
          sourceRow: rowIndex + 1,
        });
      }

      if (!groupedDocuments.size) {
        return {
          ok: false,
          fileName: options.fileName || "",
          sheetName: options.sheetName || "",
          errors: ["对账单中没有识别到可导入的送货单明细。"],
          warnings: warningMessages,
          documents: [],
        };
      }

      const dominantMonth = Array.from(detailMonths.entries()).sort(
        (left, right) => right[1] - left[1],
      )[0]?.[0];
      const periodYear = Number(dominantMonth?.slice(0, 4)) || fallbackYear;
      const periodMonth =
        Number(dominantMonth?.slice(5, 7)) || titlePeriod.month || 1;
      if (
        titlePeriod.month &&
        dominantMonth &&
        titlePeriod.month !== periodMonth
      ) {
        warningMessages.push(
          `标题月份为 ${titlePeriod.month} 月，但送货明细集中在 ${periodMonth} 月，导入时采用明细月份。`,
        );
      }

      const currentAmount = roundMoney(
        Array.from(groupedDocuments.values()).reduce(
          (documentSum, documentData) =>
            documentSum +
            documentData.items.reduce(
              (itemSum, item) => itemSum + item.quantity * item.unitPrice,
              0,
            ),
          0,
        ),
      );
      const arrears = [];
      let taxRate = 0;
      let parsedTaxedAmount = 0;
      let parsedTotalAmount = 0;
      usefulRows.slice(footerStartIndex).forEach((row) => {
        const source = compact(rowText(row));
        if (!source) return;
        const monthMatch = source.match(
          /(\d{2,4})年(\d{1,2})月(?:货款|合计)/,
        );
        if (monthMatch) {
          const year =
            Number(monthMatch[1]) < 100
              ? 2000 + Number(monthMatch[1])
              : Number(monthMatch[1]);
          const month = Number(monthMatch[2]);
          const amount = lastPositiveNumber(row);
          if (amount > 0 && (year !== periodYear || month !== periodMonth)) {
            arrears.push({
              monthLabel: `${year}-${String(month).padStart(2, "0")} 货款`,
              amount: roundMoney(amount),
            });
          }
        }
        if (source.includes("含税")) {
          const multiplier = (row || [])
            .map((value) => parseNumber(value))
            .find((value) => value > 1 && value < 2);
          if (multiplier) taxRate = roundMoney(multiplier - 1);
          parsedTaxedAmount = roundMoney(lastPositiveNumber(row));
        }
        if (/^(合计|RMB)/i.test(source)) {
          parsedTotalAmount = roundMoney(lastPositiveNumber(row));
        }
      });
      const arrearsAmount = roundMoney(
        arrears.reduce((sum, item) => sum + item.amount, 0),
      );
      const amountWithTax = taxRate
        ? roundMoney(currentAmount * (1 + taxRate))
        : currentAmount;
      const totalAmount = roundMoney(amountWithTax + arrearsAmount);
      if (
        parsedTaxedAmount &&
        Math.abs(parsedTaxedAmount - amountWithTax) > 1
      ) {
        warningMessages.push(
          `表内含税金额 ${parsedTaxedAmount.toFixed(2)} 与明细重算 ${amountWithTax.toFixed(2)} 不一致。`,
        );
      }
      if (
        parsedTotalAmount &&
        Math.abs(parsedTotalAmount - totalAmount) > 1
      ) {
        warningMessages.push(
          `表内总额 ${parsedTotalAmount.toFixed(2)} 与明细及往期余额重算 ${totalAmount.toFixed(2)} 不一致。`,
        );
      }
      if (
        declaredDocumentCount &&
        declaredDocumentCount !== groupedDocuments.size
      ) {
        warningMessages.push(
          `表头写明共 ${declaredDocumentCount} 单，实际识别 ${groupedDocuments.size} 个送货单号。`,
        );
      }

      const period = getMonthBounds(periodYear, periodMonth);
      const statementGroupId = `${options.fileName || "statement"}::${options.sheetName || "sheet"}::${period.periodStart}`;
      const statementMeta = {
        groupId: statementGroupId,
        sourceFileName: options.fileName || "",
        orderNumbers: Array.from(groupedDocuments.keys()),
        statementDate: statementDate || period.periodEnd,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        declaredDocumentCount,
        currentAmount,
        taxRate,
        amountWithTax,
        arrears,
        arrearsAmount,
        totalAmount,
      };
      const documents = Array.from(groupedDocuments.values()).map(
        (documentData, index) => {
          const calculatedTotal = roundMoney(
            documentData.items.reduce(
              (sum, item) => sum + item.quantity * item.unitPrice,
              0,
            ),
          );
          return {
            ok: true,
            importKind: "customer-statement",
            statementGroupId,
            statementMeta,
            sourceFileName: options.fileName || "",
            fileName: `${options.fileName || "对账单"} · ${documentData.orderNo}`,
            sheetName: options.sheetName || "",
            errors: [],
            warnings: index === 0 ? warningMessages : [],
            metadata: {
              companyName,
              companyAddress: "",
              companyPhone: companyPhones.join(" / "),
              companyContact,
              customerName,
              customerAddress,
              customerContact,
              customerPhone,
              paymentTerms: "",
              orderNo: documentData.orderNo,
              issueDate: documentData.issueDate,
            },
            items: documentData.items,
            sourceTotal: calculatedTotal,
            calculatedTotal,
            priceTaxMode: "exclusive",
          };
        },
      );

      return {
        ok: true,
        importKind: "customer-statement",
        fileName: options.fileName || "",
        sheetName: options.sheetName || "",
        errors: [],
        warnings: warningMessages,
        documents,
        statementMeta,
      };
    }

    function parseWorkbookBuffer(arrayBuffer, fileName) {
      if (!global.XLSX?.read || !global.XLSX?.utils?.sheet_to_json) {
        throw new Error("Excel 解析组件未加载，请刷新页面后重试。");
      }
      const workbook = global.XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: false,
      });
      let fallback = null;
      for (const sheetName of workbook.SheetNames || []) {
        const sheet = workbook.Sheets[sheetName];
        const rows = global.XLSX.utils.sheet_to_json(sheet, {
          header: 1,
          raw: false,
          defval: "",
          blankrows: false,
        });
        const parsed = isStatementSheetRows(rows)
          ? parseStatementSheetRows(rows, { fileName, sheetName })
          : parseDeliverySheetRows(rows, { fileName, sheetName });
        if (!fallback) fallback = parsed;
        if (parsed.ok) return parsed;
      }
      return (
        fallback || {
          ok: false,
          fileName,
          sheetName: "",
          errors: ["工作簿中没有可读取的工作表。"],
          warnings: [],
          items: [],
        }
      );
    }

    function enrichMatches(documentData, data) {
      const metadata = documentData.metadata || {};
      return {
        ...documentData,
        companyMatchId:
          findBestMatch(data?.companies, metadata.companyName)?.id || "",
        customerMatchId:
          findBestMatch(data?.customers, metadata.customerName)?.id || "",
        items: (documentData.items || []).map((item) => ({
          ...item,
          productMatchId:
            findBestMatch(data?.products, item.productName, item.unit)?.id ||
            "",
        })),
      };
    }

    function buildSelectOptions(items, selectedId, createLabel) {
      const createSelected = !selectedId ? " selected" : "";
      return [
        `<option value="${CREATE_NEW_VALUE}"${createSelected}>${escapeHTML(createLabel)}</option>`,
        ...(items || []).map(
          (item) =>
            `<option value="${escapeHTML(item.id)}"${item.id === selectedId ? " selected" : ""}>${escapeHTML(item.name)}（${escapeHTML(item.id)}）</option>`,
        ),
      ].join("");
    }

    function buildWarningMarkup(documentData) {
      const messages = [
        ...(documentData.errors || []),
        ...(documentData.warnings || []),
      ];
      if (!messages.length) {
        return '<div class="mt-3 rounded-lg bg-green-50 px-3 py-2 text-xs text-green-700"><i class="fa fa-check-circle mr-1"></i>字段结构已识别，请核对内容后导入。</div>';
      }
      return `<div class="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-6 text-amber-800">${messages
        .map(
          (message) =>
            `<div><i class="fa fa-exclamation-triangle mr-1"></i>${escapeHTML(message)}</div>`,
        )
        .join("")}</div>`;
    }

    function buildDocumentMarkup(documentData, documentIndex, data) {
      const metadata = documentData.metadata || {};
      const companyOptions = buildSelectOptions(
        data.companies,
        documentData.companyMatchId,
        `新建公司：${metadata.companyName || "待填写"}`,
      );
      const customerOptions = buildSelectOptions(
        data.customers,
        documentData.customerMatchId,
        `新建客户：${metadata.customerName || "待填写"}`,
      );
      const itemRows = (documentData.items || [])
        .map((item, itemIndex) => {
          const productOptions = buildSelectOptions(
            data.products,
            item.productMatchId,
            `新建商品：${item.productName || "待填写"}`,
          );
          return `
            <tr data-import-item="${itemIndex}">
              <td><input type="checkbox" data-field="enabled" checked aria-label="导入此商品"></td>
              <td><select data-field="productId" class="delivery-import-control">${productOptions}</select></td>
              <td><input data-field="productName" class="delivery-import-control" value="${escapeHTML(item.productName)}"></td>
              <td><input data-field="specification" class="delivery-import-control" value="${escapeHTML(item.specification)}"></td>
              <td><input data-field="unit" class="delivery-import-control" value="${escapeHTML(item.unit)}"></td>
              <td><input data-field="quantity" type="number" min="0.0001" step="any" class="delivery-import-control" value="${escapeHTML(item.quantity)}"></td>
              <td><input data-field="unitPrice" type="number" min="0" step="0.01" class="delivery-import-control" value="${escapeHTML(item.unitPrice)}"></td>
              <td class="whitespace-nowrap">¥${roundMoney(item.quantity * item.unitPrice).toFixed(2)}</td>
              <td><input data-field="notes" class="delivery-import-control" value="${escapeHTML(item.notes)}"></td>
            </tr>`;
        })
        .join("");

      return `
        <details class="delivery-import-document" data-import-document="${documentIndex}" open>
          <summary class="flex flex-wrap items-center justify-between gap-3 bg-[#faf9fc] px-4 py-3">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <input type="checkbox" data-field="enabled" checked aria-label="导入此送货单" onclick="event.stopPropagation()">
                <strong class="truncate text-sm text-gray-900">${escapeHTML(documentData.fileName || `文件 ${documentIndex + 1}`)}</strong>
              </div>
              <div class="mt-1 text-xs text-gray-500">工作表：${escapeHTML(documentData.sheetName || "-")} · ${documentData.items.length} 条明细 · 合计 ¥${documentData.calculatedTotal.toFixed(2)}</div>
            </div>
            <span class="rounded-full px-2.5 py-1 text-xs ${documentData.warnings.length ? "bg-amber-100 text-amber-800" : "bg-green-100 text-green-700"}">${documentData.warnings.length ? `${documentData.warnings.length} 项提醒` : "结构正常"}</span>
          </summary>
          <div class="p-4">
            <div class="delivery-import-grid">
              <div class="delivery-import-field"><label>送货单号 *</label><input data-field="orderNo" class="delivery-import-control" value="${escapeHTML(metadata.orderNo)}"></div>
              <div class="delivery-import-field"><label>制单日期 *</label><input data-field="issueDate" type="date" class="delivery-import-control" value="${escapeHTML(metadata.issueDate)}"></div>
              <div class="delivery-import-field"><label>公司资料关联 *</label><select data-field="companyId" class="delivery-import-control">${companyOptions}</select></div>
              <div class="delivery-import-field"><label>发货公司名称 *</label><input data-field="companyName" class="delivery-import-control" value="${escapeHTML(metadata.companyName)}"></div>
              <div class="delivery-import-field"><label>公司联系人</label><input data-field="companyContact" class="delivery-import-control" value="${escapeHTML(metadata.companyContact)}"></div>
              <div class="delivery-import-field"><label>公司电话</label><input data-field="companyPhone" class="delivery-import-control" value="${escapeHTML(metadata.companyPhone)}"></div>
              <div class="delivery-import-field delivery-import-span-2"><label>公司地址</label><input data-field="companyAddress" class="delivery-import-control" value="${escapeHTML(metadata.companyAddress)}"></div>
              <div class="delivery-import-field"><label>客户资料关联 *</label><select data-field="customerId" class="delivery-import-control">${customerOptions}</select></div>
              <div class="delivery-import-field"><label>客户名称 *</label><input data-field="customerName" class="delivery-import-control" value="${escapeHTML(metadata.customerName)}"></div>
              <div class="delivery-import-field"><label>客户联系人</label><input data-field="customerContact" class="delivery-import-control" value="${escapeHTML(metadata.customerContact)}"></div>
              <div class="delivery-import-field"><label>客户电话</label><input data-field="customerPhone" class="delivery-import-control" value="${escapeHTML(metadata.customerPhone)}"></div>
              <div class="delivery-import-field delivery-import-span-2"><label>客户地址</label><input data-field="customerAddress" class="delivery-import-control" value="${escapeHTML(metadata.customerAddress)}"></div>
              <div class="delivery-import-field"><label>结款方式</label><input data-field="paymentTerms" class="delivery-import-control" value="${escapeHTML(metadata.paymentTerms)}"></div>
              <div class="delivery-import-field"><label>价格类型 *</label><select data-field="priceTaxMode" class="delivery-import-control"><option value="exclusive" ${documentData.priceTaxMode !== "inclusive" ? "selected" : ""}>未税价</option><option value="inclusive" ${documentData.priceTaxMode === "inclusive" ? "selected" : ""}>含税价</option></select></div>
            </div>
            ${buildWarningMarkup(documentData)}
            <div class="mt-4 delivery-import-table-wrap">
              <table class="delivery-import-table">
                <thead><tr><th>导入</th><th>商品资料关联</th><th>商品名称 *</th><th>规格</th><th>单位</th><th>数量 *</th><th>单价 *</th><th>重算金额</th><th>备注</th></tr></thead>
                <tbody>${itemRows}</tbody>
              </table>
            </div>
          </div>
        </details>`;
    }

    function setWorkflowContent(content) {
      const container = global.document?.getElementById(
        "delivery-import-workflow-content",
      );
      if (!container) return null;
      if (global.Node && content instanceof global.Node) {
        container.replaceChildren(content);
      } else if (typeof global.setSafeInnerHTML === "function") {
        global.setSafeInnerHTML(container, content);
      } else {
        container.innerHTML = String(content ?? "");
      }
      return container;
    }

    function setWorkflowStep(activeStep) {
      const order = ["review", "preview", "commit"];
      const activeIndex = order.indexOf(activeStep);
      global.document
        ?.querySelectorAll("#delivery-import-workflow-steps [data-step]")
        .forEach((step) => {
          const stepIndex = order.indexOf(step.dataset.step);
          step.classList.toggle("is-active", stepIndex === activeIndex);
          step.classList.toggle(
            "is-complete",
            activeIndex >= 0 && stepIndex < activeIndex,
          );
        });
    }

    function showImportWorkflowPage({
      title,
      subtitle,
      step,
      content,
      primaryText,
      secondaryText,
      onPrimary,
      onSecondary,
    }) {
      const container = setWorkflowContent(content);
      if (!container) {
        global.alert?.("未找到历史导入页面，请刷新页面后重试。");
        return false;
      }

      const titleElement = global.document?.getElementById(
        "delivery-import-workflow-title",
      );
      const subtitleElement = global.document?.getElementById(
        "delivery-import-workflow-subtitle",
      );
      const actions = global.document?.getElementById(
        "delivery-import-workflow-actions",
      );
      const primary = global.document?.getElementById(
        "delivery-import-workflow-primary",
      );
      const secondary = global.document?.getElementById(
        "delivery-import-workflow-secondary",
      );
      if (titleElement) titleElement.textContent = title;
      if (subtitleElement) subtitleElement.textContent = subtitle;
      setWorkflowStep(step);
      actions?.classList.remove("hidden");

      if (secondary) {
        secondary.textContent = secondaryText;
        secondary.onclick = () => onSecondary?.();
      }
      if (primary) {
        primary.disabled = false;
        primary.textContent = primaryText;
        const primaryHandler = async () => {
          const originalText = primary.textContent;
          try {
            primary.disabled = true;
            await onPrimary?.();
          } catch (error) {
            console.error("Historical import workflow failed.", error);
            global.alert?.("操作失败，请重试。");
          } finally {
            if (primary.onclick === primaryHandler) {
              primary.disabled = false;
              primary.textContent = originalText;
            }
          }
        };
        primary.onclick = primaryHandler;
      }

      global.showSection?.("history-import-workflow");
      const main = global.document?.querySelector("main");
      if (main && typeof main.scrollTo === "function") main.scrollTo(0, 0);
      return true;
    }

    function returnToImportSettings({ clearState = false } = {}) {
      if (clearState) {
        activeWorkflowState = null;
        clearWorkflowDraft();
      }
      if (typeof global.returnToHistoricalImportSettings === "function") {
        global.returnToHistoricalImportSettings();
        return;
      }
      global.showSection?.("settings");
      global.activateSettingsTab?.("settings-history-import");
    }

    function showReviewPage(documents, options = {}) {
      const data = global.mockData || {};
      const matchedDocuments = documents.map((item) =>
        enrichMatches(item, data),
      );
      const statementCount = new Set(
        matchedDocuments
          .filter((item) => item.importKind === "customer-statement")
          .map((item) => item.statementGroupId)
          .filter(Boolean),
      ).size;
      const totalItems = matchedDocuments.reduce(
        (sum, item) => sum + item.items.length,
        0,
      );
      const matchedParties = matchedDocuments.reduce(
        (sum, item) =>
          sum +
          Number(Boolean(item.companyMatchId)) +
          Number(Boolean(item.customerMatchId)),
        0,
      );
      const warningCount = matchedDocuments.reduce(
        (sum, item) => sum + item.warnings.length + item.errors.length,
        0,
      );
      const content = `
        <div id="delivery-import-review" class="space-y-3">
          <div class="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900">
            <div class="font-semibold"><i class="fa fa-info-circle mr-1"></i>这是历史单据导入</div>
            <div class="mt-1 text-xs leading-5 text-purple-700">确认后会保存送货单${statementCount ? `和 ${statementCount} 张客户对账单` : ""}，并补齐未匹配的公司、客户和商品资料，同时按“公司 + 客户 + 商品”写入客户价格版本；新商品会归入“历史送货单导入”供应商。不会生成出库流水，也不会扣减当前库存。</div>
          </div>
          <div class="delivery-import-summary">
            <div><div class="text-xs text-gray-500">送货单</div><div class="mt-1 text-xl font-semibold">${matchedDocuments.length}</div></div>
            <div><div class="text-xs text-gray-500">商品/价格明细</div><div class="mt-1 text-xl font-semibold">${totalItems}</div></div>
            <div><div class="text-xs text-gray-500">已匹配公司/客户</div><div class="mt-1 text-xl font-semibold">${matchedParties}</div></div>
            <div><div class="text-xs text-gray-500">需留意</div><div class="mt-1 text-xl font-semibold ${warningCount ? "text-amber-600" : "text-green-600"}">${warningCount}</div></div>
          </div>
          <div>${matchedDocuments.map((item, index) => buildDocumentMarkup(item, index, data)).join("")}</div>
        </div>`;

      showImportWorkflowPage({
        title: `核对送货单解析结果（${matchedDocuments.length} 张${statementCount ? `；含 ${statementCount} 张对账单` : ""}）`,
        subtitle: "检查解析结果并修改关联资料；此步骤不会写入系统。",
        step: "review",
        content,
        primaryText: `预览本次新增（${matchedDocuments.length} 张）`,
        secondaryText: "取消导入",
        onPrimary: () => advanceToImportPreview(matchedDocuments.length),
        onSecondary: () => returnToImportSettings({ clearState: true }),
      });
      activeWorkflowState = {
        documentCount: matchedDocuments.length,
        documents: matchedDocuments,
        reviewDocuments: matchedDocuments,
        reviewRoot: global.document?.getElementById("delivery-import-review"),
        formState: [],
      };
      if (options.formState) {
        applyReviewFormState(activeWorkflowState.reviewRoot, options.formState);
      }
      activeWorkflowState.formState = captureReviewFormState(
        activeWorkflowState.reviewRoot,
      );
      bindReviewDraftPersistence(activeWorkflowState.reviewRoot);
      if (options.persist !== false) persistActiveWorkflowDraft("review");
      return matchedDocuments;
    }

    function restoreReviewPage(reviewRoot, documentCount) {
      showImportWorkflowPage({
        title: `核对送货单解析结果（${documentCount} 张）`,
        subtitle: "已保留刚才的修改，可以继续调整后再次预览。",
        step: "review",
        content: reviewRoot,
        primaryText: `预览本次新增（${documentCount} 张）`,
        secondaryText: "取消导入",
        onPrimary: () => advanceToImportPreview(documentCount),
        onSecondary: () => returnToImportSettings({ clearState: true }),
      });
      if (activeWorkflowState) {
        activeWorkflowState.reviewRoot = reviewRoot;
        activeWorkflowState.formState = captureReviewFormState(reviewRoot);
        persistActiveWorkflowDraft("review");
      }
    }

    function advanceToImportPreview(documentCount) {
      const reviewed = collectReviewedDocuments();
      if (!reviewed.ok) {
        global.alert?.(reviewed.message);
        return false;
      }
      const reviewRoot = global.document?.getElementById(
        "delivery-import-review",
      );
      const formState = captureReviewFormState(reviewRoot);
      reviewRoot?.remove();
      activeWorkflowState = {
        documentCount,
        documents: reviewed.documents,
        reviewDocuments:
          activeWorkflowState?.reviewDocuments ||
          activeWorkflowState?.documents ||
          [],
        formState,
        reviewRoot,
      };
      showImportPlanPage(reviewed.documents, reviewRoot, documentCount);
      return false;
    }

    function getField(scope, name) {
      const element = scope.querySelector(`[data-field="${name}"]`);
      return element?.type === "checkbox"
        ? element.checked
        : text(element?.value);
    }

    function getDocumentField(documentElement, name) {
      return Array.from(
        documentElement.querySelectorAll(`[data-field="${name}"]`),
      ).find((element) => !element.closest("[data-import-item]"));
    }

    function readControlValue(element) {
      if (!element) return "";
      return element.type === "checkbox" ? element.checked : element.value;
    }

    function writeControlValue(element, value) {
      if (!element) return;
      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = value ?? "";
      }
    }

    function captureReviewFormState(root) {
      if (!root) return [];
      return Array.from(root.querySelectorAll("[data-import-document]")).map(
        (documentElement) => ({
          open: documentElement.open !== false,
          fields: Object.fromEntries(
            DOCUMENT_DRAFT_FIELDS.map((name) => [
              name,
              readControlValue(getDocumentField(documentElement, name)),
            ]),
          ),
          items: Array.from(
            documentElement.querySelectorAll("[data-import-item]"),
          ).map((itemElement) =>
            Object.fromEntries(
              ITEM_DRAFT_FIELDS.map((name) => [
                name,
                readControlValue(
                  itemElement.querySelector(`[data-field="${name}"]`),
                ),
              ]),
            ),
          ),
        }),
      );
    }

    function applyReviewFormState(root, formState) {
      if (!root || !Array.isArray(formState)) return;
      const documentElements = Array.from(
        root.querySelectorAll("[data-import-document]"),
      );
      formState.forEach((documentState, documentIndex) => {
        const documentElement = documentElements[documentIndex];
        if (!documentElement) return;
        documentElement.open = documentState.open !== false;
        Object.entries(documentState.fields || {}).forEach(([name, value]) => {
          writeControlValue(getDocumentField(documentElement, name), value);
        });
        const itemElements = Array.from(
          documentElement.querySelectorAll("[data-import-item]"),
        );
        (documentState.items || []).forEach((itemState, itemIndex) => {
          const itemElement = itemElements[itemIndex];
          if (!itemElement) return;
          Object.entries(itemState || {}).forEach(([name, value]) => {
            writeControlValue(
              itemElement.querySelector(`[data-field="${name}"]`),
              value,
            );
          });
        });
      });
    }

    function persistActiveWorkflowDraft(stage) {
      if (!activeWorkflowState) return false;
      const reviewRoot =
        activeWorkflowState.reviewRoot ||
        global.document?.getElementById("delivery-import-review");
      const formState = captureReviewFormState(reviewRoot);
      activeWorkflowState.formState = formState;
      return writeWorkflowDraft({
        stage,
        documentCount: activeWorkflowState.documentCount,
        reviewDocuments:
          activeWorkflowState.reviewDocuments ||
          activeWorkflowState.documents ||
          [],
        previewDocuments:
          stage === "preview" ? activeWorkflowState.documents || [] : [],
        formState,
      });
    }

    function bindReviewDraftPersistence(reviewRoot) {
      if (!reviewRoot || reviewRoot.dataset.draftPersistenceBound === "true") {
        return;
      }
      reviewRoot.dataset.draftPersistenceBound = "true";
      const persistReview = () => persistActiveWorkflowDraft("review");
      reviewRoot.addEventListener("input", persistReview);
      reviewRoot.addEventListener("change", persistReview);
    }

    function collectReviewedDocuments() {
      const root = global.document?.getElementById("delivery-import-review");
      if (!root) return { ok: false, message: "未找到导入核对内容。" };
      const documents = [];
      for (const documentElement of root.querySelectorAll(
        "[data-import-document]",
      )) {
        if (!getField(documentElement, "enabled")) continue;
        const orderNo = getField(documentElement, "orderNo");
        const issueDate = getField(documentElement, "issueDate");
        const companyName = getField(documentElement, "companyName");
        const customerName = getField(documentElement, "customerName");
        if (!orderNo || !issueDate || !companyName || !customerName) {
          return {
            ok: false,
            message: "每张启用的送货单都必须填写单号、日期、公司和客户名称。",
          };
        }
        const items = [];
        for (const itemElement of documentElement.querySelectorAll(
          "[data-import-item]",
        )) {
          if (!getField(itemElement, "enabled")) continue;
          const quantity = Number(getField(itemElement, "quantity"));
          const unitPrice = Number(getField(itemElement, "unitPrice"));
          const productName = getField(itemElement, "productName");
          if (!productName || !Number.isFinite(quantity) || quantity <= 0) {
            return {
              ok: false,
              message: `送货单 ${orderNo} 存在未填写商品名称或数量无效的明细。`,
            };
          }
          if (!Number.isFinite(unitPrice) || unitPrice < 0) {
            return {
              ok: false,
              message: `送货单 ${orderNo} 中商品“${productName}”的单价无效。`,
            };
          }
          items.push({
            productId: getField(itemElement, "productId"),
            productName,
            specification: getField(itemElement, "specification"),
            unit: getField(itemElement, "unit") || "个",
            quantity,
            unitPrice,
            notes: getField(itemElement, "notes"),
          });
        }
        if (!items.length) {
          return {
            ok: false,
            message: `送货单 ${orderNo} 没有启用的商品明细。`,
          };
        }
        const originalDocument =
          activeWorkflowState?.reviewDocuments?.[
            Number(documentElement.dataset.importDocument)
          ];
        documents.push({
          orderNo,
          issueDate,
          companyId: getField(documentElement, "companyId"),
          companyName,
          companyContact: getField(documentElement, "companyContact"),
          companyPhone: getField(documentElement, "companyPhone"),
          companyAddress: getField(documentElement, "companyAddress"),
          customerId: getField(documentElement, "customerId"),
          customerName,
          customerContact: getField(documentElement, "customerContact"),
          customerPhone: getField(documentElement, "customerPhone"),
          customerAddress: getField(documentElement, "customerAddress"),
          paymentTerms: getField(documentElement, "paymentTerms"),
          priceTaxMode:
            getField(documentElement, "priceTaxMode") === "inclusive"
              ? "inclusive"
              : "exclusive",
          sourceFileName:
            originalDocument?.sourceFileName ||
            documentElement.querySelector("summary strong")?.textContent ||
            "",
          importKind: originalDocument?.importKind || "delivery-note",
          statementGroupId: originalDocument?.statementGroupId || "",
          statementMeta: originalDocument?.statementMeta || null,
          items,
        });
      }
      if (!documents.length) {
        return { ok: false, message: "请至少选择一张送货单导入。" };
      }
      const existing = new Set(
        (global.mockData?.deliveryNotes || []).map((item) =>
          normalizeMatchValue(item.orderNo || item.customerNo),
        ),
      );
      const seen = new Set();
      for (const item of documents) {
        const key = normalizeMatchValue(item.orderNo);
        if (existing.has(key)) {
          return {
            ok: false,
            message: `送货单号 ${item.orderNo} 已存在，请取消该单导入或修改单号。`,
          };
        }
        if (seen.has(key)) {
          return {
            ok: false,
            message: `本次选择中存在重复送货单号 ${item.orderNo}。`,
          };
        }
        seen.add(key);
      }
      return { ok: true, documents };
    }

    function getNow() {
      return typeof global.getLocalISOString === "function"
        ? global.getLocalISOString()
        : new Date().toISOString();
    }

    function createId(items, prefix, padding) {
      if (typeof global.createSequentialId === "function") {
        return global.createSequentialId(items, prefix, padding);
      }
      return `${prefix}${String((items || []).length + 1).padStart(padding || 3, "0")}`;
    }

    function runtimeId(prefix) {
      if (typeof global.createRuntimeId === "function") {
        return global.createRuntimeId(prefix);
      }
      return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }

    function missing(value) {
      return !text(value) || ["-", "未提供", "未知"].includes(text(value));
    }

    function fillMissing(record, values, now) {
      let changed = false;
      Object.entries(values).forEach(([key, value]) => {
        if (text(value) && missing(record[key])) {
          record[key] = text(value);
          changed = true;
        }
      });
      if (changed) record.updatedAt = now;
    }

    function ensureImportSupplier(data, now) {
      let supplier = (data.suppliers || []).find(
        (item) =>
          normalizeMatchValue(item.name) ===
          normalizeMatchValue(IMPORT_SUPPLIER_NAME),
      );
      if (supplier) return supplier;
      supplier = {
        id: createId(data.suppliers, "S"),
        name: IMPORT_SUPPLIER_NAME,
        contactPerson: "历史数据",
        contactPhone: "未提供",
        email: "-",
        address: "未提供",
        paymentTerms: "未提供",
        creditLimit: 0,
        status: "active",
        createdAt: now,
        updatedAt: now,
      };
      data.suppliers.push(supplier);
      return supplier;
    }

    function resolveCompany(documentData, data, now) {
      let company =
        documentData.companyId !== CREATE_NEW_VALUE
          ? data.companies.find((item) => item.id === documentData.companyId)
          : null;
      if (!company) {
        company = findBestMatch(data.companies, documentData.companyName);
      }
      if (!company) {
        company = {
          id: createId(data.companies, "CO"),
          name: documentData.companyName,
          contactPerson: documentData.companyContact || "未提供",
          contactPhone: primaryPhone(documentData.companyPhone) || "未提供",
          address: documentData.companyAddress || "未提供",
          email: "-",
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        data.companies.push(company);
      } else {
        fillMissing(
          company,
          {
            contactPerson: documentData.companyContact,
            contactPhone: primaryPhone(documentData.companyPhone),
            address: documentData.companyAddress,
          },
          now,
        );
      }
      return company;
    }

    function resolveCustomer(documentData, data, now) {
      let customer =
        documentData.customerId !== CREATE_NEW_VALUE
          ? data.customers.find((item) => item.id === documentData.customerId)
          : null;
      if (!customer) {
        customer = findBestMatch(data.customers, documentData.customerName);
      }
      if (!customer) {
        customer = {
          id: createId(data.customers, "C"),
          name: documentData.customerName,
          contactPerson: documentData.customerContact || "未提供",
          contactPhone: documentData.customerPhone || "未提供",
          address: documentData.customerAddress || "未提供",
          email: "-",
          paymentTerms: documentData.paymentTerms || "未提供",
          hasTaxRate: false,
          taxRateCoefficient: null,
          defaultTaxRate: 0,
          priceTaxMode:
            documentData.priceTaxMode === "inclusive"
              ? "inclusive"
              : "exclusive",
          creditLimit: 0,
          status: "active",
          createdAt: now,
          updatedAt: now,
        };
        data.customers.push(customer);
      } else {
        fillMissing(
          customer,
          {
            contactPerson: documentData.customerContact,
            contactPhone: documentData.customerPhone,
            address: documentData.customerAddress,
            paymentTerms: documentData.paymentTerms,
          },
          now,
        );
      }
      return customer;
    }

    function resolveProduct(item, data, now) {
      let product =
        item.productId !== CREATE_NEW_VALUE
          ? data.products.find((candidate) => candidate.id === item.productId)
          : null;
      if (!product)
        product = findBestMatch(data.products, item.productName, item.unit);
      if (!product) {
        const supplier = ensureImportSupplier(data, now);
        product = {
          id: createId(data.products, "P"),
          name: item.productName,
          category: "历史导入",
          unit: item.unit || "个",
          costPrice: 0,
          retailPrice: item.unitPrice,
          stockQuantity: 0,
          minStock: 0,
          maxStock: 999999,
          supplierId: supplier.id,
          status: "active",
          notes: "由历史送货单导入自动建档，不影响当前库存",
          createdAt: now,
          updatedAt: now,
        };
        data.products.push(product);
      }
      return product;
    }

    function buildDeliveryNote(documentData, data, now) {
      const company = resolveCompany(documentData, data, now);
      const customer = resolveCustomer(documentData, data, now);
      const deliveryNoteId = runtimeId("SD");
      const details = documentData.items.map((item) => {
        const product = resolveProduct(item, data, now);
        const amount = roundMoney(item.quantity * item.unitPrice);
        return {
          id: runtimeId("SDD"),
          deliveryId: deliveryNoteId,
          productId: product.id,
          productName: item.productName,
          productNameSnapshot: item.productName,
          quantity: item.quantity,
          unit: item.unit || product.unit || "个",
          unitSnapshot: item.unit || product.unit || "个",
          spec: item.specification || "",
          specificationSnapshot: item.specification || "",
          unitPrice: item.unitPrice,
          confirmedUnitPrice: item.unitPrice,
          referencePriceSnapshot: item.unitPrice,
          referencePriceOriginalSnapshot: item.unitPrice,
          referencePriceTaxModeSnapshot:
            documentData.priceTaxMode === "inclusive"
              ? "inclusive"
              : "exclusive",
          lastTransactionPriceSnapshot: null,
          priceSource: "historical-import",
          taxRateSnapshot: 0,
          priceTaxModeSnapshot:
            documentData.priceTaxMode === "inclusive"
              ? "inclusive"
              : "exclusive",
          lineAmount: amount,
          totalAmount: amount,
          notes: item.notes || "",
          status: "confirmed",
        };
      });
      const totalAmount = roundMoney(
        details.reduce((sum, item) => sum + item.lineAmount, 0),
      );
      const historicalTime = `${documentData.issueDate}T12:00:00`;
      return {
        id: deliveryNoteId,
        type: "sales",
        orderNo: documentData.orderNo,
        issueDate: documentData.issueDate,
        deliveryDate: documentData.issueDate,
        status: "confirmed",
        subtotal: totalAmount,
        taxAmount: 0,
        totalAmount,
        taxRateSnapshot: 0,
        priceTaxModeSnapshot:
          documentData.priceTaxMode === "inclusive" ? "inclusive" : "exclusive",
        warehouseId: global.getDefaultWarehouseId?.() || "WH001",
        notes: `历史送货单导入（不调整库存）${documentData.sourceFileName ? `；来源：${documentData.sourceFileName}` : ""}`,
        companyId: company.id,
        companyName: documentData.companyName,
        companyAddress: documentData.companyAddress,
        companyPhone: documentData.companyPhone,
        companyContact: documentData.companyContact,
        customerId: customer.id,
        customerName: documentData.customerName,
        customerAddress: documentData.customerAddress,
        customerContact: documentData.customerContact,
        customerPhone: documentData.customerPhone,
        paymentTerms: documentData.paymentTerms,
        customerNo: documentData.orderNo,
        importSource: "xlsx",
        sourceFileName: documentData.sourceFileName,
        historicalImport: true,
        inventoryEffect: "none",
        importedAt: now,
        createdAt: historicalTime,
        updatedAt: historicalTime,
        details,
      };
    }

    function buildImportedCustomerStatements(
      documents,
      deliveryNotes,
      data,
      _now,
    ) {
      data.bills = Array.isArray(data.bills) ? data.bills : [];
      const groups = new Map();
      (documents || []).forEach((documentData, index) => {
        if (
          documentData.importKind !== "customer-statement" ||
          !documentData.statementGroupId ||
          !documentData.statementMeta
        ) {
          return;
        }
        if (!groups.has(documentData.statementGroupId)) {
          groups.set(documentData.statementGroupId, {
            meta: documentData.statementMeta,
            notes: [],
          });
        }
        groups.get(documentData.statementGroupId).notes.push(
          deliveryNotes[index],
        );
      });

      const statements = [];
      groups.forEach(({ meta, notes }) => {
        const usableNotes = notes.filter(Boolean);
        if (!usableNotes.length) return;
        const duplicate = data.bills.some(
          (record) =>
            record?.recordType === "statement-v1" &&
            record?.historicalImport === true &&
            record?.sourceFileName === meta.sourceFileName &&
            record?.periodStart === meta.periodStart &&
            record?.periodEnd === meta.periodEnd,
        );
        if (duplicate) return;

        const firstNote = usableNotes[0];
        const currentAmount = roundMoney(
          usableNotes.reduce(
            (sum, note) => sum + Number(note.totalAmount || 0),
            0,
          ),
        );
        const taxRate = Number(meta.taxRate) || 0;
        const amountWithTax = roundMoney(currentAmount * (1 + taxRate));
        const arrears = Array.isArray(meta.arrears) ? meta.arrears : [];
        const arrearsAmount = roundMoney(
          arrears.reduce((sum, item) => sum + Number(item.amount || 0), 0),
        );
        const totalAmount = roundMoney(amountWithTax + arrearsAmount);
        const details = [];
        usableNotes.forEach((note) => {
          (note.details || []).forEach((detail) => {
            details.push({
              id: runtimeId("CSTD"),
              sourceType: "delivery_note",
              sourceId: note.id,
              sourceNo: note.orderNo,
              bizDate: note.deliveryDate || note.issueDate,
              productId: detail.productId,
              productNameSnapshot:
                detail.productNameSnapshot || detail.productName,
              specSnapshot:
                detail.specificationSnapshot || detail.spec || "",
              unitSnapshot: detail.unitSnapshot || detail.unit || "",
              quantity: Number(detail.quantity) || 0,
              unitPrice: Number(detail.unitPrice) || 0,
              lineAmount: Number(detail.lineAmount) || 0,
              remark: detail.notes || "",
              sortOrder: details.length + 1,
            });
          });
        });
        const historicalTime = `${meta.statementDate || meta.periodEnd}T12:00:00`;
        statements.push({
          id: createId([...data.bills, ...statements], "CST", 4),
          recordType: "statement-v1",
          statementType: "customer",
          partyId: firstNote.customerId,
          partyNameSnapshot: firstNote.customerName,
          companyId: firstNote.companyId,
          companyNameSnapshot: firstNote.companyName,
          companyAddressSnapshot: firstNote.companyAddress || "",
          companyPhoneSnapshot: firstNote.companyPhone || "",
          contactNameSnapshot: firstNote.customerContact || "",
          contactPhoneSnapshot: firstNote.customerPhone || "",
          partyAddressSnapshot: firstNote.customerAddress || "",
          statementDate: meta.statementDate || meta.periodEnd,
          periodStart: meta.periodStart,
          periodEnd: meta.periodEnd,
          documentCount: usableNotes.length,
          currentAmount,
          taxRate,
          amountWithTax,
          arrearsAmount,
          totalAmount,
          totalAmountUppercase:
            global.convertAmountToChineseUpperForBills?.(totalAmount) || "",
          status: "pending_check",
          notes: `历史对账单导入；来源：${meta.sourceFileName || "Excel"}`,
          details,
          arrears,
          payments: [],
          sourceDocumentIds: usableNotes.map((note) => note.id),
          historicalImport: true,
          importSource: "xlsx",
          sourceFileName: meta.sourceFileName || "",
          createdAt: historicalTime,
          updatedAt: historicalTime,
        });
      });
      return statements;
    }

    function customerPriceKey(companyId, customerId, productId) {
      return [companyId, customerId, productId].map(String).join("::");
    }

    function recordTime(record) {
      const value = new Date(
        record.updatedAt || record.createdAt || 0,
      ).getTime();
      return Number.isFinite(value) ? value : 0;
    }

    function syncImportedCustomerPrices(notes, data) {
      data.customerProductPrices = Array.isArray(data.customerProductPrices)
        ? data.customerProductPrices
        : [];
      const touchedKeys = new Set();
      let createdCount = 0;

      (notes || [])
        .slice()
        .sort((left, right) => recordTime(left) - recordTime(right))
        .forEach((note) => {
          (note.details || []).forEach((detail) => {
            const key = customerPriceKey(
              note.companyId,
              note.customerId,
              detail.productId,
            );
            touchedKeys.add(key);
            const duplicate = data.customerProductPrices.some(
              (record) =>
                customerPriceKey(
                  record.companyId,
                  record.customerId,
                  record.productId,
                ) === key && record.sourceOrderNo === note.orderNo,
            );
            if (duplicate) return;
            data.customerProductPrices.push({
              id: runtimeId("CPP"),
              companyId: note.companyId,
              customerId: note.customerId,
              productId: detail.productId,
              referencePrice: Number(
                detail.confirmedUnitPrice ?? detail.unitPrice ?? 0,
              ),
              priceTaxMode:
                note.priceTaxModeSnapshot === "inclusive"
                  ? "inclusive"
                  : "exclusive",
              status: "inactive",
              remark: `历史送货单 ${note.orderNo} 导入`,
              sourceDeliveryNoteId: note.id,
              sourceOrderNo: note.orderNo,
              historicalImport: true,
              effectiveFrom:
                normalizeDate(
                  note.issueDate || note.deliveryDate || note.createdAt,
                ) || text(note.createdAt).slice(0, 10),
              createdAt: note.createdAt,
              updatedAt: note.updatedAt,
            });
            createdCount += 1;
          });
        });

      touchedKeys.forEach((key) => {
        const versions = data.customerProductPrices
          .filter(
            (record) =>
              customerPriceKey(
                record.companyId,
                record.customerId,
                record.productId,
              ) === key,
          )
          .sort((left, right) => recordTime(right) - recordTime(left));
        versions.forEach((record, index) => {
          record.status = index === 0 ? "active" : "inactive";
        });
      });

      return createdCount;
    }

    function cloneImportData(source) {
      const clone = (value) =>
        global.deepClone?.(value) || JSON.parse(JSON.stringify(value || []));
      const cloneArray = (value) => (Array.isArray(value) ? clone(value) : []);
      return {
        products: cloneArray(source?.products),
        suppliers: cloneArray(source?.suppliers),
        customers: cloneArray(source?.customers),
        customerProductPrices: cloneArray(source?.customerProductPrices),
        companies: cloneArray(source?.companies),
        bills: cloneArray(source?.bills),
        deliveryNotes: cloneArray(source?.deliveryNotes),
      };
    }

    function getRecordChanges(before, after) {
      const beforeById = new Map(
        (before || []).map((record) => [String(record.id), record]),
      );
      const created = (after || []).filter(
        (record) => !beforeById.has(String(record.id)),
      );
      const updated = (after || []).filter((record) => {
        const previous = beforeById.get(String(record.id));
        return previous && JSON.stringify(previous) !== JSON.stringify(record);
      });
      return { created, updated };
    }

    function createImportPlan(documents) {
      const before = cloneImportData(global.mockData || {});
      const plannedData = cloneImportData(global.mockData || {});
      const now = getNow();
      const deliveryNotes = documents.map((item) =>
        buildDeliveryNote(item, plannedData, now),
      );
      plannedData.deliveryNotes.unshift(...deliveryNotes);
      syncImportedCustomerPrices(deliveryNotes, plannedData);
      const statements = buildImportedCustomerStatements(
        documents,
        deliveryNotes,
        plannedData,
        now,
      );
      plannedData.bills.unshift(...statements);

      return {
        documents,
        plannedData,
        deliveryNotes,
        statements,
        companies: getRecordChanges(before.companies, plannedData.companies),
        customers: getRecordChanges(before.customers, plannedData.customers),
        products: getRecordChanges(before.products, plannedData.products),
        suppliers: getRecordChanges(before.suppliers, plannedData.suppliers),
        bills: getRecordChanges(before.bills, plannedData.bills),
        prices: getRecordChanges(
          before.customerProductPrices,
          plannedData.customerProductPrices,
        ),
      };
    }

    function buildPreviewTable(headers, rows) {
      if (!rows.length) return "";
      return `
        <div class="delivery-import-table-wrap delivery-import-preview-table-wrap">
          <table class="delivery-import-table delivery-import-preview-table">
            <thead><tr>${headers.map((item) => `<th>${escapeHTML(item)}</th>`).join("")}</tr></thead>
            <tbody>${rows.join("")}</tbody>
          </table>
        </div>`;
    }

    function buildMasterDataPreview(plan) {
      const companyRows = [
        ...plan.companies.created.map(
          (item) => `
            <tr><td><span class="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">新增</span></td><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.contactPerson)}</td><td>${escapeHTML(item.contactPhone)}</td><td>${escapeHTML(item.address)}</td></tr>`,
        ),
        ...plan.companies.updated.map(
          (item) => `
            <tr><td><span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">补充</span></td><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.contactPerson)}</td><td>${escapeHTML(item.contactPhone)}</td><td>${escapeHTML(item.address)}</td></tr>`,
        ),
      ];
      const customerRows = [
        ...plan.customers.created.map(
          (item) => `
            <tr><td><span class="rounded-full bg-green-100 px-2 py-1 text-xs text-green-700">新增</span></td><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.contactPerson)}</td><td>${escapeHTML(item.contactPhone)}</td><td>${escapeHTML(item.address)}</td><td>${escapeHTML(item.paymentTerms)}</td></tr>`,
        ),
        ...plan.customers.updated.map(
          (item) => `
            <tr><td><span class="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">补充</span></td><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.contactPerson)}</td><td>${escapeHTML(item.contactPhone)}</td><td>${escapeHTML(item.address)}</td><td>${escapeHTML(item.paymentTerms)}</td></tr>`,
        ),
      ];
      const productRows = plan.products.created.map((item) => {
        const supplier = plan.plannedData.suppliers.find(
          (record) => record.id === item.supplierId,
        );
        return `<tr><td>${escapeHTML(item.name)}</td><td>${escapeHTML(item.category)}</td><td>${escapeHTML(item.unit)}</td><td>¥${Number(item.retailPrice || 0).toFixed(2)}</td><td>${escapeHTML(supplier?.name || item.supplierId)}</td></tr>`;
      });
      const changeSections = [];
      if (companyRows.length) {
        changeSections.push(`
          <div class="text-sm font-semibold text-gray-700">我方公司</div>
          ${buildPreviewTable(["动作", "公司", "联系人", "电话", "地址"], companyRows)}`);
      }
      if (customerRows.length) {
        changeSections.push(`
          <div class="text-sm font-semibold text-gray-700">客户公司</div>
          ${buildPreviewTable(["动作", "客户", "联系人", "电话", "地址", "结款方式"], customerRows)}`);
      }
      if (productRows.length) {
        changeSections.push(`
          <div class="text-sm font-semibold text-gray-700">商品</div>
          ${buildPreviewTable(["商品", "分类", "单位", "通用售价", "归属供应商"], productRows)}`);
      }
      if (!changeSections.length) return "";

      return `
        <section class="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div><h4 class="font-semibold text-gray-900">基础资料变更</h4><p class="mt-1 text-xs text-gray-500">“补充”只填写原记录中的空缺字段，不覆盖已有有效资料。</p></div>
          ${changeSections.join("")}
        </section>`;
    }

    function buildDeliveryPreview(plan) {
      return plan.deliveryNotes
        .map((note) => {
          const rows = (note.details || []).map(
            (detail) => `
              <tr><td>${escapeHTML(detail.productNameSnapshot || detail.productName)}</td><td>${escapeHTML(detail.specificationSnapshot || "-")}</td><td>${escapeHTML(detail.unitSnapshot || "-")}</td><td>${detail.quantity}</td><td>¥${Number(detail.confirmedUnitPrice || 0).toFixed(2)}</td><td>¥${Number(detail.lineAmount || 0).toFixed(2)}</td><td>${escapeHTML(detail.notes || "-")}</td></tr>`,
          );
          return `
            <div class="rounded-xl border border-gray-200 bg-white p-4">
              <div class="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div><div class="font-semibold text-gray-900">${escapeHTML(note.orderNo)} · ${escapeHTML(note.customerName)}</div><div class="mt-1 text-xs text-gray-500">${escapeHTML(note.issueDate)} · 发货公司：${escapeHTML(note.companyName)} · ${note.priceTaxModeSnapshot === "inclusive" ? "含税价" : "未税价"}</div></div>
                <div class="text-right"><div class="text-xs text-gray-500">送货单金额</div><div class="text-lg font-semibold text-primary">¥${Number(note.totalAmount || 0).toFixed(2)}</div></div>
              </div>
              ${buildPreviewTable(["商品", "规格", "单位", "数量", "客户单价", "金额", "备注"], rows)}
            </div>`;
        })
        .join("");
    }

    function buildStatementPreview(plan) {
      if (!plan.statements?.length) return "";
      const rows = plan.statements.map(
        (statement) => `
          <tr>
            <td>${escapeHTML(statement.partyNameSnapshot)}</td>
            <td>${escapeHTML(statement.periodStart)} 至 ${escapeHTML(statement.periodEnd)}</td>
            <td>${statement.documentCount}</td>
            <td>¥${Number(statement.currentAmount || 0).toFixed(2)}</td>
            <td>${statement.taxRate ? `${(Number(statement.taxRate) * 100).toFixed(0)}%` : "未税"}</td>
            <td>¥${Number(statement.arrearsAmount || 0).toFixed(2)}</td>
            <td>¥${Number(statement.totalAmount || 0).toFixed(2)}</td>
            <td>待核对</td>
          </tr>`,
      );
      return `
        <section class="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div><h4 class="font-semibold text-gray-900">客户对账单</h4><p class="mt-1 text-xs text-gray-500">对账单会关联本次拆分出的历史送货单；以前月份货款作为往期余额保存，不会生成库存流水。</p></div>
          ${buildPreviewTable(["客户", "对账期间", "送货单", "本期未税", "税率", "往期余额", "对账总额", "状态"], rows)}
        </section>`;
    }

    function buildPricePreview(plan) {
      const createdPriceIds = new Set(
        plan.prices.created.map((record) => String(record.id)),
      );
      const buildRow = (price, actionLabel, actionClass) => {
        const company = plan.plannedData.companies.find(
          (item) => item.id === price.companyId,
        );
        const customer = plan.plannedData.customers.find(
          (item) => item.id === price.customerId,
        );
        const product = plan.plannedData.products.find(
          (item) => item.id === price.productId,
        );
        return `
          <tr><td><span class="rounded-full px-2 py-1 text-xs ${actionClass}">${escapeHTML(actionLabel)}</span></td><td>${escapeHTML(company?.name || price.companyId)}</td><td>${escapeHTML(customer?.name || price.customerId)}</td><td>${escapeHTML(product?.name || price.productId)}</td><td>¥${Number(price.referencePrice || 0).toFixed(2)}</td><td>${price.priceTaxMode === "inclusive" ? "含税价" : "未税价"}</td><td>${escapeHTML(price.sourceOrderNo || "-")}</td><td>${price.status === "active" ? '<span class="text-green-700">当前参考价</span>' : '<span class="text-gray-500">历史版本</span>'}</td></tr>`;
      };
      const existingPriceUpdates = plan.prices.updated.filter(
        (record) => !createdPriceIds.has(String(record.id)),
      );
      const rows = [
        ...plan.prices.created.map((price) =>
          buildRow(price, "新增版本", "bg-green-100 text-green-700"),
        ),
        ...existingPriceUpdates.map((price) =>
          buildRow(price, "状态调整", "bg-blue-100 text-blue-700"),
        ),
      ];
      if (!rows.length) return "";
      return `
        <section class="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          <div><h4 class="font-semibold text-gray-900">客户商品价格版本</h4><p class="mt-1 text-xs text-gray-500">每条成交价都会进入对应公司与客户的商品价格表；较新的价格为当前参考价，其余保留为历史版本。${existingPriceUpdates.length ? `本次另有 ${existingPriceUpdates.length} 条原价格版本状态会随之调整。` : ""}</p></div>
          ${buildPreviewTable(["动作", "公司", "客户", "商品", "价格", "类型", "来源单号", "导入后状态"], rows)}
        </section>`;
    }

    function buildChangeSummaryCard({
      label,
      icon,
      created = 0,
      updated = 0,
      createdLabel = "新增",
      updatedLabel = "补充",
    }) {
      const total = created + updated;
      if (!total) return "";
      const kind = created && updated ? "mixed" : updated ? "update" : "create";
      return `
        <div class="delivery-import-change-card is-${kind}" data-change-kind="${kind}">
          <div class="delivery-import-change-card-heading">
            <span class="delivery-import-change-card-icon"><i class="fa fa-${escapeHTML(icon)}"></i></span>
            <span>${escapeHTML(label)}</span>
          </div>
          <div class="delivery-import-change-card-count">${total}</div>
          <div class="delivery-import-change-card-badges">
            ${created ? `<span class="is-create"><i class="fa fa-plus-circle"></i>${escapeHTML(createdLabel)} ${created}</span>` : ""}
            ${updated ? `<span class="is-update"><i class="fa fa-pencil"></i>${escapeHTML(updatedLabel)} ${updated}</span>` : ""}
          </div>
        </div>`;
    }

    function buildImportPlanMarkup(plan) {
      const detailCount = plan.deliveryNotes.reduce(
        (sum, note) => sum + (note.details || []).length,
        0,
      );
      const summaryCards = [
        buildChangeSummaryCard({
          label: "公司资料",
          icon: "building-o",
          created: plan.companies.created.length,
          updated: plan.companies.updated.length,
        }),
        buildChangeSummaryCard({
          label: "客户资料",
          icon: "users",
          created: plan.customers.created.length,
          updated: plan.customers.updated.length,
        }),
        buildChangeSummaryCard({
          label: "商品资料",
          icon: "cube",
          created: plan.products.created.length,
        }),
        buildChangeSummaryCard({
          label: "送货单",
          icon: "file-text-o",
          created: plan.deliveryNotes.length,
        }),
        buildChangeSummaryCard({
          label: "商品明细",
          icon: "list-ul",
          created: detailCount,
        }),
        buildChangeSummaryCard({
          label: "客户对账单",
          icon: "file-invoice-dollar",
          created: plan.statements.length,
        }),
        buildChangeSummaryCard({
          label: "客户价格版本",
          icon: "tags",
          created: plan.prices.created.length,
          updated: plan.prices.updated.length,
          updatedLabel: "调整",
        }),
      ].filter(Boolean);
      return `
        <div id="delivery-import-final-preview" class="space-y-3">
          <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <div class="font-semibold"><i class="fa fa-eye mr-1"></i>以下只是最终预览，尚未写入系统</div>
            <div class="mt-1 text-xs leading-5 text-blue-700">请确认新增和补充内容。只有点击“最终确认导入”后，下面的信息才会作为一笔事务保存。<span class="ml-2 inline-flex items-center gap-2"><span class="delivery-import-inline-legend is-create">新增</span><span class="delivery-import-inline-legend is-update">补充 / 调整</span></span></div>
          </div>
          ${summaryCards.length ? `<div class="delivery-import-change-summary">${summaryCards.join("")}</div>` : ""}
          ${buildMasterDataPreview(plan)}
          <section class="space-y-3"><div><h4 class="font-semibold text-gray-900">送货单与商品明细</h4><p class="mt-1 text-xs text-gray-500">下面的送货单会进入历史销售记录和后续客户对账来源。</p></div>${buildDeliveryPreview(plan)}</section>
          ${buildStatementPreview(plan)}
          ${buildPricePreview(plan)}
          <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"><i class="fa fa-shield mr-1"></i>本次导入不会生成出库流水，不会改变任何商品的当前库存。</div>
        </div>`;
    }

    function showImportPlanPage(documents, reviewRoot, documentCount) {
      const plan = createImportPlan(documents);
      activeWorkflowState = {
        ...activeWorkflowState,
        documentCount,
        documents,
        reviewDocuments:
          activeWorkflowState?.reviewDocuments ||
          activeWorkflowState?.documents ||
          [],
        formState:
          captureReviewFormState(reviewRoot) ||
          activeWorkflowState?.formState ||
          [],
        reviewRoot,
      };
      showImportWorkflowPage({
        title: "预览本次新增与补充内容",
        subtitle: "这是写入前的最终预览；确认各项变更无误后再执行导入。",
        step: "preview",
        content: buildImportPlanMarkup(plan),
        primaryText: "最终确认导入",
        secondaryText: "返回修改",
        onPrimary: async () => {
          const saved = await commitReviewedImports(documents);
          if (saved) returnToImportSettings({ clearState: true });
          return saved;
        },
        onSecondary: () => restoreReviewPage(reviewRoot, documentCount),
      });
      persistActiveWorkflowDraft("preview");
      return plan;
    }

    function showEmptyWorkflowState(message) {
      activeWorkflowState = null;
      return showImportWorkflowPage({
        title: "历史送货单 / 对账单导入",
        subtitle: "从系统设置选择 Excel 送货单或客户对账单，核对并预览后再确认写入。",
        step: "review",
        content: `
          <div class="flex min-h-[240px] flex-col items-center justify-center px-6 py-12 text-center">
            <span class="flex h-14 w-14 items-center justify-center rounded-full bg-purple-50 text-2xl text-primary"><i class="fa fa-file-excel-o"></i></span>
            <h3 class="mt-4 text-base font-semibold text-gray-900">没有待处理的导入任务</h3>
            <p class="mt-2 max-w-xl text-sm leading-6 text-gray-500">${escapeHTML(message || "刷新后会自动恢复尚未完成的导入草稿。现在可以返回系统设置，或重新选择送货单 / 对账单文件。")}</p>
          </div>`,
        primaryText: "选择送货单 / 对账单文件",
        secondaryText: "返回系统设置",
        onPrimary: () => openFilePicker(),
        onSecondary: () => returnToImportSettings(),
      });
    }

    function draftContainsImportedOrder(draft) {
      const existingOrderNumbers = new Set(
        (global.mockData?.deliveryNotes || []).map((item) =>
          normalizeMatchValue(item.orderNo || item.customerNo),
        ),
      );
      return (draft.previewDocuments || []).some((item) =>
        existingOrderNumbers.has(normalizeMatchValue(item.orderNo)),
      );
    }

    function restoreWorkflowDraft() {
      const draft = readWorkflowDraft();
      if (!draft) {
        showEmptyWorkflowState();
        return false;
      }
      if (draftContainsImportedOrder(draft)) {
        clearWorkflowDraft();
        showEmptyWorkflowState(
          "暂存任务中的送货单已经存在于系统中，可能已完成导入。为防止重复写入，本次草稿已自动清除。",
        );
        return false;
      }

      showReviewPage(draft.reviewDocuments, {
        formState: draft.formState,
        persist: false,
      });
      if (
        draft.stage === "preview" &&
        Array.isArray(draft.previewDocuments) &&
        draft.previewDocuments.length
      ) {
        const reviewRoot = global.document?.getElementById(
          "delivery-import-review",
        );
        reviewRoot?.remove();
        activeWorkflowState = {
          documentCount:
            Number(draft.documentCount) || draft.previewDocuments.length,
          documents: draft.previewDocuments,
          reviewDocuments: draft.reviewDocuments,
          formState: draft.formState || [],
          reviewRoot,
        };
        showImportPlanPage(
          draft.previewDocuments,
          reviewRoot,
          activeWorkflowState.documentCount,
        );
      } else {
        persistActiveWorkflowDraft("review");
      }
      return true;
    }

    function restoreArray(targetName, previous) {
      if (targetName === "stockMovementData" || targetName === "logsData") {
        global[targetName] = previous;
      } else if (global.mockData) {
        global.mockData[targetName] = previous;
      }
    }

    async function commitReviewedImports(documents) {
      const data = global.mockData;
      if (!data) {
        global.alert?.("系统数据尚未加载，请稍后重试。");
        return false;
      }
      data.products = Array.isArray(data.products) ? data.products : [];
      data.suppliers = Array.isArray(data.suppliers) ? data.suppliers : [];
      data.customers = Array.isArray(data.customers) ? data.customers : [];
      data.companies = Array.isArray(data.companies) ? data.companies : [];
      data.deliveryNotes = Array.isArray(data.deliveryNotes)
        ? data.deliveryNotes
        : [];
      data.bills = Array.isArray(data.bills) ? data.bills : [];
      data.customerProductPrices = Array.isArray(data.customerProductPrices)
        ? data.customerProductPrices
        : [];
      const snapshot = {
        products:
          global.deepClone?.(data.products) ||
          JSON.parse(JSON.stringify(data.products)),
        suppliers:
          global.deepClone?.(data.suppliers) ||
          JSON.parse(JSON.stringify(data.suppliers)),
        customers:
          global.deepClone?.(data.customers) ||
          JSON.parse(JSON.stringify(data.customers)),
        companies:
          global.deepClone?.(data.companies) ||
          JSON.parse(JSON.stringify(data.companies)),
        deliveryNotes:
          global.deepClone?.(data.deliveryNotes) ||
          JSON.parse(JSON.stringify(data.deliveryNotes)),
        bills:
          global.deepClone?.(data.bills) ||
          JSON.parse(JSON.stringify(data.bills)),
        customerProductPrices:
          global.deepClone?.(data.customerProductPrices) ||
          JSON.parse(JSON.stringify(data.customerProductPrices)),
        stockMovementData: Array.isArray(global.stockMovementData)
          ? global.stockMovementData.slice()
          : [],
        logsData: Array.isArray(global.logsData) ? global.logsData.slice() : [],
      };
      const now = getNow();
      const createdNotes = documents.map((item) =>
        buildDeliveryNote(item, data, now),
      );
      data.deliveryNotes.unshift(...createdNotes);
      const createdPriceCount = syncImportedCustomerPrices(createdNotes, data);
      const createdStatements = buildImportedCustomerStatements(
        documents,
        createdNotes,
        data,
        now,
      );
      data.bills.unshift(...createdStatements);
      const auditLogs = global.stageAuditLogs?.({
        actionType: "import",
        objectType: createdStatements.length
          ? "historical-business"
          : "delivery-note",
        objectName: `${createdNotes.length} 张历史送货单${createdStatements.length ? `、${createdStatements.length} 张客户对账单` : ""}`,
        details: `从 Excel 导入 ${createdNotes.length} 张历史销售送货单、${createdNotes.reduce((sum, note) => sum + note.details.length, 0)} 条商品明细${createdStatements.length ? `、${createdStatements.length} 张客户对账单` : ""}及 ${createdPriceCount} 条客户价格版本；未调整当前库存。`,
      });

      let saved = true;
      try {
        if (typeof global.saveMockData === "function") {
          saved = await global.saveMockData();
        }
      } catch (error) {
        console.error("Historical delivery note import failed.", error);
        saved = false;
      }
      if (saved === false) {
        restoreArray("products", snapshot.products);
        restoreArray("suppliers", snapshot.suppliers);
        restoreArray("customers", snapshot.customers);
        restoreArray("companies", snapshot.companies);
        restoreArray("deliveryNotes", snapshot.deliveryNotes);
        restoreArray("bills", snapshot.bills);
        restoreArray("customerProductPrices", snapshot.customerProductPrices);
        restoreArray("stockMovementData", snapshot.stockMovementData);
        restoreArray("logsData", snapshot.logsData);
        global.rollbackStagedAuditLogs?.(auditLogs || []);
        global.alert?.("导入保存失败，所有变更已回滚，当前库存未受影响。");
        return false;
      }

      global.finalizeStagedAuditLogs?.(auditLogs || []);
      global.updateInventoryTable?.();
      global.updateCompanyTable?.();
      global.updateSupplierTable?.();
      global.updateCustomerTable?.();
      global.renderStockMovementTable?.(
        global.document
          ?.querySelector("#stock-tabs .active")
          ?.getAttribute("data-tab") || "all",
      );
      global.renderBillPartyFilter?.();
      global.updateBillsTable?.();
      global.renderPriceManagement?.();
      global.renderDashboardActivity?.();
      global.alert?.(
        `成功导入 ${createdNotes.length} 张历史送货单、${createdNotes.reduce((sum, note) => sum + note.details.length, 0)} 条商品明细${createdStatements.length ? `、${createdStatements.length} 张客户对账单` : ""}，并写入 ${createdPriceCount} 条客户价格版本；当前库存没有变化。`,
      );
      return true;
    }

    function openFilePicker() {
      if (!global.XLSX) {
        global.alert?.("Excel 解析组件未加载，请刷新页面后重试。");
        return false;
      }
      global.document
        ?.getElementById("historical-business-import-input")
        ?.click();
      return true;
    }

    async function handleFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return false;
      if (files.length > MAX_FILE_COUNT) {
        global.alert?.(`一次最多导入 ${MAX_FILE_COUNT} 个文件，请分批处理。`);
        return false;
      }
      const invalid = files.find(
        (file) =>
          !/\.xlsx?$/i.test(file.name || "") ||
          Number(file.size) > MAX_FILE_SIZE,
      );
      if (invalid) {
        global.alert?.(
          `文件“${invalid.name}”格式不支持或超过 15MB，请选择 .xlsx/.xls 文件。`,
        );
        return false;
      }

      const button = global.document?.getElementById(
        "historical-business-import-btn",
      );
      const originalText = button?.innerHTML;
      if (button) {
        button.disabled = true;
        button.innerHTML =
          '<i class="fa fa-spinner fa-spin mr-2"></i>正在解析…';
      }
      try {
        const documents = [];
        const failures = [];
        for (const file of files) {
          try {
            const parsed = parseWorkbookBuffer(
              await file.arrayBuffer(),
              file.name,
            );
            if (parsed.ok && Array.isArray(parsed.documents)) {
              documents.push(...parsed.documents);
            } else if (parsed.ok) documents.push(parsed);
            else failures.push(`${file.name}：${parsed.errors.join("；")}`);
          } catch (error) {
            failures.push(`${file.name}：${error?.message || "解析失败"}`);
          }
        }
        if (!documents.length) {
          global.alert?.(
            `没有可导入的送货单或对账明细。\n${failures.join("\n")}`,
          );
          return false;
        }
        if (failures.length) {
          documents[0].warnings.unshift(
            `另有 ${failures.length} 个文件未解析：${failures.join("；")}`,
          );
        }
        showReviewPage(documents);
        return true;
      } finally {
        if (button) {
          button.disabled = false;
          button.innerHTML = originalText;
        }
      }
    }

    return {
      CREATE_NEW_VALUE,
      IMPORT_SUPPLIER_NAME,
      WORKFLOW_DRAFT_KEY,
      normalizeDate,
      normalizeMatchValue,
      parseDeliverySheetRows,
      parseStatementSheetRows,
      parseWorkbookBuffer,
      findBestMatch,
      enrichMatches,
      syncImportedCustomerPrices,
      createImportPlan,
      collectReviewedDocuments,
      commitReviewedImports,
      showReviewPage,
      showReviewModal: showReviewPage,
      showImportPlanPage,
      showImportPlanModal: showImportPlanPage,
      restoreWorkflowDraft,
      clearWorkflowDraft,
      openFilePicker,
      handleFiles,
    };
  },
);
