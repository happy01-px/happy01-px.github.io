(function initPriceManagementModule(global) {
  let activeTab = "purchase";
  let pendingCustomerId = "";
  let confirmedCustomerPair = null;
  let customerPriceDisplayMode = "exclusive";
  let customerPriceDrafts = new Map();

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function money(value) {
    const number = Number(value);
    return Number.isFinite(number) ? `¥${number.toFixed(2)}` : "-";
  }

  function roundMoney(value) {
    const number = Number(value);
    return Number.isFinite(number)
      ? Math.round((number + Number.EPSILON) * 100) / 100
      : null;
  }

  function getCustomerTaxRate(customer) {
    const configuredRate = Number(customer?.defaultTaxRate);
    if (Number.isFinite(configuredRate) && configuredRate > 0) {
      return configuredRate > 1 ? configuredRate / 100 : configuredRate;
    }

    const coefficient = Number(customer?.taxRateCoefficient);
    if (!Number.isFinite(coefficient) || coefficient <= 0) return 0;
    if (coefficient > 1) return coefficient - 1;
    return coefficient;
  }

  function convertPriceMode(value, sourceMode, targetMode, taxRate) {
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    if (sourceMode === targetMode || taxRate <= 0) return roundMoney(number);
    return sourceMode === "inclusive"
      ? roundMoney(number / (1 + taxRate))
      : roundMoney(number * (1 + taxRate));
  }

  function showPriceWarning(message) {
    if (typeof global.showAntdMessage === "function") {
      global.showAntdMessage("warning", message);
      return;
    }
    global.alert(message);
  }

  function dateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";
    return date.toLocaleString("zh-CN", { hour12: false });
  }

  function setSelectOptions(select, records, placeholder, selectedValue) {
    if (!select) return;
    const options = [
      `<option value="">${escapeHTML(placeholder)}</option>`,
      ...records.map(
        (record) =>
          `<option value="${escapeHTML(record.id)}" ${record.id === selectedValue ? "selected" : ""}>${escapeHTML(record.name || record.id)}</option>`,
      ),
    ];
    select.innerHTML = options.join("");
  }

  function getActiveCompanies() {
    return list(mockData?.companies).filter(
      (record) => record.status !== "inactive",
    );
  }

  function getActiveCustomers() {
    return list(mockData?.customers).filter(
      (record) => record.status !== "inactive",
    );
  }

  function getActiveProducts() {
    return list(mockData?.products).filter(
      (record) => record.status !== "inactive",
    );
  }

  function showEmptyRow(tbody, colspan, message) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="px-6 py-10 text-center text-sm text-gray-500">${escapeHTML(message)}</td></tr>`;
  }

  function renderPurchasePriceTable() {
    const tbody = document.getElementById("purchase-price-table-body");
    if (!tbody) return;
    const companyId = document.getElementById(
      "purchase-price-company-filter",
    )?.value;
    const supplierId = document.getElementById(
      "purchase-price-supplier-filter",
    )?.value;
    const companyMap = new Map(
      list(mockData?.companies).map((record) => [record.id, record.name]),
    );
    const supplierMap = new Map(
      list(mockData?.suppliers).map((record) => [record.id, record.name]),
    );
    const productMap = new Map(
      list(mockData?.products).map((record) => [record.id, record.name]),
    );
    const records = list(stockMovementData)
      .filter(
        (record) =>
          record.type === "inbound" &&
          record.status !== "voided" &&
          (!companyId || record.companyId === companyId) &&
          (!supplierId || record.supplierId === supplierId),
      )
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() -
          new Date(left.createdAt).getTime(),
      );
    if (!records.length) {
      showEmptyRow(tbody, 9, "当前筛选条件下暂无进货记录");
      return;
    }
    tbody.innerHTML = records
      .map((record) => {
        const quantity = Number(record.quantity || 0);
        const unitPrice = Number(record.price || 0);
        const total = quantity * unitPrice;
        return `<tr class="hover:bg-gray-50">
          <td class="whitespace-nowrap px-4 py-3 text-sm text-gray-600">${escapeHTML(dateTime(record.createdAt))}</td>
          <td class="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-700">${escapeHTML(record.inboundOrderNo || record.orderNo || "-")}</td>
          <td class="px-4 py-3 text-sm text-gray-900"><div class="table-long-text price-history-cell-wrap" title="${escapeHTML(record.companyName || companyMap.get(record.companyId) || "未归属")}">${escapeHTML(record.companyName || companyMap.get(record.companyId) || "未归属")}</div></td>
          <td class="px-4 py-3 text-sm text-gray-900"><div class="table-long-text price-history-cell-wrap" title="${escapeHTML(record.supplierName || supplierMap.get(record.supplierId) || "-")}">${escapeHTML(record.supplierName || supplierMap.get(record.supplierId) || "-")}</div></td>
          <td class="px-4 py-3 text-sm font-medium text-gray-900"><div class="table-long-text price-history-cell-wrap" title="${escapeHTML(record.productName || productMap.get(record.productId) || "-")}">${escapeHTML(record.productName || productMap.get(record.productId) || "-")}</div></td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">${quantity} ${escapeHTML(record.unit || "")}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">${money(unitPrice)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">${money(total)}</td>
          <td class="px-4 py-3 text-sm text-gray-500"><div class="table-long-text price-history-cell-wrap" title="${escapeHTML(record.remark || "-")}">${escapeHTML(record.remark || "-")}</div></td>
        </tr>`;
      })
      .join("");
  }

  function getLatestPurchase(productId, companyId) {
    return (
      list(stockMovementData)
        .filter(
          (record) =>
            record.type === "inbound" &&
            record.status !== "voided" &&
            record.productId === productId &&
            (!companyId || !record.companyId || record.companyId === companyId),
        )
        .sort(
          (left, right) =>
            new Date(right.createdAt).getTime() -
            new Date(left.createdAt).getTime(),
        )[0] || null
    );
  }

  function getLatestSalePrice(productId, customerId, companyId) {
    const notes = list(mockData?.deliveryNotes)
      .filter(
        (note) =>
          note.type === "sales" &&
          note.customerId === customerId &&
          note.companyId === companyId &&
          !["voided", "cancelled"].includes(note.status),
      )
      .sort(
        (left, right) =>
          new Date(
            right.deliveryDate || right.issueDate || right.createdAt,
          ).getTime() -
          new Date(
            left.deliveryDate || left.issueDate || left.createdAt,
          ).getTime(),
      );

    for (const note of notes) {
      const detail = list(note.details).find(
        (entry) => entry.productId === productId,
      );
      const price = Number(detail?.confirmedUnitPrice ?? detail?.unitPrice);
      if (!Number.isFinite(price)) continue;
      return {
        price,
        priceTaxMode:
          note.priceTaxModeSnapshot === "inclusive" ||
          note.priceTaxMode === "inclusive"
            ? "inclusive"
            : "exclusive",
      };
    }
    return null;
  }

  function collectCustomerPriceDrafts() {
    document
      .querySelectorAll("[data-customer-pair-price-row]")
      .forEach((row) => {
        customerPriceDrafts.set(row.dataset.productId, {
          value: String(
            row.querySelector('[data-field="referencePrice"]')?.value || "",
          ).trim(),
          priceTaxMode: customerPriceDisplayMode,
        });
      });
  }

  function syncCustomerPairControls() {
    const isConfirmed = Boolean(confirmedCustomerPair);
    const companySelect = document.getElementById(
      "customer-price-company-select",
    );
    const customerSelect = document.getElementById(
      "customer-price-customer-select",
    );
    const confirmButton = document.getElementById(
      "confirm-customer-price-pair",
    );
    const resetButton = document.getElementById("reset-customer-price-pair");

    if (companySelect) companySelect.disabled = isConfirmed;
    if (customerSelect) customerSelect.disabled = isConfirmed;
    if (confirmButton) {
      confirmButton.disabled = isConfirmed;
      confirmButton.textContent = isConfirmed ? "已确认" : "确认";
    }
    if (resetButton) resetButton.disabled = !isConfirmed;
  }

  function renderCustomerPriceModeSwitch(customer) {
    const host = document.getElementById("customer-price-tax-mode-switch");
    if (!host) return;
    const checked = customerPriceDisplayMode === "inclusive";
    const onChange = (nextChecked) => {
      const taxRate = getCustomerTaxRate(customer);
      if (nextChecked && taxRate <= 0) {
        showPriceWarning("该公司没有税点，无法切换为税后价");
        renderCustomerPriceModeSwitch(customer);
        return;
      }
      collectCustomerPriceDrafts();
      customerPriceDisplayMode = nextChecked ? "inclusive" : "exclusive";
      renderCustomerPairPriceTable();
    };

    if (
      global.React &&
      global.antd?.Switch &&
      typeof global.renderAntdNode === "function"
    ) {
      global.renderAntdNode(
        host,
        global.React.createElement(global.antd.Switch, {
          checked,
          checkedChildren: "税后价",
          unCheckedChildren: "未税价",
          onChange,
        }),
      );
      return;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = checked
      ? "rounded-full bg-primary px-3 py-1 text-xs font-medium text-white"
      : "rounded-full bg-gray-300 px-3 py-1 text-xs font-medium text-gray-700";
    button.setAttribute("role", "switch");
    button.setAttribute("aria-checked", String(checked));
    button.textContent = checked ? "税后价" : "未税价";
    button.addEventListener("click", () => onChange(!checked));
    host.replaceChildren(button);
  }

  function showUnconfirmedCustomerPriceView() {
    const summary = document.getElementById("customer-price-pair-summary");
    const tbody = document.getElementById("customer-pair-price-table-body");
    const content = document.getElementById("customer-pair-price-content");
    if (summary) {
      summary.textContent = "请先选择我方公司和客户，再点击“确认”。";
    }
    tbody?.replaceChildren();
    if (content) content.hidden = true;
    syncCustomerPairControls();
  }

  function confirmCustomerPricePair() {
    const companyId = document.getElementById(
      "customer-price-company-select",
    )?.value;
    const customerId = document.getElementById(
      "customer-price-customer-select",
    )?.value;
    const company = getActiveCompanies().find(
      (record) => record.id === companyId,
    );
    const customer = getActiveCustomers().find(
      (record) => record.id === customerId,
    );
    if (!company || !customer) {
      showPriceWarning("请先选择我方公司和客户");
      return false;
    }

    confirmedCustomerPair = { companyId, customerId };
    customerPriceDisplayMode = "exclusive";
    customerPriceDrafts = new Map();
    syncCustomerPairControls();
    renderCustomerPairPriceTable();
    return true;
  }

  function resetCustomerPricePair() {
    confirmedCustomerPair = null;
    customerPriceDisplayMode = "exclusive";
    customerPriceDrafts = new Map();
    const companySelect = document.getElementById(
      "customer-price-company-select",
    );
    const customerSelect = document.getElementById(
      "customer-price-customer-select",
    );
    if (companySelect) companySelect.value = "";
    if (customerSelect) customerSelect.value = "";
    showUnconfirmedCustomerPriceView();
  }

  function renderCustomerPairPriceTable() {
    const tbody = document.getElementById("customer-pair-price-table-body");
    const summary = document.getElementById("customer-price-pair-summary");
    const content = document.getElementById("customer-pair-price-content");
    if (!tbody) return;
    if (!confirmedCustomerPair) {
      showUnconfirmedCustomerPriceView();
      return;
    }
    const { companyId, customerId } = confirmedCustomerPair;
    const company = list(mockData?.companies).find(
      (record) => record.id === companyId,
    );
    const customer = list(mockData?.customers).find(
      (record) => record.id === customerId,
    );
    if (!company || !customer) {
      resetCustomerPricePair();
      return;
    }
    const taxRate = getCustomerTaxRate(customer);
    const taxPoint = taxRate * 100;
    if (summary) {
      summary.innerHTML = `<div class="flex flex-wrap items-center justify-between gap-3"><span>${escapeHTML(company.name)} → ${escapeHTML(customer.name)}｜默认税点 ${taxPoint.toFixed(2).replace(/\.00$/, "")}%｜当前${customerPriceDisplayMode === "inclusive" ? "税后价" : "未税价"}</span><span class="inline-flex items-center gap-2"><span class="text-xs text-purple-600">未税价</span><span id="customer-price-tax-mode-switch"></span><span class="text-xs text-purple-600">税后价</span></span></div>`;
    }
    if (content) content.hidden = false;
    syncCustomerPairControls();
    renderCustomerPriceModeSwitch(customer);
    const products = getActiveProducts().sort((left, right) =>
      String(left.name).localeCompare(String(right.name), "zh-CN"),
    );
    if (!products.length) {
      showEmptyRow(tbody, 7, "请先新增商品和进货记录");
      return;
    }
    tbody.innerHTML = products
      .map((product) => {
        const current = global.getEffectiveCustomerPrice?.(
          customerId,
          product.id,
          companyId,
        );
        const lastSale = getLatestSalePrice(product.id, customerId, companyId);
        const lastPurchase = getLatestPurchase(product.id, companyId);
        const currentMode =
          current?.priceTaxMode === "inclusive" ? "inclusive" : "exclusive";
        const draft = customerPriceDrafts.get(product.id);
        const draftSourceMode = draft?.priceTaxMode || currentMode;
        const draftSourceValue =
          draft !== undefined ? draft.value : current?.referencePrice;
        const referencePrice =
          draftSourceValue === undefined || draftSourceValue === ""
            ? ""
            : convertPriceMode(
                draftSourceValue,
                draftSourceMode,
                customerPriceDisplayMode,
                taxRate,
              );
        const recentPurchase = lastPurchase
          ? convertPriceMode(
              lastPurchase.price,
              "exclusive",
              customerPriceDisplayMode,
              taxRate,
            )
          : null;
        const retailPrice = convertPriceMode(
          product.retailPrice,
          "exclusive",
          customerPriceDisplayMode,
          taxRate,
        );
        const lastSalePrice = lastSale
          ? convertPriceMode(
              lastSale.price,
              lastSale.priceTaxMode,
              customerPriceDisplayMode,
              taxRate,
            )
          : null;
        if (draft !== undefined) {
          customerPriceDrafts.set(product.id, {
            value: referencePrice === "" ? "" : String(referencePrice),
            priceTaxMode: customerPriceDisplayMode,
          });
        }
        return `<tr data-customer-pair-price-row data-product-id="${escapeHTML(product.id)}" data-current-id="${escapeHTML(current?.id || "")}">
          <td class="px-4 py-3"><div class="font-medium text-gray-900">${escapeHTML(product.name)}</div><div class="mt-1 text-xs text-gray-500">${escapeHTML(product.category || "-")} · ${escapeHTML(product.unit || "-")}</div></td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">${Number(product.stockQuantity || 0)} ${escapeHTML(product.unit || "")}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">${recentPurchase == null ? "-" : money(recentPurchase)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">${money(retailPrice)}</td>
          <td class="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">${lastSalePrice == null ? "-" : money(lastSalePrice)}</td>
          <td class="px-4 py-3"><input data-field="referencePrice" type="number" min="0" step="0.01" value="${escapeHTML(referencePrice)}" placeholder="未设置" class="w-full rounded-lg border border-gray-300 px-3 py-2 text-right"></td>
          <td class="px-4 py-3 text-center"><input data-field="priceTaxMode" type="hidden" value="${customerPriceDisplayMode}"><span class="inline-flex rounded-full px-3 py-1 text-xs font-medium ${customerPriceDisplayMode === "inclusive" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-700"}">${customerPriceDisplayMode === "inclusive" ? "税后价" : "未税价"}</span></td>
        </tr>`;
      })
      .join("");
  }

  async function saveCustomerPairPrices() {
    const companyId = confirmedCustomerPair?.companyId;
    const customerId = confirmedCustomerPair?.customerId;
    const company = list(mockData?.companies).find(
      (record) => record.id === companyId,
    );
    const customer = list(mockData?.customers).find(
      (record) => record.id === customerId,
    );
    if (!company || !customer) {
      alert("请先选择公司和客户");
      return false;
    }
    const rows = Array.from(
      document.querySelectorAll("[data-customer-pair-price-row]"),
    );
    const beforePrices = JSON.parse(
      JSON.stringify(list(mockData.customerProductPrices)),
    );
    const beforeLogs = list(logsData).slice();
    const now =
      typeof getLocalISOString === "function"
        ? getLocalISOString()
        : new Date().toISOString();
    let changed = 0;
    for (const row of rows) {
      const priceText = String(
        row.querySelector('[data-field="referencePrice"]')?.value || "",
      ).trim();
      if (!priceText) continue;
      const referencePrice = Number(priceText);
      if (!Number.isFinite(referencePrice) || referencePrice < 0) {
        alert("客户参考价必须是大于或等于 0 的有效数字");
        return false;
      }
      const priceTaxMode =
        row.querySelector('[data-field="priceTaxMode"]')?.value === "inclusive"
          ? "inclusive"
          : "exclusive";
      const current = row.dataset.currentId
        ? list(mockData.customerProductPrices).find(
            (record) => record.id === row.dataset.currentId,
          )
        : null;
      if (
        current &&
        Number(current.referencePrice) === referencePrice &&
        current.priceTaxMode === priceTaxMode
      ) {
        continue;
      }
      if (current) {
        current.status = "inactive";
        current.updatedAt = now;
      }
      mockData.customerProductPrices.push({
        id: createRuntimeId("CPP"),
        companyId,
        customerId,
        productId: row.dataset.productId,
        referencePrice,
        priceTaxMode,
        status: "active",
        remark: "公司客户商品价格表",
        createdAt: now,
        updatedAt: now,
      });
      changed += 1;
    }
    if (!changed) {
      alert("价格表没有变化");
      return false;
    }
    const auditLogs = stageAuditLogs({
      actionType: "edit",
      objectType: "customer-price-list",
      objectName: `${company.name} → ${customer.name}`,
      details: `更新公司客户商品价格 ${changed} 项`,
    });
    const saved =
      typeof saveMockData === "function" ? await saveMockData() : true;
    if (saved === false) {
      mockData.customerProductPrices = beforePrices;
      logsData = beforeLogs;
      rollbackStagedAuditLogs(auditLogs);
      alert("商品价格表保存失败，变更已回滚");
      return false;
    }
    finalizeStagedAuditLogs(auditLogs);
    customerPriceDrafts = new Map();
    renderCustomerPairPriceTable();
    alert(`商品价格表已保存，共更新 ${changed} 项`);
    return true;
  }

  function switchTab(nextTab) {
    activeTab = nextTab === "customer" ? "customer" : "purchase";
    const purchasePanel = document.getElementById(
      "price-management-purchase-panel",
    );
    const customerPanel = document.getElementById(
      "price-management-customer-panel",
    );
    const purchaseButton = document.getElementById(
      "price-management-tab-purchase",
    );
    const customerButton = document.getElementById(
      "price-management-tab-customer",
    );
    purchasePanel?.classList.toggle("hidden", activeTab !== "purchase");
    customerPanel?.classList.toggle("hidden", activeTab !== "customer");
    purchaseButton?.classList.toggle("bg-primary", activeTab === "purchase");
    purchaseButton?.classList.toggle("text-white", activeTab === "purchase");
    customerButton?.classList.toggle("bg-primary", activeTab === "customer");
    customerButton?.classList.toggle("text-white", activeTab === "customer");
    if (activeTab === "purchase") renderPurchasePriceTable();
    else renderCustomerPairPriceTable();
  }

  function populateSelectors() {
    const companies = getActiveCompanies();
    const customers = getActiveCustomers();
    const suppliers = list(mockData?.suppliers).filter(
      (record) => record.status !== "inactive",
    );
    const pairCompany = document.getElementById(
      "customer-price-company-select",
    );
    const pairCustomer = document.getElementById(
      "customer-price-customer-select",
    );
    const purchaseCompany = document.getElementById(
      "purchase-price-company-filter",
    );
    const purchaseSupplier = document.getElementById(
      "purchase-price-supplier-filter",
    );
    setSelectOptions(
      pairCompany,
      companies,
      "请选择我方公司",
      confirmedCustomerPair?.companyId || pairCompany?.value || "",
    );
    setSelectOptions(
      pairCustomer,
      customers,
      "请选择客户",
      pendingCustomerId ||
        confirmedCustomerPair?.customerId ||
        pairCustomer?.value ||
        "",
    );
    setSelectOptions(
      purchaseCompany,
      companies,
      "全部公司",
      purchaseCompany?.value || "",
    );
    setSelectOptions(
      purchaseSupplier,
      suppliers,
      "全部供应商",
      purchaseSupplier?.value || "",
    );
    pendingCustomerId = "";
  }

  function bindPriceManagementEvents() {
    const bindings = [
      {
        id: "price-management-tab-purchase",
        eventName: "click",
        handler: () => switchTab("purchase"),
      },
      {
        id: "price-management-tab-customer",
        eventName: "click",
        handler: () => switchTab("customer"),
      },
      {
        id: "purchase-price-company-filter",
        eventName: "change",
        handler: renderPurchasePriceTable,
      },
      {
        id: "purchase-price-supplier-filter",
        eventName: "change",
        handler: renderPurchasePriceTable,
      },
      {
        id: "customer-price-company-select",
        eventName: "change",
        handler: showUnconfirmedCustomerPriceView,
      },
      {
        id: "customer-price-customer-select",
        eventName: "change",
        handler: showUnconfirmedCustomerPriceView,
      },
      {
        id: "confirm-customer-price-pair",
        eventName: "click",
        handler: confirmCustomerPricePair,
      },
      {
        id: "reset-customer-price-pair",
        eventName: "click",
        handler: resetCustomerPricePair,
      },
      {
        id: "save-customer-pair-prices",
        eventName: "click",
        handler: saveCustomerPairPrices,
      },
    ];
    bindings.forEach(({ id, eventName, handler }) => {
      const element = document.getElementById(id);
      if (!element || element.dataset.priceBound) return;
      element.dataset.priceBound = "true";
      element.addEventListener(eventName, handler);
    });
  }

  function renderPriceManagement() {
    populateSelectors();
    bindPriceManagementEvents();
    switchTab(activeTab);
  }

  function openCustomerPriceManagement(customerId) {
    pendingCustomerId = customerId || "";
    confirmedCustomerPair = null;
    customerPriceDisplayMode = "exclusive";
    customerPriceDrafts = new Map();
    activeTab = "customer";
    global.showSection?.("price-management");
    renderPriceManagement();
  }

  global.renderPriceManagement = renderPriceManagement;
  global.openCustomerPriceManagement = openCustomerPriceManagement;
  global.confirmCustomerPricePair = confirmCustomerPricePair;
  global.resetCustomerPricePair = resetCustomerPricePair;
  global.saveCustomerPairPrices = saveCustomerPairPrices;
  global.AppPriceManagementModule = Object.freeze({
    renderPriceManagement,
    openCustomerPriceManagement,
    confirmCustomerPricePair,
    resetCustomerPricePair,
    saveCustomerPairPrices,
  });
})(window);
