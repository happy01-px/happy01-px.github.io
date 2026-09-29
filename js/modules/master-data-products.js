(function initMasterDataProducts(global) {
  const core = global.AppMasterDataCore;
  if (!core) return;

  const {
    PRODUCT_CATEGORIES,
    formatDateTime,
    normalizeTextValue,
    getEditableFieldValue,
    getProductStatusMeta,
    buildRecordInfoCard,
    renderStatusSelect,
    formatCurrencyValue,
    countMatchingItems,
    requestDeleteConfirmation,
    createMasterDataSnapshot,
    persistMasterDataChanges,
    refreshInventoryDependencies,
    refreshStockDependencies,
    configureReadonlyModal,
    buildReadonlySummaryCard,
    buildEditableFieldCard,
    configureWideFormModal,
  } = core;

  function showBusinessEditor(title, content, onConfirm) {
    const open = global.showBusinessFormPage || global.showModal;
    return open?.(title, content, onConfirm);
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
    if (typeof global.showAddInboundModal !== "function") {
      alert("进货建档模块尚未就绪，请刷新页面后重试。");
      return false;
    }
    return global.showAddInboundModal({ source: "inventory" });
  }
  function createProductInboundStockMovement(product, productData) {
    const supplier = mockData.suppliers.find(
      (item) => item.id === product.supplierId,
    );
    const now = new Date();
    const warehouseId = global.getDefaultWarehouseId?.() || "WH001";

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
      status: "confirmed",
      warehouseId,
      locationCode: global.getDefaultLocationCode?.(warehouseId) || "",
      batchNo: "",
      expiryDate: null,
      remark: String(productData.notes || "").trim() || "-",
      createdAt: now,
      updatedAt: now,
    };
  }
  async function addProduct(productData) {
    const snapshot = createMasterDataSnapshot();
    const minStock = Number.isInteger(productData.minStock)
      ? productData.minStock
      : 10;
    const maxStock =
      Number.isInteger(productData.maxStock) && productData.maxStock > minStock
        ? productData.maxStock
        : Math.max(100, minStock + 1);
    const existingProduct = mockData.products.find(
      (product) =>
        product.name === productData.name &&
        product.supplierId === productData.supplierId,
    );
    let movementProduct = existingProduct;
    let oldQuantity = null;

    if (existingProduct) {
      oldQuantity = existingProduct.stockQuantity;
      existingProduct.stockQuantity += productData.quantity;
      existingProduct.minStock = minStock;
      existingProduct.maxStock = maxStock;
      existingProduct.status = "active";
      existingProduct.updatedAt = getLocalISOString();
    } else {
      const newProduct = {
        id: createSequentialId(mockData.products, "P"),
        name: productData.name,
        category: productData.category,
        unit: productData.unit,
        costPrice: productData.costPrice,
        retailPrice: productData.retailPrice,
        stockQuantity: productData.quantity,
        minStock,
        maxStock,
        supplierId: productData.supplierId,
        status: "active",
        createdAt: getLocalISOString(),
        updatedAt: getLocalISOString(),
      };

      mockData.products.push(newProduct);
      movementProduct = newProduct;
    }

    if (!Array.isArray(stockMovementData)) {
      stockMovementData = [];
    }
    stockMovementData.unshift(
      createProductInboundStockMovement(movementProduct, productData),
    );

    const persisted = await persistMasterDataChanges(snapshot, "商品", {
      actionType: existingProduct ? "edit" : "add",
      objectType: "product",
      objectName: productData.name,
      details: existingProduct
        ? `合并库存，原数量：${oldQuantity}，新增数量：${productData.quantity}，当前数量：${existingProduct.stockQuantity}`
        : `新增商品，数量：${productData.quantity}，成本单价：${productData.costPrice}`,
    });
    if (!persisted) return false;

    if (existingProduct) {
      alert(
        `商品 "${productData.name}" 已存在，已将数量合并。当前库存：${existingProduct.stockQuantity}`,
      );
    } else {
      alert(
        `商品 "${productData.name}" 已成功添加，库存数量：${productData.quantity}`,
      );
    }

    updateInventoryTable();
    refreshStockDependencies();
    return true;
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
  function showEditProductModal(productId) {
    const product = mockData.products.find((item) => item.id === productId);
    if (!product) {
      alert("未找到对应的商品记录");
      return;
    }

    const categoryOptions = [
      ...new Set(
        PRODUCT_CATEGORIES.concat(
          normalizeList(mockData.products)
            .map((item) => normalizeTextValue(item.category))
            .filter(Boolean),
        ),
      ),
    ].map((category) => ({ value: category, label: category }));
    const supplierOptions = mockData.suppliers
      .filter(
        (supplier) =>
          supplier.status !== "inactive" || supplier.id === product.supplierId,
      )
      .map((supplier) => ({ value: supplier.id, label: supplier.name }));
    const statusMeta = getProductStatusMeta(product);
    const content = `
            <form id="edit-product-form" class="space-y-3">
                ${buildReadonlySummaryCard("cube", product.name, `SKU: ${product.id || "-"}`, statusMeta)}
                ${buildRecordInfoCard(product)}
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    ${buildEditableFieldCard(
                      '商品名称 <span class="text-danger">*</span>',
                      `<input type="text" name="name" required value="${escapeHTML(getEditableFieldValue(product.name))}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                      "xl:col-span-2",
                    )}
                    ${buildEditableFieldCard(
                      '分类 <span class="text-danger">*</span>',
                      `<div id="edit-product-category-container" class="w-full"></div><input type="hidden" name="category" id="edit-product-category-input" value="${escapeHTML(getEditableFieldValue(product.category))}" required>`,
                    )}
                    ${buildEditableFieldCard(
                      '单位 <span class="text-danger">*</span>',
                      `<input type="text" name="unit" required value="${escapeHTML(getEditableFieldValue(product.unit))}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '成本单价 <span class="text-danger">*</span>',
                      `<input type="number" name="costPrice" required min="0" step="0.01" value="${Number(product.costPrice) || 0}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '销售单价 <span class="text-danger">*</span>',
                      `<input type="number" name="retailPrice" required min="0" step="0.01" value="${Number(product.retailPrice) || 0}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '最小库存 <span class="text-danger">*</span>',
                      `<input type="number" name="minStock" required min="0" step="1" value="${Number(product.minStock) || 0}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '最大库存 <span class="text-danger">*</span>',
                      `<input type="number" name="maxStock" required min="1" step="1" value="${Number(product.maxStock) || 0}" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">`,
                    )}
                    ${buildEditableFieldCard(
                      '供应商 <span class="text-danger">*</span>',
                      `<div id="edit-product-supplier-container" class="w-full"></div><input type="hidden" name="supplierId" id="edit-product-supplier-input" value="${escapeHTML(product.supplierId || "")}" required>`,
                    )}
                    ${buildEditableFieldCard(
                      '状态 <span class="text-danger">*</span>',
                      `<div id="edit-product-status-container" class="w-full"></div><input type="hidden" name="status" id="edit-product-status-input" value="${escapeHTML(product.status || "active")}" required>`,
                    )}
                </div>
                <p class="text-xs text-gray-500">库存数量请通过进货或出货调整；编辑商品属性不会改写历史单据中的快照。</p>
            </form>
        `;

    showBusinessEditor("编辑商品", content, async function onConfirm() {
      const form = document.getElementById("edit-product-form");
      if (!form.reportValidity()) return false;

      const formData = new FormData(form);
      const nextValues = {
        name: normalizeTextValue(formData.get("name")),
        category: normalizeTextValue(formData.get("category")),
        unit: normalizeTextValue(formData.get("unit")),
        costPrice: Number(formData.get("costPrice")),
        retailPrice: Number(formData.get("retailPrice")),
        minStock: Number(formData.get("minStock")),
        maxStock: Number(formData.get("maxStock")),
        supplierId: normalizeTextValue(formData.get("supplierId")),
        status: normalizeTextValue(formData.get("status")) || "active",
      };

      if (!nextValues.name || !nextValues.category || !nextValues.unit) {
        alert("请完整填写商品名称、分类和单位");
        return false;
      }
      if (!nextValues.supplierId) {
        alert("请选择供应商");
        return false;
      }
      if (
        !Number.isFinite(nextValues.costPrice) ||
        nextValues.costPrice < 0 ||
        !Number.isFinite(nextValues.retailPrice) ||
        nextValues.retailPrice < 0
      ) {
        alert("请输入有效的成本单价和销售单价");
        return false;
      }
      if (
        !Number.isInteger(nextValues.minStock) ||
        nextValues.minStock < 0 ||
        !Number.isInteger(nextValues.maxStock) ||
        nextValues.maxStock <= nextValues.minStock
      ) {
        alert("最大库存必须是大于最小库存的整数");
        return false;
      }

      const duplicateProduct = mockData.products.some(
        (item) =>
          item.id !== product.id &&
          normalizeTextValue(item.name).toLowerCase() ===
            nextValues.name.toLowerCase() &&
          item.supplierId === nextValues.supplierId,
      );
      if (duplicateProduct) {
        alert("同一供应商下已存在同名商品，请使用其他名称");
        return false;
      }

      const changedFields = [
        ["名称", product.name, nextValues.name],
        ["分类", product.category, nextValues.category],
        ["单位", product.unit, nextValues.unit],
        ["成本价", Number(product.costPrice), nextValues.costPrice],
        ["销售价", Number(product.retailPrice), nextValues.retailPrice],
        ["最小库存", Number(product.minStock), nextValues.minStock],
        ["最大库存", Number(product.maxStock), nextValues.maxStock],
        ["供应商", product.supplierId, nextValues.supplierId],
        ["状态", product.status || "active", nextValues.status],
      ]
        .filter(([, previousValue, nextValue]) => previousValue !== nextValue)
        .map(([label]) => label);
      if (changedFields.length === 0) {
        alert("商品信息未发生变化");
        return false;
      }

      const snapshot = createMasterDataSnapshot();
      Object.assign(product, nextValues, { updatedAt: getLocalISOString() });
      const persisted = await persistMasterDataChanges(snapshot, "商品", {
        actionType: "edit",
        objectType: "product",
        objectName: nextValues.name,
        details: `编辑商品属性：${changedFields.join("、")}`,
      });
      if (!persisted) return false;

      refreshInventoryDependencies();
      refreshStockDependencies();
      alert("商品信息已更新");
      return true;
    });

    configureWideFormModal("保存");
    renderAntdSelect(
      "edit-product-category-container",
      "edit-product-category-input",
      categoryOptions,
      {
        placeholder: "请输入或搜索分类...",
        mode: "tags",
        controlSearchValue: true,
        keepSearchTextOnBlur: true,
        enableCreateOption: true,
        createOptionLabel: (text) => `添加 ${text}`,
        value: product.category || undefined,
      },
      (value) => {
        const input = document.getElementById("edit-product-category-input");
        if (input) input.value = normalizeTextValue(value);
      },
    );
    renderAntdSelect(
      "edit-product-supplier-container",
      "edit-product-supplier-input",
      supplierOptions,
      {
        placeholder: "请选择供应商",
        value: product.supplierId || undefined,
      },
    );
    renderStatusSelect(
      "edit-product-status-container",
      "edit-product-status-input",
      product.status || "active",
    );
  }
  function updateInventoryTable() {
    const tbody = document.getElementById("inventory-table-body");
    if (!tbody) return;

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
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

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
      row.dataset.recordId = product.id;
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap overflow-hidden">
                    <div class="min-w-0 overflow-hidden">
                        <div class="text-sm font-medium text-gray-900 truncate" title="${safeProductName}">${safeProductName}</div>
                        <div class="text-sm text-gray-500 truncate">SKU: ${safeProductId}</div>
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
                            <span class="text-xs text-gray-500 whitespace-nowrap">创建时间:</span>
                            <span class="flex items-center overflow-hidden">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 flex-shrink-0">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 whitespace-nowrap">更新时间:</span>
                            <span class="flex items-center overflow-hidden">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 flex-shrink-0">${getInitial(currentUser.name)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="table-action-cell px-6 py-4 text-sm font-medium text-left align-middle">
                    <div class="table-action-links flex items-center gap-4 whitespace-nowrap">
                        <button type="button" class="inline-flex items-center justify-center text-blue-600 hover:text-blue-900" data-action="view">查看</button>
                        <button type="button" class="inline-flex items-center justify-center text-primary hover:text-primary-dark" data-action="edit">编辑</button>
                        <button type="button" class="inline-flex items-center justify-center text-danger hover:text-danger-dark" data-action="delete">删除</button>
                    </div>
                </td>
            `;

      const viewButton = row.querySelector('[data-action="view"]');
      const editButton = row.querySelector('[data-action="edit"]');
      const deleteButton = row.querySelector('[data-action="delete"]');
      if (viewButton) {
        viewButton.addEventListener("click", () =>
          showViewProductModal(product.id),
        );
      }
      if (editButton) {
        editButton.addEventListener("click", () =>
          showEditProductModal(product.id),
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
    const relatedBillCount = countMatchingItems(
      mockData.bills,
      (bill) =>
        Array.isArray(bill?.details) &&
        bill.details.some((detail) => detail.productId === productId),
    );
    const hasReferences =
      relatedStockCount + relatedDeliveryCount + relatedBillCount > 0;

    const ok = await requestDeleteConfirmation(
      "商品",
      product.name,
      [
        relatedStockCount > 0
          ? `已有 ${relatedStockCount} 条库存流水会保留这件商品的历史快照。`
          : "",
        relatedDeliveryCount > 0
          ? `已有 ${relatedDeliveryCount} 张送货单会保留这件商品的历史快照。`
          : "",
        relatedBillCount > 0
          ? `已有 ${relatedBillCount} 张对账单引用了这件商品。`
          : "",
      ],
      hasReferences ? "deactivate" : "delete",
    );
    if (!ok) return false;

    const snapshot = createMasterDataSnapshot();
    if (hasReferences) {
      product.status = "inactive";
      product.updatedAt = getLocalISOString();
    } else {
      mockData.products.splice(productIndex, 1);
    }
    const persisted = await persistMasterDataChanges(snapshot, "商品", {
      actionType: hasReferences ? "edit" : "delete",
      objectType: "product",
      objectName: product.name,
      details: hasReferences ? "停用商品" : "删除商品",
    });
    if (!persisted) return false;

    refreshInventoryDependencies();
    refreshStockDependencies();
    alert(hasReferences ? "商品已停用，历史业务数据保持不变" : "商品已删除");
    return true;
  }

  global.getProductIcon = getProductIcon;
  global.showAddProductModal = showAddProductModal;
  global.showViewProductModal = showViewProductModal;
  global.showEditProductModal = showEditProductModal;
  global.deleteProduct = deleteProduct;
  global.addProduct = addProduct;
  global.updateInventoryTable = updateInventoryTable;

  global.AppMasterDataProducts = Object.freeze({
    getProductIcon,
    showAddProductModal,
    showViewProductModal,
    showEditProductModal,
    deleteProduct,
    addProduct,
    updateInventoryTable,
  });
})(window);
