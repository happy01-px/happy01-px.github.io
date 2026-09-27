(function initBillsModule(global) {
  const state = global.BillsModuleState;

  if (!global.BillsCore) {
    throw new Error("BillsCore must be loaded before bills-module.js");
  }

  const {
    BILL_STATUS_META,
    formatBillCurrency,
    formatBillDateOnly,
    formatStatementPeriod,
    getBillsMeta,
    getStatusBadgeHtml,
    normalizeBillStatus,
    roundCurrency,
    convertAmountToChineseUpperForBills,
  } = global.BillsCore;

  if (!global.AppBillsData) {
    throw new Error("bills-data.js must be loaded before bills-module.js");
  }

  const { getStatementRecords, getOutstandingAmount, ensureBillsSeedData } =
    global.AppBillsData;

  if (!state || !global.AppBillsList) {
    throw new Error(
      "bills-state.js and bills-list.js must load before bills-module.js",
    );
  }

  const {
    buildBillsEmptyHostMarkup,
    buildBillsEmptyTableRow,
    hydrateBillsEmptyStates,
    normalizeBillsSectionCopy,
    closeBillsModal,
    bindBillsModalLifecycle,
    openBillsModal,
    initBillFiltersOverride,
    updateBillsTableOverride,
    updateActiveBillTabUI,
    bindBillTabEventsOverride,
  } = global.AppBillsList;

  if (!global.AppBillsStatements) {
    throw new Error("bills-statements.js must load before bills-module.js");
  }

  const {
    buildCustomerStatementFromForm,
    buildSupplierStatementFromForm,
    findDuplicateStatement,
    buildCreateBillDraft,
    getDraftSourceOccupancyEntries,
    normalizeOccupiedContextEntries,
  } = global.AppBillsStatements;

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

  function clearBillsViewFloatingActions() {
    document.getElementById("bills-view-floating-actions")?.remove();
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

  function buildStatementExcelWorkbook(statement) {
    if (!global.XLSX?.utils || typeof global.XLSX.write !== "function") {
      throw new Error("Excel 导出组件未加载");
    }

    const meta = getBillsMeta(statement.statementType);
    const details = global.normalizeList(statement.details);
    const arrears = global.normalizeList(statement.arrears);
    const payments = global.normalizeList(statement.payments);
    const rows = [
      [statement.companyNameSnapshot || "对账单"],
      [meta.label],
      [],
      [
        "对账单编号",
        statement.id,
        "对账日期",
        formatBillDateOnly(statement.statementDate),
      ],
      [
        "对账周期",
        formatStatementPeriod(statement.periodStart, statement.periodEnd),
        meta.partyLabel,
        statement.partyNameSnapshot || "-",
      ],
      [
        "联系人",
        statement.contactNameSnapshot || "-",
        "联系电话",
        statement.contactPhoneSnapshot || "-",
      ],
      [],
      [
        "序号",
        "业务日期",
        "来源单号",
        "产品名称",
        "规格",
        "单位",
        "数量",
        "单价",
        "金额",
        "备注",
      ],
      ...details.map((detail, index) => [
        index + 1,
        formatBillDateOnly(detail.bizDate),
        detail.sourceNo || "-",
        detail.productNameSnapshot || "-",
        detail.specSnapshot || "-",
        detail.unitSnapshot || "-",
        Number(detail.quantity) || 0,
        roundCurrency(Number(detail.unitPrice) || 0),
        roundCurrency(Number(detail.lineAmount) || 0),
        detail.remark || "-",
      ]),
      [
        "明细合计",
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        roundCurrency(Number(statement.currentAmount) || 0),
        "",
      ],
      [],
      ["往期欠款月份", "金额"],
      ...(arrears.length
        ? arrears.map((item) => [
            item.monthLabel || "-",
            roundCurrency(Number(item.amount) || 0),
          ])
        : [["暂无往期欠款", 0]]),
      [],
      ["付款日期", "方式", "金额", "备注"],
      ...(payments.length
        ? payments.map((item) => [
            formatBillDateOnly(item.payDate),
            item.payMethod || "-",
            roundCurrency(Number(item.payAmount) || 0),
            item.remark || "-",
          ])
        : [["暂无付款记录", "", 0, ""]]),
      [],
      ["单据份数", Number(statement.documentCount) || 0],
      ["当前货款", roundCurrency(Number(statement.currentAmount) || 0)],
      ["含税金额", roundCurrency(Number(statement.amountWithTax) || 0)],
      ["往期欠款", roundCurrency(Number(statement.arrearsAmount) || 0)],
      ["对账总额", roundCurrency(Number(statement.totalAmount) || 0)],
      [
        "大写金额",
        statement.totalAmountUppercase ||
          convertAmountToChineseUpperForBills(statement.totalAmount),
      ],
    ];

    const worksheet = global.XLSX.utils.aoa_to_sheet(rows);
    worksheet["!cols"] = [
      { wch: 16 },
      { wch: 18 },
      { wch: 18 },
      { wch: 24 },
      { wch: 14 },
      { wch: 10 },
      { wch: 12 },
      { wch: 14 },
      { wch: 16 },
      { wch: 24 },
    ];
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 9 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } },
    ];

    const workbook = global.XLSX.utils.book_new();
    global.XLSX.utils.book_append_sheet(workbook, worksheet, "对账单");
    workbook.Props = {
      Title: `${statement.id || ""} ${meta.label}`.trim(),
      Subject: "库存管理系统对账单",
      CreatedDate: new Date(),
    };
    return workbook;
  }

  function exportStatementAsExcel(statement) {
    try {
      const workbook = buildStatementExcelWorkbook(statement);
      const workbookData = global.XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
        compression: true,
      });
      const blob = new Blob([workbookData], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      downloadBlob(blob, `${statement.id}.xlsx`);
      return true;
    } catch (error) {
      console.error("exportStatementAsExcel failed:", error);
      alert(`Excel 导出失败：${error?.message || "请刷新页面后重试"}`);
      return false;
    }
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
        } catch (_parseError) {
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

  async function saveStatementRecord(statement, reopenView, audit) {
    const bills = global.normalizeList(global.mockData?.bills);
    const nextBills = bills.map((item) =>
      item.id === statement.id ? statement : item,
    );
    global.mockData.bills = nextBills;
    const auditLogs = audit ? global.stageAuditLogs(audit) : [];
    let saved = true;
    if (typeof global.saveMockData === "function") {
      saved = await global.saveMockData();
    }
    if (saved === false) {
      global.rollbackStagedAuditLogs(auditLogs);
      global.mockData.bills = bills;
      updateBillsTableOverride();
      alert("对账单保存失败，本次变更已回滚。");
      return false;
    }
    global.finalizeStagedAuditLogs(auditLogs);
    updateBillsTableOverride();
    const isViewingCurrentStatement =
      state.activeViewStatementId === statement.id &&
      !document.getElementById("bills-view")?.classList.contains("hidden");
    if (reopenView || isViewingCurrentStatement) {
      openStatementViewModal(statement, {
        returnTab: state.activeViewReturnTab || statement.statementType,
      });
    }
    return true;
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
          onClick: async function () {
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
            const saved = await saveStatementRecord(nextStatement, true);
            if (saved) closeBillsModal();
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

  async function persistStatement(statement) {
    const previousBills = global.normalizeList(global.mockData.bills);
    global.mockData.bills = previousBills.concat([statement]);
    let saved = true;
    if (typeof global.saveMockData === "function") {
      saved = await global.saveMockData();
    }
    if (saved === false) {
      global.mockData.bills = previousBills;
      updateBillsTableOverride();
      alert("对账单创建失败，未保存的数据已回滚。");
      return false;
    }
    state.activeTab = statement.statementType;
    updateActiveBillTabUI();
    initBillFiltersOverride();
    updateBillsTableOverride();
    return true;
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
        .filter((item) => item.status !== "inactive")
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
            .filter((item) => item.status !== "inactive")
            .map((item) => ({ value: item.id, label: item.name }))
        : draft.statementType === "customer"
          ? global
              .normalizeList(global.mockData?.customers)
              .filter((item) => item.status !== "inactive")
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

  async function createStatementFromDraft(formData) {
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
    const saved = await persistStatement(statement);
    if (!saved) return false;
    state.pendingDraft = null;
    openStatementViewModal(statement);
    return true;
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

  async function persistStatementRecordWithViewContext(statement, options) {
    const bills = global.normalizeList(global.mockData?.bills);
    global.mockData.bills = bills.map((item) =>
      item.id === statement.id ? statement : item,
    );
    let saved = true;
    if (typeof global.saveMockData === "function") {
      saved = await global.saveMockData();
    }
    if (saved === false) {
      global.mockData.bills = bills;
      updateBillsTableOverride();
      alert("对账单保存失败，本次变更已回滚。");
      return false;
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
    return true;
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
          onClick: async function () {
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
              const saved = await persistStatementRecordWithViewContext(
                nextStatement,
                {
                  returnTab:
                    options?.returnTab ||
                    state.activeViewReturnTab ||
                    statement.statementType,
                  preserveOccupiedContext: !!options?.preserveOccupiedContext,
                },
              );
              if (!saved) return;
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
          onClick: async function () {
            const nextStatement = {
              ...statement,
              status: "cancelled",
              updatedAt: global.getLocalISOString(),
            };
            const statementTypeLabel = getBillsMeta(
              nextStatement.statementType,
            ).label;
            const periodText = formatStatementPeriod(
              nextStatement.periodStart,
              nextStatement.periodEnd,
            );
            const saved = await saveStatementRecord(nextStatement, true, {
              actionType: "cancel",
              objectType: "bill",
              objectName: nextStatement.id,
              details: `作废${statementTypeLabel}：${nextStatement.partyNameSnapshot || "-"} / ${nextStatement.id} / ${periodText}`,
            });
            if (!saved) return;
            closeBillsModal();
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
                            ${buildBillsEmptyHostMarkup(
                              `未找到编号为 ${statementId} 的对账单。`,
                              {
                                wrapperClassName: "py-8",
                                fallbackClassName:
                                  "text-center text-sm text-gray-500",
                              },
                            )}
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
      ?.addEventListener("click", async () => {
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
      ?.addEventListener("click", async () => {
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

        const taxRate = Number(formData.taxRate);
        if (!Number.isFinite(taxRate) || taxRate < 1) {
          alert("请输入有效的税率系数");
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

        await createStatementFromDraft(formData);
      });
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
    button.addEventListener("click", () => {
      const statementType =
        state.activeTab === "supplier" ? "supplier" : "customer";
      if (
        typeof global.guardWorkflowAction === "function" &&
        !global.guardWorkflowAction("addBill", { statementType })
      ) {
        return;
      }
      openCreateBillModal();
    });
    state.addButtonBound = true;
  }

  async function initBillsModule() {
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

  global.AppBillsExport = Object.freeze({
    buildStatementExcelWorkbook,
    buildStatementExportHtml,
    exportStatementAsExcel,
    exportStatementAsPdf,
  });

  document.addEventListener("DOMContentLoaded", function () {
    initBillsModule().catch((error) => {
      console.error("Bills module init failed:", error);
    });
  });
})(window);
