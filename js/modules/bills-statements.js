(function initBillsStatements(global) {
  if (!global.BillsCore || !global.AppBillsData) return;

  const {
    formatBillDateOnly,
    normalizeBillDate,
    normalizeBillStatus,
    roundCurrency,
    convertAmountToChineseUpperForBills,
  } = global.BillsCore;
  const {
    getStatementRecords,
    getOutstandingAmount,
    isSalesDeliveryNote,
    isPurchaseDeliveryNote,
    getActiveSourceDocumentIdSet,
  } = global.AppBillsData;

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
  function getCreateDraftSourceCandidates(statementType, companyId, partyId) {
    if (statementType === "supplier") {
      const occupiedSourceIds = getActiveSourceDocumentIdSet("supplier");
      const purchaseCandidates = global
        .normalizeList(global.mockData?.deliveryNotes)
        .filter(isPurchaseDeliveryNote)
        .filter((note) => note.status !== "draft" && note.status !== "voided")
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
        .filter(
          (record) => record.status !== "draft" && record.status !== "voided",
        )
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
      .filter((note) => note.status !== "draft" && note.status !== "voided")
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

  global.AppBillsStatements = Object.freeze({
    buildStatementFromDetails,
    buildCustomerStatementFromForm,
    buildSupplierStatementFromForm,
    findDuplicateStatement,
    getCreateDraftSourceCandidates,
    buildCreateBillDraft,
    getDraftSourceOccupancyEntries,
    normalizeOccupiedContextEntries,
  });
})(window);
