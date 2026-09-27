(function initMasterDataCore(global) {
  const DOMESTIC_PHONE_REGEX = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/;
  const PRODUCT_CATEGORIES = ["电子产品", "服装", "家具", "图书"];
  const PAYMENT_OPTIONS = [
    { value: "Net 30", label: "Net 30" },
    { value: "Net 45", label: "Net 45" },
    { value: "Net 60", label: "Net 60" },
    { value: "COD", label: "货到付款" },
  ];
  const STATUS_OPTIONS = [
    { value: "active", label: "活跃" },
    { value: "inactive", label: "停用" },
  ];

  function formatDateTime(value) {
    return new Date(value).toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  }

  function normalizeTextValue(value) {
    return String(value ?? "").trim();
  }

  function getEditableFieldValue(value) {
    const normalized = normalizeTextValue(value);
    return normalized === "-" ? "" : normalized;
  }

  function getStoredOptionalValue(value) {
    const normalized = normalizeTextValue(value);
    return normalized || "-";
  }

  function getStatusMeta(status) {
    switch (status) {
      case "inactive":
        return {
          value: "inactive",
          label: "停用",
          className: "bg-gray-100 text-gray-800",
        };
      default:
        return {
          value: "active",
          label: "活跃",
          className: "bg-green-100 text-green-800",
        };
    }
  }

  function buildRecordInfoCard(record) {
    const safeId = escapeHTML(record.id || "-");
    const safeCreatedAt = escapeHTML(
      formatDateTime(record.createdAt || new Date()),
    );
    const safeUpdatedAt = escapeHTML(
      formatDateTime(record.updatedAt || new Date()),
    );

    return `
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
                <div class="text-sm font-medium text-gray-700 mb-3">记录信息</div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div>
                        <div class="text-xs text-gray-500 mb-1">编号</div>
                        <div class="font-medium text-gray-800">${safeId}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 mb-1">创建时间</div>
                        <div class="font-medium text-gray-800">${safeCreatedAt}</div>
                    </div>
                    <div>
                        <div class="text-xs text-gray-500 mb-1">更新时间</div>
                        <div class="font-medium text-gray-800">${safeUpdatedAt}</div>
                    </div>
                </div>
            </div>
        `;
  }

  function ensureUniqueName(items, currentId, nextName, entityLabel) {
    const normalizedNextName = normalizeTextValue(nextName).toLowerCase();
    const exists = items.some(
      (item) =>
        item.id !== currentId &&
        normalizeTextValue(item.name).toLowerCase() === normalizedNextName,
    );

    if (exists) {
      alert(`${entityLabel}名称已存在，请使用其他名称`);
      return false;
    }

    return true;
  }

  function ensureUniqueRecordId(items, currentId, nextId, entityLabel) {
    const normalizedNextId = normalizeTextValue(nextId).toLowerCase();
    const exists = items.some(
      (item) =>
        item.id !== currentId &&
        normalizeTextValue(item.id).toLowerCase() === normalizedNextId,
    );

    if (exists) {
      alert(`${entityLabel}编号已存在，请使用其他编号`);
      return false;
    }

    return true;
  }

  function renderStatusSelect(containerId, inputId, value) {
    renderAntdSelect(containerId, inputId, STATUS_OPTIONS, {
      placeholder: "请选择状态",
      value: value || "active",
    });
  }

  function renderPaymentTermsSelect(
    containerId,
    inputId,
    value,
    placeholder = "请选择付款条件",
  ) {
    renderAntdSelect(containerId, inputId, PAYMENT_OPTIONS, {
      placeholder,
      value: value || undefined,
    });
  }

  function formatCurrencyValue(value) {
    if (value === null || value === undefined || value === "") {
      return "-";
    }

    const numericValue = Number(value);
    return Number.isFinite(numericValue)
      ? `¥${numericValue.toLocaleString()}`
      : "-";
  }

  function getProductStatusMeta(product) {
    if (product?.status === "inactive") {
      return {
        label: "已停用",
        className: "bg-gray-100 text-gray-800",
      };
    }

    if (!product || product.stockQuantity === 0) {
      return {
        label: "缺货",
        className: "bg-red-100 text-red-800",
      };
    }

    if (product.stockQuantity < product.minStock) {
      return {
        label: "库存不足",
        className: "bg-yellow-100 text-yellow-800",
      };
    }

    if (product.stockQuantity > product.maxStock) {
      return {
        label: "库存过剩",
        className: "bg-blue-100 text-blue-800",
      };
    }

    return {
      label: "正常",
      className: "bg-green-100 text-green-800",
    };
  }

  function countMatchingItems(list, predicate) {
    if (!Array.isArray(list)) return 0;
    return list.reduce((total, item) => total + (predicate(item) ? 1 : 0), 0);
  }

  async function requestDeleteConfirmation(
    entityLabel,
    recordName,
    hints = [],
    mode = "delete",
  ) {
    const isDeactivate = mode === "deactivate";
    const content = [
      isDeactivate
        ? `“${recordName || "-"}”已有业务数据，不能直接删除。是否改为停用？`
        : `确定要删除“${recordName || "-"}”吗？删除后无法撤销。`,
      isDeactivate
        ? "停用后不会出现在新业务的选择列表中，已有历史记录仍会完整保留。"
        : "",
      ...hints.filter(Boolean),
    ]
      .filter(Boolean)
      .join("\n");

    if (typeof window.showAntdConfirm === "function") {
      return window.showAntdConfirm({
        title: `${isDeactivate ? "停用" : "删除"}${entityLabel}`,
        content,
        okText: isDeactivate ? "确认停用" : "删除",
        cancelText: "取消",
        okType: "danger",
        centered: true,
      });
    }

    return true;
  }

  function cloneMasterDataValue(value) {
    if (value instanceof Date) return new Date(value.getTime());
    if (Array.isArray(value)) return value.map(cloneMasterDataValue);
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [
          key,
          cloneMasterDataValue(item),
        ]),
      );
    }
    return value;
  }

  function createMasterDataSnapshot() {
    return {
      mockData: cloneMasterDataValue(mockData),
      stockMovementData: cloneMasterDataValue(normalizeList(stockMovementData)),
      logsData: cloneMasterDataValue(normalizeList(logsData)),
    };
  }

  function restoreMasterDataSnapshot(snapshot) {
    mockData = normalizeMockData(cloneMasterDataValue(snapshot.mockData));
    stockMovementData = cloneMasterDataValue(snapshot.stockMovementData);
    logsData = cloneMasterDataValue(snapshot.logsData);
  }

  function createMasterDataAuditLog(audit) {
    if (!audit) return null;

    const record = {
      id: createRuntimeId("LOG"),
      timestamp: new Date(),
      userId: currentUser.id,
      userName: currentUser.name,
      actionType: audit.actionType,
      objectType: audit.objectType,
      objectName: audit.objectName,
      details: audit.details,
      ipAddress: clientIP,
    };
    logsData.unshift(record);
    return record;
  }

  function refreshCommittedAuditLog(audit, record) {
    if (!audit || !record || typeof addLog !== "function") return;

    addLog(
      audit.actionType,
      audit.objectType,
      audit.objectName,
      audit.details,
      { append: false, persist: false, record },
    );
  }

  async function persistMasterDataChanges(snapshot, entityLabel, audit) {
    const auditRecord = createMasterDataAuditLog(audit);
    try {
      const persisted =
        typeof saveMockData === "function"
          ? await Promise.resolve(saveMockData())
          : true;

      if (persisted !== false) {
        refreshCommittedAuditLog(audit, auditRecord);
        return true;
      }
    } catch (error) {
      console.error(`Failed to persist ${entityLabel} changes.`, error);
    }

    restoreMasterDataSnapshot(snapshot);
    const logsSection = document.querySelector("#logs");
    if (
      logsSection &&
      !logsSection.classList.contains("hidden") &&
      typeof renderLogsTable === "function"
    ) {
      renderLogsTable();
    }
    alert(`${entityLabel}保存失败，本次修改已回滚，原数据已恢复。`);
    return false;
  }

  function getActiveStockTabName() {
    return (
      document.querySelector("#stock-tabs .active")?.getAttribute("data-tab") ||
      "all"
    );
  }

  function refreshInventoryDependencies() {
    if (typeof updateInventoryTable === "function") {
      updateInventoryTable();
    }

    if (typeof initInventoryFilters === "function") {
      initInventoryFilters();
    }
  }

  function refreshStockDependencies() {
    if (typeof renderStockMovementTable === "function") {
      renderStockMovementTable(getActiveStockTabName());
    }

    if (typeof renderDashboardActivity === "function") {
      renderDashboardActivity();
    }
  }

  function refreshBillDependencies() {
    if (typeof renderBillPartyFilter === "function") {
      renderBillPartyFilter();
    }

    if (typeof updateBillsTable === "function") {
      updateBillsTable();
    }
  }

  function updateCustomerReferenceIds(previousId, nextId) {
    normalizeList(mockData.bills).forEach((record) => {
      if (
        record.statementType === "customer" &&
        record.partyId === previousId
      ) {
        record.partyId = nextId;
      }
    });

    normalizeList(mockData.deliveryNotes).forEach((note) => {
      if (note.customerId === previousId) {
        note.customerId = nextId;
      }
    });

    normalizeList(mockData.customerProductPrices).forEach((price) => {
      if (price.customerId === previousId) {
        price.customerId = nextId;
      }
    });

    normalizeList(stockMovementData).forEach((record) => {
      if (record.customerId === previousId) {
        record.customerId = nextId;
      }
    });
  }

  function configureReadonlyModal() {
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const modalPanel = document.getElementById("modal-panel");
    const modalContent = document.getElementById("modal-content");

    if (modalPanel) {
      modalPanel.className =
        "bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4";
    }

    if (modalContent) {
      modalContent.className = "p-3 md:p-4";
    }

    if (confirmBtn) {
      confirmBtn.textContent = "关闭";
    }

    if (cancelBtn) {
      cancelBtn.classList.add("hidden");
    }
  }

  function getSafeDisplayValue(value) {
    return escapeHTML(getStoredOptionalValue(value));
  }

  function buildReadonlySummaryCard(iconClass, title, subtitle, statusMeta) {
    const safeTitle = getSafeDisplayValue(title);
    const safeSubtitle = escapeHTML(normalizeTextValue(subtitle));
    const safeStatusLabel = escapeHTML(statusMeta.label);

    return `
            <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div class="flex items-start justify-between gap-3">
                    <div class="flex items-center min-w-0">
                        <div class="flex-shrink-0 h-10 w-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                            <i class="fa fa-${iconClass} text-gray-500 text-xl"></i>
                        </div>
                        <div class="ml-3 min-w-0">
                            <div class="text-base font-semibold text-gray-900 truncate">${safeTitle}</div>
                            <div class="text-xs text-gray-500">${safeSubtitle}</div>
                        </div>
                    </div>
                    <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </div>
            </div>
        `;
  }

  function buildReadonlyFieldCard(label, valueMarkup, extraClasses = "") {
    const safeLabel = escapeHTML(label);
    const className = extraClasses ? ` ${extraClasses}` : "";

    return `
            <div class="rounded-lg border border-gray-200 p-3${className}">
                <div class="text-xs text-gray-500 mb-1">${safeLabel}</div>
                <div class="text-sm font-medium text-gray-900 break-words">${valueMarkup}</div>
            </div>
        `;
  }

  function buildEditableFieldCard(labelMarkup, fieldMarkup, extraClasses = "") {
    const className = extraClasses ? ` ${extraClasses}` : "";

    return `
            <div class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5${className}">
                <label class="block text-xs font-semibold text-gray-500 mb-1.5">${labelMarkup}</label>
                ${fieldMarkup}
            </div>
        `;
  }

  function buildFormIntroCard(iconClass, title, description) {
    const safeTitle = escapeHTML(title);
    const safeDescription = escapeHTML(description);

    return `
            <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 h-10 w-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center">
                        <i class="fa fa-${iconClass} text-blue-600 text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="text-base font-semibold text-gray-900">${safeTitle}</div>
                        <div class="text-sm text-gray-600 mt-0.5">${safeDescription}</div>
                    </div>
                </div>
            </div>
        `;
  }

  function configureWideFormModal(confirmText = "保存") {
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const modalPanel = document.getElementById("modal-panel");
    const modalContent = document.getElementById("modal-content");

    if (modalPanel) {
      modalPanel.className =
        "bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4";
    }

    if (modalContent) {
      modalContent.className = "p-2.5 md:p-3";
    }

    if (confirmBtn) {
      confirmBtn.textContent = confirmText;
    }
    global.configureBusinessFormPage?.(confirmText);

    if (cancelBtn) {
      cancelBtn.classList.remove("hidden");
      cancelBtn.textContent = "取消";
    }
  }

  global.AppMasterDataCore = Object.freeze({
    DOMESTIC_PHONE_REGEX,
    PRODUCT_CATEGORIES,
    PAYMENT_OPTIONS,
    STATUS_OPTIONS,
    formatDateTime,
    normalizeTextValue,
    getEditableFieldValue,
    getStoredOptionalValue,
    getStatusMeta,
    buildRecordInfoCard,
    ensureUniqueName,
    ensureUniqueRecordId,
    renderStatusSelect,
    renderPaymentTermsSelect,
    formatCurrencyValue,
    getProductStatusMeta,
    countMatchingItems,
    requestDeleteConfirmation,
    cloneMasterDataValue,
    createMasterDataSnapshot,
    restoreMasterDataSnapshot,
    createMasterDataAuditLog,
    refreshCommittedAuditLog,
    persistMasterDataChanges,
    getActiveStockTabName,
    refreshInventoryDependencies,
    refreshStockDependencies,
    refreshBillDependencies,
    updateCustomerReferenceIds,
    configureReadonlyModal,
    getSafeDisplayValue,
    buildReadonlySummaryCard,
    buildReadonlyFieldCard,
    buildEditableFieldCard,
    buildFormIntroCard,
    configureWideFormModal,
  });
})(window);
