(function initBillsModule(global) {
  const state = global.BillsModuleState || {
    activeTab: "customer",
    filtersBound: false,
    tableEventsBound: false,
    addButtonBound: false,
    modalLifecycleBound: false,
    routeBound: false,
    pendingDraft: null,
    modalCloseHandler: null,
    activeViewStatementId: "",
    activeViewReturnTab: "",
    previousBillsRoute: null,
    currentBillsRoute: null,
  };
  global.BillsModuleState = state;

  const BILL_TYPE_META = Object.freeze({
    customer: {
      label: "客户对账单",
      partyLabel: "客户",
      emptyText: "当前没有客户对账单",
    },
    supplier: {
      label: "供应商对账单",
      partyLabel: "供应商",
      emptyText: "当前没有供应商对账单",
    },
    payment: {
      label: "付款计划",
      partyLabel: "对象",
      emptyText: "当前没有待付款或部分付款对账单",
    },
  });

  const BILL_STATUS_META = Object.freeze({
    pending_check: { label: "待核对", badgeClass: "bg-blue-100 text-blue-700" },
    pending_payment: { label: "待付款", badgeClass: "bg-red-100 text-red-700" },
    partial_paid: {
      label: "部分付款",
      badgeClass: "bg-yellow-100 text-yellow-700",
    },
    paid: { label: "已结清", badgeClass: "bg-green-100 text-green-700" },
    cancelled: { label: "已作废", badgeClass: "bg-gray-100 text-gray-600" },
  });

  function injectBillsModuleStyles() {
    if (document.getElementById("bills-module-style")) return;

    const style = document.createElement("style");
    style.id = "bills-module-style";
    style.textContent = `
            #bills .bills-table-scroll {
                overflow-x: auto !important;
                overflow-y: hidden !important;
                scrollbar-width: none;
            }
            #bills .bills-table-scroll::-webkit-scrollbar {
                display: none;
            }
            #bills .bills-action-header,
            #bills .bills-action-cell {
                text-align: left !important;
            }
            #bills .bills-list-header {
                display: flex;
                flex-direction: row;
                align-items: flex-start;
                justify-content: space-between;
                flex-wrap: wrap;
                gap: 1rem;
                margin-bottom: 1.5rem;
            }
            #bills .bills-list-header > div:first-child {
                flex: 1 1 auto;
            }
            #bills .bills-list-toolbar {
                display: flex;
                align-items: center;
                justify-content: flex-end;
                gap: 1rem;
                margin-left: auto;
            }
            #bills #add-bill-btn {
                padding: 0.5rem 1.5rem;
                font-size: 1rem;
                font-weight: 600;
            }
            #bills .bills-action-links {
                display: flex;
                align-items: center;
                justify-content: flex-start;
                gap: 0.75rem;
                white-space: nowrap;
                font-size: 0.875rem;
                font-weight: 500;
            }
            #bills .bills-action-links a,
            #bills .bills-action-links button {
                background: transparent;
                border: none;
                padding: 0;
                cursor: pointer;
                font-size: 0.875rem;
                font-weight: 500;
            }
            #bills .bills-status-badge {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0.125rem 0.5rem;
                border-radius: 9999px;
                font-size: 0.75rem;
                font-weight: 600;
                line-height: 1.25rem;
            }
            #bills .bills-empty-state {
                padding: 1rem 1.5rem;
                text-align: center;
                color: #6b7280;
                font-size: 0.875rem;
            }
            .bills-modal-summary-grid {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 1rem;
            }
            .bills-modal-summary-card {
                border: 1px solid #e5e7eb;
                border-radius: 0.75rem;
                padding: 1rem;
                background: #fff;
            }
            .bills-modal-section {
                border: 1px solid #e5e7eb;
                border-radius: 0.75rem;
                background: #fff;
                overflow: hidden;
            }
            .bills-modal-section-title {
                padding: 0.9rem 1rem;
                border-bottom: 1px solid #e5e7eb;
                font-size: 1rem;
                font-weight: 600;
                color: #111827;
                background: #f9fafb;
            }
            .bills-modal-section-body {
                padding: 1rem;
            }
            .bills-modal-form-grid {
                display: grid;
                grid-template-columns: repeat(2, minmax(0, 1fr));
                gap: 1rem;
            }
            .bills-field {
                display: flex;
                flex-direction: column;
                gap: 0.375rem;
            }
            .bills-field > label {
                font-size: 0.875rem;
                color: #374151;
                font-weight: 600;
            }
            .bills-inline-table {
                width: 100%;
                border-collapse: collapse;
            }
            .bills-inline-table th,
            .bills-inline-table td {
                border: 1px solid #e5e7eb;
                padding: 0.625rem 0.75rem;
                text-align: left;
                vertical-align: top;
                font-size: 0.875rem;
            }
            .bills-inline-table th {
                background: #f9fafb;
                color: #374151;
                font-weight: 600;
            }
            .bills-muted-note {
                font-size: 0.875rem;
                color: #6b7280;
                line-height: 1.5;
            }
            .bills-outline-button {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                border-radius: 0.5rem;
                border: 1px solid #d1d5db;
                padding: 0.5rem 0.875rem;
                font-size: 0.875rem;
                font-weight: 600;
                color: #374151;
                background: #fff;
                cursor: pointer;
            }
            .bills-outline-button:hover {
                background: #f9fafb;
            }
            .bills-route-shell {
                display: flex;
                flex-direction: column;
                gap: 1rem;
            }
            .bills-route-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 1rem;
                flex-wrap: wrap;
            }
            .bills-route-title {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;
            }
            .bills-route-title h2 {
                margin: 0;
                font-size: 1.875rem;
                line-height: 2.25rem;
            }
            .bills-route-title p {
                font-size: 0.875rem;
                color: #4b5563;
                margin: 0;
            }
            .bills-route-actions {
                display: flex;
                align-items: center;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            .bills-route-card {
                background: #fff;
                border: 1px solid #e5e7eb;
                border-radius: 0.75rem;
                box-shadow: 0 10px 24px rgba(15, 23, 42, 0.05);
                overflow: hidden;
            }
            .bills-route-card-body {
                padding: 1rem;
            }
            .bills-route-card + .bills-route-card {
                margin-top: 1rem;
            }
            .bills-route-toolbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 1rem;
                flex-wrap: wrap;
                margin-bottom: 1rem;
            }
            .bills-route-empty {
                padding: 2rem 1.5rem;
                text-align: center;
                color: #6b7280;
                font-size: 0.875rem;
            }
            .bills-route-card .bills-modal-form-grid > .bills-field {
                border: 1px solid #e5e7eb;
                border-radius: 0.75rem;
                background: #f9fafb;
                padding: 0.75rem;
                gap: 0;
            }
            .bills-route-card .bills-modal-form-grid > .bills-field > label {
                margin-bottom: 0.375rem;
                font-size: 0.75rem;
                font-weight: 600;
                color: #6b7280;
            }
            .bills-route-card .bills-modal-form-grid > .bills-field.justify-center {
                justify-content: flex-start;
            }
            .bills-route-card .bills-modal-form-grid input[type="number"] {
                background: #fff;
                border-radius: 0.375rem;
                border: 1px solid #d1d5db;
                padding: 0.375rem 0.75rem;
                font-size: 0.875rem;
                line-height: 1.25rem;
            }
            .bills-route-checkbox {
                display: flex;
                align-items: flex-start;
                gap: 0.5rem;
                font-size: 0.875rem;
                color: #374151;
                line-height: 1.5;
            }
            .bills-route-note {
                border: 1px solid #e5e7eb;
                border-radius: 0.75rem;
                background: #f9fafb;
                padding: 0.75rem 1rem;
                font-size: 0.875rem;
                color: #6b7280;
                line-height: 1.6;
            }
            .bills-route-intro {
                border: 1px solid #dbeafe;
                border-radius: 0.75rem;
                background: #eff6ff;
                padding: 0.875rem 1rem;
            }
            .bills-route-intro-body {
                display: flex;
                align-items: flex-start;
                gap: 0.75rem;
            }
            .bills-route-intro-icon {
                flex-shrink: 0;
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 0.75rem;
                border: 1px solid #dbeafe;
                background: #fff;
                color: #2563eb;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
            }
            .bills-route-intro-title {
                font-size: 1rem;
                font-weight: 600;
                color: #111827;
            }
            .bills-route-intro-desc {
                margin-top: 0.125rem;
                font-size: 0.875rem;
                color: #4b5563;
                line-height: 1.6;
            }
            .bills-modal-summary-card {
                border-radius: 0.75rem;
                padding: 0.875rem 1rem;
                background: #f9fafb;
            }
            .bills-modal-summary-card .text-sm {
                font-size: 0.75rem;
                color: #6b7280;
            }
            .bills-modal-summary-card .text-xl {
                font-size: 1.125rem;
                line-height: 1.75rem;
            }
            .bills-modal-summary-card .text-base {
                font-size: 0.9375rem;
                line-height: 1.5rem;
            }
            .bills-modal-section {
                border-radius: 0.75rem;
            }
            .bills-modal-section-title {
                padding: 0.75rem 1rem;
                font-size: 0.875rem;
                font-weight: 600;
            }
            .bills-modal-section-body {
                padding: 0.875rem 1rem;
            }
            .bills-inline-table th,
            .bills-inline-table td {
                font-size: 0.875rem;
                padding: 0.75rem 0.875rem;
            }
            .bills-inline-table th {
                font-size: 0.75rem;
                font-weight: 500;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                color: #6b7280;
            }
            @media (max-width: 1024px) {
                .bills-modal-summary-grid,
                .bills-modal-form-grid {
                    grid-template-columns: 1fr;
                }
            }
        `;
    document.head.appendChild(style);
  }

  function getBillsMeta(tabKey) {
    return BILL_TYPE_META[tabKey] || BILL_TYPE_META.customer;
  }

  function buildBillsEmptyHostMarkup(description, options = {}) {
    const safeDescription = global.escapeHTML(description || "暂无数据");
    const safeWrapperClass = global.escapeHTML(
      options.wrapperClassName || "py-4",
    );
    const safeFallbackClass = global.escapeHTML(
      options.fallbackClassName || "text-center text-sm text-gray-400",
    );

    return `
            <div
                class="bills-empty-host"
                data-bills-empty-description="${safeDescription}"
                data-bills-empty-wrapper-class="${safeWrapperClass}"
            >
                <div class="${safeFallbackClass}">${safeDescription}</div>
            </div>
        `;
  }

  function buildBillsEmptyTableRow(description, colspan, options = {}) {
    const safeColspan = Number(colspan) || 1;
    const safeCellClass = global.escapeHTML(
      options.cellClassName || "px-6 py-4",
    );

    return `
            <tr>
                <td colspan="${safeColspan}" class="${safeCellClass}">
                    ${buildBillsEmptyHostMarkup(description, {
                      wrapperClassName: options.wrapperClassName || "py-2",
                      fallbackClassName:
                        options.fallbackClassName ||
                        "text-center text-sm text-gray-400",
                    })}
                </td>
            </tr>
        `;
  }

  function hydrateBillsEmptyStates(root = document) {
    if (!root || typeof global.renderAntdEmptyState !== "function") {
      return;
    }

    root
      .querySelectorAll("[data-bills-empty-description]")
      .forEach((host) => {
        if (!host || host.dataset.rendered === "true") {
          return;
        }

        global.renderAntdEmptyState(host, host.dataset.billsEmptyDescription, {
          wrapperClassName:
            host.getAttribute("data-bills-empty-wrapper-class") || "py-4",
        });
      });
  }

  function ensureBillsPaginationState() {
    if (!global.paginationState) {
      global.paginationState = {};
    }

    if (!global.paginationState.bills) {
      global.paginationState.bills = {
        page: 1,
        pageSize: 10,
        total: 0,
      };
    }

    return global.paginationState.bills;
  }

  function normalizeBillStatus(status) {
    const map = {
      pending: "pending_check",
      created: "pending_check",
      draft: "pending_check",
      verified: "pending_payment",
      sent: "pending_payment",
      pending_payment: "pending_payment",
      partial_paid: "partial_paid",
      partial: "partial_paid",
      paid: "paid",
      confirmed: "paid",
      cancelled: "cancelled",
      canceled: "cancelled",
    };
    return map[String(status || "").trim()] || "pending_check";
  }

  function normalizeBillDate(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

    const raw = String(value).trim();
    if (/^\d{8}$/.test(raw)) {
      return new Date(
        `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00`,
      );
    }

    const normalized = raw.includes("T") ? raw : raw.replace(/\//g, "-");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatBillDateOnly(value) {
    const date = normalizeBillDate(value);
    if (!date) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function formatBillDateTime(value) {
    const date = normalizeBillDate(value);
    if (!date) return "-";
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  }

  function formatStatementPeriod(start, end) {
    return `${formatBillDateOnly(start)} 至 ${formatBillDateOnly(end)}`;
  }

  function roundCurrency(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function formatBillCurrency(value) {
    return `¥${roundCurrency(value).toFixed(2)}`;
  }

  function getCurrentUserInitialForBills() {
    const name = String(global.currentUser?.name || "张三").trim();
    return global.escapeHTML
      ? global.escapeHTML(name.charAt(0) || "张")
      : name.charAt(0) || "张";
  }

  function getStatusBadgeHtml(status) {
    const meta =
      BILL_STATUS_META[normalizeBillStatus(status)] ||
      BILL_STATUS_META.pending_check;
    return `<span class="bills-status-badge ${meta.badgeClass}">${meta.label}</span>`;
  }

  function convertAmountToChineseUpperForBills(amount) {
    const number = roundCurrency(amount);
    if (!number) return "人民币零元整";

    const digits = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
    const units = ["", "拾", "佰", "仟"];
    const groups = ["", "万", "亿", "兆"];
    const fractionUnits = ["角", "分"];

    const integerPart = Math.floor(number);
    const decimalPart = Math.round((number - integerPart) * 100);

    function convertInteger(num) {
      const raw = String(num);
      const result = [];
      const groupCount = Math.ceil(raw.length / 4);

      for (let groupIndex = 0; groupIndex < groupCount; groupIndex += 1) {
        const start = Math.max(raw.length - (groupIndex + 1) * 4, 0);
        const end = raw.length - groupIndex * 4;
        const chunk = raw.slice(start, end).padStart(4, "0");
        let chunkText = "";

        for (let i = 0; i < chunk.length; i += 1) {
          const digit = Number(chunk[i]);
          if (!digit) {
            if (chunkText && !chunkText.endsWith("零")) {
              chunkText += "零";
            }
            continue;
          }
          chunkText += digits[digit] + units[chunk.length - i - 1];
        }

        chunkText = chunkText.replace(/零+$/g, "");
        if (chunkText) {
          result.unshift(chunkText + groups[groupIndex]);
        }
      }

      return result
        .join("")
        .replace(/零+/g, "零")
        .replace(/零(万|亿|兆)/g, "$1");
    }

    const integerText = convertInteger(integerPart) || "零";
    let fractionText = "";
    if (decimalPart > 0) {
      const jiao = Math.floor(decimalPart / 10);
      const fen = decimalPart % 10;
      if (jiao) fractionText += digits[jiao] + fractionUnits[0];
      if (fen) fractionText += digits[fen] + fractionUnits[1];
    }

    return `人民币${integerText}元${fractionText || "整"}`
      .replace(/零角零分$/, "整")
      .replace(/零分$/, "");
  }

  function getStatementRecords() {
    return (
      global.normalizeList ? global.normalizeList(global.mockData?.bills) : []
    ).filter((record) => record?.recordType === "statement-v1");
  }

  function getOutstandingAmount(statement) {
    const totalAmount = Number(statement?.totalAmount) || 0;
    const paidAmount = (
      global.normalizeList ? global.normalizeList(statement?.payments) : []
    ).reduce((sum, payment) => sum + (Number(payment?.payAmount) || 0), 0);
    return Math.max(0, roundCurrency(totalAmount - paidAmount));
  }

  function isSalesDeliveryNote(note) {
    return (
      Boolean(note) &&
      (String(note.type || "").toLowerCase() === "sales" ||
        note.customerId ||
        note.customerName ||
        note.customerNo)
    );
  }

  function isPurchaseDeliveryNote(note) {
    return (
      Boolean(note) &&
      !isSalesDeliveryNote(note) &&
      (note.supplierId || note.orderId)
    );
  }

  function parseLegacyStatementPeriod(period, fallbackDate) {
    const matches =
      String(period || "").match(/\d{4}[-/]\d{2}[-/]\d{2}/g) || [];
    if (matches.length >= 2) {
      return {
        periodStart: matches[0].replace(/\//g, "-"),
        periodEnd: matches[1].replace(/\//g, "-"),
      };
    }

    const fallback = formatBillDateOnly(fallbackDate);
    return {
      periodStart: fallback,
      periodEnd: fallback,
    };
  }

  function getStatementPartyFilterValue(statement) {
    return String(
      statement?.partyId || statement?.partyNameSnapshot || "",
    ).trim();
  }

  function findSupplierRecord(reference) {
    const normalizedReference = String(reference || "")
      .trim()
      .toLowerCase();
    if (!normalizedReference) return null;

    return (
      global.normalizeList(global.mockData?.suppliers).find(
        (supplier) =>
          String(supplier.id || "")
            .trim()
            .toLowerCase() === normalizedReference ||
          String(supplier.name || "")
            .trim()
            .toLowerCase() === normalizedReference,
      ) || null
    );
  }

  function getActiveSourceDocumentIdSet(statementType) {
    return new Set(
      getStatementRecords()
        .filter((record) => record.statementType === statementType)
        .filter((record) => normalizeBillStatus(record.status) !== "cancelled")
        .flatMap((record) => global.normalizeList(record.sourceDocumentIds))
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    );
  }

  function mapLegacySupplierBillToStructured(record, existingStatements) {
    const amount =
      Number(String(record.amount || "").replace(/[^\d.-]/g, "")) || 0;
    const createdAt = record.createdAt || global.getLocalISOString();
    const period = parseLegacyStatementPeriod(record.period, createdAt);
    const supplier = findSupplierRecord(
      record.supplierId || record.supplierName,
    );
    return {
      id: global.createSequentialId(existingStatements, "SST", 4),
      recordType: "statement-v1",
      statementType: "supplier",
      partyId: supplier?.id || record.supplierId || "",
      partyNameSnapshot:
        record.supplierName || supplier?.name || "未命名供应商",
      companyId: "",
      companyNameSnapshot: "",
      companyAddressSnapshot: "",
      companyPhoneSnapshot: "",
      contactNameSnapshot: supplier?.contactPerson || "",
      contactPhoneSnapshot: supplier?.contactPhone || "",
      partyAddressSnapshot: supplier?.address || "",
      statementDate: createdAt,
      periodStart: period.periodStart,
      periodEnd: period.periodEnd,
      documentCount: 1,
      currentAmount: amount,
      taxRate: 1,
      amountWithTax: amount,
      arrearsAmount: 0,
      totalAmount: amount,
      totalAmountUppercase: convertAmountToChineseUpperForBills(amount),
      status: normalizeBillStatus(record.status),
      notes: "",
      details: [],
      arrears: [],
      payments: [],
      sourceDocumentIds: [],
      createdAt,
      updatedAt: createdAt,
    };
  }

  function migrateBillsData(records) {
    const purchaseDeliveryIds = new Set(
      global
        .normalizeList(global.mockData?.deliveryNotes)
        .filter(isPurchaseDeliveryNote)
        .map((note) => String(note.id || "").trim())
        .filter(Boolean),
    );

    let changed = false;
    const nextRecords = [];
    const existingStructuredStatements = global
      .normalizeList(records)
      .filter((record) => record?.recordType === "statement-v1");

    global.normalizeList(records).forEach((record) => {
      if (record?.recordType !== "statement-v1") {
        if (record && (record.supplierName || record.supplierId)) {
          const migratedLegacyRecord = mapLegacySupplierBillToStructured(
            record,
            existingStructuredStatements,
          );
          nextRecords.push(migratedLegacyRecord);
          existingStructuredStatements.push(migratedLegacyRecord);
          changed = true;
          return;
        }

        nextRecords.push(record);
        return;
      }

      if (record.statementType === "customer") {
        const sourceIds = global
          .normalizeList(record.sourceDocumentIds)
          .map((id) => String(id || "").trim())
          .filter(Boolean);

        if (
          sourceIds.length > 0 &&
          sourceIds.every((id) => purchaseDeliveryIds.has(id))
        ) {
          changed = true;
          return;
        }
      }

      let nextRecord = record;
      if (record.statementType === "supplier") {
        const supplier = findSupplierRecord(
          record.partyId || record.partyNameSnapshot,
        );
        if (supplier) {
          nextRecord = {
            ...record,
            partyId: record.partyId || supplier.id,
            partyNameSnapshot: record.partyNameSnapshot || supplier.name,
            contactNameSnapshot:
              record.contactNameSnapshot || supplier.contactPerson || "",
            contactPhoneSnapshot:
              record.contactPhoneSnapshot || supplier.contactPhone || "",
            partyAddressSnapshot:
              record.partyAddressSnapshot || supplier.address || "",
          };

          if (
            nextRecord.partyId !== record.partyId ||
            nextRecord.partyNameSnapshot !== record.partyNameSnapshot ||
            nextRecord.contactNameSnapshot !== record.contactNameSnapshot ||
            nextRecord.contactPhoneSnapshot !== record.contactPhoneSnapshot ||
            nextRecord.partyAddressSnapshot !== record.partyAddressSnapshot
          ) {
            changed = true;
          }
        }
      }

      nextRecords.push(nextRecord);
      existingStructuredStatements.push(nextRecord);
    });

    return { changed, records: nextRecords.filter(Boolean) };
  }

  function createBillsDemoSourceData() {
    return [
      {
        id: "BILLTEST-SALES-001",
        type: "sales",
        orderNo: "XS202604180101",
        issueDate: "20260418",
        deliveryDate: "20260418",
        status: "created",
        totalAmount: 21995,
        notes: "iPhone 13 Pro x 2, AirPods Pro x 3",
        companyId: "CO001",
        companyName: "化工",
        companyAddress: "上海市浦东新区张江高科技园区",
        companyPhone: "13800138001",
        companyContact: "张经理",
        customerId: "C002",
        customerName: "天猫商城",
        customerAddress: "杭州市余杭区阿里巴巴西溪园区",
        customerContact: "钱经理",
        customerPhone: "13500135000",
        paymentTerms: "Net 45",
        customerNo: "TM26-101",
        createdAt: "2026-04-18T09:30:00",
        updatedAt: "2026-04-18T09:30:00",
        details: [
          {
            id: "BILLTEST-SALES-001-1",
            deliveryId: "BILLTEST-SALES-001",
            productId: "P001",
            productName: "iPhone 13 Pro",
            quantity: 2,
            unit: "个",
            spec: "电子产品",
            unitPrice: 7999,
            totalAmount: 15998,
            notes: "",
            status: "created",
          },
          {
            id: "BILLTEST-SALES-001-2",
            deliveryId: "BILLTEST-SALES-001",
            productId: "P004",
            productName: "AirPods Pro",
            quantity: 3,
            unit: "个",
            spec: "电子产品",
            unitPrice: 1999,
            totalAmount: 5997,
            notes: "",
            status: "created",
          },
        ],
      },
      {
        id: "BILLTEST-SALES-002",
        type: "sales",
        orderNo: "XS202604190101",
        issueDate: "20260419",
        deliveryDate: "20260419",
        status: "created",
        totalAmount: 16497,
        notes: "MacBook Air M2 x 1, Apple Watch x 2",
        companyId: "CO001",
        companyName: "化工",
        companyAddress: "上海市浦东新区张江高科技园区",
        companyPhone: "13800138001",
        companyContact: "张经理",
        customerId: "C002",
        customerName: "天猫商城",
        customerAddress: "杭州市余杭区阿里巴巴西溪园区",
        customerContact: "钱经理",
        customerPhone: "13500135000",
        paymentTerms: "Net 45",
        customerNo: "TM26-102",
        createdAt: "2026-04-19T14:20:00",
        updatedAt: "2026-04-19T14:20:00",
        details: [
          {
            id: "BILLTEST-SALES-002-1",
            deliveryId: "BILLTEST-SALES-002",
            productId: "P002",
            productName: "MacBook Air M2",
            quantity: 1,
            unit: "个",
            spec: "电子产品",
            unitPrice: 9499,
            totalAmount: 9499,
            notes: "",
            status: "created",
          },
          {
            id: "BILLTEST-SALES-002-2",
            deliveryId: "BILLTEST-SALES-002",
            productId: "P005",
            productName: "Apple Watch",
            quantity: 2,
            unit: "个",
            spec: "电子产品",
            unitPrice: 3499,
            totalAmount: 6998,
            notes: "",
            status: "created",
          },
        ],
      },
      {
        id: "BILLTEST-SALES-003",
        type: "sales",
        orderNo: "XS202604200101",
        issueDate: "20260420",
        deliveryDate: "20260420",
        status: "created",
        totalAmount: 18095,
        notes: "Apple Watch x 3, AirPods Pro x 2, airpods x 3",
        companyId: "CO001",
        companyName: "化工",
        companyAddress: "上海市浦东新区张江高科技园区",
        companyPhone: "13800138001",
        companyContact: "张经理",
        customerId: "C003",
        customerName: "苏宁易购",
        customerAddress: "南京市玄武区苏宁总部",
        customerContact: "孙经理",
        customerPhone: "13400134000",
        paymentTerms: "Net 60",
        customerNo: "SN26-101",
        createdAt: "2026-04-20T10:15:00",
        updatedAt: "2026-04-20T10:15:00",
        details: [
          {
            id: "BILLTEST-SALES-003-1",
            deliveryId: "BILLTEST-SALES-003",
            productId: "P005",
            productName: "Apple Watch",
            quantity: 3,
            unit: "个",
            spec: "电子产品",
            unitPrice: 3499,
            totalAmount: 10497,
            notes: "",
            status: "created",
          },
          {
            id: "BILLTEST-SALES-003-2",
            deliveryId: "BILLTEST-SALES-003",
            productId: "P004",
            productName: "AirPods Pro",
            quantity: 2,
            unit: "个",
            spec: "电子产品",
            unitPrice: 1999,
            totalAmount: 3998,
            notes: "",
            status: "created",
          },
          {
            id: "BILLTEST-SALES-003-3",
            deliveryId: "BILLTEST-SALES-003",
            productId: "P006",
            productName: "airpods",
            quantity: 3,
            unit: "个",
            spec: "未分类",
            unitPrice: 1200,
            totalAmount: 3600,
            notes: "测试价差样例",
            status: "created",
          },
        ],
      },
      {
        id: "BILLTEST-SALES-004",
        type: "sales",
        orderNo: "XS202602180101",
        issueDate: "20260218",
        deliveryDate: "20260218",
        status: "created",
        totalAmount: 20997,
        notes:
          "苏宁易购对账测试单 - iPhone 13 Pro x 1, MacBook Air M2 x 1, Apple Watch x 1",
        companyId: "CO001",
        companyName: "化工",
        companyAddress: "上海市浦东新区张江高科技园区",
        companyPhone: "13800138001",
        companyContact: "张经理",
        customerId: "C003",
        customerName: "苏宁易购",
        customerAddress: "南京市玄武区苏宁总部",
        customerContact: "孙经理",
        customerPhone: "13400134000",
        paymentTerms: "Net 60",
        customerNo: "SN26-102",
        createdAt: "2026-02-18T10:30:00",
        updatedAt: "2026-02-18T10:30:00",
        details: [
          {
            id: "BILLTEST-SALES-004-1",
            deliveryId: "BILLTEST-SALES-004",
            productId: "P001",
            productName: "iPhone 13 Pro",
            quantity: 1,
            unit: "个",
            spec: "电子产品",
            unitPrice: 7999,
            totalAmount: 7999,
            notes: "",
            status: "created",
          },
          {
            id: "BILLTEST-SALES-004-2",
            deliveryId: "BILLTEST-SALES-004",
            productId: "P002",
            productName: "MacBook Air M2",
            quantity: 1,
            unit: "个",
            spec: "电子产品",
            unitPrice: 9499,
            totalAmount: 9499,
            notes: "",
            status: "created",
          },
          {
            id: "BILLTEST-SALES-004-3",
            deliveryId: "BILLTEST-SALES-004",
            productId: "P005",
            productName: "Apple Watch",
            quantity: 1,
            unit: "个",
            spec: "电子产品",
            unitPrice: 3499,
            totalAmount: 3499,
            notes: "",
            status: "created",
          },
        ],
      },
      {
        id: "BILLTEST-PUR-001",
        supplierId: "S001",
        orderId: "PO20260418001",
        deliveryDate: "2026-04-18",
        expectedDate: "2026-04-18",
        status: "received",
        totalAmount: 42993,
        notes: "测试采购单 - 苹果公司",
        createdAt: "2026-04-18T11:00:00",
        updatedAt: "2026-04-18T11:00:00",
        details: [
          {
            id: "BILLTEST-PUR-001-1",
            deliveryId: "BILLTEST-PUR-001",
            productId: "P001",
            quantity: 3,
            unitPrice: 6999,
            totalAmount: 20997,
            receivedQuantity: 3,
            notes: "",
            status: "received",
          },
          {
            id: "BILLTEST-PUR-001-2",
            deliveryId: "BILLTEST-PUR-001",
            productId: "P004",
            quantity: 6,
            unitPrice: 1799,
            totalAmount: 10794,
            receivedQuantity: 6,
            notes: "",
            status: "received",
          },
          {
            id: "BILLTEST-PUR-001-3",
            deliveryId: "BILLTEST-PUR-001",
            productId: "P005",
            quantity: 4,
            unitPrice: 2799,
            totalAmount: 11202,
            receivedQuantity: 4,
            notes: "",
            status: "received",
          },
        ],
      },
      {
        id: "BILLTEST-PUR-002",
        supplierId: "S004",
        orderId: "PO20260419001",
        deliveryDate: "2026-04-19",
        expectedDate: "2026-04-19",
        status: "received",
        totalAmount: 11110,
        notes: "测试采购单 - 拼多多",
        createdAt: "2026-04-19T15:40:00",
        updatedAt: "2026-04-19T15:40:00",
        details: [
          {
            id: "BILLTEST-PUR-002-1",
            deliveryId: "BILLTEST-PUR-002",
            productId: "P006",
            quantity: 5,
            unitPrice: 1000,
            totalAmount: 5000,
            receivedQuantity: 5,
            notes: "",
            status: "received",
          },
          {
            id: "BILLTEST-PUR-002-2",
            deliveryId: "BILLTEST-PUR-002",
            productId: "P007",
            quantity: 2,
            unitPrice: 3055,
            totalAmount: 6110,
            receivedQuantity: 2,
            notes: "",
            status: "received",
          },
        ],
      },
    ];
  }

  async function ensureBillsDemoSourceData() {
    if (!global.mockData) return false;

    const existingIds = new Set(
      global
        .normalizeList(global.mockData.deliveryNotes)
        .map((note) => String(note.id || "").trim()),
    );
    const demoRecords = createBillsDemoSourceData().filter(
      (record) => !existingIds.has(record.id),
    );
    if (!demoRecords.length) return false;

    global.mockData.deliveryNotes = demoRecords.concat(
      global.normalizeList(global.mockData.deliveryNotes),
    );
    if (typeof global.saveMockData === "function") {
      await global.saveMockData();
    }
    return true;
  }

  function mapDeliveryNoteToStructured(note, index) {
    const details = (
      global.normalizeList ? global.normalizeList(note.details) : []
    ).map((detail, detailIndex) => ({
      id: `${note.id || note.orderNo || "SD"}-item-${detailIndex + 1}`,
      sourceType: "delivery_note",
      sourceId: note.id,
      sourceNo: note.orderNo || note.id,
      bizDate: note.deliveryDate || note.issueDate || note.createdAt,
      productId: detail.productId || "",
      productNameSnapshot: detail.productName || "未命名商品",
      specSnapshot: detail.spec || "",
      unitSnapshot: detail.unit || "",
      quantity: Number(detail.quantity) || 0,
      unitPrice: Number(detail.unitPrice) || 0,
      lineAmount: Number(detail.totalAmount) || 0,
      remark: detail.notes || "",
      sortOrder: detailIndex + 1,
    }));

    const amount = details.reduce(
      (sum, item) => sum + (Number(item.lineAmount) || 0),
      0,
    );
    const createdAt = note.createdAt || global.getLocalISOString();
    return {
      id: `CST${String(index + 1).padStart(4, "0")}`,
      recordType: "statement-v1",
      statementType: "customer",
      partyId: note.customerId || "",
      partyNameSnapshot: note.customerName || "未命名客户",
      companyId: note.companyId || "",
      companyNameSnapshot: note.companyName || "",
      companyAddressSnapshot: note.companyAddress || "",
      companyPhoneSnapshot: note.companyPhone || "",
      contactNameSnapshot: note.customerContact || "",
      contactPhoneSnapshot: note.customerPhone || "",
      partyAddressSnapshot: note.customerAddress || "",
      statementDate: note.issueDate || note.deliveryDate || createdAt,
      periodStart: note.deliveryDate || note.issueDate || createdAt,
      periodEnd: note.deliveryDate || note.issueDate || createdAt,
      documentCount: 1,
      currentAmount: amount,
      taxRate: 1,
      amountWithTax: amount,
      arrearsAmount: 0,
      totalAmount: amount,
      totalAmountUppercase: convertAmountToChineseUpperForBills(amount),
      status: "pending_check",
      notes: note.notes || "",
      details,
      arrears: [],
      payments: [],
      sourceDocumentIds: [note.id],
      createdAt,
      updatedAt: note.updatedAt || createdAt,
    };
  }

  async function ensureBillsSeedData() {
    if (typeof global.loadMockData === "function") {
      await global.loadMockData();
    }
    if (typeof global.loadStockMovementData === "function") {
      global.loadStockMovementData();
    }

    if (!global.mockData) return;

    await ensureBillsDemoSourceData();

    const currentBills = global.normalizeList
      ? global.normalizeList(global.mockData.bills)
      : [];
    const migrated = migrateBillsData(currentBills);
    const nextBills = migrated.records.slice();
    const structured = nextBills.filter(
      (record) => record?.recordType === "statement-v1",
    );
    let changed = migrated.changed || nextBills.length !== currentBills.length;

    if (!structured.some((record) => record.statementType === "customer")) {
      global
        .normalizeList(global.mockData.deliveryNotes)
        .filter(isSalesDeliveryNote)
        .forEach((note, index) => {
          nextBills.push(mapDeliveryNoteToStructured(note, index));
        });
      changed = true;
    }

    if (changed) {
      global.mockData.bills = nextBills;
      if (typeof global.saveMockData === "function") {
        await global.saveMockData();
      }
    }
  }

  function normalizeBillsSectionCopy() {
    const section = document.getElementById("bills");
    if (!section) return;

    const header = section.firstElementChild;
    const title = section.querySelector("h2");
    const desc = section.querySelector("p");
    const addButton = document.getElementById("add-bill-btn");

    if (title) title.textContent = "对账单系统";
    if (desc) desc.textContent = "管理所有客户和供应商对账单";
    if (addButton) {
      addButton.innerHTML = '<i class="fa fa-plus mr-2"></i> 新增对账单';
    }

    section.querySelectorAll("#bills-tabs button").forEach((button) => {
      const meta = getBillsMeta(button.dataset.tab);
      if (meta) button.textContent = meta.label;
    });

    const partyLabel = document.getElementById("bills-filter-party-label");
    if (partyLabel) {
      partyLabel.textContent = getBillsMeta(state.activeTab).partyLabel;
    }

    const labels = section.querySelectorAll(
      ".bg-white.rounded-lg.shadow-card.p-4.mb-6 label",
    );
    if (labels[1]) labels[1].textContent = "对账状态";
    if (labels[2]) labels[2].textContent = "日期范围";
    if (labels[3]) labels[3].textContent = "搜索";

    const headerTitles = section.querySelectorAll("thead th");
    const titles = [
      "对账单编号",
      getBillsMeta(state.activeTab).partyLabel,
      "对账期间",
      "账单金额",
      "状态",
      "创建与更新",
      "操作",
    ];
    headerTitles.forEach((cell, index) => {
      if (titles[index]) cell.textContent = titles[index];
    });

    if (headerTitles[6]) {
      headerTitles[6].classList.add("bills-action-header");
      headerTitles[6].style.textAlign = "left";
    }

    const tableWrapper = section.querySelector(".overflow-x-auto");
    if (tableWrapper) {
      tableWrapper.classList.add("bills-table-scroll");
    }
  }

  function getBillsModalElements() {
    return {
      overlay: document.getElementById("modal"),
      panel: document.getElementById("modal-panel"),
      title: document.getElementById("modal-title"),
      content: document.getElementById("modal-content"),
      cancel: document.getElementById("modal-cancel"),
      confirm: document.getElementById("modal-confirm"),
      close: document.getElementById("close-modal"),
      footer: document.querySelector("#modal-panel > div:last-child"),
    };
  }

  function applyBillsListVisualParity() {
    const section = document.getElementById("bills");
    const addButton = document.getElementById("add-bill-btn");
    if (!section) return;

    section.firstElementChild?.classList.add("bills-list-header");

    if (addButton) {
      addButton.className =
        "bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg flex items-center transition-all-300";
      addButton.parentElement?.classList.add("bills-list-toolbar");
    }
  }

  function closeBillsModal() {
    const { overlay, panel, content, cancel, confirm, footer } =
      getBillsModalElements();
    if (overlay) overlay.classList.add("hidden");
    if (panel) {
      panel.className = "bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4";
      panel.style.maxWidth = "";
      panel.style.width = "";
    }
    if (content) {
      content.className = "p-4";
      content.innerHTML = "";
    }
    if (cancel) {
      cancel.className =
        "bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-lg mr-2 transition-all-300";
      cancel.textContent = "取消";
      cancel.onclick = null;
    }
    if (confirm) {
      confirm.className =
        "bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-all-300";
      confirm.textContent = "确认";
      confirm.onclick = null;
    }
    if (footer) {
      footer.className = "flex justify-end p-4 border-t border-gray-200";
    }

    const pendingClose = state.modalCloseHandler;
    state.modalCloseHandler = null;
    if (typeof pendingClose === "function") {
      pendingClose();
    }
  }

  function bindBillsModalLifecycle() {
    if (state.modalLifecycleBound) return;
    const { overlay, close, cancel } = getBillsModalElements();
    if (overlay) {
      overlay.addEventListener("click", (event) => {
        if (event.target === overlay) {
          closeBillsModal();
        }
      });
    }
    if (close) {
      close.addEventListener("click", closeBillsModal);
    }
    if (cancel) {
      cancel.addEventListener("click", () => {
        if (!cancel.classList.contains("hidden")) {
          closeBillsModal();
        }
      });
    }
    state.modalLifecycleBound = true;
  }

  function createBillsModalButton(config) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = config.label;
    button.className = config.className || "bills-outline-button";
    if (config.style) {
      button.style.cssText = config.style;
    }
    button.addEventListener("click", config.onClick);
    return button;
  }

  function openBillsModal(config) {
    const elements = getBillsModalElements();
    if (
      !elements.overlay ||
      !elements.panel ||
      !elements.content ||
      !elements.title ||
      !elements.footer
    ) {
      return;
    }

    state.modalCloseHandler =
      typeof config.onClose === "function" ? config.onClose : null;

    elements.title.textContent = config.title || "查看对账单";
    elements.panel.className =
      config.panelClassName ||
      "bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4";
    elements.panel.style.maxWidth = config.maxWidth || "";
    elements.panel.style.width = config.width || "";
    elements.content.className = config.contentClassName || "p-4";
    elements.content.innerHTML = config.content || "";
    hydrateBillsEmptyStates(elements.content);

    const footer = elements.footer;
    if (footer) {
      footer.className =
        config.footerClassName ||
        "flex items-center justify-between p-4 border-t border-gray-200";
      footer.setAttribute("data-modal-footer", "true");

      let cancelButton = elements.cancel;
      if (!cancelButton) {
        cancelButton = document.createElement("button");
        cancelButton.id = "modal-cancel";
        cancelButton.type = "button";
      }

      let confirmButton = elements.confirm;
      if (!confirmButton) {
        confirmButton = document.createElement("button");
        confirmButton.id = "modal-confirm";
        confirmButton.type = "button";
      }

      cancelButton.className = "hidden";
      cancelButton.textContent = "取消";
      cancelButton.onclick = null;

      confirmButton.className = "hidden";
      confirmButton.textContent = "确认";
      confirmButton.onclick = null;

      footer.replaceChildren();

      const leftWrap = document.createElement("div");
      leftWrap.className = "flex items-center gap-2";
      (config.leftButtons || []).forEach((buttonConfig) => {
        leftWrap.appendChild(createBillsModalButton(buttonConfig));
      });

      const rightWrap = document.createElement("div");
      rightWrap.className = "flex items-center gap-2";
      (config.rightButtons || []).forEach((buttonConfig) => {
        rightWrap.appendChild(createBillsModalButton(buttonConfig));
      });

      rightWrap.appendChild(cancelButton);
      rightWrap.appendChild(confirmButton);

      footer.appendChild(leftWrap);
      footer.appendChild(rightWrap);
    }

    elements.overlay.classList.remove("hidden");
  }

  function getStatementsForTab(tabKey) {
    if (tabKey === "payment") {
      return getStatementRecords().filter((record) =>
        ["pending_payment", "partial_paid"].includes(
          normalizeBillStatus(record.status),
        ),
      );
    }
    return getStatementRecords().filter(
      (record) => record.statementType === tabKey,
    );
  }

  function getPartyOptions() {
    if (state.activeTab === "supplier") {
      return global
        .normalizeList(global.mockData?.suppliers)
        .map((supplier) => ({
          value: supplier.id,
          label: supplier.name,
        }));
    }

    if (state.activeTab === "customer") {
      return global
        .normalizeList(global.mockData?.customers)
        .map((customer) => ({
          value: customer.id,
          label: customer.name,
        }));
    }

    if (state.activeTab === "payment") {
      const optionMap = new Map();
      getStatementsForTab("payment").forEach((record) => {
        const value = getStatementPartyFilterValue(record);
        if (!value || optionMap.has(value)) return;
        optionMap.set(value, {
          value,
          label: record.partyNameSnapshot || value,
        });
      });
      return Array.from(optionMap.values());
    }

    return [];
  }

  function renderBillPartyFilter() {
    const container = document.getElementById(
      "bills-filter-supplier-container",
    );
    const input = document.getElementById("bills-filter-supplier");
    if (!container || !input || typeof global.renderAntdSelect !== "function")
      return;

    global.renderAntdSelect(
      "bills-filter-supplier-container",
      "bills-filter-supplier",
      getPartyOptions(),
      {
        placeholder:
          state.activeTab === "supplier"
            ? "全部供应商"
            : state.activeTab === "customer"
              ? "全部客户"
              : "全部对象",
        value: input.value || undefined,
      },
      () => {
        ensureBillsPaginationState().page = 1;
        updateBillsTableOverride();
      },
    );
  }

  function renderBillStatusFilter() {
    const container = document.getElementById("bills-filter-status-container");
    const input = document.getElementById("bills-filter-status");
    if (!container || !input || typeof global.renderAntdSelect !== "function")
      return;

    const statuses =
      state.activeTab === "payment"
        ? ["pending_payment", "partial_paid"]
        : [
            "pending_check",
            "pending_payment",
            "partial_paid",
            "paid",
            "cancelled",
          ];

    global.renderAntdSelect(
      "bills-filter-status-container",
      "bills-filter-status",
      [{ value: "", label: "全部状态" }].concat(
        statuses.map((status) => ({
          value: status,
          label: BILL_STATUS_META[status].label,
        })),
      ),
      {
        placeholder: "全部状态",
        value: input.value || "",
      },
      () => {
        ensureBillsPaginationState().page = 1;
        updateBillsTableOverride();
      },
    );
  }

  function renderBillSearchInput() {
    const container = document.getElementById("bills-filter-search-container");
    const input = document.getElementById("bills-filter-search");
    if (!container || !input || typeof global.renderAntdInput !== "function")
      return;

    global.renderAntdInput(
      "bills-filter-search-container",
      "bills-filter-search",
      {
        placeholder: "搜索对账单...",
        defaultValue: input.value || "",
        prefixIcon: "fa fa-search",
      },
      () => {
        ensureBillsPaginationState().page = 1;
        updateBillsTableOverride();
      },
    );
  }

  function initBillFiltersOverride() {
    normalizeBillsSectionCopy();
    applyBillsListVisualParity();
    renderBillPartyFilter();
    renderBillStatusFilter();
    renderBillSearchInput();
  }

  function getStatementDisplayName(statement) {
    return (
      statement.partyNameSnapshot ||
      (state.activeTab === "supplier" ? "未命名供应商" : "未命名客户")
    );
  }

  function getBillUserInitial(statement) {
    if (statement.updatedByName) {
      return global.escapeHTML(
        String(statement.updatedByName).charAt(0) || "张",
      );
    }
    return getCurrentUserInitialForBills();
  }

  function getBillRowActions(record) {
    const paymentDisabled = ["paid", "cancelled"].includes(
      normalizeBillStatus(record.status),
    );
    return `
            <div class="bills-action-links">
                <a href="#/bills/view/${encodeURIComponent(record.id)}" class="text-primary hover:text-primary-dark">查看</a>
                <button type="button" class="text-orange-500 hover:text-orange-600" data-action="export" data-id="${global.escapeHTML(record.id)}">导出</button>
                <button type="button" class="${paymentDisabled ? "text-gray-300 cursor-not-allowed" : "text-green-600 hover:text-green-700"}" data-action="payment" data-id="${global.escapeHTML(record.id)}" ${paymentDisabled ? "disabled" : ""}>登记付款</button>
            </div>
        `;
  }

  function getBillTimeCellHtml(statement) {
    const initial = getBillUserInitial(statement);
    return `
            <div class="space-y-1 whitespace-nowrap">
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formatBillDateTime(statement.createdAt)}</span>
                    </span>
                </div>
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formatBillDateTime(statement.updatedAt)}</span>
                    </span>
                </div>
            </div>
        `;
  }

  function renderBillRows(records) {
    return records
      .map(
        (record) => `
            <tr>
                <td class="px-6 py-4 text-sm font-medium text-gray-900 whitespace-nowrap">${global.escapeHTML(record.id)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">${global.escapeHTML(getStatementDisplayName(record))}</td>
                <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">${global.escapeHTML(formatStatementPeriod(record.periodStart, record.periodEnd))}</td>
                <td class="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">${global.escapeHTML(formatBillCurrency(record.totalAmount))}</td>
                <td class="px-6 py-4 whitespace-nowrap">${getStatusBadgeHtml(record.status)}</td>
                <td class="px-6 py-4 text-sm text-gray-500 align-top">${getBillTimeCellHtml(record)}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium bills-action-cell align-top">${getBillRowActions(record)}</td>
            </tr>
        `,
      )
      .join("");
  }

  function getFilteredStatements() {
    const statements = getStatementsForTab(state.activeTab);
    const partyValue =
      document.getElementById("bills-filter-supplier")?.value || "";
    const statusValue =
      document.getElementById("bills-filter-status")?.value || "";
    const startValue =
      document.getElementById("bills-filter-date-start")?.value || "";
    const endValue =
      document.getElementById("bills-filter-date-end")?.value || "";
    const searchValue = String(
      document.getElementById("bills-filter-search")?.value || "",
    )
      .trim()
      .toLowerCase();

    return statements
      .filter(
        (record) =>
          !partyValue || getStatementPartyFilterValue(record) === partyValue,
      )
      .filter(
        (record) =>
          !statusValue || normalizeBillStatus(record.status) === statusValue,
      )
      .filter((record) => {
        if (!startValue && !endValue) return true;
        const createdAt = normalizeBillDate(
          record.statementDate || record.createdAt,
        );
        if (!createdAt) return true;
        const dateOnly = formatBillDateOnly(createdAt);
        return (
          (!startValue || dateOnly >= startValue) &&
          (!endValue || dateOnly <= endValue)
        );
      })
      .filter((record) => {
        if (!searchValue) return true;
        const bag = [
          record.id,
          record.partyNameSnapshot,
          formatStatementPeriod(record.periodStart, record.periodEnd),
          record.notes,
        ]
          .join(" ")
          .toLowerCase();
        return bag.includes(searchValue);
      })
      .sort((a, b) => {
        const timeA =
          normalizeBillDate(a.updatedAt || a.createdAt)?.getTime() || 0;
        const timeB =
          normalizeBillDate(b.updatedAt || b.createdAt)?.getTime() || 0;
        return timeB - timeA;
      });
  }

  function updateBillsTableOverride() {
    normalizeBillsSectionCopy();
    applyBillsListVisualParity();

    const tbody = document.getElementById("bills-table-body");
    if (!tbody) return;

    const filtered = getFilteredStatements();
    const billsPagination = ensureBillsPaginationState();
    billsPagination.total = filtered.length;
    const pageSize = billsPagination.pageSize;
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    if (billsPagination.page > totalPages) {
      billsPagination.page = totalPages;
    }

    const startIndex = (billsPagination.page - 1) * pageSize;
    const currentPageRows = filtered.slice(startIndex, startIndex + pageSize);

    if (!currentPageRows.length) {
      global.renderAntdEmptyTableRow(
        tbody,
        7,
        getBillsMeta(state.activeTab).emptyText,
        {
          cellClassName: "bills-empty-state",
          wrapperClassName: "py-2",
        },
      );
    } else {
      tbody.innerHTML = renderBillRows(currentPageRows);
    }

    if (typeof global.renderPaginationControl === "function") {
      global.renderPaginationControl(
        "bills-pagination-container",
        "bills",
        () => {
          updateBillsTableOverride();
        },
      );
    }
  }

  function updateActiveBillTabUI() {
    document.querySelectorAll("#bills-tabs button").forEach((button) => {
      const isActive = button.dataset.tab === state.activeTab;
      button.classList.toggle("active", isActive);
      button.classList.toggle("text-primary", isActive);
      button.classList.toggle("border-primary", isActive);
      button.classList.toggle("border-transparent", !isActive);
    });
  }

  function bindBillTabEventsOverride() {
    if (state.filtersBound) return;
    document.querySelectorAll("#bills-tabs button").forEach((button) => {
      button.addEventListener("click", () => {
        state.activeTab = button.dataset.tab || "customer";
        document.getElementById("bills-filter-supplier").value = "";
        document.getElementById("bills-filter-status").value = "";
        document.getElementById("bills-filter-search").value = "";
        ensureBillsPaginationState().page = 1;
        updateActiveBillTabUI();
        initBillFiltersOverride();
        updateBillsTableOverride();
      });
    });
    state.filtersBound = true;
  }

  function ensureBillsRouteSections() {
    const billsSection = document.getElementById("bills");
    if (!billsSection || !billsSection.parentElement) return;

    if (!document.getElementById("bills-create")) {
      const createSection = document.createElement("section");
      createSection.id = "bills-create";
      createSection.className = "page-section hidden";
      billsSection.insertAdjacentElement("afterend", createSection);
    }

    if (!document.getElementById("bills-view")) {
      const viewSection = document.createElement("section");
      viewSection.id = "bills-view";
      viewSection.className = "page-section hidden";
      const createSection = document.getElementById("bills-create");
      if (createSection) {
        createSection.insertAdjacentElement("afterend", viewSection);
      } else {
        billsSection.insertAdjacentElement("afterend", viewSection);
      }
    }
  }

  function parseBillsRouteHash(hashValue) {
    const rawHash = String(hashValue || global.location.hash || "").trim();
    if (!rawHash) return null;
    if (rawHash === "#/bills") {
      return { type: "list" };
    }
    if (rawHash === "#/bills/create") {
      return { type: "create" };
    }
    if (rawHash.startsWith("#/bills/view/")) {
      const statementId = decodeURIComponent(
        rawHash.slice("#/bills/view/".length),
      );
      return statementId ? { type: "view", statementId } : null;
    }
    return null;
  }

  function showBillsSection(sectionId, routeHash) {
    if (typeof global.showSection === "function") {
      global.showSection(sectionId, { routeHash, skipHashSync: true });
    } else {
      document
        .querySelectorAll(".page-section")
        .forEach((section) => section.classList.add("hidden"));
      document.getElementById(sectionId)?.classList.remove("hidden");
    }

    if (routeHash && global.location.hash !== routeHash) {
      global.location.hash = routeHash;
    }
  }

  function buildBillsRouteState(route, options) {
    if (!route?.type) return null;

    const config = options || {};
    if (route.type === "list") {
      return {
        type: "list",
        tab: route.tab || config.tab || state.activeTab || "customer",
      };
    }

    if (route.type === "create") {
      return { type: "create" };
    }

    if (route.type === "view") {
      return {
        type: "view",
        statementId: route.statementId || "",
        returnTab:
          config.returnTab ||
          state.activeViewReturnTab ||
          state.activeTab ||
          "customer",
      };
    }

    return { type: route.type };
  }

  function getBillsRouteStateKey(routeState) {
    if (!routeState?.type) return "";
    if (routeState.type === "view") {
      return `${routeState.type}:${routeState.statementId || ""}:${routeState.returnTab || ""}`;
    }
    if (routeState.type === "list") {
      return `${routeState.type}:${routeState.tab || ""}`;
    }
    return routeState.type;
  }

  function returnToPreviousBillsLevel(statementId, fallbackTab) {
    if (global.normalizeList(state.occupiedViewContext?.entries).length) {
      reopenOccupiedStatementsModal(statementId);
      return;
    }

    const previousRoute = state.previousBillsRoute;
    if (previousRoute?.type === "create") {
      navigateToBillsRoute(
        { type: "create" },
        { draft: state.pendingDraft || {} },
      );
      return;
    }

    if (
      previousRoute?.type === "view" &&
      previousRoute.statementId &&
      previousRoute.statementId !== statementId
    ) {
      navigateToBillsRoute(
        { type: "view", statementId: previousRoute.statementId },
        { returnTab: previousRoute.returnTab || fallbackTab },
      );
      return;
    }

    if (previousRoute?.type === "list") {
      navigateToBillsRoute(
        { type: "list", tab: previousRoute.tab || fallbackTab },
        { tab: previousRoute.tab || fallbackTab },
      );
      return;
    }

    navigateToBillsRoute(
      { type: "list", tab: fallbackTab },
      { tab: fallbackTab },
    );
  }

  function navigateToBillsRoute(route, options) {
    const config = options || {};
    ensureBillsRouteSections();
    const currentRouteState =
      parseBillsRouteHash(global.location.hash) || state.currentBillsRoute;
    const targetRouteState = buildBillsRouteState(route, config);

    if (currentRouteState && targetRouteState) {
      const currentKey = getBillsRouteStateKey(currentRouteState);
      const targetKey = getBillsRouteStateKey(targetRouteState);
      if (currentKey && targetKey && currentKey !== targetKey) {
        state.previousBillsRoute = currentRouteState;
      }
    }
    if (targetRouteState) {
      state.currentBillsRoute = targetRouteState;
    }

    if (route.type === "list") {
      clearBillsViewFloatingActions();
      state.activeViewStatementId = "";
      const listTab = route.tab || config.tab;
      if (listTab) {
        state.activeTab = listTab;
      }
      updateActiveBillTabUI();
      initBillFiltersOverride();
      updateBillsTableOverride();
      showBillsSection("bills", "#/bills");
      return;
    }

    if (route.type === "create") {
      clearBillsViewFloatingActions();
      state.activeViewStatementId = "";
      renderBillsCreateRoute(config.draft || state.pendingDraft || {});
      showBillsSection("bills-create", "#/bills/create");
      return;
    }

    if (route.type === "view") {
      renderBillsViewRoute(route.statementId, config);
      showBillsSection(
        "bills-view",
        `#/bills/view/${encodeURIComponent(route.statementId)}`,
      );
    }
  }

  function handleBillsRouteHash() {
    const route = parseBillsRouteHash();
    if (!route) return false;

    if (route.type === "list") {
      navigateToBillsRoute(route);
      return true;
    }

    if (route.type === "create") {
      navigateToBillsRoute(route, { draft: state.pendingDraft || {} });
      return true;
    }

    if (route.type === "view") {
      if (document.querySelector("#bills.page-section:not(.hidden)")) {
        state.activeViewReturnTab = state.activeTab;
      }
      navigateToBillsRoute(route);
      return true;
    }

    return false;
  }

  function bindBillsRouteLifecycle() {
    if (state.routeBound) return;
    global.addEventListener("hashchange", () => {
      handleBillsRouteHash();
    });
    state.routeBound = true;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function exportStatementAsExcel(statement) {
    const blob = new Blob([buildStatementExportHtml(statement)], {
      type: "application/vnd.ms-excel;charset=utf-8;",
    });
    downloadBlob(blob, `${statement.id}.xls`);
  }

  async function exportStatementAsPdf(statement) {
    try {
      const response = await fetch("/api/export/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          html: buildStatementExportHtml(statement),
          filename: `${statement.id}.pdf`,
        }),
      });

      if (!response.ok) {
        let message = "PDF 导出失败";
        try {
          const errorPayload = await response.json();
          if (errorPayload?.error) {
            message = errorPayload.error;
          }
        } catch (parseError) {
          const rawText = await response.text().catch(() => "");
          if (rawText) {
            message = rawText;
          }
        }
        alert(`PDF 导出失败：${message}`);
        return false;
      }

      const blob = await response.blob();
      downloadBlob(blob, `${statement.id}.pdf`);
      return true;
    } catch (error) {
      console.error("exportStatementAsPdf failed:", error);
      alert(
        `PDF 导出失败：${error?.message || "请检查本地导出服务是否正常运行"}`,
      );
      return false;
    }
  }

  function saveStatementRecord(statement, reopenView) {
    const bills = global.normalizeList(global.mockData?.bills);
    const nextBills = bills.map((item) =>
      item.id === statement.id ? statement : item,
    );
    global.mockData.bills = nextBills;
    if (typeof global.saveMockData === "function") {
      global.saveMockData();
    }
    updateBillsTableOverride();
    const isViewingCurrentStatement =
      state.activeViewStatementId === statement.id &&
      !document.getElementById("bills-view")?.classList.contains("hidden");
    if (reopenView || isViewingCurrentStatement) {
      openStatementViewModal(statement, {
        returnTab: state.activeViewReturnTab || statement.statementType,
      });
    }
  }

  function openPaymentModal(statement) {
    const content = `
            <div class="space-y-4">
                <div class="bills-field">
                    <label>付款日期</label>
                    <input id="bill-payment-date" type="date" class="w-full border border-gray-300 rounded-md px-3 py-2" value="${global.escapeHTML(formatBillDateOnly(new Date()))}">
                </div>
                <div class="bills-field">
                    <label>付款金额</label>
                    <input id="bill-payment-amount" type="number" min="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2" value="${global.escapeHTML(String(getOutstandingAmount(statement)))}">
                </div>
                <div class="bills-field">
                    <label>付款方式</label>
                    <div id="bill-payment-method-container"></div>
                    <input type="hidden" id="bill-payment-method" value="bank_transfer">
                </div>
                <div class="bills-field">
                    <label>备注</label>
                    <textarea id="bill-payment-remark" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2"></textarea>
                </div>
            </div>
        `;

    openBillsModal({
      title: "登记付款",
      content,
      rightButtons: [
        {
          label: "取消",
          className: "bills-outline-button",
          onClick: closeBillsModal,
        },
        {
          label: "确认",
          className:
            "bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-all-300",
          onClick: function () {
            const amount = Number(
              document.getElementById("bill-payment-amount").value || 0,
            );
            const payDate = document.getElementById("bill-payment-date").value;
            const payMethod =
              document.getElementById("bill-payment-method").value ||
              "bank_transfer";
            const remark =
              document.getElementById("bill-payment-remark").value || "";
            const outstandingAmount = getOutstandingAmount(statement);
            if (!payDate) {
              alert("请选择付款日期");
              return;
            }
            if (outstandingAmount <= 0) {
              alert("当前对账单已无未付金额");
              return;
            }
            if (!amount || amount <= 0) {
              alert("请输入有效的付款金额");
              return;
            }
            if (amount > outstandingAmount) {
              alert(
                `付款金额不能大于未付金额 ${formatBillCurrency(outstandingAmount)}`,
              );
              return;
            }
            const nextStatement = {
              ...statement,
              payments: global.normalizeList(statement.payments).concat([
                {
                  id: global.createRuntimeId("PAY"),
                  payDate,
                  payAmount: amount,
                  payMethod,
                  remark,
                },
              ]),
              updatedAt: global.getLocalISOString(),
            };
            nextStatement.status =
              getOutstandingAmount(nextStatement) > 0 ? "partial_paid" : "paid";
            closeBillsModal();
            saveStatementRecord(nextStatement, true);
          },
        },
      ],
    });

    if (typeof global.renderAntdSelect === "function") {
      global.renderAntdSelect(
        "bill-payment-method-container",
        "bill-payment-method",
        [
          { value: "bank_transfer", label: "银行转账" },
          { value: "cash", label: "现金" },
          { value: "wechat", label: "微信" },
          { value: "alipay", label: "支付宝" },
        ],
        { placeholder: "选择付款方式", value: "bank_transfer" },
      );
    }
  }

  function renderBillStatusSelect(statement) {
    if (typeof global.renderAntdSelect !== "function") return;

    global.renderAntdSelect(
      "bill-view-status-container",
      "bill-view-status",
      Object.keys(BILL_STATUS_META).map((key) => ({
        value: key,
        label: BILL_STATUS_META[key].label,
      })),
      { placeholder: "修改状态", value: normalizeBillStatus(statement.status) },
      (value) => {
        const nextStatement = {
          ...statement,
          status: value,
          updatedAt: global.getLocalISOString(),
        };
        saveStatementRecord(nextStatement, true);
      },
    );
  }

  function openStatementViewModal(statement, options) {
    if (!statement?.id) return;

    const occupiedEntries = global.normalizeList(
      state.occupiedViewContext?.entries,
    );
    const targetInOccupiedContext = occupiedEntries.some(
      (entry) => entry.statementId === statement.id,
    );
    const shouldPreserveOccupiedContext =
      options?.preserveOccupiedContext === true ||
      (state.activeViewStatementId === statement.id && targetInOccupiedContext);

    if (options?.occupiedContext) {
      state.occupiedViewContext = options.occupiedContext;
    } else if (!shouldPreserveOccupiedContext) {
      state.occupiedViewContext = null;
    }

    if (state.occupiedViewContext && targetInOccupiedContext) {
      state.occupiedViewContext.activeStatementId =
        options?.occupiedActiveStatementId || statement.id;
    }

    state.activeViewReturnTab =
      options?.returnTab ||
      state.activeTab ||
      statement.statementType ||
      "customer";
    navigateToBillsRoute(
      { type: "view", statementId: statement.id },
      { returnTab: state.activeViewReturnTab },
    );
  }

  function buildStatementFromDetails(
    formData,
    company,
    party,
    details,
    sourceNumbers,
    sourceIds,
  ) {
    const currentAmount = roundCurrency(
      details.reduce((sum, item) => sum + (Number(item.lineAmount) || 0), 0),
    );
    const taxRate = Number(formData.taxRate || 1);
    const amountWithTax = roundCurrency(currentAmount * taxRate);

    let arrears = [];
    let arrearsAmount = 0;
    if (formData.includeArrears) {
      arrears = getStatementRecords()
        .filter((record) => record.statementType === formData.statementType)
        .filter(
          (record) =>
            record.companyId === formData.companyId &&
            record.partyId === formData.partyId,
        )
        .filter((record) =>
          ["pending_payment", "partial_paid"].includes(
            normalizeBillStatus(record.status),
          ),
        )
        .filter(
          (record) =>
            formatBillDateOnly(record.periodEnd) < formData.periodStart,
        )
        .map((record) => ({
          sourceStatementId: record.id,
          monthLabel: `${formatBillDateOnly(record.periodEnd).slice(0, 7)} 货款`,
          amount: getOutstandingAmount(record),
        }))
        .filter((item) => item.amount > 0);
      arrearsAmount = roundCurrency(
        arrears.reduce((sum, item) => sum + item.amount, 0),
      );
    }

    const totalAmount = roundCurrency(amountWithTax + arrearsAmount);
    const prefix = formData.statementType === "supplier" ? "SST" : "CST";
    const allStatements = getStatementRecords().filter(
      (record) => record.statementType === formData.statementType,
    );

    return {
      id: global.createSequentialId(allStatements, prefix, 4),
      recordType: "statement-v1",
      statementType: formData.statementType,
      partyId: party.id,
      partyNameSnapshot: party.name,
      companyId: company.id,
      companyNameSnapshot: company.name,
      companyAddressSnapshot: company.address || "",
      companyPhoneSnapshot: company.contactPhone || "",
      contactNameSnapshot: party.contactPerson || "",
      contactPhoneSnapshot: party.contactPhone || "",
      partyAddressSnapshot: party.address || "",
      statementDate: formData.statementDate,
      periodStart: formData.periodStart,
      periodEnd: formData.periodEnd,
      documentCount: sourceNumbers.length,
      currentAmount,
      taxRate,
      amountWithTax,
      arrearsAmount,
      totalAmount,
      totalAmountUppercase: convertAmountToChineseUpperForBills(totalAmount),
      status: "pending_check",
      notes: "",
      details,
      arrears,
      payments: [],
      sourceDocumentIds: sourceIds,
      createdAt: global.getLocalISOString(),
      updatedAt: global.getLocalISOString(),
    };
  }

  function buildCustomerStatementFromForm(formData) {
    const company = global
      .normalizeList(global.mockData?.companies)
      .find((item) => item.id === formData.companyId);
    const party = global
      .normalizeList(global.mockData?.customers)
      .find((item) => item.id === formData.partyId);
    if (!company || !party) return null;

    const occupiedSourceIds = getActiveSourceDocumentIdSet("customer");
    const notes = global
      .normalizeList(global.mockData?.deliveryNotes)
      .filter(isSalesDeliveryNote)
      .filter((note) => note.companyId === formData.companyId)
      .filter((note) => note.customerId === formData.partyId)
      .filter((note) => {
        const date = formatBillDateOnly(
          note.deliveryDate || note.issueDate || note.createdAt,
        );
        return date >= formData.periodStart && date <= formData.periodEnd;
      })
      .filter((note) => !occupiedSourceIds.has(String(note.id || "").trim()));

    const details = [];
    notes.forEach((note) => {
      global.normalizeList(note.details).forEach((detail, index) => {
        details.push({
          id: `${note.id}-detail-${index + 1}`,
          sourceType: "delivery_note",
          sourceId: note.id,
          sourceNo: note.orderNo || note.id,
          bizDate: note.deliveryDate || note.issueDate || note.createdAt,
          productId: detail.productId || "",
          productNameSnapshot: detail.productName || "",
          specSnapshot: detail.spec || "",
          unitSnapshot: detail.unit || "",
          quantity: Number(detail.quantity) || 0,
          unitPrice: Number(detail.unitPrice) || 0,
          lineAmount: Number(detail.totalAmount) || 0,
          remark: detail.notes || "",
          sortOrder: details.length + 1,
        });
      });
    });

    return buildStatementFromDetails(
      formData,
      company,
      party,
      details,
      notes.map((note) => note.orderNo || note.id),
      notes.map((note) => note.id),
    );
  }

  function buildSupplierStatementFromForm(formData) {
    const company = global
      .normalizeList(global.mockData?.companies)
      .find((item) => item.id === formData.companyId);
    const party = global
      .normalizeList(global.mockData?.suppliers)
      .find((item) => item.id === formData.partyId);
    if (!company || !party) return null;

    const productMap = new Map(
      global
        .normalizeList(global.mockData?.products)
        .map((item) => [item.id, item]),
    );
    const occupiedSourceIds = getActiveSourceDocumentIdSet("supplier");
    const sourceNumbers = [];
    const sourceIds = [];
    const details = [];

    global
      .normalizeList(global.mockData?.deliveryNotes)
      .filter(isPurchaseDeliveryNote)
      .filter((note) => note.supplierId === formData.partyId)
      .filter((note) => {
        const date = formatBillDateOnly(
          note.deliveryDate || note.expectedDate || note.createdAt,
        );
        return date >= formData.periodStart && date <= formData.periodEnd;
      })
      .filter((note) => !occupiedSourceIds.has(String(note.id || "").trim()))
      .forEach((note) => {
        sourceNumbers.push(note.orderId || note.id);
        sourceIds.push(note.id);
        global.normalizeList(note.details).forEach((detail) => {
          const product = productMap.get(detail.productId);
          details.push({
            id: `${note.id}-detail-${details.length + 1}`,
            sourceType: "purchase_delivery_note",
            sourceId: note.id,
            sourceNo: note.orderId || note.id,
            bizDate: note.deliveryDate || note.expectedDate || note.createdAt,
            productId: detail.productId || "",
            productNameSnapshot: detail.productName || product?.name || "",
            specSnapshot: detail.spec || product?.category || "",
            unitSnapshot: detail.unit || product?.unit || "",
            quantity: Number(detail.quantity) || 0,
            unitPrice: Number(detail.unitPrice) || 0,
            lineAmount:
              Number(detail.totalAmount) ||
              roundCurrency(
                (Number(detail.quantity) || 0) *
                  (Number(detail.unitPrice) || 0),
              ),
            remark: detail.notes || note.notes || "",
            sortOrder: details.length + 1,
          });
        });
      });

    global
      .normalizeList(global.stockMovementData)
      .filter((record) => record.type === "inbound")
      .filter(
        (record) =>
          record.supplierId === formData.partyId ||
          record.supplierName === party.name,
      )
      .filter((record) => {
        const date = formatBillDateOnly(record.createdAt || record.updatedAt);
        return date >= formData.periodStart && date <= formData.periodEnd;
      })
      .filter(
        (record) => !occupiedSourceIds.has(String(record.id || "").trim()),
      )
      .forEach((record) => {
        sourceNumbers.push(record.id);
        sourceIds.push(record.id);
        details.push({
          id: `${record.id}-detail-${details.length + 1}`,
          sourceType: "stock_inbound",
          sourceId: record.id,
          sourceNo: record.id,
          bizDate: record.createdAt || record.updatedAt,
          productId: record.productId || "",
          productNameSnapshot: record.productName || "",
          specSnapshot: "",
          unitSnapshot: record.unit || "",
          quantity: Number(record.quantity) || 0,
          unitPrice: Number(record.price) || 0,
          lineAmount: roundCurrency(
            (Number(record.quantity) || 0) * (Number(record.price) || 0),
          ),
          remark: record.remark || "",
          sortOrder: details.length + 1,
        });
      });

    return buildStatementFromDetails(
      formData,
      company,
      party,
      details,
      sourceNumbers,
      sourceIds,
    );
  }

  function findDuplicateStatement(formData) {
    return getStatementRecords().find(
      (record) =>
        record.statementType === formData.statementType &&
        record.companyId === formData.companyId &&
        record.partyId === formData.partyId &&
        formatBillDateOnly(record.periodStart) === formData.periodStart &&
        formatBillDateOnly(record.periodEnd) === formData.periodEnd &&
        normalizeBillStatus(record.status) !== "cancelled",
    );
  }

  function persistStatement(statement) {
    global.mockData.bills = global
      .normalizeList(global.mockData.bills)
      .concat([statement]);
    if (typeof global.saveMockData === "function") {
      global.saveMockData();
    }
    state.activeTab = statement.statementType;
    updateActiveBillTabUI();
    initBillFiltersOverride();
    updateBillsTableOverride();
  }

  function getCreateDraftSourceCandidates(statementType, companyId, partyId) {
    if (statementType === "supplier") {
      const occupiedSourceIds = getActiveSourceDocumentIdSet("supplier");
      const purchaseCandidates = global
        .normalizeList(global.mockData?.deliveryNotes)
        .filter(isPurchaseDeliveryNote)
        .filter((note) => !partyId || note.supplierId === partyId)
        .filter((note) => !occupiedSourceIds.has(String(note.id || "").trim()))
        .map((note) => ({
          partyId: note.supplierId || "",
          date: formatBillDateOnly(
            note.deliveryDate || note.expectedDate || note.createdAt,
          ),
        }));

      const inboundCandidates = global
        .normalizeList(global.stockMovementData)
        .filter((record) => record.type === "inbound")
        .filter((record) => !partyId || record.supplierId === partyId)
        .filter(
          (record) => !occupiedSourceIds.has(String(record.id || "").trim()),
        )
        .map((record) => ({
          partyId: record.supplierId || "",
          date: formatBillDateOnly(record.createdAt || record.updatedAt),
        }));

      return purchaseCandidates
        .concat(inboundCandidates)
        .filter((item) => item.partyId && item.date !== "-");
    }

    const occupiedSourceIds = getActiveSourceDocumentIdSet("customer");
    return global
      .normalizeList(global.mockData?.deliveryNotes)
      .filter(isSalesDeliveryNote)
      .filter((note) => !companyId || note.companyId === companyId)
      .filter((note) => !partyId || note.customerId === partyId)
      .filter((note) => !occupiedSourceIds.has(String(note.id || "").trim()))
      .map((note) => ({
        partyId: note.customerId || "",
        date: formatBillDateOnly(
          note.deliveryDate || note.issueDate || note.createdAt,
        ),
      }))
      .filter((item) => item.partyId && item.date !== "-");
  }

  function buildCreateBillDraft(draft) {
    const baseDraft = {
      statementType: "",
      companyId: "",
      partyId: "",
      statementDate: "",
      periodStart: "",
      periodEnd: "",
      taxRate: "",
      includeArrears: false,
      ...(draft || {}),
    };
    return baseDraft;
  }

  function renderCreateBillDatePicker(containerId, inputId, value) {
    const container = document.getElementById(containerId);
    const hiddenInput = document.getElementById(inputId);
    if (!container || !hiddenInput) return;

    hiddenInput.value = value || "";

    if (!global.React || !global.ReactDOM || !global.antd || !global.dayjs) {
      container.innerHTML = `
                <input
                    type="date"
                    class="w-full border border-gray-300 rounded-md px-3 py-2"
                    value="${global.escapeHTML(value || "")}"
                >
            `;
      const fallbackInput = container.querySelector("input");
      if (fallbackInput) {
        fallbackInput.addEventListener("input", () => {
          hiddenInput.value = fallbackInput.value || "";
        });
      }
      return;
    }

    const React = global.React;
    const ReactDOM = global.ReactDOM;
    const DatePicker = global.antd.DatePicker;
    const dayjs = global.dayjs;

    const App = () => {
      const [pickerValue, setPickerValue] = React.useState(
        value ? dayjs(value) : null,
      );

      return React.createElement(DatePicker, {
        value: pickerValue,
        format: "YYYY/MM/DD",
        allowClear: true,
        needConfirm: true,
        inputReadOnly: true,
        placeholder: "请选择日期",
        style: { width: "100%" },
        onChange: (date) => {
          const nextValue = date ? date.format("YYYY-MM-DD") : "";
          setPickerValue(date || null);
          hiddenInput.value = nextValue;
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
        },
      });
    };

    if (!container._reactRoot) {
      container._reactRoot = ReactDOM.createRoot(container);
    }

    container._reactRoot.render(React.createElement(App));
  }

  function renderCreateBillDatePickers(draft) {
    renderCreateBillDatePicker(
      "bill-create-date-container",
      "bill-create-date",
      draft.statementDate || "",
    );
    renderCreateBillDatePicker(
      "bill-create-period-start-container",
      "bill-create-period-start",
      draft.periodStart || "",
    );
    renderCreateBillDatePicker(
      "bill-create-period-end-container",
      "bill-create-period-end",
      draft.periodEnd || "",
    );
  }

  function getCreateDraftFromModal() {
    return {
      statementType: document.getElementById("bill-create-type").value || "",
      companyId: document.getElementById("bill-create-company").value || "",
      partyId: document.getElementById("bill-create-party").value || "",
      statementDate: document.getElementById("bill-create-date").value || "",
      periodStart:
        document.getElementById("bill-create-period-start").value || "",
      periodEnd: document.getElementById("bill-create-period-end").value || "",
      taxRate: document.getElementById("bill-create-tax-rate").value || "",
      includeArrears: !!document.getElementById("bill-create-include-arrears")
        ?.checked,
    };
  }

  function openDuplicatePromptModal(formData, duplicate) {
    openBillsModal({
      title: "发现重复对账单",
      content: `
                <div class="space-y-3 text-sm text-gray-700">
                    <p>当前公司对当前对象在当前时间段已存在一份对账单。</p>
                    <div class="rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-1">
                        <div><strong>对账单编号：</strong>${global.escapeHTML(duplicate.id)}</div>
                        <div><strong>对账期间：</strong>${global.escapeHTML(formatStatementPeriod(duplicate.periodStart, duplicate.periodEnd))}</div>
                        <div><strong>状态：</strong>${BILL_STATUS_META[normalizeBillStatus(duplicate.status)].label}</div>
                    </div>
                </div>
            `,
      rightButtons: [
        {
          label: "取消",
          className: "bills-outline-button",
          onClick: closeBillsModal,
        },
        {
          label: "查看已有对账单",
          className: "bills-outline-button",
          onClick: function () {
            state.pendingDraft = formData;
            closeBillsModal();
            openStatementViewModal(duplicate, { returnTab: state.activeTab });
          },
        },
        {
          label: "返回修改条件",
          className:
            "bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-all-300",
          onClick: function () {
            closeBillsModal();
            openCreateBillModal(formData);
          },
        },
      ],
    });
  }

  function renderCreateFormSelects(draft) {
    if (typeof global.renderAntdSelect !== "function") return;

    global.renderAntdSelect(
      "bill-create-type-container",
      "bill-create-type",
      [
        { value: "customer", label: "客户对账单" },
        { value: "supplier", label: "供应商对账单" },
      ],
      { placeholder: "选择对账类型", value: draft.statementType || undefined },
      function (value) {
        const nextDraft = {
          ...getCreateDraftFromModal(),
          statementType: value || "",
          partyId: "",
          periodStart: "",
          periodEnd: "",
        };
        openCreateBillModal(nextDraft);
      },
    );

    global.renderAntdSelect(
      "bill-create-company-container",
      "bill-create-company",
      global
        .normalizeList(global.mockData?.companies)
        .map((item) => ({ value: item.id, label: item.name })),
      { placeholder: "选择我方公司", value: draft.companyId || undefined },
      function (value) {
        const nextDraft = {
          ...getCreateDraftFromModal(),
          companyId: value || "",
          partyId: "",
          periodStart: "",
          periodEnd: "",
        };
        openCreateBillModal(nextDraft);
      },
    );

    const partyOptions =
      draft.statementType === "supplier"
        ? global
            .normalizeList(global.mockData?.suppliers)
            .map((item) => ({ value: item.id, label: item.name }))
        : draft.statementType === "customer"
          ? global
              .normalizeList(global.mockData?.customers)
              .map((item) => ({ value: item.id, label: item.name }))
          : [];

    global.renderAntdSelect(
      "bill-create-party-container",
      "bill-create-party",
      partyOptions,
      {
        placeholder:
          draft.statementType === "supplier"
            ? "选择供应商"
            : draft.statementType === "customer"
              ? "选择客户"
              : "请先选择对账类型",
        value: draft.partyId || undefined,
      },
      function (value) {
        const nextDraft = {
          ...getCreateDraftFromModal(),
          partyId: value || "",
          periodStart: "",
          periodEnd: "",
        };
        openCreateBillModal(nextDraft);
      },
    );
  }

  function openCreateBillModal(draft) {
    state.pendingDraft = buildCreateBillDraft(draft);
    navigateToBillsRoute({ type: "create" }, { draft: state.pendingDraft });
  }

  function buildBillsRouteIntroCard(iconClass, title, description) {
    return `
            <div class="bills-route-intro">
                <div class="bills-route-intro-body">
                    <div class="bills-route-intro-icon">
                        <i class="fa ${global.escapeHTML(iconClass)}" aria-hidden="true"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="bills-route-intro-title">${global.escapeHTML(title)}</div>
                        <div class="bills-route-intro-desc">${global.escapeHTML(description)}</div>
                    </div>
                </div>
            </div>
        `;
  }

  function getDraftSourceOccupancyEntries(formData) {
    if (
      !formData?.statementType ||
      !formData.partyId ||
      !formData.periodStart ||
      !formData.periodEnd
    ) {
      return [];
    }

    let sourcePool = [];

    if (formData.statementType === "supplier") {
      const supplier = global
        .normalizeList(global.mockData?.suppliers)
        .find((item) => item.id === formData.partyId);
      const purchaseSources = global
        .normalizeList(global.mockData?.deliveryNotes)
        .filter(isPurchaseDeliveryNote)
        .filter((note) => note.supplierId === formData.partyId)
        .filter((note) => {
          const date = formatBillDateOnly(
            note.deliveryDate || note.expectedDate || note.createdAt,
          );
          return date >= formData.periodStart && date <= formData.periodEnd;
        })
        .map((note) => ({
          id: String(note.id || "").trim(),
          sourceNo: note.orderId || note.id,
          bizDate: formatBillDateOnly(
            note.deliveryDate || note.expectedDate || note.createdAt,
          ),
          sourceType: "purchase_delivery_note",
        }));

      const inboundSources = global
        .normalizeList(global.stockMovementData)
        .filter((record) => record.type === "inbound")
        .filter(
          (record) =>
            record.supplierId === formData.partyId ||
            (supplier?.name && record.supplierName === supplier.name),
        )
        .filter((record) => {
          const date = formatBillDateOnly(record.createdAt || record.updatedAt);
          return date >= formData.periodStart && date <= formData.periodEnd;
        })
        .map((record) => ({
          id: String(record.id || "").trim(),
          sourceNo: record.id,
          bizDate: formatBillDateOnly(record.createdAt || record.updatedAt),
          sourceType: "stock_inbound",
        }));

      sourcePool = purchaseSources.concat(inboundSources);
    } else if (formData.statementType === "customer") {
      sourcePool = global
        .normalizeList(global.mockData?.deliveryNotes)
        .filter(isSalesDeliveryNote)
        .filter((note) => note.companyId === formData.companyId)
        .filter((note) => note.customerId === formData.partyId)
        .filter((note) => {
          const date = formatBillDateOnly(
            note.deliveryDate || note.issueDate || note.createdAt,
          );
          return date >= formData.periodStart && date <= formData.periodEnd;
        })
        .map((note) => ({
          id: String(note.id || "").trim(),
          sourceNo: note.orderNo || note.id,
          bizDate: formatBillDateOnly(
            note.deliveryDate || note.issueDate || note.createdAt,
          ),
          sourceType: "delivery_note",
        }));
    }

    const sourceMap = new Map(
      sourcePool.filter((item) => item.id).map((item) => [item.id, item]),
    );

    return getStatementRecords()
      .filter((record) => record.statementType === formData.statementType)
      .filter((record) => normalizeBillStatus(record.status) !== "cancelled")
      .map((record) => {
        const matchedSources = global
          .normalizeList(record.sourceDocumentIds)
          .map((id) => String(id || "").trim())
          .filter((id) => sourceMap.has(id))
          .map((id) => sourceMap.get(id));

        if (!matchedSources.length) {
          return null;
        }

        return {
          statement: record,
          matchedSources,
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const timeA =
          normalizeBillDate(
            a.statement.updatedAt || a.statement.createdAt,
          )?.getTime() || 0;
        const timeB =
          normalizeBillDate(
            b.statement.updatedAt || b.statement.createdAt,
          )?.getTime() || 0;
        return timeB - timeA;
      });
  }

  function createStatementFromDraft(formData) {
    const statement =
      formData.statementType === "supplier"
        ? buildSupplierStatementFromForm(formData)
        : buildCustomerStatementFromForm(formData);
    if (!statement) {
      alert("所选公司或对象不存在，请重新选择");
      return;
    }
    if (!statement.details.length) {
      const occupiedEntries = getDraftSourceOccupancyEntries(formData);
      if (occupiedEntries.length) {
        openOccupiedStatementsModal(formData, occupiedEntries);
        return;
      }
      alert("当前条件下没有可生成的对账明细，可能是没有匹配单据");
      return;
    }
    persistStatement(statement);
    state.pendingDraft = null;
    openStatementViewModal(statement);
  }

  function normalizeOccupiedContextEntries(occupiedEntries) {
    return global
      .normalizeList(occupiedEntries)
      .map((entry) => {
        const liveStatement =
          entry.statement ||
          getStatementRecords().find((item) => item.id === entry.statementId) ||
          null;
        const statementId = String(
          liveStatement?.id || entry.statementId || "",
        ).trim();
        const sourceNos = Array.from(
          new Set(
            global
              .normalizeList(entry.matchedSources || entry.sourceNos)
              .map((item) => {
                if (typeof item === "string") {
                  return item;
                }
                return item?.sourceNo || item?.id || "";
              })
              .map((item) => String(item || "").trim())
              .filter(Boolean),
          ),
        );

        if (!statementId) {
          return null;
        }

        return {
          statementId,
          partyNameSnapshot:
            liveStatement?.partyNameSnapshot || entry.partyNameSnapshot || "-",
          periodStart: liveStatement?.periodStart || entry.periodStart || "",
          periodEnd: liveStatement?.periodEnd || entry.periodEnd || "",
          status: normalizeBillStatus(liveStatement?.status || entry.status),
          sourceNos,
        };
      })
      .filter(Boolean);
  }

  function getOccupiedViewNavigation(statementId) {
    const entries = global.normalizeList(state.occupiedViewContext?.entries);
    if (!entries.length) {
      return null;
    }

    const index = entries.findIndex(
      (entry) => entry.statementId === statementId,
    );
    if (index === -1) {
      return null;
    }

    return {
      formData: state.occupiedViewContext?.formData || {},
      entries,
      index,
      total: entries.length,
      activeEntry: entries[index],
      prevEntry: entries[index - 1] || null,
      nextEntry: entries[index + 1] || null,
    };
  }

  function reopenOccupiedStatementsModal(activeStatementId) {
    const context = state.occupiedViewContext;
    if (!context || !global.normalizeList(context.entries).length) {
      return false;
    }

    openOccupiedStatementsModal(
      context.formData || {},
      context.entries,
      activeStatementId || context.activeStatementId || "",
    );
    return true;
  }

  function openOccupiedStatementsModal(
    formData,
    occupiedEntries,
    activeStatementId,
  ) {
    const normalizedEntries = normalizeOccupiedContextEntries(occupiedEntries);
    if (!normalizedEntries.length) {
      alert("当前没有可查看的占用对账单");
      return;
    }

    const uniqueSourceCount = new Set(
      normalizedEntries.flatMap((entry) => entry.sourceNos),
    ).size;
    const statementCount = normalizedEntries.length;
    const currentActiveStatementId =
      activeStatementId ||
      state.occupiedViewContext?.activeStatementId ||
      normalizedEntries[0].statementId;

    state.occupiedViewContext = {
      formData: { ...(formData || {}) },
      entries: normalizedEntries,
      activeStatementId: currentActiveStatementId,
    };

    const content = `
            <div class="space-y-3 text-sm text-gray-700">
                <p>当前条件下共有 <strong>${global.escapeHTML(String(uniqueSourceCount))}</strong> 条来源单已被占用，涉及 <strong>${global.escapeHTML(String(statementCount))}</strong> 张对账单。你可以逐张查看这些占用对账单，查看页支持“返回占用列表”和“上一张/下一张”。</p>
                <div class="space-y-3 max-h-80 overflow-y-auto pr-1">
                    ${normalizedEntries
                      .map((entry, index) => {
                        const isActive =
                          entry.statementId === currentActiveStatementId;
                        const cardClass = isActive
                          ? "rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-2"
                          : "rounded-lg bg-gray-50 border border-gray-200 p-4 space-y-2";
                        return `
                            <div class="${cardClass}">
                                <div class="flex items-start justify-between gap-4">
                                    <div class="min-w-0 space-y-1">
                                        <div class="text-sm font-semibold text-gray-900">${global.escapeHTML(entry.statementId)}</div>
                                        <div class="text-xs text-gray-500">${global.escapeHTML(entry.partyNameSnapshot || "-")} · ${global.escapeHTML(formatStatementPeriod(entry.periodStart, entry.periodEnd))}</div>
                                        <div class="text-xs text-gray-500">状态：${global.escapeHTML(BILL_STATUS_META[entry.status]?.label || "-")} · 第 ${global.escapeHTML(String(index + 1))} / ${global.escapeHTML(String(statementCount))} 张</div>
                                    </div>
                                    <button type="button" class="text-primary hover:text-primary-dark whitespace-nowrap" data-occupied-view="${global.escapeHTML(entry.statementId)}">查看对账单</button>
                                </div>
                                <div class="text-xs text-gray-600 break-all">本单占用来源单（${global.escapeHTML(String(entry.sourceNos.length))} 条）：${global.escapeHTML(entry.sourceNos.join("、"))}</div>
                            </div>
                        `;
                      })
                      .join("")}
                </div>
            </div>
        `;

    openBillsModal({
      title: "来源单据已被占用",
      content,
      rightButtons: [
        {
          label: "关闭",
          className: "bills-outline-button",
          onClick: closeBillsModal,
        },
      ],
    });

    document.querySelectorAll("[data-occupied-view]").forEach((button) => {
      button.addEventListener("click", () => {
        const statementId = button.getAttribute("data-occupied-view");
        const statement = getStatementRecords().find(
          (item) => item.id === statementId,
        );
        if (!statement) return;

        state.pendingDraft = formData;
        state.occupiedViewContext = {
          ...(state.occupiedViewContext || {}),
          activeStatementId: statement.id,
        };

        closeBillsModal();
        openStatementViewModal(statement, {
          returnTab: formData.statementType || state.activeTab || "customer",
          preserveOccupiedContext: true,
          occupiedActiveStatementId: statement.id,
        });
      });
    });
  }

  function getStatementViewOptions(statementId) {
    state.statementViewOptions = state.statementViewOptions || {};
    if (!state.statementViewOptions[statementId]) {
      state.statementViewOptions[statementId] = {
        showTaxSummary: false,
      };
    }
    return state.statementViewOptions[statementId];
  }

  function persistStatementRecordWithViewContext(statement, options) {
    const bills = global.normalizeList(global.mockData?.bills);
    global.mockData.bills = bills.map((item) =>
      item.id === statement.id ? statement : item,
    );
    if (typeof global.saveMockData === "function") {
      global.saveMockData();
    }
    updateBillsTableOverride();

    const isViewingCurrentStatement =
      state.activeViewStatementId === statement.id &&
      !document.getElementById("bills-view")?.classList.contains("hidden");
    if (options?.reopenView || isViewingCurrentStatement) {
      openStatementViewModal(statement, {
        returnTab:
          options?.returnTab ||
          state.activeViewReturnTab ||
          statement.statementType,
        preserveOccupiedContext: !!options?.preserveOccupiedContext,
        occupiedActiveStatementId: statement.id,
      });
    }
  }

  function openStatementConfirmExportModal(statement, options) {
    const shouldUpdateStatus =
      normalizeBillStatus(statement.status) === "pending_check" &&
      !options?.skipStatusConfirm;
    const noteMarkup = shouldUpdateStatus
      ? '<div class="bills-route-note">当前对账单状态为“待核对”，点击确认后会先更新为“待付款”，再按你勾选的格式导出。</div>'
      : '<div class="bills-route-note">请勾选要导出的格式。你可以只导出 Excel、只导出 PDF，或者两种格式一起导出。</div>';

    openBillsModal({
      title: "确认并导出",
      content: `
                <div class="space-y-4">
                    ${noteMarkup}
                    <label class="bills-route-checkbox">
                        <input id="bill-confirm-export-excel" type="checkbox" checked>
                        <span>导出 Excel</span>
                    </label>
                    <label class="bills-route-checkbox">
                        <input id="bill-confirm-export-pdf" type="checkbox" checked>
                        <span>导出 PDF</span>
                    </label>
                </div>
            `,
      rightButtons: [
        {
          label: "取消",
          className: "bills-outline-button",
          onClick: closeBillsModal,
        },
        {
          label: "确认并导出",
          className:
            "bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-all-300",
          onClick: function () {
            const shouldExportExcel = !!document.getElementById(
              "bill-confirm-export-excel",
            )?.checked;
            const shouldExportPdf = !!document.getElementById(
              "bill-confirm-export-pdf",
            )?.checked;
            if (!shouldExportExcel && !shouldExportPdf) {
              alert("请至少勾选一种导出格式");
              return;
            }

            const nextStatement = shouldUpdateStatus
              ? {
                  ...statement,
                  status: "pending_payment",
                  updatedAt: global.getLocalISOString(),
                }
              : statement;

            if (nextStatement !== statement) {
              persistStatementRecordWithViewContext(nextStatement, {
                returnTab:
                  options?.returnTab ||
                  state.activeViewReturnTab ||
                  statement.statementType,
                preserveOccupiedContext: !!options?.preserveOccupiedContext,
              });
            }

            closeBillsModal();

            if (shouldExportExcel) {
              exportStatementAsExcel(nextStatement);
            }
            if (shouldExportPdf) {
              exportStatementAsPdf(nextStatement);
            }
          },
        },
      ],
    });
  }

  function buildStatementPreviewMarkup(statement, options) {
    const viewOptions = {
      includeTaxToggle: false,
      showTaxSummary: getStatementViewOptions(statement.id).showTaxSummary,
      ...options,
    };
    const pureAmount = roundCurrency(Number(statement.currentAmount) || 0);
    const normalizedTaxRate = Number(statement.taxRate || 1);
    const taxRate =
      Number.isFinite(normalizedTaxRate) && normalizedTaxRate > 0
        ? normalizedTaxRate
        : 1;
    const taxRateLabel = global.escapeHTML(String(Number(taxRate.toFixed(4))));
    const taxedAmount = roundCurrency(
      statement.amountWithTax == null
        ? pureAmount * taxRate
        : Number(statement.amountWithTax) || 0,
    );
    const detailRows = global
      .normalizeList(statement.details)
      .map(
        (detail, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${global.escapeHTML(formatBillDateOnly(detail.bizDate))}</td>
                <td>${global.escapeHTML(detail.sourceNo || "-")}</td>
                <td>${global.escapeHTML(detail.productNameSnapshot || "-")}</td>
                <td>${global.escapeHTML(detail.specSnapshot || "-")}</td>
                <td>${global.escapeHTML(detail.unitSnapshot || "-")}</td>
                <td>${global.escapeHTML(String(detail.quantity ?? "-"))}</td>
                <td>${global.escapeHTML(formatBillCurrency(detail.unitPrice || 0))}</td>
                <td>${global.escapeHTML(formatBillCurrency(detail.lineAmount || 0))}</td>
                <td>${global.escapeHTML(detail.remark || "-")}</td>
            </tr>
        `,
      )
      .join("");

    const detailSummaryRows = `
            <tr class="bills-inline-summary-row" style="background:#f8fafc;font-weight:600;">
                <td colspan="8"><strong>合计（纯金额，不含税）</strong></td>
                <td><strong>${global.escapeHTML(formatBillCurrency(pureAmount))}</strong></td>
                <td>-</td>
            </tr>
            <tr id="bill-view-tax-summary-row" class="bills-inline-summary-row" style="background:#eff6ff;font-weight:600;${viewOptions.showTaxSummary ? "" : "display:none;"}">
                <td colspan="6"><strong>含税合计</strong></td>
                <td colspan="2"><strong>${global.escapeHTML(formatBillCurrency(pureAmount))} × ${taxRateLabel}</strong></td>
                <td><strong>${global.escapeHTML(formatBillCurrency(taxedAmount))}</strong></td>
                <td>含税系数 ${taxRateLabel}</td>
            </tr>
        `;

    const arrearsRows = global
      .normalizeList(statement.arrears)
      .map(
        (item) => `
            <tr>
                <td>${global.escapeHTML(item.monthLabel || "-")}</td>
                <td>${global.escapeHTML(formatBillCurrency(item.amount || 0))}</td>
            </tr>
        `,
      )
      .join("");

    const paymentRows = global
      .normalizeList(statement.payments)
      .map(
        (item) => `
            <tr>
                <td>${global.escapeHTML(formatBillDateOnly(item.payDate))}</td>
                <td>${global.escapeHTML(item.payMethod || "-")}</td>
                <td>${global.escapeHTML(formatBillCurrency(item.payAmount || 0))}</td>
                <td>${global.escapeHTML(item.remark || "-")}</td>
            </tr>
        `,
      )
      .join("");

    const detailTaxToggleMarkup = viewOptions.includeTaxToggle
      ? `
            <label class="bills-route-checkbox text-sm text-gray-600 mb-3">
                <input id="bill-view-tax-summary-toggle" type="checkbox" ${viewOptions.showTaxSummary ? "checked" : ""}>
                <span>显示第二行含税合计（纯金额 × 含税系数）。如果送货单金额本身已经含税，请不要勾选。</span>
            </label>
        `
      : "";

    return `
            <div class="space-y-4">
                <div class="bills-modal-summary-grid">
                    <div class="bills-modal-summary-card">
                        <div class="text-sm text-gray-500">对账单编号</div>
                        <div class="mt-2 text-xl font-semibold text-gray-900">${global.escapeHTML(statement.id)}</div>
                    </div>
                    <div class="bills-modal-summary-card">
                        <div class="text-sm text-gray-500">${global.escapeHTML(getBillsMeta(statement.statementType).partyLabel)}</div>
                        <div class="mt-2 text-xl font-semibold text-gray-900">${global.escapeHTML(statement.partyNameSnapshot || "-")}</div>
                    </div>
                    <div class="bills-modal-summary-card">
                        <div class="text-sm text-gray-500">对账周期</div>
                        <div class="mt-2 text-base font-semibold text-gray-900">${global.escapeHTML(formatStatementPeriod(statement.periodStart, statement.periodEnd))}</div>
                    </div>
                    <div class="bills-modal-summary-card">
                        <div class="text-sm text-gray-500">总计金额</div>
                        <div class="mt-2 text-xl font-semibold text-gray-900">${global.escapeHTML(formatBillCurrency(statement.totalAmount))}</div>
                    </div>
                </div>

                <div class="bills-modal-form-grid">
                    <div class="bills-modal-section">
                        <div class="bills-modal-section-title">我方信息</div>
                        <div class="bills-modal-section-body space-y-2 text-sm text-gray-700">
                            <div><strong>公司：</strong>${global.escapeHTML(statement.companyNameSnapshot || "-")}</div>
                            <div><strong>地址：</strong>${global.escapeHTML(statement.companyAddressSnapshot || "-")}</div>
                            <div><strong>电话：</strong>${global.escapeHTML(statement.companyPhoneSnapshot || "-")}</div>
                        </div>
                    </div>
                    <div class="bills-modal-section">
                        <div class="bills-modal-section-title">${global.escapeHTML(getBillsMeta(statement.statementType).partyLabel)}信息</div>
                        <div class="bills-modal-section-body space-y-2 text-sm text-gray-700">
                            <div><strong>名称：</strong>${global.escapeHTML(statement.partyNameSnapshot || "-")}</div>
                            <div><strong>联系人：</strong>${global.escapeHTML(statement.contactNameSnapshot || "-")}</div>
                            <div><strong>电话：</strong>${global.escapeHTML(statement.contactPhoneSnapshot || "-")}</div>
                            <div><strong>地址：</strong>${global.escapeHTML(statement.partyAddressSnapshot || "-")}</div>
                        </div>
                    </div>
                </div>

                <div class="bills-modal-section">
                    <div class="bills-modal-section-title">对账明细</div>
                    <div class="bills-modal-section-body overflow-x-auto">
                        ${detailTaxToggleMarkup}
                        <table class="bills-inline-table">
                            <thead>
                                <tr>
                                    <th>序号</th>
                                    <th>业务日期</th>
                                    <th>来源单号</th>
                                    <th>产品名称</th>
                                    <th>规格</th>
                                    <th>单位</th>
                                    <th>数量</th>
                                    <th>单价</th>
                                    <th>金额</th>
                                    <th>备注</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${detailRows || buildBillsEmptyTableRow("暂无明细", 10)}
                                ${detailSummaryRows}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="bills-modal-form-grid">
                    <div class="bills-modal-section">
                        <div class="bills-modal-section-title">往期欠款</div>
                        <div class="bills-modal-section-body overflow-x-auto">
                            <table class="bills-inline-table">
                                <thead><tr><th>月份</th><th>金额</th></tr></thead>
                                <tbody>${arrearsRows || buildBillsEmptyTableRow("暂无往期欠款", 2)}</tbody>
                            </table>
                        </div>
                    </div>
                    <div class="bills-modal-section">
                        <div class="bills-modal-section-title">付款记录</div>
                        <div class="bills-modal-section-body overflow-x-auto">
                            <table class="bills-inline-table">
                                <thead><tr><th>付款日期</th><th>方式</th><th>金额</th><th>备注</th></tr></thead>
                                <tbody>${paymentRows || buildBillsEmptyTableRow("暂无付款记录", 4)}</tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="bills-modal-section">
                    <div class="bills-modal-section-title">金额汇总</div>
                    <div class="bills-modal-section-body grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                        <div><strong>单据份数：</strong>${global.escapeHTML(String(statement.documentCount || 0))}</div>
                        <div><strong>当前货款：</strong>${global.escapeHTML(formatBillCurrency(statement.currentAmount || 0))}</div>
                        <div><strong>含税金额：</strong>${global.escapeHTML(formatBillCurrency(statement.amountWithTax || 0))}</div>
                        <div><strong>往期欠款：</strong>${global.escapeHTML(formatBillCurrency(statement.arrearsAmount || 0))}</div>
                        <div class="md:col-span-2"><strong>大写金额：</strong>${global.escapeHTML(statement.totalAmountUppercase || convertAmountToChineseUpperForBills(statement.totalAmount))}</div>
                    </div>
                </div>
            </div>
        `;
  }

  function buildStatementExportHtml(statement) {
    return `
            <!DOCTYPE html>
            <html lang="zh-CN">
            <head>
                <meta charset="UTF-8" />
                <title>${global.escapeHTML(statement.id)}</title>
                <style>
                    body { font-family: "Microsoft YaHei", sans-serif; padding: 24px; color: #111827; }
                    h1 { font-size: 28px; margin: 0 0 8px; text-align: center; }
                    h2 { font-size: 18px; margin: 16px 0 12px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 12px; }
                    th, td { border: 1px solid #d1d5db; padding: 8px 10px; font-size: 14px; text-align: left; }
                    th { background: #f9fafb; }
                    .meta-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
                    .meta-card { border: 1px solid #e5e7eb; padding: 12px; border-radius: 8px; }
                </style>
            </head>
            <body>
                <h1>${global.escapeHTML(statement.companyNameSnapshot || "对账单")}</h1>
                <h2 style="text-align:center;">${global.escapeHTML(getBillsMeta(statement.statementType).label)}</h2>
                <div class="meta-grid">
                    <div class="meta-card">
                        <div><strong>对账单编号：</strong>${global.escapeHTML(statement.id)}</div>
                        <div><strong>对账日期：</strong>${global.escapeHTML(formatBillDateOnly(statement.statementDate))}</div>
                        <div><strong>对账周期：</strong>${global.escapeHTML(formatStatementPeriod(statement.periodStart, statement.periodEnd))}</div>
                    </div>
                    <div class="meta-card">
                        <div><strong>${global.escapeHTML(getBillsMeta(statement.statementType).partyLabel)}：</strong>${global.escapeHTML(statement.partyNameSnapshot)}</div>
                        <div><strong>联系人：</strong>${global.escapeHTML(statement.contactNameSnapshot || "-")}</div>
                        <div><strong>电话：</strong>${global.escapeHTML(statement.contactPhoneSnapshot || "-")}</div>
                    </div>
                </div>
                ${buildStatementPreviewMarkup(statement, {
                  includeTaxToggle: false,
                  showTaxSummary: getStatementViewOptions(statement.id)
                    .showTaxSummary,
                })}
            </body>
            </html>
        `;
  }

  function renderBillStatusDisplay(statement) {
    const container = document.getElementById("bill-view-status-container");
    if (!container) return;

    container.innerHTML = `
            <div class="inline-flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 min-h-[48px]">
                <span class="text-sm text-gray-500">当前状态</span>
                ${getStatusBadgeHtml(statement.status)}
            </div>
        `;
  }

  function openCancelStatementConfirmModal(statement) {
    if (!statement?.id) return;
    if (normalizeBillStatus(statement.status) === "cancelled") return;

    openBillsModal({
      title: "确认作废对账单",
      content: `
                <div class="space-y-3">
                    <div class="bills-route-note" style="border-color:#fecaca;background:#fef2f2;color:#b91c1c;">
                        作废后，这张对账单会变为“已作废”状态。请确认这就是你要执行的操作。
                    </div>
                    <div class="text-sm text-gray-700">
                        <div><strong>对账单编号：</strong>${global.escapeHTML(statement.id)}</div>
                        <div><strong>对账对象：</strong>${global.escapeHTML(statement.partyNameSnapshot || "-")}</div>
                        <div><strong>对账周期：</strong>${global.escapeHTML(formatStatementPeriod(statement.periodStart, statement.periodEnd))}</div>
                    </div>
                </div>
            `,
      rightButtons: [
        {
          label: "取消",
          className: "bills-outline-button",
          onClick: closeBillsModal,
        },
        {
          label: "确认作废",
          className: "px-4 py-2 rounded-lg text-white transition-all-300",
          style: "background:#dc2626;",
          onClick: function () {
            closeBillsModal();
            const nextStatement = {
              ...statement,
              status: "cancelled",
              updatedAt: global.getLocalISOString(),
            };
            saveStatementRecord(nextStatement, true);
            if (typeof global.addLog === "function") {
              const statementTypeLabel = getBillsMeta(
                nextStatement.statementType,
              ).label;
              const periodText = formatStatementPeriod(
                nextStatement.periodStart,
                nextStatement.periodEnd,
              );
              global.addLog(
                "cancel",
                "bill",
                nextStatement.id,
                `作废${statementTypeLabel}：${nextStatement.partyNameSnapshot || "-"} / ${nextStatement.id} / ${periodText}`,
              );
            }
          },
        },
      ],
    });
  }

  function renderBillsViewRoute(statementId, options) {
    ensureBillsRouteSections();
    const section = document.getElementById("bills-view");
    if (!section) return;

    const statement = getStatementRecords().find(
      (item) => item.id === statementId,
    );
    const returnTab =
      options?.returnTab ||
      state.activeViewReturnTab ||
      statement?.statementType ||
      "customer";
    const occupiedNav = getOccupiedViewNavigation(statementId);

    if (!statement) {
      section.innerHTML = `
                <div class="bills-route-shell">
                    <div class="bills-route-header">
                        <div class="bills-route-title">
                            <div class="flex items-center gap-2 mb-2 text-sm text-gray-500">
                                <button id="bill-view-missing-up-btn" type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all-300 hover:bg-gray-100 hover:text-gray-700" aria-label="返回上一级" title="返回上一级">
                                    <i class="fa fa-arrow-left"></i>
                                </button>
                                <span>对账单系统 / 查看对账单</span>
                            </div>
                            <h2 class="text-2xl font-bold text-gray-800">未找到对账单</h2>
                            <p>这份对账单可能已被删除，或当前数据尚未同步完成。</p>
                        </div>
                        <div class="bills-route-actions">
                            ${occupiedNav ? '<button id="bill-view-missing-occupied-btn" type="button" class="bills-outline-button">返回占用列表</button>' : ""}
                            <button id="bill-view-missing-back-btn" type="button" class="bills-outline-button">返回对账单列表</button>
                        </div>
                    </div>
                    <div class="bills-route-card">
                        <div class="bills-route-card-body">
                            ${buildBillsEmptyHostMarkup(`未找到编号为 ${statementId} 的对账单。`, {
                              wrapperClassName: "py-8",
                              fallbackClassName: "text-center text-sm text-gray-500",
                            })}
                        </div>
                    </div>
                </div>
            `;
      hydrateBillsEmptyStates(section);
      document
        .getElementById("bill-view-missing-up-btn")
        ?.addEventListener("click", () => {
          returnToPreviousBillsLevel(statementId, returnTab);
        });
      document
        .getElementById("bill-view-missing-back-btn")
        ?.addEventListener("click", () =>
          navigateToBillsRoute({ type: "list", tab: returnTab }),
        );
      document
        .getElementById("bill-view-missing-occupied-btn")
        ?.addEventListener("click", () => {
          reopenOccupiedStatementsModal(statementId);
        });
      return;
    }

    state.activeViewStatementId = statement.id;
    state.activeViewReturnTab = returnTab;
    if (occupiedNav && state.occupiedViewContext) {
      state.occupiedViewContext.activeStatementId = statement.id;
    }

    const isCancelled = normalizeBillStatus(statement.status) === "cancelled";
    const statementViewOptions = getStatementViewOptions(statement.id);
    const occupiedActionMarkup = occupiedNav
      ? `
            <button id="bill-view-back-occupied-btn" type="button" class="bills-outline-button">返回占用列表</button>
        `
      : "";

    const occupiedToolbarMarkup = occupiedNav
      ? `
            <div class="flex items-center gap-2 flex-wrap">
                <span class="text-sm text-gray-500">占用对账单 ${occupiedNav.index + 1} / ${occupiedNav.total}</span>
                <button id="bill-view-prev-occupied-btn" type="button" class="bills-outline-button ${occupiedNav.prevEntry ? "" : "opacity-50 cursor-not-allowed"}" ${occupiedNav.prevEntry ? "" : "disabled"}>上一张</button>
                <button id="bill-view-next-occupied-btn" type="button" class="bills-outline-button ${occupiedNav.nextEntry ? "" : "opacity-50 cursor-not-allowed"}" ${occupiedNav.nextEntry ? "" : "disabled"}>下一张</button>
            </div>
        `
      : "";
    const cancelButtonClass = isCancelled
      ? "inline-flex items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-4 py-2 font-semibold text-red-300 cursor-not-allowed opacity-75"
      : "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 font-semibold text-red-700 transition-all-300 hover:bg-red-100 hover:border-red-300";

    section.innerHTML = `
            <div class="bills-route-shell">
                <div class="bills-route-header">
                    <div class="bills-route-title">
                        <div class="flex items-center gap-2 mb-2 text-sm text-gray-500">
                            <button id="bill-view-up-btn" type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all-300 hover:bg-gray-100 hover:text-gray-700" aria-label="返回上一级" title="返回上一级">
                                <i class="fa fa-arrow-left"></i>
                            </button>
                            <span>对账单系统 / 查看对账单</span>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-800">${global.escapeHTML(statement.id)}</h2>
                        <p>${global.escapeHTML(getBillsMeta(statement.statementType).label)} / ${global.escapeHTML(statement.partyNameSnapshot || "-")} / ${global.escapeHTML(formatStatementPeriod(statement.periodStart, statement.periodEnd))}</p>
                    </div>
                    ${occupiedActionMarkup ? `<div class="bills-route-actions">${occupiedActionMarkup}</div>` : ""}
                </div>
                ${buildBillsRouteIntroCard("fa-table", occupiedNav ? "占用对账单详情" : "对账单快照", occupiedNav ? "你可以返回占用列表，或使用上一张/下一张继续逐个查看相关对账单。" : "这里展示当前账期的来源单据、往期欠款和付款记录，便于直接核对与导出。")}
                <div class="bills-route-card">
                    <div class="bills-route-card-body">
                        <div class="bills-route-toolbar">
                            <div class="flex items-center gap-3 flex-wrap">
                                <div id="bill-view-status-container" class="min-w-[220px]"></div>
                                ${occupiedToolbarMarkup}
                            </div>
                            <button id="bill-view-cancel-btn" type="button" class="${cancelButtonClass}" ${isCancelled ? 'disabled title="已作废对账单不可重复作废"' : 'title="作废对账单"'}>${isCancelled ? "已作废" : "作废对账单"}</button>
                        </div>
                        ${buildStatementPreviewMarkup(statement, {
                          includeTaxToggle: true,
                          showTaxSummary: statementViewOptions.showTaxSummary,
                        })}
                    </div>
                </div>
                <div class="bills-route-actions justify-end mt-6">
                    <button id="bill-view-register-payment-btn" type="button" class="bills-outline-button">登记付款</button>
                    <button id="bill-view-confirm-export-btn" type="button" class="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg transition-all-300">确认并导出</button>
                </div>
            </div>
        `;
    hydrateBillsEmptyStates(section);

    renderBillStatusDisplay(statement);

    document
      .getElementById("bill-view-up-btn")
      ?.addEventListener("click", () => {
        returnToPreviousBillsLevel(statement.id, returnTab);
      });
    document
      .getElementById("bill-view-back-occupied-btn")
      ?.addEventListener("click", () => {
        reopenOccupiedStatementsModal(statement.id);
      });
    document
      .getElementById("bill-view-prev-occupied-btn")
      ?.addEventListener("click", () => {
        if (!occupiedNav?.prevEntry) return;
        const prevStatement = getStatementRecords().find(
          (item) => item.id === occupiedNav.prevEntry.statementId,
        );
        if (!prevStatement) return;
        openStatementViewModal(prevStatement, {
          returnTab,
          preserveOccupiedContext: true,
          occupiedActiveStatementId: prevStatement.id,
        });
      });
    document
      .getElementById("bill-view-next-occupied-btn")
      ?.addEventListener("click", () => {
        if (!occupiedNav?.nextEntry) return;
        const nextStatement = getStatementRecords().find(
          (item) => item.id === occupiedNav.nextEntry.statementId,
        );
        if (!nextStatement) return;
        openStatementViewModal(nextStatement, {
          returnTab,
          preserveOccupiedContext: true,
          occupiedActiveStatementId: nextStatement.id,
        });
      });
    document
      .getElementById("bill-view-tax-summary-toggle")
      ?.addEventListener("change", (event) => {
        const checked = !!event.target.checked;
        getStatementViewOptions(statement.id).showTaxSummary = checked;
        const taxSummaryRow = document.getElementById(
          "bill-view-tax-summary-row",
        );
        if (taxSummaryRow) {
          taxSummaryRow.style.display = checked ? "" : "none";
        }
      });
    document
      .getElementById("bill-view-register-payment-btn")
      ?.addEventListener("click", () => openPaymentModal(statement));
    document
      .getElementById("bill-view-confirm-export-btn")
      ?.addEventListener("click", () => {
        openStatementConfirmExportModal(statement, {
          returnTab,
          preserveOccupiedContext: !!occupiedNav,
        });
      });
    document
      .getElementById("bill-view-cancel-btn")
      ?.addEventListener("click", () => {
        if (isCancelled) return;
        openCancelStatementConfirmModal(statement);
      });
  }

  function renderBillsCreateRoute(draft) {
    ensureBillsRouteSections();
    const section = document.getElementById("bills-create");
    if (!section) return;

    const currentDraft = buildCreateBillDraft(draft);
    const listTab = currentDraft.statementType || state.activeTab || "customer";
    const partyLabel =
      currentDraft.statementType === "supplier"
        ? "供应商"
        : currentDraft.statementType === "customer"
          ? "客户"
          : "对账对象";

    state.pendingDraft = currentDraft;

    section.innerHTML = `
            <div class="bills-route-shell">
                <div class="bills-route-header">
                    <div class="bills-route-title">
                        <div class="flex items-center gap-2 mb-2 text-sm text-gray-500">
                            <button id="bill-create-up-btn" type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-all-300 hover:bg-gray-100 hover:text-gray-700" aria-label="返回上一级" title="返回上一级">
                                <i class="fa fa-arrow-left"></i>
                            </button>
                            <span>对账单系统 / 新增对账单</span>
                        </div>
                        <h2 class="text-2xl font-bold text-gray-800">新增对账单</h2>
                        <p>默认已清空所有字段，请按需要自行选择对账类型、公司、对象和账期。</p>
                    </div>
                </div>
                <div class="bills-route-card">
                    <div class="bills-route-card-body space-y-4">
                        ${buildBillsRouteIntroCard("fa-file-text-o", "新增对账单", "进入页面时不再自动带入任何默认值，方便你按实际业务手动选择。")}
                        <div class="bills-modal-form-grid">
                            <div class="bills-field">
                                <label>对账类型</label>
                                <div id="bill-create-type-container"></div>
                                <input type="hidden" id="bill-create-type" value="${global.escapeHTML(currentDraft.statementType || "")}">
                            </div>
                            <div class="bills-field">
                                <label>我方公司</label>
                                <div id="bill-create-company-container"></div>
                                <input type="hidden" id="bill-create-company" value="${global.escapeHTML(currentDraft.companyId || "")}">
                            </div>
                            <div class="bills-field">
                                <label>${global.escapeHTML(partyLabel)}</label>
                                <div id="bill-create-party-container"></div>
                                <input type="hidden" id="bill-create-party" value="${global.escapeHTML(currentDraft.partyId || "")}">
                            </div>
                            <div class="bills-field">
                                <label>对账日期</label>
                                <div id="bill-create-date-container"></div>
                                <input type="hidden" id="bill-create-date" value="${global.escapeHTML(currentDraft.statementDate || "")}">
                            </div>
                            <div class="bills-field">
                                <label>周期开始</label>
                                <div id="bill-create-period-start-container"></div>
                                <input type="hidden" id="bill-create-period-start" value="${global.escapeHTML(currentDraft.periodStart || "")}">
                            </div>
                            <div class="bills-field">
                                <label>周期结束</label>
                                <div id="bill-create-period-end-container"></div>
                                <input type="hidden" id="bill-create-period-end" value="${global.escapeHTML(currentDraft.periodEnd || "")}">
                            </div>
                            <div class="bills-field">
                                <label>税率系数</label>
                                <input id="bill-create-tax-rate" type="number" min="1" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2" value="${global.escapeHTML(currentDraft.taxRate || "")}">
                            </div>
                            <div class="bills-field">
                                <label>附加选项</label>
                                <label class="bills-route-checkbox">
                                    <input id="bill-create-include-arrears" type="checkbox" ${currentDraft.includeArrears ? "checked" : ""}>
                                    <span>自动带入历史未结清欠款</span>
                                </label>
                            </div>
                        </div>
                        <div class="bills-route-note">如果当前条件下已经存在相同账期的对账单，系统会优先提示你查看已有对账单，避免重复生成。</div>
                        <div class="bills-route-actions justify-end">
                            <button id="bill-create-cancel-btn" type="button" class="bills-outline-button">取消</button>
                            <button id="bill-create-submit-btn" type="button" class="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg transition-all-300">生成对账单</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

    renderCreateFormSelects(currentDraft);
    renderCreateBillDatePickers(currentDraft);

    document
      .getElementById("bill-create-up-btn")
      ?.addEventListener("click", () => {
        const previousRoute = state.previousBillsRoute;
        if (previousRoute?.type === "view" && previousRoute.statementId) {
          navigateToBillsRoute(
            { type: "view", statementId: previousRoute.statementId },
            { returnTab: previousRoute.returnTab || listTab },
          );
          return;
        }

        if (previousRoute?.type === "list") {
          navigateToBillsRoute(
            { type: "list", tab: previousRoute.tab || listTab },
            { tab: previousRoute.tab || listTab },
          );
          return;
        }

        navigateToBillsRoute({ type: "list", tab: listTab }, { tab: listTab });
      });
    document
      .getElementById("bill-create-cancel-btn")
      ?.addEventListener("click", () =>
        navigateToBillsRoute({ type: "list" }, { tab: listTab }),
      );
    document
      .getElementById("bill-create-submit-btn")
      ?.addEventListener("click", () => {
        const formData = getCreateDraftFromModal();
        state.pendingDraft = formData;

        if (
          !formData.statementType ||
          !formData.companyId ||
          !formData.partyId ||
          !formData.statementDate ||
          !formData.periodStart ||
          !formData.periodEnd ||
          !formData.taxRate
        ) {
          alert("请先完整选择对账类型、公司、对象、对账日期、账期和税率系数");
          return;
        }

        if (formData.periodStart > formData.periodEnd) {
          alert("周期开始不能晚于周期结束");
          return;
        }

        const duplicateBill = findDuplicateStatement(formData);
        if (duplicateBill) {
          state.pendingDraft = formData;
          openDuplicatePromptModal(formData, duplicateBill);
          return;
        }

        createStatementFromDraft(formData);
      });
  }

  function clearBillsViewFloatingActions() {
    document.getElementById("bills-view-floating-actions")?.remove();
  }

  function mountBillsViewFloatingActions() {
    clearBillsViewFloatingActions();

    const root = document.createElement("div");
    root.id = "bills-view-floating-actions";
    root.className = "bills-route-actions";
    root.style.cssText =
      "position:fixed;right:max(16px, env(safe-area-inset-right));bottom:max(16px, env(safe-area-inset-bottom));z-index:90;display:flex;align-items:center;gap:12px;";
    root.innerHTML = `
            <button id="bill-view-register-payment-btn" type="button" class="bills-outline-button">登记付款</button>
            <button id="bill-view-confirm-export-btn" type="button" class="bg-primary hover:bg-primary-dark text-white px-6 py-2 rounded-lg transition-all-300">确认并导出</button>
        `;
    document.body.appendChild(root);
  }

  function bindBillsTableEvents() {
    if (state.tableEventsBound) return;
    const tbody = document.getElementById("bills-table-body");
    if (!tbody) return;

    tbody.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const record = getStatementRecords().find(
        (item) => item.id === button.dataset.id,
      );
      if (!record) return;

      if (button.dataset.action === "view") {
        openStatementViewModal(record);
      } else if (button.dataset.action === "export") {
        openBillsModal({
          title: "导出对账单",
          content:
            '<p class="text-sm text-gray-600">请选择要导出的文件格式。</p>',
          rightButtons: [
            {
              label: "取消",
              className: "bills-outline-button",
              onClick: closeBillsModal,
            },
            {
              label: "Excel",
              className: "bills-outline-button",
              onClick: function () {
                exportStatementAsExcel(record);
                closeBillsModal();
              },
            },
            {
              label: "PDF",
              className:
                "bg-primary hover:bg-primary-dark text-white px-4 py-2 rounded-lg transition-all-300",
              onClick: function () {
                exportStatementAsPdf(record);
                closeBillsModal();
              },
            },
          ],
        });
      } else if (button.dataset.action === "payment" && !button.disabled) {
        openPaymentModal(record);
      }
    });

    state.tableEventsBound = true;
  }

  function bindBillsAddButton() {
    if (state.addButtonBound) return;
    const button = document.getElementById("add-bill-btn");
    if (!button) return;
    button.addEventListener("click", () => openCreateBillModal());
    state.addButtonBound = true;
  }

  async function initBillsModule() {
    injectBillsModuleStyles();
    ensureBillsRouteSections();
    bindBillsModalLifecycle();
    bindBillsRouteLifecycle();
    await ensureBillsSeedData();
    normalizeBillsSectionCopy();
    bindBillTabEventsOverride();
    bindBillsTableEvents();
    bindBillsAddButton();
    updateActiveBillTabUI();
    initBillFiltersOverride();
    updateBillsTableOverride();
    handleBillsRouteHash();
  }

  global.normalizeBillsSectionCopy = normalizeBillsSectionCopy;
  global.initBillFilters = initBillFiltersOverride;
  global.updateBillsTable = updateBillsTableOverride;
  global.renderBillsTable = updateBillsTableOverride;
  global.bindBillTabEvents = bindBillTabEventsOverride;

  document.addEventListener("DOMContentLoaded", function () {
    initBillsModule().catch((error) => {
      console.error("Bills module init failed:", error);
    });
  });
})(window);
