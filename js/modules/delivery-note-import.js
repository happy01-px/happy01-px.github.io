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
    const MAX_ARCHIVE_COUNT = 4;
    const MAX_ARCHIVE_SIZE = 80 * 1024 * 1024;
    const BATCH_PAGE_SIZE = 40;
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
    let archiveImportEndpoint = "";
    let batchNavigationRoot = null;
    let batchNavigationHost = null;

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

    function isProductNameHeader(value) {
      return (
        value.includes("产品名称") ||
        value.includes("货品名称") ||
        value.includes("品名规格") ||
        value === "品名" ||
        value === "名称"
      );
    }

    function isUnitPriceHeader(value) {
      return (
        value.includes("单价") ||
        value.includes("含税价") ||
        value.includes("未税价")
      );
    }

    function parseDeliverySheetRows(rows, options = {}) {
      const usefulRows = (rows || []).map((row) =>
        Array.isArray(row) ? row : [],
      );
      const warnings = [];
      const headerRowIndex = usefulRows.findIndex((row) => {
        const normalized = row.map(compact);
        return (
          normalized.some(isProductNameHeader) &&
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
        productName: findHeaderIndex(header, isProductNameHeader),
        specification: findHeaderIndex(header, (value) => value === "规格"),
        unit: findHeaderIndex(header, (value) => value === "单位"),
        quantity: findHeaderIndex(
          header,
          (value) => value.includes("出库数量") || value === "数量",
        ),
        unitPrice: findHeaderIndex(header, isUnitPriceHeader),
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
        const year =
          Number(match[3]) < 100 ? 2000 + Number(match[3]) : match[3];
        return `${year}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
      }
      match = source.match(/(\d{1,2})[-/.](\d{1,2})/);
      if (!match || !fallbackYear) return "";
      return `${fallbackYear}-${String(match[1]).padStart(2, "0")}-${String(match[2]).padStart(2, "0")}`;
    }

    function parseStatementPeriod(rows) {
      for (const row of rows || []) {
        for (const value of row || []) {
          const match = compact(value).match(/(\d{2,4})年(\d{1,2})月对账单/);
          if (!match) continue;
          const year =
            Number(match[1]) < 100 ? 2000 + Number(match[1]) : Number(match[1]);
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
          cells.some((value) => value === "送货日期" || value === "日期") &&
          cells.some((value) => value === "送货单号") &&
          cells.some(isProductNameHeader)
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
          cells.some((value) => value === "送货日期" || value === "日期") &&
          cells.some((value) => value === "送货单号") &&
          cells.some(isProductNameHeader)
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
        deliveryDate: findHeaderIndex(
          header,
          (value) => value === "送货日期" || value === "日期",
        ),
        orderNo: findHeaderIndex(header, (value) => value === "送货单号"),
        productName: findHeaderIndex(header, isProductNameHeader),
        specification: findHeaderIndex(header, (value) => value === "规格"),
        unit: findHeaderIndex(header, (value) => value === "单位"),
        quantity: findHeaderIndex(header, (value) => value === "数量"),
        unitPrice: findHeaderIndex(header, isUnitPriceHeader),
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
        Number(statementDate.slice(0, 4)) ||
        titlePeriod.year ||
        new Date().getFullYear();
      const companyName =
        metadataRows
          .flatMap((row) => row.map(text))
          .find((value) => value && !compact(value).includes("对账单")) || "";
      const companyLine = metadataRows
        .map(rowText)
        .find((value) => compact(value).startsWith("电话"));
      const companyPhones = findPhones(companyLine || "");
      let companyContact = compact(companyLine || "").replace(
        /^电话[:：]?/,
        "",
      );
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
        const monthMatch = source.match(/(\d{2,4})年(\d{1,2})月(?:货款|合计)/);
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
      if (parsedTotalAmount && Math.abs(parsedTotalAmount - totalAmount) > 1) {
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
      if (batchNavigationRoot) {
        batchNavigationRoot.unmount?.();
        batchNavigationRoot = null;
        batchNavigationHost = null;
      }
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
      preserveScroll = false,
    }) {
      const main = global.document?.querySelector("main");
      const preservedScrollTop = preserveScroll
        ? Number(main?.scrollTop) || 0
        : 0;
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
      const partial = global.document?.getElementById(
        "delivery-import-workflow-partial",
      );
      const secondary = global.document?.getElementById(
        "delivery-import-workflow-secondary",
      );
      if (titleElement) titleElement.textContent = title;
      if (subtitleElement) subtitleElement.textContent = subtitle;
      setWorkflowStep(step);
      actions?.classList.remove("hidden");
      if (partial) {
        partial.classList.add("hidden");
        partial.disabled = true;
        partial.onclick = null;
      }

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

      global.showSection?.("history-import-workflow", {
        preserveScroll: true,
      });
      if (main) {
        const restoreScroll = () => {
          main.scrollTop = preservedScrollTop;
          if (typeof main.scrollTo === "function") {
            main.scrollTo(0, preservedScrollTop);
          }
        };
        restoreScroll();
        if (preserveScroll) global.requestAnimationFrame?.(restoreScroll);
      }
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

    function getBatchStatusMeta(status) {
      const values = {
        pending: { label: "待确认", className: "is-pending" },
        confirmed: { label: "已确认", className: "is-confirmed" },
        error: { label: "识别失败", className: "is-error" },
        excluded: { label: "已排除", className: "is-excluded" },
      };
      return values[status] || values.pending;
    }

    function getBatchCounts(records) {
      const counts = {
        total: records.length,
        pending: 0,
        confirmed: 0,
        error: 0,
        excluded: 0,
        documents: 0,
        items: 0,
      };
      records.forEach((record) => {
        const status = record.reviewStatus || "pending";
        counts[status] = (counts[status] || 0) + 1;
        counts.documents += Number(record.documentCount) || 0;
        counts.items += Number(record.itemCount) || 0;
      });
      counts.unresolved = counts.pending + counts.error;
      return counts;
    }

    function batchKindLabel(record) {
      if (record.importKind === "customer-statement") return "对账单";
      if (record.reviewStatus === "error") return "待识别";
      return "送货单";
    }

    function createArchiveEntryKey(archiveName, relativePath) {
      const archive = text(archiveName).toLowerCase();
      const entry = text(relativePath).replace(/\\/g, "/").toLowerCase();
      if (!archive || !entry || archive === "单独选择的 excel") return "";
      return `${archive}::${entry}`;
    }

    function attachBatchSource(documentData, record) {
      const sourceArchiveEntryKey = createArchiveEntryKey(
        record.archiveName,
        record.relativePath,
      );
      if (!sourceArchiveEntryKey) return documentData;
      return {
        ...documentData,
        sourceArchiveName: record.archiveName,
        sourceRelativePath: record.relativePath,
        sourceArchiveEntryKey,
      };
    }

    function filterPreviouslyImportedArchiveRecords(records, data) {
      const notes = Array.isArray(data?.deliveryNotes)
        ? data.deliveryNotes
        : [];
      const processedEntryKeys = new Set(
        notes
          .flatMap((note) => [
            note.sourceArchiveEntryKey ||
              createArchiveEntryKey(
                note.sourceArchiveName,
                note.sourceRelativePath,
              ),
            ...(Array.isArray(note.sourceArchiveEntryKeys)
              ? note.sourceArchiveEntryKeys
              : []),
          ])
          .filter(Boolean),
      );
      const importedOrderNumbers = new Set(
        notes
          .map((note) => normalizeMatchValue(note.orderNo || note.customerNo))
          .filter(Boolean),
      );
      const pending = [];
      const skipped = [];
      (records || []).forEach((record) => {
        const entryKey = createArchiveEntryKey(
          record.archiveName,
          record.relativePath,
        );
        const orderNumbers = (record.documents || [])
          .map((documentData) =>
            normalizeMatchValue(
              documentData.orderNo || documentData.metadata?.orderNo,
            ),
          )
          .filter(Boolean);
        const processedByOrderNumber =
          orderNumbers.length > 0 &&
          orderNumbers.every((orderNo) => importedOrderNumbers.has(orderNo));
        if (
          (entryKey && processedEntryKeys.has(entryKey)) ||
          processedByOrderNumber
        ) {
          skipped.push(record);
        } else {
          pending.push(record);
        }
      });
      return { pending, skipped };
    }

    function classifyArchiveScreeningRecords(records, skippedRecords = []) {
      const recognized = [];
      const unrecognized = [];
      (records || []).forEach((record) => {
        if (
          record.status === "error" ||
          !Array.isArray(record.documents) ||
          !record.documents.length
        ) {
          unrecognized.push(record);
        } else {
          recognized.push(record);
        }
      });
      return {
        recognized,
        unrecognized,
        filtered: Array.isArray(skippedRecords) ? skippedRecords : [],
      };
    }

    function getArchiveScreeningRecordMessage(record, category) {
      if (category === "filtered") {
        return "以前已成功导入，本次自动过滤";
      }
      if (category === "recognized") {
        return `识别到 ${Number(record.documentCount) || record.documents?.length || 0} 张单据、${Number(record.itemCount) || 0} 条明细`;
      }
      const errors = Array.isArray(record.errors) ? record.errors : [];
      return errors.filter(Boolean).join("；") || "没有识别到有效单据";
    }

    function buildArchiveScreeningRows(records, category) {
      if (!records.length) {
        const emptyText =
          category === "filtered"
            ? "本次没有自动过滤的文件"
            : category === "recognized"
              ? "本次没有识别成功的文件"
              : "本次没有识别失败的文件";
        return `<div class="delivery-import-screening-empty"><i class="fa fa-check-circle-o"></i>${emptyText}</div>`;
      }
      return `
        <div class="delivery-import-screening-list" role="list">
          ${records
            .map(
              (record) => `
                <div class="delivery-import-screening-row" role="listitem">
                  <span class="delivery-import-screening-file-icon is-${category}"><i class="fa ${category === "unrecognized" ? "fa-exclamation-triangle" : category === "filtered" ? "fa-filter" : "fa-file-excel-o"}"></i></span>
                  <span class="delivery-import-screening-file">
                    <strong title="${escapeHTML(record.relativePath || record.fileName)}">${escapeHTML(record.relativePath || record.fileName || "未命名文件")}</strong>
                    <small>${escapeHTML(record.archiveName || "单独选择的 Excel")}</small>
                  </span>
                  <span class="delivery-import-screening-result is-${category}">${escapeHTML(getArchiveScreeningRecordMessage(record, category))}</span>
                </div>`,
            )
            .join("")}
        </div>`;
    }

    function buildArchiveScreeningMarkup(screening) {
      const total =
        screening.recognized.length +
        screening.unrecognized.length +
        screening.filtered.length;
      const tabs = [
        {
          key: "recognized",
          label: "识别成功",
          count: screening.recognized.length,
          icon: "fa-check-circle",
        },
        {
          key: "unrecognized",
          label: "识别失败",
          count: screening.unrecognized.length,
          icon: "fa-exclamation-circle",
        },
        {
          key: "filtered",
          label: "自动过滤",
          count: screening.filtered.length,
          icon: "fa-filter",
        },
      ];
      const activeCategory = screening.unrecognized.length
        ? "unrecognized"
        : screening.filtered.length
          ? "filtered"
          : "recognized";
      return `
        <div id="delivery-import-archive-screening">
          <div class="delivery-import-batch-notice">
            <i class="fa fa-list-alt"></i>
            <div><strong>压缩包解析结果</strong><p>请先查看自动过滤、识别成功和识别失败的文件；确认结果后再进入逐文件核对。</p></div>
          </div>
          <div class="delivery-import-screening-summary">
            <div><span>解析 Excel 总数</span><strong>${total}</strong></div>
            ${tabs
              .map(
                (tab) => `
                  <button type="button" class="delivery-import-screening-tab${tab.key === activeCategory ? " is-active" : ""}" data-archive-screening-tab="${tab.key}" aria-selected="${tab.key === activeCategory ? "true" : "false"}">
                    <i class="fa ${tab.icon}"></i><span>${tab.label}</span><strong>${tab.count}</strong>
                  </button>`,
              )
              .join("")}
          </div>
          <div class="delivery-import-screening-panels">
            ${tabs
              .map(
                (tab) => `
                  <section data-archive-screening-panel="${tab.key}" ${tab.key === activeCategory ? "" : "hidden"}>
                    <div class="delivery-import-screening-heading">
                      <div><h3>${tab.label}文件</h3><p>共 ${tab.count} 个</p></div>
                      <span>${tab.key === "recognized" ? "这些文件将进入逐一核对" : tab.key === "filtered" ? "这些文件不会重复导入" : "这些文件可在核对页排除或后续处理"}</span>
                    </div>
                    ${buildArchiveScreeningRows(screening[tab.key], tab.key)}
                  </section>`,
              )
              .join("")}
          </div>
        </div>`;
    }

    function bindArchiveScreeningEvents() {
      const tabs = Array.from(
        global.document?.querySelectorAll("[data-archive-screening-tab]") || [],
      );
      const panels = Array.from(
        global.document?.querySelectorAll("[data-archive-screening-panel]") ||
          [],
      );
      tabs.forEach((tab) => {
        tab.onclick = () => {
          const category = tab.dataset.archiveScreeningTab;
          tabs.forEach((item) => {
            const selected = item === tab;
            item.classList.toggle("is-active", selected);
            item.setAttribute("aria-selected", String(selected));
          });
          panels.forEach((panel) => {
            panel.hidden = panel.dataset.archiveScreeningPanel !== category;
          });
        };
      });
    }

    function showArchiveScreeningPage(records, skippedRecords = []) {
      const pendingRecords = Array.isArray(records) ? records : [];
      const screening = classifyArchiveScreeningRecords(
        pendingRecords,
        skippedRecords,
      );
      const reviewableCount = pendingRecords.length;
      activeWorkflowState = {
        archiveScreening: screening,
        skippedProcessedCount: screening.filtered.length,
      };
      showImportWorkflowPage({
        title: "检查压缩包解析结果",
        subtitle: "先确认哪些文件已过滤、已识别或未识别，再进入逐文件核对。",
        step: "review",
        content: buildArchiveScreeningMarkup(screening),
        primaryText: reviewableCount
          ? `进入逐文件核对（${reviewableCount} 个）`
          : "完成并返回",
        secondaryText: "取消本次导入",
        onPrimary: () => {
          if (!reviewableCount) {
            returnToImportSettings({ clearState: true });
            return false;
          }
          showBatchReviewPage(pendingRecords, {
            skippedProcessedCount: screening.filtered.length,
          });
          return false;
        },
        onSecondary: () => returnToImportSettings({ clearState: true }),
      });
      bindArchiveScreeningEvents();
      return screening;
    }

    function getBatchRecordMessages(record) {
      return [
        ...(record?.errors || []),
        ...(record?.warnings || []),
        ...(record?.documents || []).flatMap((documentData) => [
          ...(documentData?.errors || []),
          ...(documentData?.warnings || []),
        ]),
      ].filter(Boolean);
    }

    function getFilteredBatchRecords(records, filter, query) {
      const keyword = normalizeMatchValue(query);
      return records.filter((record) => {
        if (filter === "warning" && !getBatchRecordMessages(record).length) {
          return false;
        }
        if (
          filter !== "all" &&
          filter !== "warning" &&
          record.reviewStatus !== filter
        ) {
          return false;
        }
        if (!keyword) return true;
        return normalizeMatchValue(
          `${record.relativePath} ${record.archiveName} ${record.fileName}`,
        ).includes(keyword);
      });
    }

    function getBatchRecordForPage(records, state, page) {
      const filtered = getFilteredBatchRecords(
        records,
        state.batchFilter,
        state.batchQuery,
      );
      const pageCount = Math.max(
        1,
        Math.ceil(filtered.length / BATCH_PAGE_SIZE),
      );
      const normalizedPage = Math.min(Math.max(1, page || 1), pageCount);
      return filtered[(normalizedPage - 1) * BATCH_PAGE_SIZE] || null;
    }

    function getCurrentBatchPageRecords(records, state) {
      const filtered = getFilteredBatchRecords(
        records,
        state.batchFilter,
        state.batchQuery,
      );
      const pageStart =
        (Math.max(1, state.batchPage || 1) - 1) * BATCH_PAGE_SIZE;
      return filtered.slice(pageStart, pageStart + BATCH_PAGE_SIZE);
    }

    function getBatchDirectory(record) {
      const path = text(record?.relativePath).replace(/\\/g, "/");
      const separatorIndex = path.lastIndexOf("/");
      return separatorIndex >= 0
        ? path.slice(0, separatorIndex)
        : "压缩包根目录";
    }

    function isBatchRecordSafeToConfirm(record) {
      return (
        record?.reviewStatus === "pending" &&
        Boolean(record?.documents?.length) &&
        getBatchRecordMessages(record).length === 0
      );
    }

    function confirmSafeBatchRecords(records) {
      let confirmed = 0;
      let skipped = 0;
      records.forEach((record) => {
        if (!isBatchRecordSafeToConfirm(record)) {
          skipped += 1;
          return;
        }
        record.reviewedDocuments =
          record.previewDocuments || record.documents || [];
        record.reviewStatus = "confirmed";
        record.editMode = false;
        confirmed += 1;
      });
      return { confirmed, skipped };
    }

    function rerenderBatchReview(message, type = "success") {
      const state = activeWorkflowState;
      if (!Array.isArray(state?.batchRecords)) return;
      state.selectedRecordIds = (state.selectedRecordIds || []).filter((id) =>
        state.batchRecords.some((record) => record.id === id),
      );
      showBatchReviewPage(state.batchRecords, {
        preserve: true,
        activeRecordId: state.activeRecordId,
        batchPage: state.batchPage,
      });
      if (message) global.showAntdMessage?.(type, message);
    }

    function buildBatchQueueMarkup(records, state) {
      const filtered = getFilteredBatchRecords(
        records,
        state.batchFilter,
        state.batchQuery,
      );
      const pageCount = Math.max(
        1,
        Math.ceil(filtered.length / BATCH_PAGE_SIZE),
      );
      state.batchPage = Math.min(Math.max(1, state.batchPage || 1), pageCount);
      const pageStart = (state.batchPage - 1) * BATCH_PAGE_SIZE;
      const pageRecords = filtered.slice(
        pageStart,
        pageStart + BATCH_PAGE_SIZE,
      );
      const selectedIds = new Set(state.selectedRecordIds || []);
      const rows = pageRecords
        .map((record) => {
          const status = getBatchStatusMeta(record.reviewStatus);
          const selected = record.id === state.activeRecordId;
          const messageCount = getBatchRecordMessages(record).length;
          return `
            <div class="delivery-import-batch-row${selected ? " is-active" : ""}" data-batch-record-id="${escapeHTML(record.id)}">
              <label class="delivery-import-batch-select" title="选择此文件">
                <input type="checkbox" data-batch-select="${escapeHTML(record.id)}" ${selectedIds.has(record.id) ? "checked" : ""} aria-label="选择 ${escapeHTML(record.relativePath)}">
              </label>
              <button type="button" class="delivery-import-batch-row-open" data-batch-open="${escapeHTML(record.id)}" aria-current="${selected ? "true" : "false"}">
                <span class="delivery-import-batch-row-main">
                <strong title="${escapeHTML(record.relativePath)}">${escapeHTML(record.relativePath)}</strong>
                <small>${escapeHTML(batchKindLabel(record))} · ${record.documentCount || 0} 张单据 · ${record.itemCount || 0} 条明细${messageCount ? ` · ${messageCount} 项提醒` : ""}</small>
                </span>
              </button>
              <span class="delivery-import-batch-status ${status.className}" data-batch-status>${status.label}</span>
            </div>`;
        })
        .join("");
      return `
        <div class="delivery-import-batch-toolbar">
          <input id="delivery-import-batch-search" class="delivery-import-control" value="${escapeHTML(state.batchQuery || "")}" placeholder="搜索压缩包内路径或文件名">
          <select id="delivery-import-batch-filter" class="delivery-import-control">
            <option value="all" ${state.batchFilter === "all" ? "selected" : ""}>全部文件</option>
            <option value="pending" ${state.batchFilter === "pending" ? "selected" : ""}>待确认</option>
            <option value="confirmed" ${state.batchFilter === "confirmed" ? "selected" : ""}>已确认</option>
            <option value="error" ${state.batchFilter === "error" ? "selected" : ""}>识别失败</option>
            <option value="warning" ${state.batchFilter === "warning" ? "selected" : ""}>有异常提示</option>
            <option value="excluded" ${state.batchFilter === "excluded" ? "selected" : ""}>已排除</option>
          </select>
        </div>
        <div class="delivery-import-batch-queue">
          <div id="delivery-import-batch-menu">
            ${rows || '<div class="px-4 py-10 text-center text-sm text-gray-500">没有符合条件的文件</div>'}
          </div>
        </div>
        <div class="delivery-import-batch-pagination">
          <span>第 ${state.batchPage}/${pageCount} 页 · ${filtered.length} 个文件</span>
          <span>
            <button type="button" data-batch-page="prev" ${state.batchPage <= 1 ? "disabled" : ""}>上一页</button>
            <button type="button" data-batch-page="next" ${state.batchPage >= pageCount ? "disabled" : ""}>下一页</button>
          </span>
        </div>`;
    }

    function renderBatchNavigationMenu(records, state) {
      const host = global.document?.getElementById(
        "delivery-import-batch-menu",
      );
      const React = global.React;
      const Menu = global.antd?.Menu;
      if (!host || !React || !Menu || !global.ReactDOM) {
        return false;
      }
      const filtered = getFilteredBatchRecords(
        records,
        state.batchFilter,
        state.batchQuery,
      );
      const pageStart = (state.batchPage - 1) * BATCH_PAGE_SIZE;
      const pageRecords = filtered.slice(
        pageStart,
        pageStart + BATCH_PAGE_SIZE,
      );
      const selectedIds = new Set(state.selectedRecordIds || []);
      const items = pageRecords.map((record) => {
        const status = getBatchStatusMeta(record.reviewStatus);
        const messageCount = getBatchRecordMessages(record).length;
        return {
          key: record.id,
          icon: React.createElement("i", {
            className: "fa fa-file-excel-o",
            "aria-hidden": "true",
          }),
          label: React.createElement(
            "div",
            {
              className: "delivery-import-batch-menu-label",
              "data-batch-record-id": record.id,
            },
            React.createElement("input", {
              type: "checkbox",
              className: "delivery-import-batch-select-input",
              checked: selectedIds.has(record.id),
              "aria-label": `选择 ${record.relativePath}`,
              onClick: (event) => event.stopPropagation(),
              onChange: (event) => {
                const next = new Set(state.selectedRecordIds || []);
                if (event.target.checked) next.add(record.id);
                else next.delete(record.id);
                state.selectedRecordIds = Array.from(next);
                const count = global.document?.getElementById(
                  "delivery-import-batch-selected-count",
                );
                if (count) count.textContent = String(next.size);
              },
            }),
            React.createElement(
              "span",
              { className: "delivery-import-batch-row-main" },
              React.createElement(
                "strong",
                { title: record.relativePath },
                record.relativePath,
              ),
              React.createElement(
                "small",
                null,
                `${batchKindLabel(record)} · ${record.documentCount || 0} 张单据 · ${record.itemCount || 0} 条明细${messageCount ? ` · ${messageCount} 项提醒` : ""}`,
              ),
            ),
            React.createElement(
              "span",
              {
                className: `delivery-import-batch-status ${status.className}`,
                "data-batch-status": "true",
              },
              status.label,
            ),
          ),
        };
      });
      if (!batchNavigationRoot || batchNavigationHost !== host) {
        if (typeof global.ReactDOM.createRoot === "function") {
          batchNavigationRoot = global.ReactDOM.createRoot(host);
        } else if (typeof global.ReactDOM.render === "function") {
          batchNavigationRoot = {
            render(node) {
              global.ReactDOM.render(node, host);
            },
            unmount() {
              global.ReactDOM.unmountComponentAtNode?.(host);
            },
          };
        } else {
          return false;
        }
        batchNavigationHost = host;
      }
      batchNavigationRoot.render(
        React.createElement(Menu, {
          mode: "inline",
          items,
          selectedKeys: state.activeRecordId ? [state.activeRecordId] : [],
          inlineIndent: 12,
          onClick: ({ key }) => openBatchRecord(String(key)),
        }),
      );
      return true;
    }

    function revealActiveBatchRecord() {
      const reveal = () => {
        const queue = global.document?.querySelector(
          ".delivery-import-batch-queue",
        );
        const activeRow = queue?.querySelector(
          ".delivery-import-batch-row.is-active, .ant-menu-item-selected, .ant-menu-item-selected [data-batch-record-id]",
        );
        if (!queue || !activeRow) return;

        const queueRect = queue.getBoundingClientRect?.();
        const rowRect = activeRow.getBoundingClientRect?.();
        if (!queueRect || !rowRect) return;
        if (rowRect.top < queueRect.top) {
          queue.scrollTop -= queueRect.top - rowRect.top;
        } else if (rowRect.bottom > queueRect.bottom) {
          queue.scrollTop += rowRect.bottom - queueRect.bottom;
        }
      };
      reveal();
      global.requestAnimationFrame?.(reveal);
    }

    function showImportConfirm(options = {}) {
      if (typeof global.showAntdConfirm === "function") {
        return global.showAntdConfirm(options);
      }
      const document = global.document;
      if (!document?.body) return Promise.resolve(false);
      return new Promise((resolve) => {
        document.getElementById("delivery-import-confirm-dialog")?.remove();
        const content = Array.isArray(options.content)
          ? options.content
          : [options.content];
        const overlay = document.createElement("div");
        overlay.id = "delivery-import-confirm-dialog";
        overlay.className = "delivery-import-confirm-overlay";
        overlay.innerHTML = `
          <div class="delivery-import-confirm-card" role="dialog" aria-modal="true" aria-labelledby="delivery-import-confirm-title">
            <span class="delivery-import-confirm-icon"><i class="fa fa-exclamation-triangle"></i></span>
            <div class="delivery-import-confirm-copy">
              <h3 id="delivery-import-confirm-title">${escapeHTML(options.title || "请确认")}</h3>
              ${content
                .filter(Boolean)
                .map((line) => `<p>${escapeHTML(line)}</p>`)
                .join("")}
            </div>
            <div class="delivery-import-confirm-actions">
              <button type="button" data-import-confirm-cancel>${escapeHTML(options.cancelText || "取消")}</button>
              <button type="button" class="is-danger" data-import-confirm-ok>${escapeHTML(options.okText || "确定")}</button>
            </div>
          </div>`;
        document.body.appendChild(overlay);
        const finish = (value) => {
          document.removeEventListener("keydown", onKeyDown);
          overlay.remove();
          resolve(value);
        };
        const onKeyDown = (event) => {
          if (event.key === "Escape") finish(false);
        };
        document.addEventListener("keydown", onKeyDown);
        overlay.querySelector("[data-import-confirm-cancel]").onclick = () =>
          finish(false);
        overlay.querySelector("[data-import-confirm-ok]").onclick = () =>
          finish(true);
        overlay.onclick = (event) => {
          if (event.target === overlay) finish(false);
        };
        overlay.querySelector("[data-import-confirm-cancel]")?.focus();
      });
    }

    function buildBatchDocumentPreview(documentData, documentIndex) {
      const metadata = documentData.metadata || {};
      const orderNo = documentData.orderNo || metadata.orderNo || "-";
      const issueDate = documentData.issueDate || metadata.issueDate || "-";
      const companyName =
        documentData.companyName || metadata.companyName || "未提供";
      const customerName =
        documentData.customerName || metadata.customerName || "未提供";
      const customerContact =
        documentData.customerContact || metadata.customerContact || "-";
      const customerPhone =
        documentData.customerPhone || metadata.customerPhone || "-";
      const customerAddress =
        documentData.customerAddress || metadata.customerAddress || "-";
      const paymentTerms =
        documentData.paymentTerms || metadata.paymentTerms || "-";
      const items = documentData.items || [];
      const totalAmount = items.reduce(
        (sum, item) =>
          sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
        0,
      );
      return `
        <article class="delivery-import-file-preview" data-batch-preview-document="${documentIndex}">
          <div class="delivery-import-file-preview-heading">
            <div>
              <span>单据 ${documentIndex + 1}</span>
              <strong>${escapeHTML(orderNo)}</strong>
            </div>
            <div class="delivery-import-file-preview-total">合计 ¥${roundMoney(totalAmount).toFixed(2)}</div>
          </div>
          <dl class="delivery-import-file-preview-meta">
            <div><dt>制单日期</dt><dd>${escapeHTML(issueDate)}</dd></div>
            <div><dt>发货公司</dt><dd>${escapeHTML(companyName)}</dd></div>
            <div><dt>客户</dt><dd>${escapeHTML(customerName)}</dd></div>
            <div><dt>价格类型</dt><dd>${documentData.priceTaxMode === "inclusive" ? "含税价" : "未税价"}</dd></div>
            <div><dt>联系人</dt><dd>${escapeHTML(customerContact)}</dd></div>
            <div><dt>联系电话</dt><dd>${escapeHTML(customerPhone)}</dd></div>
            <div><dt>结款方式</dt><dd>${escapeHTML(paymentTerms)}</dd></div>
            <div class="delivery-import-file-preview-wide"><dt>客户地址</dt><dd>${escapeHTML(customerAddress)}</dd></div>
          </dl>
          <div class="delivery-import-table-wrap delivery-import-file-preview-table">
            <table class="delivery-import-table">
              <thead><tr><th>商品名称</th><th>规格</th><th>单位</th><th>数量</th><th>单价</th><th>金额</th><th>备注</th></tr></thead>
              <tbody>
                ${items
                  .map(
                    (item) => `<tr>
                      <td>${escapeHTML(item.productName || "-")}</td>
                      <td>${escapeHTML(item.specification || "-")}</td>
                      <td>${escapeHTML(item.unit || "-")}</td>
                      <td>${escapeHTML(item.quantity)}</td>
                      <td>¥${roundMoney(Number(item.unitPrice || 0)).toFixed(2)}</td>
                      <td>¥${roundMoney(Number(item.quantity || 0) * Number(item.unitPrice || 0)).toFixed(2)}</td>
                      <td>${escapeHTML(item.notes || "-")}</td>
                    </tr>`,
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        </article>`;
    }

    function buildBatchDetailMarkup(record, data) {
      if (!record) {
        return '<div class="delivery-import-batch-empty">请选择左侧文件进行核对。</div>';
      }
      const status = getBatchStatusMeta(record.reviewStatus);
      const messages = getBatchRecordMessages(record);
      if (record.reviewStatus === "error") {
        return `
          <div class="delivery-import-batch-detail-heading">
            <div><span class="delivery-import-batch-status ${status.className}">${status.label}</span><h3>${escapeHTML(record.relativePath)}</h3></div>
            <button type="button" class="delivery-import-batch-danger" data-batch-exclude>确认排除此文件</button>
          </div>
          <div class="delivery-import-batch-error"><i class="fa fa-exclamation-triangle"></i><div><strong>此文件无法安全自动识别</strong>${messages.map((message) => `<p>${escapeHTML(message)}</p>`).join("")}</div></div>
          <p class="mt-3 text-xs leading-5 text-gray-500">最终导入前，必须先修正模板后重新选择压缩包，或明确排除此文件；系统不会静默跳过。</p>`;
      }
      if (record.reviewStatus === "excluded") {
        return `
          <div class="delivery-import-batch-detail-heading">
            <div><span class="delivery-import-batch-status ${status.className}">${status.label}</span><h3>${escapeHTML(record.relativePath)}</h3></div>
            <button type="button" class="delivery-import-batch-secondary" data-batch-restore>恢复核对</button>
          </div>
          <div class="delivery-import-batch-empty">该文件已明确排除，不会写入系统。</div>`;
      }
      const isEditing = record.editMode === true;
      const previewDocuments =
        record.previewDocuments || record.reviewedDocuments || record.documents;
      const formMarkup = (record.documents || [])
        .map((documentData, index) =>
          buildDocumentMarkup(documentData, index, data),
        )
        .join("");
      return `
        <div class="delivery-import-batch-detail-heading">
          <div>
            <span class="delivery-import-batch-status ${status.className}" data-batch-active-status>${status.label}</span>
            <h3>${escapeHTML(record.relativePath)}</h3>
            <p>${escapeHTML(record.archiveName || "单独选择")} · ${record.documentCount || 0} 张单据 · ${record.itemCount || 0} 条明细</p>
          </div>
          <div class="delivery-import-batch-detail-actions">
            ${
              isEditing
                ? `<button type="button" class="delivery-import-batch-secondary" data-batch-edit-cancel>取消编辑</button>
                   <button type="button" class="delivery-import-batch-confirm" data-batch-edit-save>保存修改并返回预览</button>`
                : `<button type="button" class="delivery-import-batch-danger" data-batch-exclude>排除此文件</button>
                   <button type="button" class="delivery-import-batch-secondary" data-batch-edit>编辑</button>
                   <button type="button" class="delivery-import-batch-confirm" data-batch-confirm>${record.reviewStatus === "confirmed" ? "再次确认并下一份" : "确认此文件并下一份"}</button>`
            }
          </div>
        </div>
        <div class="delivery-import-batch-mode-note">
          <i class="fa ${isEditing ? "fa-pencil" : "fa-eye"}"></i>
          <span>${isEditing ? "编辑模式：保存修改后会返回预览，仍需再次确认此文件。" : "预览模式：请先检查解析结果；需要调整时再进入编辑模式。"}</span>
        </div>
        <div class="delivery-import-batch-shortcuts" aria-label="键盘快捷键">
          <span><kbd>Enter</kbd> 确认并下一份</span>
          <span><kbd>E</kbd> 编辑</span>
          <span><kbd>Esc</kbd> 退出编辑</span>
          <span><kbd>Alt</kbd> + <kbd>X</kbd> 排除此文件</span>
        </div>
        <div id="delivery-import-batch-preview" class="${isEditing ? "hidden" : ""}">
          ${(previewDocuments || []).map(buildBatchDocumentPreview).join("")}
        </div>
        <div id="delivery-import-batch-detail-form" class="${isEditing ? "" : "hidden"}" aria-hidden="${isEditing ? "false" : "true"}">
          ${formMarkup}
        </div>`;
    }

    function updateBatchPrimaryState() {
      if (!Array.isArray(activeWorkflowState?.batchRecords)) return;
      const counts = getBatchCounts(activeWorkflowState.batchRecords);
      const primary = global.document?.getElementById(
        "delivery-import-workflow-primary",
      );
      const partial = global.document?.getElementById(
        "delivery-import-workflow-partial",
      );
      if (primary) {
        primary.disabled = counts.unresolved > 0 || counts.confirmed === 0;
        primary.textContent = counts.unresolved
          ? `全部文件确认后可预览（还剩 ${counts.unresolved} 个）`
          : `预览已确认文件（${counts.confirmed} 个）`;
      }
      if (partial) {
        const canImportPartial = counts.confirmed > 0 && counts.unresolved > 0;
        partial.classList.toggle("hidden", !canImportPartial);
        partial.disabled = !canImportPartial;
        partial.textContent = `暂时导入已确认文件（${counts.confirmed} 个）`;
      }
      Object.entries(counts).forEach(([name, value]) => {
        const element = global.document?.querySelector(
          `[data-batch-count="${name}"]`,
        );
        if (element) element.textContent = String(value);
      });
      const activeRecord = activeWorkflowState.batchRecords.find(
        (record) => record.id === activeWorkflowState.activeRecordId,
      );
      if (activeRecord) {
        const meta = getBatchStatusMeta(activeRecord.reviewStatus);
        global.document
          ?.querySelectorAll(
            `[data-batch-record-id="${activeRecord.id}"] [data-batch-status], [data-batch-active-status]`,
          )
          .forEach((element) => {
            element.textContent = meta.label;
            element.className = `delivery-import-batch-status ${meta.className}`;
          });
      }
    }

    function saveActiveBatchRecordForm() {
      if (!Array.isArray(activeWorkflowState?.batchRecords)) return;
      const record = activeWorkflowState.batchRecords.find(
        (item) => item.id === activeWorkflowState.activeRecordId,
      );
      const form = global.document?.getElementById(
        "delivery-import-batch-detail-form",
      );
      if (record?.editMode) {
        record.editMode = false;
        return;
      }
      if (record && form) record.formState = captureReviewFormState(form);
    }

    function findNextBatchRecord(records, currentId) {
      const currentIndex = Math.max(
        0,
        records.findIndex((record) => record.id === currentId),
      );
      for (let offset = 1; offset <= records.length; offset += 1) {
        const record = records[(currentIndex + offset) % records.length];
        if (["pending", "error"].includes(record.reviewStatus)) return record;
      }
      return records[currentIndex] || records[0];
    }

    function getConfirmedBatchDocuments(records) {
      return records
        .filter((record) => record.reviewStatus === "confirmed")
        .flatMap((record) => record.reviewedDocuments || []);
    }

    function getImportItemMergeKey(item) {
      return JSON.stringify([
        normalizeMatchValue(item.productName),
        normalizeMatchValue(item.specification),
        normalizeMatchValue(item.unit),
        Number(item.quantity) || 0,
        roundMoney(Number(item.unitPrice) || 0),
        normalizeMatchValue(item.notes),
      ]);
    }

    function getDocumentSourceValues(documentData, pluralKey, singleKey) {
      return Array.from(
        new Set(
          [
            ...(Array.isArray(documentData[pluralKey])
              ? documentData[pluralKey]
              : []),
            documentData[singleKey],
          ]
            .map((value) => text(value))
            .filter(Boolean),
        ),
      );
    }

    function mergeDocumentsByOrderNumber(documents) {
      const groups = new Map();
      const passthrough = [];
      const fillableFields = [
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
        "importKind",
        "statementGroupId",
        "statementMeta",
      ];

      (documents || []).forEach((documentData, index) => {
        const key = normalizeMatchValue(documentData.orderNo);
        if (!key) {
          passthrough.push({
            ...documentData,
            items: (documentData.items || []).map((item) => ({ ...item })),
          });
          return;
        }

        if (!groups.has(key)) {
          const sourceFileNames = getDocumentSourceValues(
            documentData,
            "sourceFileNames",
            "sourceFileName",
          );
          const sourceRelativePaths = getDocumentSourceValues(
            documentData,
            "sourceRelativePaths",
            "sourceRelativePath",
          );
          const sourceArchiveEntryKeys = getDocumentSourceValues(
            documentData,
            "sourceArchiveEntryKeys",
            "sourceArchiveEntryKey",
          );
          const merged = {
            ...documentData,
            items: (documentData.items || []).map((item) => ({ ...item })),
            sourceFileNames,
            sourceRelativePaths,
            sourceArchiveEntryKeys,
            mergedSourceCount: Math.max(
              1,
              Number(documentData.mergedSourceCount) || 1,
            ),
            mergedDuplicateItemCount:
              Number(documentData.mergedDuplicateItemCount) || 0,
          };
          groups.set(key, {
            index,
            document: merged,
            itemKeys: new Set(merged.items.map(getImportItemMergeKey)),
          });
          return;
        }

        const group = groups.get(key);
        const merged = group.document;
        merged.mergedSourceCount += Math.max(
          1,
          Number(documentData.mergedSourceCount) || 1,
        );
        fillableFields.forEach((field) => {
          if (missing(merged[field]) && !missing(documentData[field])) {
            merged[field] = documentData[field];
          }
        });
        [
          ["sourceFileNames", "sourceFileName"],
          ["sourceRelativePaths", "sourceRelativePath"],
          ["sourceArchiveEntryKeys", "sourceArchiveEntryKey"],
        ].forEach(([pluralKey, singleKey]) => {
          merged[pluralKey] = Array.from(
            new Set([
              ...(merged[pluralKey] || []),
              ...getDocumentSourceValues(documentData, pluralKey, singleKey),
            ]),
          );
        });
        (documentData.items || []).forEach((item) => {
          const itemKey = getImportItemMergeKey(item);
          if (group.itemKeys.has(itemKey)) {
            merged.mergedDuplicateItemCount += 1;
            return;
          }
          group.itemKeys.add(itemKey);
          merged.items.push({ ...item });
        });
      });

      const groupedDocuments = Array.from(groups.values())
        .sort((left, right) => left.index - right.index)
        .map(({ document }) => ({
          ...document,
          sourceFileName:
            document.sourceFileNames[0] || document.sourceFileName || "",
          sourceRelativePath:
            document.sourceRelativePaths[0] ||
            document.sourceRelativePath ||
            "",
          sourceArchiveEntryKey:
            document.sourceArchiveEntryKeys[0] ||
            document.sourceArchiveEntryKey ||
            "",
        }));
      const mergedDocuments = [...groupedDocuments, ...passthrough];
      const mergedGroups = mergedDocuments.filter(
        (documentData) => Number(documentData.mergedSourceCount) > 1,
      );
      return {
        documents: mergedDocuments,
        mergedOrderNumbers: mergedGroups.map(
          (documentData) => documentData.orderNo,
        ),
        mergedDocumentCount: mergedGroups.reduce(
          (sum, documentData) =>
            sum + Math.max(0, Number(documentData.mergedSourceCount) - 1),
          0,
        ),
        skippedDuplicateItemCount: mergedGroups.reduce(
          (sum, documentData) =>
            sum + Number(documentData.mergedDuplicateItemCount || 0),
          0,
        ),
      };
    }

    function getMergeSummaryMessage(summary) {
      if (!summary?.mergedDocumentCount) return "";
      const orderNumbers = summary.mergedOrderNumbers || [];
      const visibleOrders = orderNumbers.slice(0, 8).join("、");
      const remaining = Math.max(0, orderNumbers.length - 8);
      return `检测到 ${summary.mergedDocumentCount} 个重复单号文件，已按单号自动合并为 ${orderNumbers.length} 张送货单（${visibleOrders}${remaining ? ` 等 ${orderNumbers.length} 个单号` : ""}）。${summary.skippedDuplicateItemCount ? `同时去除 ${summary.skippedDuplicateItemCount} 条完全重复的商品明细。` : ""}`;
    }

    function advanceBatchToImportPreview({ allowPartial = false } = {}) {
      saveActiveBatchRecordForm();
      const records = activeWorkflowState?.batchRecords || [];
      const counts = getBatchCounts(records);
      if (counts.unresolved && !allowPartial) {
        global.alert?.(
          `还有 ${counts.unresolved} 个文件未确认或未处理，暂不能导入。`,
        );
        updateBatchPrimaryState();
        return false;
      }
      const documents = getConfirmedBatchDocuments(records);
      if (!documents.length) {
        global.alert?.("没有已确认的文件可导入。");
        updateBatchPrimaryState();
        return false;
      }
      const mergeSummary = mergeDocumentsByOrderNumber(documents);
      const mergedDocuments = mergeSummary.documents;
      const mergeMessage = getMergeSummaryMessage(mergeSummary);
      if (mergeMessage) global.showAntdMessage?.("info", mergeMessage);
      activeWorkflowState.documents = mergedDocuments;
      activeWorkflowState.documentCount = mergedDocuments.length;
      activeWorkflowState.mergeSummary = mergeSummary;
      showImportPlanPage(mergedDocuments, null, mergedDocuments.length, {
        partialBatch: allowPartial && counts.unresolved > 0,
        mergeSummary,
      });
      return false;
    }

    function openBatchRecord(recordId) {
      const state = activeWorkflowState;
      if (!Array.isArray(state?.batchRecords)) return;
      if (!state.batchRecords.some((record) => record.id === recordId)) return;
      saveActiveBatchRecordForm();
      state.activeRecordId = recordId;
      showBatchReviewPage(state.batchRecords, {
        preserve: true,
        activeRecordId: recordId,
      });
    }

    function bindBatchReviewEvents() {
      const state = activeWorkflowState;
      if (!Array.isArray(state?.batchRecords)) return;
      global.document
        ?.querySelectorAll("[data-batch-select]")
        .forEach((checkbox) => {
          checkbox.onchange = (event) => {
            event.stopPropagation();
            const next = new Set(state.selectedRecordIds || []);
            if (checkbox.checked) next.add(checkbox.dataset.batchSelect);
            else next.delete(checkbox.dataset.batchSelect);
            state.selectedRecordIds = Array.from(next);
            const count = global.document?.getElementById(
              "delivery-import-batch-selected-count",
            );
            if (count) count.textContent = String(next.size);
          };
        });
      global.document
        ?.querySelectorAll("[data-batch-open]")
        .forEach((button) => {
          button.onclick = () => openBatchRecord(button.dataset.batchOpen);
        });
      const selectPage = global.document?.getElementById(
        "delivery-import-batch-select-page",
      );
      if (selectPage) {
        selectPage.onchange = () => {
          const next = new Set(state.selectedRecordIds || []);
          getCurrentBatchPageRecords(state.batchRecords, state).forEach(
            (record) => {
              if (selectPage.checked) next.add(record.id);
              else next.delete(record.id);
            },
          );
          state.selectedRecordIds = Array.from(next);
          rerenderBatchReview();
        };
      }
      const confirmPageButton = global.document?.getElementById(
        "delivery-import-batch-confirm-page",
      );
      if (confirmPageButton) {
        confirmPageButton.onclick = () => {
          saveActiveBatchRecordForm();
          const result = confirmSafeBatchRecords(
            getCurrentBatchPageRecords(state.batchRecords, state),
          );
          rerenderBatchReview(
            result.confirmed
              ? `本页已批量确认 ${result.confirmed} 个无异常文件${result.skipped ? `，跳过 ${result.skipped} 个需人工检查的文件` : ""}。`
              : "本页没有可自动确认的无异常文件。",
            result.confirmed ? "success" : "warning",
          );
        };
      }
      const confirmDirectoryButton = global.document?.getElementById(
        "delivery-import-batch-confirm-directory",
      );
      if (confirmDirectoryButton) {
        confirmDirectoryButton.onclick = () => {
          saveActiveBatchRecordForm();
          const activeRecord = state.batchRecords.find(
            (record) => record.id === state.activeRecordId,
          );
          const directory = getBatchDirectory(activeRecord);
          const records = state.batchRecords.filter(
            (record) => getBatchDirectory(record) === directory,
          );
          const result = confirmSafeBatchRecords(records);
          rerenderBatchReview(
            result.confirmed
              ? `“${directory}”已确认 ${result.confirmed} 个无异常文件${result.skipped ? `，跳过 ${result.skipped} 个需人工检查的文件` : ""}。`
              : `“${directory}”没有可自动确认的无异常文件。`,
            result.confirmed ? "success" : "warning",
          );
        };
      }
      const confirmSelectedButton = global.document?.getElementById(
        "delivery-import-batch-confirm-selected",
      );
      if (confirmSelectedButton) {
        confirmSelectedButton.onclick = () => {
          saveActiveBatchRecordForm();
          const selectedIds = new Set(state.selectedRecordIds || []);
          const selectedRecords = state.batchRecords.filter((record) =>
            selectedIds.has(record.id),
          );
          if (!selectedRecords.length) {
            global.showAntdMessage?.("warning", "请先勾选要处理的文件。");
            return;
          }
          const result = confirmSafeBatchRecords(selectedRecords);
          state.selectedRecordIds = [];
          rerenderBatchReview(
            result.confirmed
              ? `已确认 ${result.confirmed} 个选中的无异常文件${result.skipped ? `，跳过 ${result.skipped} 个需人工检查的文件` : ""}。`
              : `选中的 ${result.skipped} 个文件均需人工检查，未执行批量确认。`,
            result.confirmed ? "success" : "warning",
          );
        };
      }
      const excludeSelectedButton = global.document?.getElementById(
        "delivery-import-batch-exclude-selected",
      );
      if (excludeSelectedButton) {
        excludeSelectedButton.onclick = async () => {
          const selectedIds = new Set(state.selectedRecordIds || []);
          const selectedRecords = state.batchRecords.filter(
            (record) =>
              selectedIds.has(record.id) && record.reviewStatus !== "confirmed",
          );
          if (!selectedRecords.length) {
            global.showAntdMessage?.(
              "warning",
              "请勾选尚未确认、需要排除的文件。",
            );
            return;
          }
          const confirmed = await showImportConfirm({
            title: `排除选中的 ${selectedRecords.length} 个文件？`,
            content:
              "排除后这些文件不会写入系统；已确认文件不会被此批量操作影响。",
            okText: "确认批量排除",
            cancelText: "继续核对",
            okType: "danger",
          });
          if (!confirmed) return;
          selectedRecords.forEach((record) => {
            record.reviewedDocuments = null;
            record.reviewStatus = "excluded";
            record.editMode = false;
          });
          state.selectedRecordIds = [];
          rerenderBatchReview(
            `已排除 ${selectedRecords.length} 个文件，已确认文件保持不变。`,
          );
        };
      }
      const search = global.document?.getElementById(
        "delivery-import-batch-search",
      );
      if (search) {
        search.onchange = () => {
          saveActiveBatchRecordForm();
          state.batchQuery = search.value;
          state.batchPage = 1;
          const firstRecord = getBatchRecordForPage(
            state.batchRecords,
            state,
            1,
          );
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: firstRecord?.id,
            batchPage: 1,
          });
        };
        search.onkeydown = (event) => {
          if (event.key === "Enter") search.onchange();
        };
      }
      const filter = global.document?.getElementById(
        "delivery-import-batch-filter",
      );
      if (filter) {
        filter.onchange = () => {
          saveActiveBatchRecordForm();
          state.batchFilter = filter.value;
          state.batchPage = 1;
          const firstRecord = getBatchRecordForPage(
            state.batchRecords,
            state,
            1,
          );
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: firstRecord?.id,
            batchPage: 1,
          });
        };
      }
      global.document
        ?.querySelectorAll("[data-batch-page]")
        .forEach((button) => {
          button.onclick = () => {
            saveActiveBatchRecordForm();
            const targetPage =
              state.batchPage + (button.dataset.batchPage === "next" ? 1 : -1);
            const firstRecord = getBatchRecordForPage(
              state.batchRecords,
              state,
              targetPage,
            );
            showBatchReviewPage(state.batchRecords, {
              preserve: true,
              activeRecordId: firstRecord?.id,
              batchPage: targetPage,
            });
          };
        });
      const activeRecord = state.batchRecords.find(
        (record) => record.id === state.activeRecordId,
      );
      const detailForm = global.document?.getElementById(
        "delivery-import-batch-detail-form",
      );
      const editButton = global.document?.querySelector("[data-batch-edit]");
      if (editButton && activeRecord) {
        editButton.onclick = () => {
          activeRecord.editMode = true;
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: activeRecord.id,
          });
        };
      }
      const cancelEditButton = global.document?.querySelector(
        "[data-batch-edit-cancel]",
      );
      if (cancelEditButton && activeRecord) {
        cancelEditButton.onclick = () => {
          activeRecord.editMode = false;
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: activeRecord.id,
          });
        };
      }
      const saveEditButton = global.document?.querySelector(
        "[data-batch-edit-save]",
      );
      if (saveEditButton && activeRecord) {
        saveEditButton.onclick = () => {
          const reviewed = collectReviewedDocuments(
            detailForm,
            activeRecord.documents,
          );
          if (!reviewed.ok) {
            global.alert?.(reviewed.message);
            return;
          }
          activeRecord.formState = captureReviewFormState(detailForm);
          activeRecord.previewDocuments = reviewed.documents;
          activeRecord.reviewedDocuments = null;
          activeRecord.reviewStatus = "pending";
          activeRecord.editMode = false;
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: activeRecord.id,
          });
        };
      }
      const confirmButton = global.document?.querySelector(
        "[data-batch-confirm]",
      );
      if (confirmButton && activeRecord) {
        confirmButton.onclick = () => {
          const reviewed = collectReviewedDocuments(
            detailForm,
            activeRecord.documents,
          );
          if (!reviewed.ok) {
            global.alert?.(reviewed.message);
            return;
          }
          activeRecord.formState = captureReviewFormState(detailForm);
          activeRecord.reviewedDocuments = reviewed.documents;
          activeRecord.reviewStatus = "confirmed";
          const next = findNextBatchRecord(state.batchRecords, activeRecord.id);
          state.activeRecordId = next?.id || activeRecord.id;
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: state.activeRecordId,
          });
        };
      }
      const excludeButton = global.document?.querySelector(
        "[data-batch-exclude]",
      );
      if (excludeButton && activeRecord) {
        excludeButton.onclick = async () => {
          excludeButton.disabled = true;
          const confirmed = await showImportConfirm({
            title: "排除此文件？",
            content: `确认排除“${activeRecord.fileName}”？排除后，该文件不会写入系统。`,
            okText: "确认排除",
            cancelText: "继续核对",
            okType: "danger",
          });
          if (!confirmed) {
            excludeButton.disabled = false;
            return;
          }
          activeRecord.formState = detailForm
            ? captureReviewFormState(detailForm)
            : activeRecord.formState;
          activeRecord.reviewedDocuments = null;
          activeRecord.reviewStatus = "excluded";
          const next = findNextBatchRecord(state.batchRecords, activeRecord.id);
          state.activeRecordId = next?.id || activeRecord.id;
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: state.activeRecordId,
          });
        };
      }
      const restoreButton = global.document?.querySelector(
        "[data-batch-restore]",
      );
      if (restoreButton && activeRecord) {
        restoreButton.onclick = () => {
          activeRecord.reviewStatus = activeRecord.documents?.length
            ? "pending"
            : "error";
          showBatchReviewPage(state.batchRecords, {
            preserve: true,
            activeRecordId: activeRecord.id,
          });
        };
      }
      const partialButton = global.document?.getElementById(
        "delivery-import-workflow-partial",
      );
      if (partialButton) {
        partialButton.onclick = async () => {
          const counts = getBatchCounts(state.batchRecords);
          if (!counts.confirmed) return;
          const confirmed = await showImportConfirm({
            title: `暂时导入已确认的 ${counts.confirmed} 个文件？`,
            content: `本次只会进入已确认文件的最终预览；剩余 ${counts.unresolved} 个待确认或失败文件不会保存，也不会写入系统。下次上传同一压缩包时，已成功导入的文件会自动过滤。`,
            okText: "预览已确认文件",
            cancelText: "继续核对",
            okType: "primary",
          });
          if (confirmed) {
            advanceBatchToImportPreview({ allowPartial: true });
          }
        };
      }
      updateBatchPrimaryState();
      bindBatchReviewKeyboard();
    }

    function bindBatchReviewKeyboard() {
      if (global.document?.documentElement?.dataset.batchKeyboardBound) return;
      global.document.documentElement.dataset.batchKeyboardBound = "true";
      global.document.addEventListener("keydown", (event) => {
        if (!Array.isArray(activeWorkflowState?.batchRecords)) return;
        const workflow = global.document.getElementById(
          "history-import-workflow",
        );
        if (!workflow || workflow.classList.contains("hidden")) return;
        if (
          event.target?.closest?.(
            "input, select, textarea, button, [contenteditable=true], .ant-modal-root",
          )
        ) {
          return;
        }
        let button = null;
        if (event.key === "Enter") {
          button = global.document.querySelector("[data-batch-confirm]");
        } else if (event.key.toLowerCase() === "e") {
          button = global.document.querySelector("[data-batch-edit]");
        } else if (event.key === "Escape") {
          button = global.document.querySelector("[data-batch-edit-cancel]");
        } else if (event.altKey && event.key.toLowerCase() === "x") {
          button = global.document.querySelector("[data-batch-exclude]");
        }
        if (!button || button.disabled) return;
        event.preventDefault();
        button.click();
      });
    }

    function showBatchReviewPage(records, options = {}) {
      const data = global.mockData || {};
      const previous = options.preserve ? activeWorkflowState || {} : {};
      const currentQueue = global.document?.querySelector(
        ".delivery-import-batch-queue",
      );
      const batchQueueScrollTop = options.preserve
        ? Number(currentQueue?.scrollTop) ||
          Number(previous.batchQueueScrollTop) ||
          0
        : 0;
      const preparedRecords = options.preserve
        ? records
        : records.map((record, index) => ({
            ...record,
            id: `batch-file-${index + 1}`,
            reviewStatus:
              record.status === "error" || !record.documents?.length
                ? "error"
                : "pending",
            editMode: false,
            documents: (record.documents || []).map((documentData) =>
              enrichMatches(attachBatchSource(documentData, record), data),
            ),
          }));
      const hasRequestedActiveRecord = Object.prototype.hasOwnProperty.call(
        options,
        "activeRecordId",
      );
      let activeRecordId =
        (hasRequestedActiveRecord
          ? options.activeRecordId
          : previous.activeRecordId) ||
        preparedRecords.find((record) =>
          ["pending", "error"].includes(record.reviewStatus),
        )?.id ||
        preparedRecords[0]?.id;
      if (!preparedRecords.some((record) => record.id === activeRecordId)) {
        activeRecordId = preparedRecords[0]?.id;
      }
      const batchFilter = previous.batchFilter || "all";
      const batchQuery = previous.batchQuery || "";
      const filteredRecords = getFilteredBatchRecords(
        preparedRecords,
        batchFilter,
        batchQuery,
      );
      const pageCount = Math.max(
        1,
        Math.ceil(filteredRecords.length / BATCH_PAGE_SIZE),
      );
      let batchPage = Math.min(
        Math.max(1, Number(options.batchPage || previous.batchPage || 1)),
        pageCount,
      );
      const activeFilteredIndex = filteredRecords.findIndex(
        (record) => record.id === activeRecordId,
      );
      if (hasRequestedActiveRecord && activeFilteredIndex >= 0) {
        batchPage = Math.floor(activeFilteredIndex / BATCH_PAGE_SIZE) + 1;
      }
      const pageStart = (batchPage - 1) * BATCH_PAGE_SIZE;
      const pageRecords = filteredRecords.slice(
        pageStart,
        pageStart + BATCH_PAGE_SIZE,
      );
      if (!pageRecords.some((record) => record.id === activeRecordId)) {
        activeRecordId = pageRecords[0]?.id;
      }
      activeWorkflowState = {
        ...previous,
        batchRecords: preparedRecords,
        activeRecordId,
        batchFilter,
        batchQuery,
        batchPage,
        batchQueueScrollTop,
        selectedRecordIds: (previous.selectedRecordIds || []).filter((id) =>
          preparedRecords.some((record) => record.id === id),
        ),
        skippedProcessedCount:
          Number(options.skippedProcessedCount) ||
          Number(previous.skippedProcessedCount) ||
          0,
        documentCount: preparedRecords.reduce(
          (sum, record) => sum + (Number(record.documentCount) || 0),
          0,
        ),
      };
      const counts = getBatchCounts(preparedRecords);
      const activeRecord = preparedRecords.find(
        (record) => record.id === activeRecordId,
      );
      const currentPageRecords = getCurrentBatchPageRecords(
        preparedRecords,
        activeWorkflowState,
      );
      const selectedIds = new Set(activeWorkflowState.selectedRecordIds || []);
      const isPageSelected =
        currentPageRecords.length > 0 &&
        currentPageRecords.every((record) => selectedIds.has(record.id));
      const activeDirectory = getBatchDirectory(activeRecord);
      const content = `
        <div id="delivery-import-batch-review">
          <div class="delivery-import-batch-notice">
            <i class="fa fa-list-alt"></i>
            <div><strong>压缩包按文件逐一核对</strong><p>每个 Excel 可以“确认”或明确“排除”；也可以先暂时导入已确认文件，其余文件不会保存。${activeWorkflowState.skippedProcessedCount ? ` 已自动过滤 ${activeWorkflowState.skippedProcessedCount} 个以前成功导入的文件。` : ""}</p></div>
          </div>
          <div class="delivery-import-summary delivery-import-batch-summary">
            <div><div class="text-xs text-gray-500">压缩包内 Excel</div><div class="mt-1 text-xl font-semibold" data-batch-count="total">${counts.total}</div></div>
            <div><div class="text-xs text-gray-500">已确认</div><div class="mt-1 text-xl font-semibold text-green-600" data-batch-count="confirmed">${counts.confirmed}</div></div>
            <div><div class="text-xs text-gray-500">待确认 / 失败</div><div class="mt-1 text-xl font-semibold text-amber-600"><span data-batch-count="pending">${counts.pending}</span> / <span data-batch-count="error">${counts.error}</span></div></div>
            <div><div class="text-xs text-gray-500">已排除</div><div class="mt-1 text-xl font-semibold text-gray-500" data-batch-count="excluded">${counts.excluded}</div></div>
          </div>
          <div class="delivery-import-batch-bulk-actions" aria-label="批量文件处理">
            <label class="inline-flex items-center gap-2 text-sm text-gray-700">
              <input id="delivery-import-batch-select-page" type="checkbox" ${isPageSelected ? "checked" : ""}>
              选择本页
            </label>
            <span class="selection-summary">已选 <strong id="delivery-import-batch-selected-count">${selectedIds.size}</strong> 个</span>
            <button id="delivery-import-batch-confirm-page" type="button" class="rounded-lg border border-primary bg-white px-3 py-2 text-sm text-primary hover:bg-purple-50">确认本页无异常</button>
            <button id="delivery-import-batch-confirm-directory" type="button" class="rounded-lg border border-primary bg-white px-3 py-2 text-sm text-primary hover:bg-purple-50" title="${escapeHTML(activeDirectory)}">确认同目录无异常</button>
            <button id="delivery-import-batch-confirm-selected" type="button" class="rounded-lg bg-primary px-3 py-2 text-sm text-white hover:bg-primary-dark">确认选中无异常</button>
            <button id="delivery-import-batch-exclude-selected" type="button" class="rounded-lg border border-red-200 bg-white px-3 py-2 text-sm text-red-600 hover:bg-red-50">排除选中</button>
          </div>
          <div class="delivery-import-batch-layout">
            <aside class="delivery-import-batch-sidebar">${buildBatchQueueMarkup(preparedRecords, activeWorkflowState)}</aside>
            <section class="delivery-import-batch-detail">${buildBatchDetailMarkup(activeRecord, data)}</section>
          </div>
        </div>`;
      showImportWorkflowPage({
        title: `批量核对压缩包（${counts.total} 个 Excel）`,
        subtitle: `已识别 ${counts.documents} 张单据、${counts.items} 条明细；逐个文件确认后才能导入。`,
        step: "review",
        content,
        primaryText: "全部文件确认后可预览",
        secondaryText: "取消整批导入",
        onPrimary: () => advanceBatchToImportPreview(),
        onSecondary: () => returnToImportSettings({ clearState: true }),
        preserveScroll: Boolean(options.preserve),
      });
      if (activeRecord?.formState) {
        applyReviewFormState(
          global.document?.getElementById("delivery-import-batch-detail-form"),
          activeRecord.formState,
        );
      }
      bindBatchReviewEvents();
      renderBatchNavigationMenu(preparedRecords, activeWorkflowState);
      const restoredQueue = global.document?.querySelector(
        ".delivery-import-batch-queue",
      );
      if (restoredQueue) restoredQueue.scrollTop = batchQueueScrollTop;
      revealActiveBatchRecord();
      return preparedRecords;
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
      if (Array.isArray(activeWorkflowState.batchRecords)) return false;
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

    function collectReviewedDocuments(rootOverride, reviewDocumentsOverride) {
      const root =
        rootOverride ||
        global.document?.getElementById("delivery-import-review");
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
        const originalDocument = (reviewDocumentsOverride ||
          activeWorkflowState?.reviewDocuments)?.[
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
          sourceArchiveName: originalDocument?.sourceArchiveName || "",
          sourceRelativePath: originalDocument?.sourceRelativePath || "",
          sourceArchiveEntryKey: originalDocument?.sourceArchiveEntryKey || "",
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
      for (const item of documents) {
        const key = normalizeMatchValue(item.orderNo);
        if (existing.has(key)) {
          return {
            ok: false,
            message: `送货单号 ${item.orderNo} 已存在，请取消该单导入或修改单号。`,
          };
        }
      }
      const merged = mergeDocumentsByOrderNumber(documents);
      return {
        ok: true,
        documents: merged.documents,
        mergeSummary: merged,
      };
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
      const sourceFileNames = getDocumentSourceValues(
        documentData,
        "sourceFileNames",
        "sourceFileName",
      );
      const sourceRelativePaths = getDocumentSourceValues(
        documentData,
        "sourceRelativePaths",
        "sourceRelativePath",
      );
      const sourceArchiveEntryKeys = getDocumentSourceValues(
        documentData,
        "sourceArchiveEntryKeys",
        "sourceArchiveEntryKey",
      );
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
        notes: `历史送货单导入（不调整库存）${sourceFileNames.length ? `；来源：${sourceFileNames.join("、")}` : ""}`,
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
        sourceArchiveName: documentData.sourceArchiveName || "",
        sourceRelativePath: documentData.sourceRelativePath || "",
        sourceArchiveEntryKey: documentData.sourceArchiveEntryKey || "",
        sourceFileNames,
        sourceRelativePaths,
        sourceArchiveEntryKeys,
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
        groups
          .get(documentData.statementGroupId)
          .notes.push(deliveryNotes[index]);
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
              specSnapshot: detail.specificationSnapshot || detail.spec || "",
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
          ${plan.mergeSummary?.mergedDocumentCount ? `<div class="rounded-xl border border-purple-100 bg-purple-50 px-4 py-3 text-sm text-purple-900" data-import-merge-summary><div class="font-semibold"><i class="fa fa-compress mr-1"></i>相同送货单号已自动合并</div><div class="mt-1 text-xs leading-5 text-purple-700">${escapeHTML(getMergeSummaryMessage(plan.mergeSummary))}</div></div>` : ""}
          ${summaryCards.length ? `<div class="delivery-import-change-summary">${summaryCards.join("")}</div>` : ""}
          ${buildMasterDataPreview(plan)}
          <section class="space-y-3"><div><h4 class="font-semibold text-gray-900">送货单与商品明细</h4><p class="mt-1 text-xs text-gray-500">下面的送货单会进入历史销售记录和后续客户对账来源。</p></div>${buildDeliveryPreview(plan)}</section>
          ${buildStatementPreview(plan)}
          ${buildPricePreview(plan)}
          <div class="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-800"><i class="fa fa-shield mr-1"></i>本次导入不会生成出库流水，不会改变任何商品的当前库存。</div>
        </div>`;
    }

    function showImportPlanPage(
      documents,
      reviewRoot,
      documentCount,
      options = {},
    ) {
      const plan = createImportPlan(documents);
      plan.mergeSummary =
        options.mergeSummary || activeWorkflowState?.mergeSummary;
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
        mergeSummary: plan.mergeSummary,
      };
      showImportWorkflowPage({
        title: options.partialBatch
          ? "预览本次暂时导入的已确认文件"
          : "预览本次新增与补充内容",
        subtitle: options.partialBatch
          ? "本次只写入已经确认的文件；其余文件不会保存，下次上传同一压缩包时可继续处理。"
          : "这是写入前的最终预览；确认各项变更无误后再执行导入。",
        step: "preview",
        content: buildImportPlanMarkup(plan),
        primaryText: "最终确认导入",
        secondaryText: "返回修改",
        onPrimary: async () => {
          const saved = await commitReviewedImports(documents);
          if (saved) returnToImportSettings({ clearState: true });
          return saved;
        },
        onSecondary: () => {
          if (Array.isArray(activeWorkflowState?.batchRecords)) {
            showBatchReviewPage(activeWorkflowState.batchRecords, {
              preserve: true,
              activeRecordId: activeWorkflowState.activeRecordId,
            });
            return;
          }
          restoreReviewPage(reviewRoot, documentCount);
        },
      });
      persistActiveWorkflowDraft("preview");
      return plan;
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
        returnToImportSettings({ clearState: true });
        return false;
      }
      if (draftContainsImportedOrder(draft)) {
        clearWorkflowDraft();
        global.showAntdMessage?.(
          "warning",
          "暂存任务中的送货单已经存在于系统中，本次草稿已自动清除。",
        );
        returnToImportSettings();
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

    function isArchiveFile(file) {
      return /\.(?:rar|zip)$/i.test(file?.name || "");
    }

    function createStandaloneBatchRecord(file, parsed, index) {
      const documents = parsed.ok
        ? Array.isArray(parsed.documents)
          ? parsed.documents
          : [parsed]
        : [];
      return {
        id: `selected-file-${index + 1}`,
        archiveName: "单独选择的 Excel",
        relativePath: file.name,
        fileName: file.name,
        size: Number(file.size) || 0,
        status: parsed.ok ? "pending" : "error",
        importKind:
          parsed.importKind || documents[0]?.importKind || "delivery-note",
        errors: parsed.errors || [],
        warnings: parsed.warnings || [],
        documentCount: documents.length,
        itemCount: documents.reduce(
          (sum, documentData) => sum + (documentData.items?.length || 0),
          0,
        ),
        totalAmount: documents.reduce(
          (sum, documentData) =>
            sum + Number(documentData.calculatedTotal || 0),
          0,
        ),
        documents,
      };
    }

    async function confirmArchiveImportExit() {
      const options = {
        title: "退出压缩包解析？",
        content:
          "退出后将立即停止当前解析，本批次已经解析的内容不会进入核对和导入流程。确定要退出吗？",
        okText: "确定退出",
        cancelText: "继续解析",
        okType: "danger",
      };
      return showImportConfirm(options);
    }

    function showArchiveProgressDialog(archiveCount, onExit) {
      const document = global.document;
      if (!document?.body) {
        return { update() {}, close() {} };
      }
      document.getElementById("archive-import-progress-dialog")?.remove();
      const overlay = document.createElement("div");
      overlay.id = "archive-import-progress-dialog";
      overlay.className = "archive-import-progress-overlay";
      overlay.innerHTML = `
        <div class="archive-import-progress-card" role="dialog" aria-modal="true" aria-labelledby="archive-import-progress-title">
          <div class="archive-import-progress-heading">
            <span class="archive-import-progress-icon"><i class="fa fa-file-archive-o"></i></span>
            <div>
              <h3 id="archive-import-progress-title">正在处理压缩包</h3>
              <p data-archive-progress-batch>准备处理 ${archiveCount} 个压缩包</p>
            </div>
          </div>
          <div class="archive-import-progress-state">
            <strong data-archive-progress-status>正在读取压缩包…</strong>
            <span data-archive-progress-percent>0%</span>
          </div>
          <div class="archive-import-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <span data-archive-progress-bar></span>
          </div>
          <div class="archive-import-progress-file">
            <span>当前文件</span>
            <strong data-archive-progress-file>等待解压…</strong>
          </div>
          <div class="archive-import-progress-footer">
            <p class="archive-import-progress-tip">文件较多时需要一些时间，请保持当前页面开启。</p>
            <button type="button" class="archive-import-progress-exit" data-archive-progress-exit>中途退出</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);

      const batch = overlay.querySelector("[data-archive-progress-batch]");
      const status = overlay.querySelector("[data-archive-progress-status]");
      const percent = overlay.querySelector("[data-archive-progress-percent]");
      const track = overlay.querySelector(".archive-import-progress-track");
      const bar = overlay.querySelector("[data-archive-progress-bar]");
      const currentFile = overlay.querySelector("[data-archive-progress-file]");
      const exitButton = overlay.querySelector("[data-archive-progress-exit]");
      let displayedPercent = 0;
      let autoCeiling = 0;
      let closed = false;

      const renderPercent = (nextPercent, nextCeiling = nextPercent) => {
        displayedPercent = Math.max(
          displayedPercent,
          Math.min(100, Number(nextPercent) || 0),
        );
        autoCeiling = Math.max(
          autoCeiling,
          displayedPercent,
          Math.min(100, Number(nextCeiling) || 0),
        );
        const rounded = Math.round(displayedPercent);
        track?.setAttribute("aria-valuenow", String(rounded));
        if (bar) bar.style.width = `${displayedPercent}%`;
        if (percent) {
          percent.textContent = `${displayedPercent > 0 && displayedPercent < 1 ? displayedPercent.toFixed(1) : rounded}%`;
        }
      };
      const progressTimer = global.setInterval?.(() => {
        if (closed || displayedPercent >= autoCeiling) return;
        renderPercent(Math.min(autoCeiling, displayedPercent + 0.2));
      }, 450);
      exitButton?.addEventListener("click", async () => {
        if (exitButton.disabled) return;
        exitButton.disabled = true;
        const shouldExit = await onExit?.();
        if (!shouldExit && !closed) exitButton.disabled = false;
      });

      return {
        update(progress = {}) {
          const phase = progress.phase || "extracting";
          const archiveIndex = Number(progress.archiveIndex) || 1;
          const archiveName =
            progress.archiveName || progress.fileName || "压缩包";
          const current = Number(progress.current) || 0;
          const total = Number(progress.total) || 0;
          const archiveSpan = 100 / Math.max(archiveCount, 1);
          const archiveBase = (archiveIndex - 1) * archiveSpan;
          const parseRatio = total > 0 ? Math.min(1, current / total) : 0;
          let phasePercent = 5;
          let phaseCeiling = 9;
          if (phase === "uploading") {
            phasePercent = 1;
            phaseCeiling = 4;
          } else if (phase === "extracted") {
            phasePercent = 10;
            phaseCeiling = 10;
          } else if (phase === "parsing") {
            phasePercent = 10 + parseRatio * 89.5;
            phaseCeiling = phasePercent;
          } else if (phase === "complete") {
            phasePercent = 100;
            phaseCeiling = 100;
          }
          renderPercent(
            archiveBase + (phasePercent / 100) * archiveSpan,
            archiveBase + (phaseCeiling / 100) * archiveSpan,
          );
          if (batch) {
            batch.textContent = `${archiveName} · 第 ${archiveIndex}/${archiveCount} 个压缩包`;
          }
          if (phase === "uploading" || phase === "extracting") {
            if (status) {
              status.textContent =
                phase === "uploading" ? "正在上传压缩包" : "正在解压压缩包";
            }
            if (currentFile) {
              currentFile.textContent = archiveName;
              currentFile.title = archiveName;
            }
            return;
          }

          if (status) {
            status.textContent =
              phase === "complete"
                ? `解析完成 ${total}/${total}`
                : `正在解析 ${current}/${total}`;
          }
          if (currentFile) {
            const fileName = progress.fileName || archiveName;
            currentFile.textContent = fileName;
            currentFile.title = fileName;
          }
        },
        close() {
          closed = true;
          if (progressTimer) global.clearInterval?.(progressTimer);
          overlay.remove();
        },
      };
    }

    async function probeArchiveImportEndpoint(endpoint) {
      try {
        const response = await global.fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/octet-stream",
            "X-Archive-Name": encodeURIComponent("probe.rar"),
          },
          body: new Uint8Array(0),
        });
        const contentType = response.headers?.get?.("content-type") || "";
        const progressProtocol =
          response.headers?.get?.("x-archive-progress") || "";
        if (!contentType.includes("application/json")) return false;
        const payload = await response.json();
        return (
          progressProtocol === "ndjson" &&
          response.status === 400 &&
          payload?.success === false &&
          /压缩包内容为空/.test(payload?.error || "")
        );
      } catch {
        return false;
      }
    }

    async function resolveArchiveImportEndpoint() {
      if (
        archiveImportEndpoint &&
        (await probeArchiveImportEndpoint(archiveImportEndpoint))
      ) {
        return archiveImportEndpoint;
      }
      const candidates = ["/api/import/archive"];
      const protocol = global.location?.protocol;
      if (protocol === "http:" || protocol === "https:") {
        for (let port = 8080; port <= 8090; port += 1) {
          candidates.push(`http://127.0.0.1:${port}/api/import/archive`);
        }
      }
      for (const endpoint of [...new Set(candidates)]) {
        if (await probeArchiveImportEndpoint(endpoint)) {
          archiveImportEndpoint = endpoint;
          return endpoint;
        }
      }
      return "";
    }

    async function readArchiveProgressResponse(response, onProgress) {
      if (!response.body?.getReader) {
        throw new Error(
          "当前浏览器不支持显示压缩包解析进度，请升级浏览器后重试。",
        );
      }
      const reader = response.body.getReader();
      const Decoder = global.TextDecoder || globalThis.TextDecoder;
      const decoder = new Decoder();
      let pending = "";
      /** @type {any} */
      let result = null;
      const handleLine = (line) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "progress") onProgress?.(event);
        if (event.type === "complete") result = event.result;
        if (event.type === "error") {
          throw new Error(event.error || "压缩包解析失败。");
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        pending += decoder.decode(value || new Uint8Array(0), {
          stream: !done,
        });
        const lines = pending.split("\n");
        pending = lines.pop() || "";
        lines.forEach(handleLine);
        if (done) break;
      }
      handleLine(pending);
      if (!result?.success) {
        throw new Error(result?.error || "压缩包解析服务未返回完整结果。");
      }
      return result;
    }

    async function uploadArchiveFile(file, onProgress, signal) {
      if (typeof global.fetch !== "function") {
        throw new Error(
          "当前运行环境不支持压缩包解析，请使用本地网页服务或桌面版。",
        );
      }
      const endpoint = await resolveArchiveImportEndpoint();
      if (!endpoint) {
        throw new Error(
          "未找到支持压缩包解析的本地服务，请打开最新版预览或桌面安装版。",
        );
      }
      onProgress?.({ phase: "uploading", fileName: file.name });
      const response = await global.fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/octet-stream",
          "X-Archive-Name": encodeURIComponent(file.name),
          "X-Progress-Stream": "1",
        },
        body: await file.arrayBuffer(),
        signal,
      });
      const responseContentType = response.headers?.get?.("content-type") || "";
      if (responseContentType.includes("application/x-ndjson")) {
        const streamedPayload = await readArchiveProgressResponse(
          response,
          onProgress,
        );
        return streamedPayload.records || [];
      }
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(
          "压缩包解析服务不可用，请通过本地预览服务或桌面安装版打开系统。",
        );
      }
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || "压缩包解析失败。");
      }
      return payload.records || [];
    }

    async function handleFiles(fileList) {
      const files = Array.from(fileList || []);
      if (!files.length) return false;
      const archiveFiles = files.filter(isArchiveFile);
      const workbookFiles = files.filter((file) => !isArchiveFile(file));
      if (archiveFiles.length > MAX_ARCHIVE_COUNT) {
        global.alert?.(
          `一次最多选择 ${MAX_ARCHIVE_COUNT} 个压缩包，请分批处理。`,
        );
        return false;
      }
      if (workbookFiles.length > MAX_FILE_COUNT) {
        global.alert?.(`一次最多导入 ${MAX_FILE_COUNT} 个文件，请分批处理。`);
        return false;
      }
      const invalid = files.find((file) => {
        const archive = isArchiveFile(file);
        const validExtension = archive
          ? /\.(?:rar|zip)$/i.test(file.name || "")
          : /\.xlsx?$/i.test(file.name || "");
        const sizeLimit = archive ? MAX_ARCHIVE_SIZE : MAX_FILE_SIZE;
        return !validExtension || Number(file.size) > sizeLimit;
      });
      if (invalid) {
        global.alert?.(
          `文件“${invalid.name}”格式不支持或超过大小限制；Excel 最大 15MB，RAR/ZIP 最大 80MB。`,
        );
        return false;
      }

      const button = global.document?.getElementById(
        "historical-business-import-btn",
      );
      const originalText = button?.innerHTML;
      const AbortControllerClass =
        global.AbortController || globalThis.AbortController;
      const abortController =
        archiveFiles.length && AbortControllerClass
          ? new AbortControllerClass()
          : null;
      let importCancelled = false;
      let progressDialog = null;
      if (archiveFiles.length) {
        progressDialog = showArchiveProgressDialog(
          archiveFiles.length,
          async () => {
            const confirmed = await confirmArchiveImportExit();
            if (!confirmed) return false;
            importCancelled = true;
            abortController?.abort();
            return true;
          },
        );
      }
      if (button) {
        button.disabled = true;
        button.innerHTML =
          '<i class="fa fa-spinner fa-spin mr-2"></i>正在解析…';
      }
      try {
        if (archiveFiles.length) {
          const records = [];
          const skippedProcessedRecords = [];
          for (let index = 0; index < archiveFiles.length; index += 1) {
            const file = archiveFiles[index];
            if (button) {
              button.innerHTML = `<i class="fa fa-spinner fa-spin mr-2"></i>正在解析压缩包 ${index + 1}/${archiveFiles.length}…`;
            }
            try {
              const parsedRecords = await uploadArchiveFile(
                file,
                (progress) => {
                  progressDialog?.update({
                    ...progress,
                    archiveIndex: index + 1,
                    archiveName: file.name,
                  });
                },
                abortController?.signal,
              );
              const filteredRecords = filterPreviouslyImportedArchiveRecords(
                parsedRecords,
                global.mockData,
              );
              skippedProcessedRecords.push(...filteredRecords.skipped);
              records.push(...filteredRecords.pending);
              if (importCancelled) return false;
            } catch (error) {
              if (importCancelled || error?.name === "AbortError") {
                return false;
              }
              global.alert?.(
                `压缩包“${file.name}”未能完整解析：${error?.message || "解析失败"}\n本批次尚未进入导入流程。`,
              );
              return false;
            }
          }
          for (let index = 0; index < workbookFiles.length; index += 1) {
            const file = workbookFiles[index];
            let parsed;
            try {
              parsed = parseWorkbookBuffer(await file.arrayBuffer(), file.name);
            } catch (error) {
              parsed = {
                ok: false,
                errors: [error?.message || "解析失败"],
                warnings: [],
              };
            }
            records.push(createStandaloneBatchRecord(file, parsed, index));
          }
          if (!records.length && !skippedProcessedRecords.length) {
            global.showAntdMessage?.(
              "info",
              "压缩包中没有可核对的 Excel 文件。",
            );
            return false;
          }
          showArchiveScreeningPage(records, skippedProcessedRecords);
          return true;
        }

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
        progressDialog?.close();
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
      createArchiveEntryKey,
      filterPreviouslyImportedArchiveRecords,
      classifyArchiveScreeningRecords,
      mergeDocumentsByOrderNumber,
      syncImportedCustomerPrices,
      createImportPlan,
      collectReviewedDocuments,
      commitReviewedImports,
      showReviewPage,
      showArchiveScreeningPage,
      showBatchReviewPage,
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
