(function initBillsList(global) {
  if (!global.BillsCore || !global.AppBillsData) return;
  const state = global.BillsModuleState;
  if (!state) return;

  const {
    BILL_STATUS_META,
    formatBillCurrency,
    formatBillDateOnly,
    formatBillDateTime,
    formatStatementPeriod,
    getBillsMeta,
    getStatusBadgeHtml,
    normalizeBillDate,
    normalizeBillStatus,
  } = global.BillsCore;
  const { getStatementRecords, getStatementPartyFilterValue } =
    global.AppBillsData;

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

    root.querySelectorAll("[data-bills-empty-description]").forEach((host) => {
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
  function getCurrentUserInitialForBills() {
    const name = String(global.currentUser?.name || "本地管理员").trim();
    return global.escapeHTML
      ? global.escapeHTML(name.charAt(0) || "张")
      : name.charAt(0) || "张";
  }
  function normalizeBillsSectionCopy() {
    const section = document.getElementById("bills");
    if (!section) return;

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
      headerTitles[6].classList.add(
        "table-action-header",
        "bills-action-header",
      );
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
    button.addEventListener("click", async (event) => {
      if (typeof config.onClick !== "function") return;
      button.disabled = true;
      try {
        await config.onClick(event);
      } catch (error) {
        console.error("Bills modal action failed:", error);
        alert("操作失败，请重试。");
      } finally {
        button.disabled = false;
      }
    });
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
            <div class="table-action-links bills-action-links">
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
                <td class="table-action-cell px-6 py-4 whitespace-nowrap text-sm font-medium bills-action-cell align-top">${getBillRowActions(record)}</td>
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

  const api = Object.freeze({
    buildBillsEmptyHostMarkup,
    buildBillsEmptyTableRow,
    hydrateBillsEmptyStates,
    ensureBillsPaginationState,
    getCurrentUserInitialForBills,
    normalizeBillsSectionCopy,
    getBillsModalElements,
    applyBillsListVisualParity,
    closeBillsModal,
    bindBillsModalLifecycle,
    createBillsModalButton,
    openBillsModal,
    getStatementsForTab,
    getPartyOptions,
    renderBillPartyFilter,
    renderBillStatusFilter,
    renderBillSearchInput,
    initBillFiltersOverride,
    getStatementDisplayName,
    getBillUserInitial,
    getBillRowActions,
    getBillTimeCellHtml,
    renderBillRows,
    getFilteredStatements,
    updateBillsTableOverride,
    updateActiveBillTabUI,
    bindBillTabEventsOverride,
  });
  global.AppBillsList = api;
  global.normalizeBillsSectionCopy = normalizeBillsSectionCopy;
  global.initBillFilters = initBillFiltersOverride;
  global.updateBillsTable = updateBillsTableOverride;
  global.renderBillsTable = updateBillsTableOverride;
  global.bindBillTabEvents = bindBillTabEventsOverride;
})(window);
