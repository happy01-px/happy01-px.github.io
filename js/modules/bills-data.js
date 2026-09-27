(function initBillsData(global) {
  if (!global.BillsCore) return;

  const {
    convertAmountToChineseUpperForBills,
    formatBillDateOnly,
    normalizeBillStatus,
    roundCurrency,
  } = global.BillsCore;

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
        companyPhone: "未提供",
        companyContact: "张经理",
        customerId: "C002",
        customerName: "天猫商城",
        customerAddress: "杭州市余杭区阿里巴巴西溪园区",
        customerContact: "钱经理",
        customerPhone: "未提供",
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
        companyPhone: "未提供",
        companyContact: "张经理",
        customerId: "C002",
        customerName: "天猫商城",
        customerAddress: "杭州市余杭区阿里巴巴西溪园区",
        customerContact: "钱经理",
        customerPhone: "未提供",
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
        companyPhone: "未提供",
        companyContact: "张经理",
        customerId: "C003",
        customerName: "苏宁易购",
        customerAddress: "南京市玄武区苏宁总部",
        customerContact: "孙经理",
        customerPhone: "未提供",
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
        companyPhone: "未提供",
        companyContact: "张经理",
        customerId: "C003",
        customerName: "苏宁易购",
        customerAddress: "南京市玄武区苏宁总部",
        customerContact: "孙经理",
        customerPhone: "未提供",
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
      const saved = await global.saveMockData();
      if (saved === false) {
        global.mockData.deliveryNotes = global
          .normalizeList(global.mockData.deliveryNotes)
          .filter(
            (record) => !demoRecords.some((item) => item.id === record.id),
          );
        return false;
      }
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

    const currentBills = global.normalizeList
      ? global.normalizeList(global.mockData.bills)
      : [];
    const migrated = migrateBillsData(currentBills);
    const nextBills = migrated.records.slice();
    let changed = migrated.changed || nextBills.length !== currentBills.length;

    if (changed) {
      global.mockData.bills = nextBills;
      if (typeof global.saveMockData === "function") {
        const saved = await global.saveMockData();
        if (saved === false) {
          global.mockData.bills = currentBills;
          return false;
        }
      }
    }
    return true;
  }

  global.AppBillsData = Object.freeze({
    getStatementRecords,
    getOutstandingAmount,
    isSalesDeliveryNote,
    isPurchaseDeliveryNote,
    parseLegacyStatementPeriod,
    getStatementPartyFilterValue,
    findSupplierRecord,
    getActiveSourceDocumentIdSet,
    mapLegacySupplierBillToStructured,
    migrateBillsData,
    createBillsDemoSourceData,
    ensureBillsDemoSourceData,
    mapDeliveryNoteToStructured,
    ensureBillsSeedData,
  });
})(window);
