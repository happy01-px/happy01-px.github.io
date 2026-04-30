(function initMasterDataModule(global) {
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
    return list.reduce(
      (total, item) => total + (predicate(item) ? 1 : 0),
      0,
    );
  }

  async function requestDeleteConfirmation(entityLabel, recordName, hints = []) {
    const content = [
      `确定要删除“${recordName || "-"}”吗？删除后无法撤销。`,
      ...hints.filter(Boolean),
    ].join("\n");

    if (typeof window.showAntdConfirm === "function") {
      return window.showAntdConfirm({
        title: `删除${entityLabel}`,
        content,
        okText: "删除",
        cancelText: "取消",
        okType: "danger",
        centered: true,
      });
    }

    return true;
  }

  async function persistMasterDataChanges() {
    if (typeof saveMockData === "function") {
      return Promise.resolve(saveMockData());
    }

    return true;
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

    if (cancelBtn) {
      cancelBtn.classList.remove("hidden");
      cancelBtn.textContent = "取消";
    }
  }

  function getProductIcon(category) {
    switch (category) {
      case "电子产品":
        return "mobile";
      case "服装":
        return "shopping-bag";
      case "家具":
        return "cube";
      case "图书":
        return "book";
      default:
        return "cube";
    }
  }

  function showAddProductModal() {
    const formContent = `
            <form id="add-product-form" class="space-y-2.5">
                ${buildFormIntroCard("cube", "新增商品", "填写基础信息后即可创建商品，系统会自动生成 SKU 并写入库存。")}
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    ${buildEditableFieldCard(
                      '商品名称 <span class="text-danger">*</span>',
                      '<div id="modal-product-name-container" class="w-full"></div><input type="hidden" name="name" id="modal-product-name-input" required><input type="hidden" id="modal-product-choice-input">',
                      "xl:col-span-2",
                    )}
                    ${buildEditableFieldCard(
                      '分类 <span class="text-danger">*</span>',
                      '<div id="modal-category-container" class="w-full"></div><input type="hidden" name="category" id="modal-category-input" required>',
                    )}
                    ${buildEditableFieldCard(
                      '当前入库数量 <span class="text-danger">*</span>',
                      '<input type="number" name="quantity" min="1" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '成本单价 <span class="text-danger">*</span>',
                      '<input type="number" name="costPrice" required min="0" step="0.01" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '销售单价 <span class="text-danger">*</span>',
                      '<input type="number" name="retailPrice" required min="0" step="0.01" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '供应商 <span class="text-danger">*</span>',
                      '<div id="modal-supplier-container" class="w-full"></div><input type="hidden" name="supplierId" id="modal-supplier-input" required>',
                      "xl:col-span-3",
                    )}
                    ${buildEditableFieldCard(
                      "备注",
                      '<textarea name="notes" rows="2" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>',
                      "md:col-span-2 xl:col-span-3",
                    )}
                </div>
                <p class="text-xs text-gray-500">搜索到已有商品后，会自动带出分类、供应商、成本单价和销售单价；新商品则按你当前填写的数据创建。</p>
            </form>
        `;

    const productOptions = [...mockData.products]
      .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
      .map((product) => ({
        value: product.id,
        label: product.name,
      }));
    const categoryOptions = PRODUCT_CATEGORIES.map((category) => ({
      value: category,
      label: category,
    }));
    const supplierOptions = mockData.suppliers.map((supplier) => ({
      value: supplier.id,
      label: supplier.name,
    }));
    let lastLoadedProductId = "";

    showModal("新增商品", formContent, function onConfirm() {
      const form = document.getElementById("add-product-form");
      const formData = new FormData(form);

      if (!formData.get("name")) {
        alert("请输入商品名称");
        return false;
      }
      if (!formData.get("category")) {
        alert("请选择分类");
        return false;
      }
      if (!formData.get("quantity")) {
        alert("请输入数量");
        return false;
      }
      if (!formData.get("costPrice")) {
        alert("请输入成本单价");
        return false;
      }
      if (!formData.get("retailPrice")) {
        alert("请输入销售单价");
        return false;
      }
      if (!formData.get("supplierId")) {
        alert("请选择供应商");
        return false;
      }

      const productData = {
        name: formData.get("name"),
        category: formData.get("category"),
        quantity: parseInt(formData.get("quantity"), 10),
        costPrice: parseFloat(formData.get("costPrice")),
        retailPrice: parseFloat(formData.get("retailPrice")),
        supplierId: formData.get("supplierId"),
        notes: formData.get("notes"),
      };

      addProduct(productData);
    });

    configureWideFormModal("创建");

    const setHiddenValue = (inputId, value) => {
      const input = document.getElementById(inputId);
      if (input) {
        input.value = value || "";
      }
    };

    const setInputValue = (selector, value) => {
      const input = document.querySelector(selector);
      if (input) {
        input.value = value ?? "";
      }
    };

    const renderCategorySelect = (value = "") => {
      renderAntdSelect(
        "modal-category-container",
        "modal-category-input",
        categoryOptions,
        {
          placeholder: "请选择分类",
          value: value || undefined,
        },
      );
      setHiddenValue("modal-category-input", value);
    };

    const renderSupplierSelect = (value = "") => {
      renderAntdSelect(
        "modal-supplier-container",
        "modal-supplier-input",
        supplierOptions,
        {
          placeholder: "请选择供应商",
          value: value || undefined,
        },
      );
      setHiddenValue("modal-supplier-input", value);
    };

    const clearAutofillFields = () => {
      renderCategorySelect();
      renderSupplierSelect();
      setInputValue('#add-product-form input[name="costPrice"]', "");
      setInputValue('#add-product-form input[name="retailPrice"]', "");
    };

    const applyProductDefaults = (product) => {
      if (!product) return;
      renderCategorySelect(product.category || "");
      renderSupplierSelect(product.supplierId || "");
      setInputValue(
        '#add-product-form input[name="costPrice"]',
        product.costPrice ?? "",
      );
      setInputValue(
        '#add-product-form input[name="retailPrice"]',
        product.retailPrice ?? "",
      );
    };

    renderAntdSelect(
      "modal-product-name-container",
      "modal-product-choice-input",
      productOptions,
      {
        placeholder: "请输入或搜索商品名称...",
        mode: "tags",
        virtual: false,
        popupClassName: "product-name-select-dropdown",
        controlSearchValue: true,
        keepSearchTextOnBlur: true,
        enableCreateOption: true,
        createOptionLabel: (text) => `添加 ${text}`,
        listHeight: 160,
        dropdownStyle: { maxHeight: 176, overflow: "hidden" },
      },
      (value) => {
        const hiddenNameInput = document.getElementById(
          "modal-product-name-input",
        );
        const selectedValue = String(value ?? "").trim();
        const matchedProduct = mockData.products.find(
          (item) => item.id === selectedValue,
        );

        if (!hiddenNameInput) return;

        if (!selectedValue) {
          hiddenNameInput.value = "";
          lastLoadedProductId = "";
          clearAutofillFields();
          return;
        }

        if (matchedProduct) {
          hiddenNameInput.value = matchedProduct.name || "";
          lastLoadedProductId = matchedProduct.id;
          applyProductDefaults(matchedProduct);
          return;
        }

        hiddenNameInput.value = selectedValue;
        if (lastLoadedProductId) {
          clearAutofillFields();
        }
        lastLoadedProductId = "";
      },
    );

    renderCategorySelect();
    renderSupplierSelect();
  }

  function createProductInboundStockMovement(product, productData) {
    const supplier = mockData.suppliers.find(
      (item) => item.id === product.supplierId,
    );
    const now = new Date();

    return {
      id: createRuntimeId("SM"),
      type: "inbound",
      productId: product.id,
      productName: product.name,
      quantity: productData.quantity,
      unit: product.unit || "",
      supplierId: product.supplierId,
      supplierName: supplier ? supplier.name : "-",
      price: productData.costPrice,
      priceType: "custom",
      operator: currentUser.name,
      remark: String(productData.notes || "").trim() || "-",
      createdAt: now,
      updatedAt: now,
    };
  }

  function addProduct(productData) {
    const existingProduct = mockData.products.find(
      (product) =>
        product.name === productData.name &&
        product.supplierId === productData.supplierId,
    );
    let movementProduct = existingProduct;

    if (existingProduct) {
      const oldQuantity = existingProduct.stockQuantity;
      existingProduct.stockQuantity += productData.quantity;
      existingProduct.updatedAt = getLocalISOString();

      alert(
        `商品 "${productData.name}" 已存在，已将数量合并。当前库存：${existingProduct.stockQuantity}`,
      );
      addLog(
        "edit",
        "product",
        productData.name,
        `合并库存，原数量：${oldQuantity}，新增数量：${productData.quantity}，当前数量：${existingProduct.stockQuantity}`,
      );
    } else {
      const newProduct = {
        id: createSequentialId(mockData.products, "P"),
        name: productData.name,
        category: productData.category,
        unit: "个",
        costPrice: productData.costPrice,
        retailPrice: productData.retailPrice,
        stockQuantity: productData.quantity,
        minStock: 10,
        maxStock: 100,
        supplierId: productData.supplierId,
        createdAt: getLocalISOString(),
        updatedAt: getLocalISOString(),
      };

      mockData.products.push(newProduct);
      movementProduct = newProduct;

      alert(
        `商品 "${productData.name}" 已成功添加，库存数量：${productData.quantity}`,
      );
      addLog(
        "add",
        "product",
        productData.name,
        `新增商品，数量：${productData.quantity}，成本单价：${productData.costPrice}`,
      );
    }

    if (!Array.isArray(stockMovementData)) {
      stockMovementData = [];
    }
    stockMovementData.unshift(
      createProductInboundStockMovement(movementProduct, productData),
    );

    saveMockData();
    updateInventoryTable();
    refreshStockDependencies();
  }

  function showViewProductModal(productId) {
    const product = mockData.products.find((item) => item.id === productId);
    if (!product) {
      alert("未找到对应的商品记录");
      return;
    }

    const supplier = mockData.suppliers.find(
      (item) => item.id === product.supplierId,
    );
    const statusMeta = getProductStatusMeta(product);
    const stockValue =
      (Number(product.costPrice) || 0) * (Number(product.stockQuantity) || 0);

    const safeProductName = escapeHTML(product.name || "-");
    const safeProductId = escapeHTML(product.id || "-");
    const safeCategory = escapeHTML(product.category || "-");
    const safeSupplierName = escapeHTML(supplier?.name || "未知供应商");
    const safeUnit = escapeHTML(product.unit || "-");
    const safeStatusLabel = escapeHTML(statusMeta.label);
    const safeCreatedAt = escapeHTML(
      formatDateTime(product.createdAt || new Date()),
    );
    const safeUpdatedAt = escapeHTML(
      formatDateTime(product.updatedAt || new Date()),
    );
    const costPriceDisplay = escapeHTML(formatCurrencyValue(product.costPrice));
    const retailPriceDisplay = escapeHTML(
      formatCurrencyValue(product.retailPrice),
    );
    const stockValueDisplay = escapeHTML(formatCurrencyValue(stockValue));

    const content = `
            <div class="space-y-3">
                <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div class="flex items-start justify-between gap-3">
                        <div class="flex items-center min-w-0">
                            <div class="flex-shrink-0 h-10 w-10 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                                <i class="fa fa-${getProductIcon(product.category)} text-gray-500 text-xl"></i>
                            </div>
                            <div class="ml-3 min-w-0">
                                <div class="text-base font-semibold text-gray-900 truncate">${safeProductName}</div>
                                <div class="text-xs text-gray-500">SKU: ${safeProductId}</div>
                            </div>
                        </div>
                        <span class="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                    </div>
                </div>
                <div class="grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <div class="rounded-lg border border-gray-200 p-3">
                        <div class="text-xs text-gray-500 mb-1">商品分类</div>
                        <div class="text-sm font-medium text-gray-900">${safeCategory}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 p-3">
                        <div class="text-xs text-gray-500 mb-1">供应商</div>
                        <div class="text-sm font-medium text-gray-900">${safeSupplierName}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 p-3">
                        <div class="text-xs text-gray-500 mb-1">库存阈值</div>
                        <div class="text-sm font-medium text-gray-900">最小 ${product.minStock} / 最大 ${product.maxStock}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 p-3">
                        <div class="text-xs text-gray-500 mb-1">成本单价</div>
                        <div class="text-sm font-medium text-gray-900">${costPriceDisplay}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 p-3">
                        <div class="text-xs text-gray-500 mb-1">库存价值</div>
                        <div class="text-sm font-semibold text-gray-900">${stockValueDisplay}</div>
                    </div>
                    <div class="rounded-lg border border-gray-200 p-3">
                        <div class="text-xs text-gray-500 mb-1">销售单价</div>
                        <div class="text-sm font-medium text-gray-900">${retailPriceDisplay}</div>
                    </div>
                    <div class="rounded-lg border border-blue-200 bg-blue-50 p-3 lg:col-span-3 shadow-sm ring-1 ring-blue-100">
                        <div class="text-sm font-extrabold text-blue-700 mb-1">当前库存</div>
                        <div class="text-2xl font-bold text-blue-900 leading-none">${product.stockQuantity}<span class="ml-1 text-base font-semibold">${safeUnit}</span></div>
                    </div>
                </div>
                <div class="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div>
                            <div class="text-xs text-gray-500 mb-1">编号</div>
                            <div class="font-medium text-gray-800">${safeProductId}</div>
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
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看商品库存信息。</p>
            </div>
        `;

    showModal("查看商品详情", content);
    configureReadonlyModal();
  }

  function showViewCompanyModal(companyId) {
    const company = mockData.companies.find((item) => item.id === companyId);
    if (!company) {
      alert("未找到对应的公司记录");
      return;
    }

    const statusMeta = getStatusMeta(company.status);
    const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>`;

    const content = `
            <div class="space-y-3">
                ${buildReadonlySummaryCard("building-o", company.name, `编号: ${company.id || "-"}`, statusMeta)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildReadonlyFieldCard("公司名称", getSafeDisplayValue(company.name))}
                    ${buildReadonlyFieldCard("联系人", getSafeDisplayValue(company.contactPerson))}
                    ${buildReadonlyFieldCard("联系电话", getSafeDisplayValue(company.contactPhone))}
                    ${buildReadonlyFieldCard("电子邮箱", getSafeDisplayValue(company.email))}
                    ${buildReadonlyFieldCard("状态", statusBadge)}
                    ${buildReadonlyFieldCard("公司地址", getSafeDisplayValue(company.address), "md:col-span-2")}
                </div>
                ${buildRecordInfoCard(company)}
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看公司信息。</p>
            </div>
        `;

    showModal("查看公司详情", content);
    configureReadonlyModal();
  }

  function showViewSupplierModal(supplierId) {
    const supplier = mockData.suppliers.find((item) => item.id === supplierId);
    if (!supplier) {
      alert("未找到对应的供应商记录");
      return;
    }

    const statusMeta = getStatusMeta(supplier.status);
    const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>`;

    const content = `
            <div class="space-y-3">
                ${buildReadonlySummaryCard("truck", supplier.name, `编号: ${supplier.id || "-"}`, statusMeta)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildReadonlyFieldCard("供应商名称", getSafeDisplayValue(supplier.name))}
                    ${buildReadonlyFieldCard("联系人", getSafeDisplayValue(supplier.contactPerson))}
                    ${buildReadonlyFieldCard("联系电话", getSafeDisplayValue(supplier.contactPhone))}
                    ${buildReadonlyFieldCard("电子邮箱", getSafeDisplayValue(supplier.email))}
                    ${buildReadonlyFieldCard("付款条件", getSafeDisplayValue(supplier.paymentTerms))}
                    ${buildReadonlyFieldCard("状态", statusBadge)}
                    ${buildReadonlyFieldCard("地址", getSafeDisplayValue(supplier.address), "md:col-span-2")}
                </div>
                ${buildRecordInfoCard(supplier)}
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看供应商信息。</p>
            </div>
        `;

    showModal("查看供应商详情", content);
    configureReadonlyModal();
  }

  function showViewCustomerModal(customerId) {
    const customer = mockData.customers.find((item) => item.id === customerId);
    if (!customer) {
      alert("未找到对应的客户记录");
      return;
    }

    const statusMeta = getStatusMeta(customer.status);
    const statusBadge = `<span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${escapeHTML(statusMeta.label)}</span>`;

    const content = `
            <div class="space-y-3">
                ${buildReadonlySummaryCard("users", customer.name, `编号: ${customer.id || "-"}`, statusMeta)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildReadonlyFieldCard("客户名称", getSafeDisplayValue(customer.name))}
                    ${buildReadonlyFieldCard("联系人", getSafeDisplayValue(customer.contactPerson))}
                    ${buildReadonlyFieldCard("联系电话", getSafeDisplayValue(customer.contactPhone))}
                    ${buildReadonlyFieldCard("电子邮箱", getSafeDisplayValue(customer.email))}
                    ${buildReadonlyFieldCard("付款条件", getSafeDisplayValue(customer.paymentTerms))}
                    ${buildReadonlyFieldCard("状态", statusBadge)}
                    ${buildReadonlyFieldCard("客户地址", getSafeDisplayValue(customer.address), "md:col-span-2")}
                </div>
                ${buildRecordInfoCard(customer)}
                <p class="text-xs text-gray-500">当前窗口为只读详情，仅用于查看客户信息。</p>
            </div>
        `;

    showModal("查看客户详情", content);
    configureReadonlyModal();
  }

  function updateInventoryTable() {
    const tbody = document.getElementById("inventory-table-body");
    if (!tbody) return;

    const companyFilterEl = document.getElementById("filter-company");
    const companyFilter = companyFilterEl ? companyFilterEl.value : "";

    const statusFilterEl = document.getElementById("filter-status");
    const statusFilter = statusFilterEl ? statusFilterEl.value : "";

    const supplierFilterEl = document.getElementById("filter-supplier");
    const supplierFilter = supplierFilterEl ? supplierFilterEl.value : "";

    const searchFilterEl = document.getElementById("filter-search");
    const searchFilter = searchFilterEl
      ? searchFilterEl.value.toLowerCase()
      : "";

    tbody.innerHTML = "";

    let filteredProducts = mockData.products;
    filteredProducts.sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    if (companyFilter) {
      // 当前商品数据模型没有 company 字段，先保留筛选占位。
    }

    if (statusFilter) {
      filteredProducts = filteredProducts.filter((product) => {
        if (statusFilter === "normal")
          return (
            product.stockQuantity >= product.minStock &&
            product.stockQuantity <= product.maxStock &&
            product.stockQuantity > 0
          );
        if (statusFilter === "low")
          return (
            product.stockQuantity < product.minStock &&
            product.stockQuantity > 0
          );
        if (statusFilter === "overstock")
          return product.stockQuantity > product.maxStock;
        if (statusFilter === "out") return product.stockQuantity === 0;
        return true;
      });
    }

    if (supplierFilter) {
      filteredProducts = filteredProducts.filter(
        (product) => product.supplierId === supplierFilter,
      );
    }

    if (searchFilter) {
      filteredProducts = filteredProducts.filter(
        (product) =>
          product.name.toLowerCase().includes(searchFilter) ||
          product.id.toLowerCase().includes(searchFilter),
      );
    }

    paginationState.inventory.total = filteredProducts.length;
    let { page, pageSize } = paginationState.inventory;

    const totalPages = Math.ceil(filteredProducts.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.inventory.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    if (paginatedProducts.length === 0) {
      renderAntdEmptyTableRow(tbody, 7, "没有找到匹配的商品");
      renderPaginationControl(
        "inventory-pagination-container",
        "inventory",
        updateInventoryTable,
      );
      return;
    }

    paginatedProducts.forEach((product) => {
      const supplier = mockData.suppliers.find(
        (item) => item.id === product.supplierId,
      );
      const supplierName = supplier ? supplier.name : "未知供应商";

      const safeProductName = escapeHTML(product.name || "-");
      const safeProductId = escapeHTML(product.id || "-");
      const safeProductCategory = escapeHTML(product.category || "-");
      const safeSupplierName = escapeHTML(supplierName);

      const statusMeta = getProductStatusMeta(product);

      const formattedCreatedAt = formatDateTime(
        product.createdAt || new Date(),
      );
      const formattedUpdatedAt = formatDateTime(
        product.updatedAt || new Date(),
      );

      const row = document.createElement("tr");
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap overflow-hidden">
                    <div class="flex items-center">
                        <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                            <i class="fa fa-${getProductIcon(product.category)} text-gray-500 text-xl"></i>
                        </div>
                        <div class="ml-4 overflow-hidden">
                            <div class="text-sm font-medium text-gray-900 truncate" title="${safeProductName}">${safeProductName}</div>
                            <div class="text-sm text-gray-500 truncate">SKU: ${safeProductId}</div>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title="${safeProductCategory}">${safeProductCategory}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-left">${product.stockQuantity}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${statusMeta.label}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title="${safeSupplierName}">${safeSupplierName}</td>
                <td class="px-6 py-4 text-sm text-gray-500 align-top min-w-[340px]">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 w-16 text-left flex-shrink-0">创建时间:</span>
                            <span class="flex items-center overflow-hidden">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 flex-shrink-0">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 w-16 text-left flex-shrink-0">更新时间:</span>
                            <span class="flex items-center overflow-hidden">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 flex-shrink-0">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 text-sm font-medium text-left align-middle min-w-[190px]">
                    <div class="flex items-center justify-start gap-4 whitespace-nowrap">
                        <button type="button" class="inline-flex items-center justify-center text-blue-600 hover:text-blue-900" data-action="view">查看</button>
                        <a href="#" class="inline-flex items-center justify-center text-primary hover:text-primary-dark">编辑</a>
                        <button type="button" class="inline-flex items-center justify-center text-danger hover:text-danger-dark" data-action="delete">删除</button>
                    </div>
                </td>
            `;

      const viewButton = row.querySelector('[data-action="view"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewProductModal(product.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () => deleteProduct(product.id));
      }

      tbody.appendChild(row);
    });

    renderPaginationControl(
      "inventory-pagination-container",
      "inventory",
      updateInventoryTable,
    );
  }

  async function deleteProduct(productId) {
    const productIndex = mockData.products.findIndex(
      (item) => item.id === productId,
    );
    if (productIndex === -1) {
      alert("未找到对应的商品记录");
      return false;
    }

    const product = mockData.products[productIndex];
    const relatedStockCount = countMatchingItems(
      stockMovementData,
      (item) => item.productId === productId,
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) =>
        Array.isArray(note?.details) &&
        note.details.some((detail) => detail.productId === productId),
    );

    const ok = await requestDeleteConfirmation("商品", product.name, [
      relatedStockCount > 0
        ? `已有 ${relatedStockCount} 条库存流水会保留这件商品的历史快照。`
        : "",
      relatedDeliveryCount > 0
        ? `已有 ${relatedDeliveryCount} 张送货单会保留这件商品的历史快照。`
        : "",
    ]);
    if (!ok) return false;

    mockData.products.splice(productIndex, 1);
    await persistMasterDataChanges();

    if (typeof addLog === "function") {
      addLog("delete", "product", product.name, "删除商品");
    }

    refreshInventoryDependencies();
    refreshStockDependencies();
    alert("商品已删除");
    return true;
  }

  async function deleteCompany(companyId) {
    const companyIndex = mockData.companies.findIndex(
      (item) => item.id === companyId,
    );
    if (companyIndex === -1) {
      alert("未找到对应的公司记录");
      return false;
    }

    const company = mockData.companies[companyIndex];
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (item) => item.companyId === companyId,
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) => note.companyId === companyId,
    );

    const ok = await requestDeleteConfirmation("公司", company.name, [
      relatedBillCount > 0
        ? `已有 ${relatedBillCount} 张对账单会保留这家公司的历史快照。`
        : "",
      relatedDeliveryCount > 0
        ? `已有 ${relatedDeliveryCount} 张送货单会保留这家公司的历史快照。`
        : "",
    ]);
    if (!ok) return false;

    mockData.companies.splice(companyIndex, 1);
    await persistMasterDataChanges();

    if (typeof addLog === "function") {
      addLog("delete", "company", company.name, "删除公司");
    }

    updateCompanyTable();
    refreshInventoryDependencies();
    alert("公司已删除");
    return true;
  }

  async function deleteSupplier(supplierId) {
    const supplierIndex = mockData.suppliers.findIndex(
      (item) => item.id === supplierId,
    );
    if (supplierIndex === -1) {
      alert("未找到对应的供应商记录");
      return false;
    }

    const supplier = mockData.suppliers[supplierIndex];
    const relatedProductCount = countMatchingItems(
      mockData.products,
      (item) => item.supplierId === supplierId,
    );
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (item) => item.partyId === supplierId && item.statementType === "supplier",
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) => note.supplierId === supplierId,
    );
    const relatedStockCount = countMatchingItems(
      stockMovementData,
      (item) => item.supplierId === supplierId,
    );

    const ok = await requestDeleteConfirmation("供应商", supplier.name, [
      relatedProductCount > 0
        ? `删除后，${relatedProductCount} 个商品会显示为“未知供应商”。`
        : "",
      relatedBillCount > 0
        ? `已有 ${relatedBillCount} 张对账单会保留这家供应商的历史快照。`
        : "",
      relatedDeliveryCount > 0
        ? `已有 ${relatedDeliveryCount} 张送货单会保留这家供应商的历史快照。`
        : "",
      relatedStockCount > 0
        ? `已有 ${relatedStockCount} 条库存流水会保留这家供应商的历史快照。`
        : "",
    ]);
    if (!ok) return false;

    mockData.suppliers.splice(supplierIndex, 1);
    await persistMasterDataChanges();

    if (typeof addLog === "function") {
      addLog("delete", "supplier", supplier.name, "删除供应商");
    }

    updateSupplierTable();
    refreshInventoryDependencies();
    refreshBillDependencies();
    refreshStockDependencies();
    alert("供应商已删除");
    return true;
  }

  async function deleteCustomer(customerId) {
    const customerIndex = mockData.customers.findIndex(
      (item) => item.id === customerId,
    );
    if (customerIndex === -1) {
      alert("未找到对应的客户记录");
      return false;
    }

    const customer = mockData.customers[customerIndex];
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (item) => item.partyId === customerId && item.statementType === "customer",
    );
    const relatedDeliveryCount = countMatchingItems(
      mockData.deliveryNotes,
      (note) => note.customerId === customerId,
    );
    const relatedStockCount = countMatchingItems(
      stockMovementData,
      (item) => item.customerId === customerId,
    );

    const ok = await requestDeleteConfirmation("客户", customer.name, [
      relatedBillCount > 0
        ? `已有 ${relatedBillCount} 张对账单会保留这位客户的历史快照。`
        : "",
      relatedDeliveryCount > 0
        ? `已有 ${relatedDeliveryCount} 张送货单会保留这位客户的历史快照。`
        : "",
      relatedStockCount > 0
        ? `已有 ${relatedStockCount} 条库存流水会保留这位客户的历史快照。`
        : "",
    ]);
    if (!ok) return false;

    mockData.customers.splice(customerIndex, 1);
    await persistMasterDataChanges();

    if (typeof addLog === "function") {
      addLog("delete", "customer", customer.name, "删除客户");
    }

    updateCustomerTable();
    refreshBillDependencies();
    refreshStockDependencies();
    alert("客户已删除");
    return true;
  }

  function showAddCompanyModal() {
    const content = `
            <form id="add-company-form" class="space-y-3">
                ${buildFormIntroCard("building-o", "新增公司", "填写公司基础信息后即可创建，系统会自动分配编号并默认设为活跃状态。")}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '公司名称 <span class="text-danger">*</span>',
                      '<input type="text" name="name" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      '<input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      '<input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="请输入国内手机号或座机号">',
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      '<input type="email" name="email" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '公司地址 <span class="text-danger">*</span>',
                      '<input type="text" name="address" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                      "md:col-span-2",
                    )}
                </div>
                <p class="text-xs text-gray-500">建议先填写常用联系人和联系电话，后续出货公司筛选会直接使用这里的信息。</p>
            </form>
        `;

    showModal("新增公司", content, function onConfirm() {
      const form = document.getElementById("add-company-form");
      const formData = new FormData(form);
      const name = formData.get("name").trim();
      const contactPerson = formData.get("contactPerson").trim();
      const contactPhone = formData.get("contactPhone").trim();
      const address = formData.get("address").trim();
      const email = formData.get("email").trim();

      if (!name) {
        alert("请输入公司名称");
        return false;
      }
      if (!contactPerson) {
        alert("请输入联系人");
        return false;
      }
      if (!contactPhone) {
        alert("请输入联系电话");
        return false;
      }
      if (!address) {
        alert("请输入公司地址");
        return false;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        alert("请输入有效的国内联系电话（手机号或座机号）");
        return false;
      }

      const newCompany = {
        id: createSequentialId(mockData.companies, "CO"),
        name,
        contactPerson,
        contactPhone,
        address,
        email: email || "-",
        status: "active",
        createdAt: getLocalISOString(),
        updatedAt: getLocalISOString(),
      };

      mockData.companies.push(newCompany);
      saveMockData();
      addLog("add", "company", name, `新增公司，联系人：${contactPerson}`);
      updateCompanyTable();
      alert("公司添加成功");
      return true;
    });

    configureWideFormModal("创建");
  }

  function showEditCompanyModal(companyId) {
    const company = mockData.companies.find((item) => item.id === companyId);
    if (!company) {
      alert("未找到对应的公司记录");
      return;
    }

    const nameValue = escapeHTML(getEditableFieldValue(company.name));
    const contactPersonValue = escapeHTML(
      getEditableFieldValue(company.contactPerson),
    );
    const contactPhoneValue = escapeHTML(
      getEditableFieldValue(company.contactPhone),
    );
    const addressValue = escapeHTML(getEditableFieldValue(company.address));
    const emailValue = escapeHTML(getEditableFieldValue(company.email));
    const statusValue = escapeHTML(getStatusMeta(company.status).value);
    const statusMeta = getStatusMeta(company.status);

    const content = `
            <form id="edit-company-form" class="space-y-3">
                ${buildReadonlySummaryCard("building-o", company.name, `编号: ${company.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(company)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '公司名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${nameValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      `<input type="text" name="contactPerson" required value="${contactPersonValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      `<input type="tel" name="contactPhone" required value="${contactPhoneValue}" placeholder="请输入国内手机号或座机号" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-company-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-company-status-input" value="${statusValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      `<input type="email" name="email" value="${emailValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '公司地址 <span class="text-danger">*</span>',
                      `<input type="text" name="address" required value="${addressValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                </div>
                <p class="text-xs text-gray-500">当前窗口为编辑模式，修改后点击保存即可更新公司信息。</p>
            </form>
        `;

    showModal("编辑公司", content, function onConfirm() {
      const form = document.getElementById("edit-company-form");
      if (!form.reportValidity()) return false;

      const formData = new FormData(form);
      const name = normalizeTextValue(formData.get("name"));
      const contactPerson = normalizeTextValue(formData.get("contactPerson"));
      const contactPhone = normalizeTextValue(formData.get("contactPhone"));
      const address = normalizeTextValue(formData.get("address"));
      const email = normalizeTextValue(formData.get("email"));
      const status =
        normalizeTextValue(
          document.getElementById("edit-company-status-input").value,
        ) || "active";

      if (!name) {
        alert("请输入公司名称");
        return false;
      }
      if (!contactPerson) {
        alert("请输入联系人");
        return false;
      }
      if (!contactPhone) {
        alert("请输入联系电话");
        return false;
      }
      if (!address) {
        alert("请输入公司地址");
        return false;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        alert("请输入有效的国内联系电话（手机号或座机号）");
        return false;
      }
      if (!ensureUniqueName(mockData.companies, company.id, name, "公司")) {
        return false;
      }

      Object.assign(company, {
        name,
        contactPerson,
        contactPhone,
        address,
        email: getStoredOptionalValue(email),
        status,
        updatedAt: getLocalISOString(),
      });

      saveMockData();
      addLog("edit", "company", name, `编辑公司信息，联系人：${contactPerson}`);
      updateCompanyTable();
      alert("公司信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderStatusSelect(
      "edit-company-status-container",
      "edit-company-status-input",
      company.status || "active",
    );
  }

  function updateCompanyTable() {
    const tbody = document.querySelector("#companies tbody");
    if (!tbody) return;
    tbody.innerHTML = "";

    const sortedCompanies = [...mockData.companies].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    paginationState.companies.total = sortedCompanies.length;
    let { page, pageSize } = paginationState.companies;

    const totalPages = Math.ceil(sortedCompanies.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.companies.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCompanies = sortedCompanies.slice(startIndex, endIndex);

    if (paginatedCompanies.length === 0) {
      renderAntdEmptyTableRow(tbody, 7, "暂无公司记录");
      renderPaginationControl(
        "company-pagination-container",
        "companies",
        updateCompanyTable,
      );
      return;
    }

    paginatedCompanies.forEach((company) => {
      const formattedCreatedAt = formatDateTime(company.createdAt);
      const formattedUpdatedAt = formatDateTime(company.updatedAt);
      const safeCompanyName = escapeHTML(company.name || "-");
      const safeContactPerson = escapeHTML(company.contactPerson || "-");
      const safeContactPhone = escapeHTML(company.contactPhone || "-");
      const safeAddress = escapeHTML(company.address || "-");
      const statusMeta = getStatusMeta(company.status);
      const safeStatusLabel = escapeHTML(statusMeta.label);

      const row = document.createElement("tr");
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${safeCompanyName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeContactPerson}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeContactPhone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeAddress}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button type="button" class="text-blue-600 hover:text-blue-900 mr-3" data-action="view">查看</button>
                    <button type="button" class="text-primary hover:text-primary-dark mr-3" data-action="edit">编辑</button>
                    <button type="button" class="text-danger hover:text-danger-dark" data-action="delete">删除</button>
                </td>
            `;
      const viewButton = row.querySelector('[data-action="view"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewCompanyModal(company.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditCompanyModal(company.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () => deleteCompany(company.id));
      }
      tbody.appendChild(row);
    });

    renderPaginationControl(
      "company-pagination-container",
      "companies",
      updateCompanyTable,
    );
  }

  function showAddSupplierModal() {
    const content = `
            <form id="add-supplier-form" class="space-y-3">
                ${buildFormIntroCard("truck", "新增供应商", "填写供应商基础信息后即可创建，系统会默认设为活跃状态。")}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '供应商名称 <span class="text-danger">*</span>',
                      '<input type="text" name="name" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      '<input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      '<input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      '<input type="email" name="email" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      "地址",
                      '<input type="text" name="address" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="选填，未填写时默认记为 -">',
                      "md:col-span-2",
                    )}
                    ${buildEditableFieldCard(
                      "付款条件",
                      '<div id="add-supplier-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="add-supplier-payment-input">',
                      "md:col-span-2",
                    )}
                </div>
                <p class="text-xs text-gray-500">建议把付款条件先补全，后续进货和对账会直接引用这里的配置。</p>
            </form>
        `;

    showModal("新增供应商", content, function onConfirm() {
      const form = document.getElementById("add-supplier-form");
      const formData = new FormData(form);
      const name = formData.get("name").trim();
      const contactPerson = formData.get("contactPerson").trim();
      const contactPhone = formData.get("contactPhone").trim();
      const email = formData.get("email").trim();
      const address = formData.get("address").trim();
      const paymentTerms = document.getElementById(
        "add-supplier-payment-input",
      ).value;

      if (!name) {
        alert("请输入供应商名称");
        return false;
      }
      if (!contactPerson) {
        alert("请输入联系人");
        return false;
      }
      if (!contactPhone) {
        alert("请输入联系电话");
        return false;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        alert("请输入有效的国内联系电话（手机号或座机号）");
        return false;
      }

      const newSupplier = {
        id: createSequentialId(mockData.suppliers, "S"),
        name,
        contactPerson,
        contactPhone,
        email: email || "-",
        address: address || "-",
        paymentTerms: paymentTerms || "Net 30",
        creditLimit: 0,
        status: "active",
        createdAt: getLocalISOString(),
        updatedAt: getLocalISOString(),
      };

      mockData.suppliers.push(newSupplier);
      saveMockData();
      addLog("add", "supplier", name, `新增供应商，联系人：${contactPerson}`);
      updateSupplierTable();
      alert("供应商添加成功");
      return true;
    });

    configureWideFormModal("创建");
    renderAntdSelect(
      "add-supplier-payment-container",
      "add-supplier-payment-input",
      PAYMENT_OPTIONS,
      "Net 30",
    );
  }

  function showEditSupplierModal(supplierId) {
    const supplier = mockData.suppliers.find((item) => item.id === supplierId);
    if (!supplier) {
      alert("未找到对应的供应商记录");
      return;
    }

    const nameValue = escapeHTML(getEditableFieldValue(supplier.name));
    const contactPersonValue = escapeHTML(
      getEditableFieldValue(supplier.contactPerson),
    );
    const contactPhoneValue = escapeHTML(
      getEditableFieldValue(supplier.contactPhone),
    );
    const emailValue = escapeHTML(getEditableFieldValue(supplier.email));
    const addressValue = escapeHTML(getEditableFieldValue(supplier.address));
    const paymentTermsValue = escapeHTML(
      getEditableFieldValue(supplier.paymentTerms),
    );
    const statusValue = escapeHTML(getStatusMeta(supplier.status).value);
    const statusMeta = getStatusMeta(supplier.status);

    const content = `
            <form id="edit-supplier-form" class="space-y-3">
                ${buildReadonlySummaryCard("truck", supplier.name, `编号: ${supplier.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(supplier)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '供应商名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${nameValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      `<input type="text" name="contactPerson" required value="${contactPersonValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      `<input type="tel" name="contactPhone" required value="${contactPhoneValue}" placeholder="请输入国内手机号或座机号" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      `<input type="email" name="email" value="${emailValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      "付款条件",
                      `<div id="edit-supplier-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="edit-supplier-payment-input" value="${paymentTermsValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-supplier-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-supplier-status-input" value="${statusValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      "地址",
                      `<input type="text" name="address" value="${addressValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                      "md:col-span-2",
                    )}
                </div>
                <p class="text-xs text-gray-500">当前窗口为编辑模式，修改后点击保存即可更新供应商信息。</p>
            </form>
        `;

    showModal("编辑供应商", content, function onConfirm() {
      const form = document.getElementById("edit-supplier-form");
      if (!form.reportValidity()) return false;

      const formData = new FormData(form);
      const name = normalizeTextValue(formData.get("name"));
      const contactPerson = normalizeTextValue(formData.get("contactPerson"));
      const contactPhone = normalizeTextValue(formData.get("contactPhone"));
      const email = normalizeTextValue(formData.get("email"));
      const address = normalizeTextValue(formData.get("address"));
      const paymentTerms = normalizeTextValue(
        document.getElementById("edit-supplier-payment-input").value,
      );
      const status =
        normalizeTextValue(
          document.getElementById("edit-supplier-status-input").value,
        ) || "active";

      if (!name) {
        alert("请输入供应商名称");
        return false;
      }
      if (!contactPerson) {
        alert("请输入联系人");
        return false;
      }
      if (!contactPhone) {
        alert("请输入联系电话");
        return false;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        alert("请输入有效的国内联系电话（手机号或座机号）");
        return false;
      }
      if (!ensureUniqueName(mockData.suppliers, supplier.id, name, "供应商")) {
        return false;
      }

      Object.assign(supplier, {
        name,
        contactPerson,
        contactPhone,
        email: getStoredOptionalValue(email),
        address: getStoredOptionalValue(address),
        paymentTerms: getStoredOptionalValue(paymentTerms),
        creditLimit: Number.isFinite(Number(supplier.creditLimit))
          ? Number(supplier.creditLimit)
          : 0,
        status,
        updatedAt: getLocalISOString(),
      });

      saveMockData();
      addLog(
        "edit",
        "supplier",
        name,
        `编辑供应商信息，联系人：${contactPerson}`,
      );
      updateSupplierTable();
      alert("供应商信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderPaymentTermsSelect(
      "edit-supplier-payment-container",
      "edit-supplier-payment-input",
      getEditableFieldValue(supplier.paymentTerms),
      "请选择付款条件",
    );
    renderStatusSelect(
      "edit-supplier-status-container",
      "edit-supplier-status-input",
      supplier.status || "active",
    );
  }

  function showAddCustomerModal() {
    const content = `
            <form id="add-customer-form" class="space-y-3">
                ${buildFormIntroCard("users", "新增客户", "填写客户基础信息后即可创建，系统会默认设为活跃状态。")}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '客户名称 <span class="text-danger">*</span>',
                      '<input type="text" name="name" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      '<input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      '<input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="请输入国内手机号或座机号">',
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      '<input type="email" name="email" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '付款条件 <span class="text-danger">*</span>',
                      '<div id="add-customer-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="add-customer-payment-input" required>',
                    )}
                    ${buildEditableFieldCard(
                      '客户地址 <span class="text-danger">*</span>',
                      '<input type="text" name="address" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                </div>
                <p class="text-xs text-gray-500">建议把付款条件和地址一起补全，后续销售单和送货单会直接引用这些数据。</p>
            </form>
        `;

    showModal("新增客户", content, function onConfirm() {
      const form = document.getElementById("add-customer-form");
      const formData = new FormData(form);

      const name = formData.get("name").trim();
      const contactPerson = formData.get("contactPerson").trim();
      const contactPhone = formData.get("contactPhone").trim();
      const address = formData.get("address").trim();
      const email = formData.get("email").trim();
      const paymentTerms = document.getElementById(
        "add-customer-payment-input",
      ).value;

      if (!name) {
        alert("请输入客户名称");
        return false;
      }
      if (!contactPerson) {
        alert("请输入联系人");
        return false;
      }
      if (!contactPhone) {
        alert("请输入联系电话");
        return false;
      }
      if (!address) {
        alert("请输入客户地址");
        return false;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        alert("请输入有效的国内联系电话（手机号或座机号）");
        return false;
      }

      const newCustomer = {
        id: createSequentialId(mockData.customers, "C"),
        name,
        contactPerson,
        contactPhone,
        address,
        email: email || "-",
        paymentTerms,
        creditLimit: 0,
        status: "active",
        createdAt: getLocalISOString(),
        updatedAt: getLocalISOString(),
      };

      mockData.customers.push(newCustomer);
      saveMockData();
      addLog("add", "customer", name, `新增客户，联系人：${contactPerson}`);
      updateCustomerTable();

      alert("客户添加成功");
      return true;
    });

    configureWideFormModal("创建");
    renderAntdSelect(
      "add-customer-payment-container",
      "add-customer-payment-input",
      PAYMENT_OPTIONS,
      "Net 30",
    );
  }

  function showEditCustomerModal(customerId) {
    const customer = mockData.customers.find((item) => item.id === customerId);
    if (!customer) {
      alert("未找到对应的客户记录");
      return;
    }

    const nameValue = escapeHTML(getEditableFieldValue(customer.name));
    const contactPersonValue = escapeHTML(
      getEditableFieldValue(customer.contactPerson),
    );
    const contactPhoneValue = escapeHTML(
      getEditableFieldValue(customer.contactPhone),
    );
    const addressValue = escapeHTML(getEditableFieldValue(customer.address));
    const emailValue = escapeHTML(getEditableFieldValue(customer.email));
    const paymentTermsValue = escapeHTML(
      getEditableFieldValue(customer.paymentTerms),
    );
    const statusValue = escapeHTML(getStatusMeta(customer.status).value);
    const statusMeta = getStatusMeta(customer.status);

    const content = `
            <form id="edit-customer-form" class="space-y-3">
                ${buildReadonlySummaryCard("users", customer.name, `编号: ${customer.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(customer)}
                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    ${buildEditableFieldCard(
                      '客户名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${nameValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系人 <span class="text-danger">*</span>',
                      `<input type="text" name="contactPerson" required value="${contactPersonValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '联系电话 <span class="text-danger">*</span>',
                      `<input type="tel" name="contactPhone" required value="${contactPhoneValue}" placeholder="请输入国内手机号或座机号" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      "电子邮箱",
                      `<input type="email" name="email" value="${emailValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '付款条件 <span class="text-danger">*</span>',
                      `<div id="edit-customer-payment-container" class="w-full"></div><input type="hidden" name="paymentTerms" id="edit-customer-payment-input" value="${paymentTermsValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-customer-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-customer-status-input" value="${statusValue}">`,
                    )}
                    ${buildEditableFieldCard(
                      '客户地址 <span class="text-danger">*</span>',
                      `<input type="text" name="address" required value="${addressValue}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                      "md:col-span-2",
                    )}
                </div>
                <p class="text-xs text-gray-500">当前窗口为编辑模式，修改后点击保存即可更新客户信息。</p>
            </form>
        `;

    showModal("编辑客户", content, function onConfirm() {
      const form = document.getElementById("edit-customer-form");
      if (!form.reportValidity()) return false;

      const formData = new FormData(form);
      const name = normalizeTextValue(formData.get("name"));
      const contactPerson = normalizeTextValue(formData.get("contactPerson"));
      const contactPhone = normalizeTextValue(formData.get("contactPhone"));
      const address = normalizeTextValue(formData.get("address"));
      const email = normalizeTextValue(formData.get("email"));
      const paymentTerms = normalizeTextValue(
        document.getElementById("edit-customer-payment-input").value,
      );
      const status =
        normalizeTextValue(
          document.getElementById("edit-customer-status-input").value,
        ) || "active";

      if (!name) {
        alert("请输入客户名称");
        return false;
      }
      if (!contactPerson) {
        alert("请输入联系人");
        return false;
      }
      if (!contactPhone) {
        alert("请输入联系电话");
        return false;
      }
      if (!address) {
        alert("请输入客户地址");
        return false;
      }
      if (!paymentTerms) {
        alert("请选择付款条件");
        return false;
      }
      if (!DOMESTIC_PHONE_REGEX.test(contactPhone)) {
        alert("请输入有效的国内联系电话（手机号或座机号）");
        return false;
      }
      if (!ensureUniqueName(mockData.customers, customer.id, name, "客户")) {
        return false;
      }

      Object.assign(customer, {
        name,
        contactPerson,
        contactPhone,
        address,
        email: getStoredOptionalValue(email),
        paymentTerms,
        status,
        updatedAt: getLocalISOString(),
      });

      saveMockData();
      addLog(
        "edit",
        "customer",
        name,
        `编辑客户信息，联系人：${contactPerson}`,
      );
      updateCustomerTable();
      alert("客户信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderPaymentTermsSelect(
      "edit-customer-payment-container",
      "edit-customer-payment-input",
      getEditableFieldValue(customer.paymentTerms),
      "请选择付款条件",
    );
    renderStatusSelect(
      "edit-customer-status-container",
      "edit-customer-status-input",
      customer.status || "active",
    );
  }

  function updateCustomerTable() {
    const tbody = document.querySelector("#customers tbody");
    if (!tbody) return;

    tbody.innerHTML = "";

    const sortedCustomers = [...mockData.customers].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    paginationState.customers.total = sortedCustomers.length;
    let { page, pageSize } = paginationState.customers;

    const totalPages = Math.ceil(sortedCustomers.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.customers.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

    if (paginatedCustomers.length === 0) {
      renderAntdEmptyTableRow(tbody, 9, "暂无客户记录");
      renderPaginationControl(
        "customer-pagination-container",
        "customers",
        updateCustomerTable,
      );
      return;
    }

    paginatedCustomers.forEach((customer) => {
      const formattedCreatedAt = formatDateTime(customer.createdAt);
      const formattedUpdatedAt = formatDateTime(customer.updatedAt);
      const safeCustomerName = escapeHTML(customer.name || "-");
      const safeContactPerson = escapeHTML(customer.contactPerson || "-");
      const safeContactPhone = escapeHTML(customer.contactPhone || "-");
      const safeAddress = escapeHTML(customer.address || "-");
      const safeEmail = escapeHTML(customer.email || "-");
      const safePaymentTerms = escapeHTML(customer.paymentTerms || "-");
      const statusMeta = getStatusMeta(customer.status);
      const safeStatusLabel = escapeHTML(statusMeta.label);

      const row = document.createElement("tr");
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${safeCustomerName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeContactPerson}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeContactPhone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeAddress}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeEmail}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safePaymentTerms}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button type="button" class="text-blue-600 hover:text-blue-900 mr-3" data-action="view">查看</button>
                    <button type="button" class="text-primary hover:text-primary-dark mr-3" data-action="edit">编辑</button>
                    <button type="button" class="text-danger hover:text-danger-dark" data-action="delete">删除</button>
                </td>
            `;
      const viewButton = row.querySelector('[data-action="view"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewCustomerModal(customer.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditCustomerModal(customer.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () =>
          deleteCustomer(customer.id),
        );
      }
      tbody.appendChild(row);
    });

    renderPaginationControl(
      "customer-pagination-container",
      "customers",
      updateCustomerTable,
    );
  }

  function updateSupplierTable() {
    const tbody = document.getElementById("suppliers-table-body");
    if (!tbody) return;

    tbody.innerHTML = "";

    const sortedSuppliers = [...mockData.suppliers].sort(
      (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
    );

    paginationState.suppliers.total = sortedSuppliers.length;
    let { page, pageSize } = paginationState.suppliers;

    const totalPages = Math.ceil(sortedSuppliers.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.suppliers.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSuppliers = sortedSuppliers.slice(startIndex, endIndex);

    if (paginatedSuppliers.length === 0) {
      renderAntdEmptyTableRow(tbody, 8, "暂无供应商记录");
      renderPaginationControl(
        "suppliers-pagination-container",
        "suppliers",
        updateSupplierTable,
      );
      return;
    }

    paginatedSuppliers.forEach((supplier) => {
      const formattedCreatedAt = formatDateTime(supplier.createdAt);
      const formattedUpdatedAt = formatDateTime(supplier.updatedAt);
      const safeSupplierName = escapeHTML(supplier.name || "-");
      const safeContactPerson = escapeHTML(supplier.contactPerson || "-");
      const safeContactPhone = escapeHTML(supplier.contactPhone || "-");
      const safeEmail = escapeHTML(supplier.email || "-");
      const safePaymentTerms = escapeHTML(supplier.paymentTerms || "-");
      const statusMeta = getStatusMeta(supplier.status);
      const safeStatusLabel = escapeHTML(statusMeta.label);

      const row = document.createElement("tr");
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${safeSupplierName}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeContactPerson}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeContactPhone}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeEmail}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safePaymentTerms}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusMeta.className}">${safeStatusLabel}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center whitespace-nowrap">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button type="button" class="text-blue-600 hover:text-blue-900 mr-3" data-action="view">查看</button>
                    <button type="button" class="text-primary hover:text-primary-dark mr-3" data-action="edit">编辑</button>
                    <button type="button" class="text-danger hover:text-danger-dark" data-action="delete">删除</button>
                </td>
            `;
      const viewButton = row.querySelector('[data-action="view"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewSupplierModal(supplier.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditSupplierModal(supplier.id),
        );
      }
      if (deleteButton) {
        deleteButton.addEventListener("click", () =>
          deleteSupplier(supplier.id),
        );
      }
      tbody.appendChild(row);
    });

    renderPaginationControl(
      "suppliers-pagination-container",
      "suppliers",
      updateSupplierTable,
    );
  }

  global.getProductIcon = getProductIcon;
  global.showAddProductModal = showAddProductModal;
  global.showViewProductModal = showViewProductModal;
  global.deleteProduct = deleteProduct;
  global.addProduct = addProduct;
  global.updateInventoryTable = updateInventoryTable;
  global.showAddCompanyModal = showAddCompanyModal;
  global.showViewCompanyModal = showViewCompanyModal;
  global.showEditCompanyModal = showEditCompanyModal;
  global.deleteCompany = deleteCompany;
  global.updateCompanyTable = updateCompanyTable;
  global.showAddSupplierModal = showAddSupplierModal;
  global.showViewSupplierModal = showViewSupplierModal;
  global.showEditSupplierModal = showEditSupplierModal;
  global.deleteSupplier = deleteSupplier;
  global.showAddCustomerModal = showAddCustomerModal;
  global.showViewCustomerModal = showViewCustomerModal;
  global.showEditCustomerModal = showEditCustomerModal;
  global.deleteCustomer = deleteCustomer;
  global.updateCustomerTable = updateCustomerTable;
  global.updateSupplierTable = updateSupplierTable;

  global.AppMasterDataModule = Object.freeze({
    getProductIcon,
    showAddProductModal,
    showViewProductModal,
    deleteProduct,
    addProduct,
    updateInventoryTable,
    showAddCompanyModal,
    showViewCompanyModal,
    showEditCompanyModal,
    deleteCompany,
    updateCompanyTable,
    showAddSupplierModal,
    showViewSupplierModal,
    showEditSupplierModal,
    deleteSupplier,
    showAddCustomerModal,
    showViewCustomerModal,
    showEditCustomerModal,
    deleteCustomer,
    updateCustomerTable,
    updateSupplierTable,
  });
})(window);
