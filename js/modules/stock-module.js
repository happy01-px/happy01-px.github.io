(function initStockModule(global) {
  function showBusinessEditor(title, content, onConfirm, options = {}) {
    const open = global.showBusinessFormPage || global.showModal;
    return open?.(title, content, onConfirm, options);
  }

  function formError(form, selector, message) {
    if (typeof global.reportFormError === "function") {
      return global.reportFormError(message, selector, form);
    }
    global.alert(message);
    return false;
  }

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

  function getSingleWarehouseId() {
    return String(
      global.getDefaultWarehouseId?.() ||
        mockData.warehouses?.find(
          (warehouse) => warehouse.status !== "inactive",
        )?.id ||
        mockData.warehouses?.[0]?.id ||
        global.AppDataSchema?.DEFAULT_WAREHOUSE_ID ||
        "WH001",
    );
  }

  function getSingleLocationCode(warehouseId = getSingleWarehouseId()) {
    const configuredLocation = global.getDefaultLocationCode?.(warehouseId);
    if (configuredLocation) return configuredLocation;
    const warehouse = mockData.warehouses?.find(
      (entry) => String(entry.id) === String(warehouseId),
    );
    return warehouse?.locations?.[0]?.code || "";
  }

  function refreshActiveStockTable() {
    global.renderWarehouseInventoryControls?.();
    const activeTab = document.querySelector("#stock-tabs .active");
    if (activeTab) {
      renderStockMovementTable(activeTab.getAttribute("data-tab"));
    } else {
      renderStockMovementTable("all");
    }
  }

  async function deleteStockMovement(recordId) {
    const ok = await window.showAntdConfirm({
      title: "删除记录",
      content: "确定要删除这条记录吗？这将自动回滚对应的库存数量。",
    });
    if (!ok) return;

    const recordIndex = stockMovementData.findIndex(
      (record) => record.id === recordId,
    );
    if (recordIndex === -1) {
      alert("记录未找到，可能已被删除");
      return;
    }

    const record = stockMovementData[recordIndex];
    if (!["inbound", "outbound"].includes(record.type)) {
      alert("期初、调整和调拨流水属于库存账本记录，不能直接删除。");
      return;
    }
    const product = mockData.products.find(
      (item) => item.id === record.productId,
    );

    const previousStockQuantity = product?.stockQuantity;
    const previousUpdatedAt = product?.updatedAt;

    if (product) {
      if (record.type === "inbound") {
        if (product.stockQuantity < record.quantity) {
          alert(
            `不能删除：删除此进货记录会导致库存为负数（当前库存 ${product.stockQuantity}，需扣减 ${record.quantity}）。`,
          );
          return;
        }
        product.stockQuantity -= record.quantity;
        product.updatedAt = getLocalISOString();
      } else if (record.type === "outbound") {
        product.stockQuantity += record.quantity;
        product.updatedAt = getLocalISOString();
      }
    } else {
      alert("警告：关联的商品已不存在，库存将不会回滚，仅删除记录。");
    }

    stockMovementData.splice(recordIndex, 1);
    const auditLogs = stageAuditLogs({
      actionType: "delete",
      objectType: "stock_movement",
      objectName: record.productName,
      details: `删除${record.type === "inbound" ? "进货" : "出货"}记录，回滚数量：${record.quantity}`,
    });
    const saved = await saveMockData();
    if (saved === false) {
      rollbackStagedAuditLogs(auditLogs);
      stockMovementData.splice(recordIndex, 0, record);
      if (product) {
        product.stockQuantity = previousStockQuantity;
        product.updatedAt = previousUpdatedAt;
      }
      refreshActiveStockTable();
      updateInventoryTable();
      alert("删除失败：数据未能保存，本次库存变更已回滚。");
      return;
    }

    finalizeStagedAuditLogs(auditLogs);

    refreshActiveStockTable();
    updateInventoryTable();
    alert("记录已删除，库存已回滚");
  }

  function renderDashboardActivity() {
    const tbody = document.getElementById("dashboard-activity-table-body");
    if (!tbody) return;

    if (typeof global.refreshDashboardAnalytics === "function") {
      global.refreshDashboardAnalytics();
    }

    tbody.innerHTML = "";

    const recentActivity = stockMovementData.slice(0, 5);
    if (recentActivity.length === 0) {
      renderAntdEmptyTableRow(tbody, 5, "暂无活动记录");
      return;
    }

    recentActivity.forEach((record) => {
      const typeText = record.type === "inbound" ? "入库" : "出库";
      const typeClass =
        record.type === "inbound"
          ? "bg-green-100 text-green-800"
          : "bg-red-100 text-red-800";
      const safeProductName = escapeHTML(record.productName || "未知商品");
      const safeOperator = escapeHTML(record.operator || "-");

      const row = document.createElement("tr");
      row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                </td>
                <td class="px-6 py-4 text-sm text-gray-900"><div class="table-long-text stock-movement-cell-wrap" title="${safeProductName}">${safeProductName}</div></td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeOperator}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(record.createdAt)}</td>
            `;
      tbody.appendChild(row);
    });
  }

  function getInitial(name) {
    if (!name) return "?";
    return name.charAt(0).toUpperCase();
  }

  function isSalesDeliveryNote(note) {
    return (
      Boolean(note) &&
      (note.type === "sales" || note.customerId || note.customerNo)
    );
  }

  function getSalesDeliveryNotes() {
    return (mockData.deliveryNotes || []).filter(isSalesDeliveryNote);
  }

  function formatStockCurrency(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return "-";
    return `¥${amount.toLocaleString("zh-CN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  function buildCreatedUpdatedMarkup(record, operatorName) {
    const formattedCreatedAt = formatDateTime(record.createdAt);
    const formattedUpdatedAt = formatDateTime(record.updatedAt);
    const initial = escapeHTML(
      getInitial(operatorName || record.operator || currentUser.name),
    );

    return `
            <div class="space-y-1">
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                    </span>
                </div>
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                    </span>
                </div>
            </div>
        `;
  }

  function buildDeliveryNoteProductsMarkup(note) {
    const details = Array.isArray(note.details) ? note.details : [];
    if (details.length === 0) {
      return '<span class="text-sm text-gray-400">-</span>';
    }

    return details
      .map((detail) => {
        const safeName = escapeHTML(detail.productName || "-");
        const safeQuantity = escapeHTML(String(detail.quantity ?? ""));
        const safeUnit = escapeHTML(detail.unit || "");
        const quantityText = safeQuantity
          ? ` x ${safeQuantity}${safeUnit ? ` ${safeUnit}` : ""}`
          : "";
        return `
                <div class="text-sm text-gray-900">
                    <span>${safeName}</span>
                    <span class="text-xs text-gray-500">${quantityText}</span>
                </div>
            `;
      })
      .join("");
  }

  function getDeliveryNoteRemark(note) {
    const rawNotes = String(note.notes || "").trim();
    if (rawNotes) {
      return escapeHTML(rawNotes);
    }
    if (note.orderNo) {
      return `销售单号：${escapeHTML(note.orderNo)}`;
    }
    if (note.customerNo) {
      return `客户NO：${escapeHTML(note.customerNo)}`;
    }
    return "-";
  }

  function configureDeliveryNoteReadonlyModal() {
    const confirmBtn = document.getElementById("modal-confirm");
    const cancelBtn = document.getElementById("modal-cancel");
    const modalPanel = document.getElementById("modal-panel");
    const modalContent = document.getElementById("modal-content");

    if (modalPanel) {
      modalPanel.className = "bg-white rounded-lg shadow-xl w-full mx-4";
      modalPanel.style.maxWidth = "1600px";
      modalPanel.style.width = "calc(100vw - 1.5rem)";
    }

    if (modalContent) {
      modalContent.className =
        "p-2 md:p-3 max-h-[82vh] overflow-y-auto overflow-x-hidden";
    }

    if (confirmBtn) {
      confirmBtn.textContent = "打印送货单";
    }

    if (cancelBtn) {
      cancelBtn.textContent = "关闭";
      cancelBtn.classList.remove("hidden");
    }
  }

  function showViewDeliveryNoteModal(noteId) {
    const note = getSalesDeliveryNotes().find((item) => item.id === noteId);
    if (!note) {
      alert("送货单未找到，可能已被删除。");
      return;
    }

    const previewPayload = {
      companyName: note.companyName,
      issueDate: note.issueDate || note.deliveryDate || note.createdAt,
      companyAddress: note.companyAddress,
      companyPhone: note.companyPhone,
      companyContact: note.companyContact,
      customerName: note.customerName,
      customerAddress: note.customerAddress,
      customerContact: note.customerContact,
      customerPhone: note.customerPhone,
      paymentTerms: note.paymentTerms,
      customerNo: note.customerNo,
    };

    const previewItems = (note.details || []).map((detail) => ({
      productName: detail.productName,
      spec: detail.spec,
      unit: detail.unit,
      deliveryQty: detail.quantity,
      price: detail.unitPrice,
      remark: detail.notes || "",
    }));

    const printMarkup =
      typeof window.buildDeliveryNotePrintMarkup === "function"
        ? window.buildDeliveryNotePrintMarkup(note)
        : typeof window.buildSalesOrderPreviewMarkup === "function"
          ? window.buildSalesOrderPreviewMarkup(
              previewPayload,
              previewItems,
              Number(note.totalAmount) || 0,
            )
          : "";
    const previewMarkup = printMarkup.replace(
      /mx-auto min-w-\[1220px\] max-w-\[1220px\]/,
      "mx-auto w-full max-w-[1480px]",
    );

    const content = previewMarkup
      ? `
                <div class="bg-gray-50 rounded-xl border border-gray-100 p-2 md:p-3">
                    ${previewMarkup}
                </div>
            `
      : `
                <div class="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                    <div class="text-lg font-semibold text-gray-900">${escapeHTML(note.companyName || "送货单")}</div>
                    <div class="text-sm text-gray-500">客户：${escapeHTML(note.customerName || "-")}</div>
                    <div class="text-sm text-gray-500">送货金额：${escapeHTML(formatStockCurrency(note.totalAmount))}</div>
                </div>
            `;

    showModal("查看送货单", content, () => {
      if (typeof window.printDeliveryNote === "function") {
        window.printDeliveryNote(note);
      } else if (typeof window.printSalesOrderMarkup === "function") {
        window.printSalesOrderMarkup(
          printMarkup,
          `送货单-${note.customerNo || note.orderNo || ""}`,
        );
      } else {
        alert("打印模块尚未就绪，请刷新页面后重试。");
      }
      return false;
    });
    configureDeliveryNoteReadonlyModal();
    document.getElementById("delivery-note-create-bill")?.remove();
    const cancelButton = document.getElementById("modal-cancel");
    if (cancelButton?.parentElement) {
      const billButton = document.createElement("button");
      billButton.id = "delivery-note-create-bill";
      billButton.type = "button";
      billButton.className =
        "rounded-lg border border-primary bg-white px-4 py-2 text-primary transition hover:bg-purple-50";
      billButton.textContent = "生成对账单";
      billButton.onclick = () => {
        document.getElementById("modal")?.classList.add("hidden");
        global.openCreateBillFromSource?.(note);
      };
      cancelButton.parentElement.insertBefore(billButton, cancelButton);
    }
  }

  function renderStockMovementTable(filter) {
    if (!filter) {
      const activeTab = document.querySelector("#stock-tabs button.active");
      filter = activeTab ? activeTab.getAttribute("data-tab") : "all";
    }

    const tableBody = document.getElementById("stock-movement-table-body");
    if (!tableBody) return;
    const tableHead = document.getElementById("stock-movement-table-head");

    tableBody.innerHTML = "";

    let filteredData = stockMovementData.slice();
    let emptyColspan = 6;

    if (filter === "inbound") {
      filteredData = filteredData.filter((record) => record.type === "inbound");
      emptyColspan = 7;
    } else if (filter === "outbound") {
      filteredData = filteredData.filter(
        (record) => record.type === "outbound",
      );
      emptyColspan = 8;
    } else if (filter === "delivery-note") {
      filteredData = getSalesDeliveryNotes();
    }

    if (tableHead) {
      if (filter === "inbound") {
        tableHead.innerHTML = `
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量变动</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">进价</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                    <th class="table-action-header px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                `;
      } else if (filter === "outbound") {
        tableHead.innerHTML = `
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出货公司</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量变动</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                    <th class="table-action-header px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                `;
      } else if (filter === "delivery-note") {
        tableHead.innerHTML = `
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">送货公司</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">送货商品</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">送货价值</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                    <th class="table-action-header px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                `;
      } else {
        tableHead.innerHTML = `
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量变动</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                    <th class="table-action-header px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                `;
      }
    }

    filteredData.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    paginationState.stock.total = filteredData.length;
    let { page, pageSize } = paginationState.stock;

    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (page > totalPages && totalPages > 0) {
      paginationState.stock.page = totalPages;
      page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filteredData.slice(startIndex, endIndex);

    if (paginatedData.length === 0) {
      renderAntdEmptyTableRow(tableBody, emptyColspan, "暂无记录");
      renderPaginationControl(
        "stock-pagination-container",
        "stock",
        renderStockMovementTable,
      );
      return;
    }

    const supplierMap = new Map(
      mockData.suppliers.map((supplier) => [supplier.id, supplier.name]),
    );
    const productMap = new Map(
      mockData.products.map((product) => [product.id, product]),
    );

    paginatedData.forEach((record) => {
      const typeTextMap = {
        inbound: "入库",
        outbound: "出库",
        opening: "期初",
        adjustment_in: "盘盈",
        adjustment_out: "盘亏",
        transfer_in: "调入",
        transfer_out: "调出",
      };
      const isPositiveMovement = [
        "inbound",
        "opening",
        "adjustment_in",
        "transfer_in",
      ].includes(record.type);
      const typeText = typeTextMap[record.type] || record.type;
      const typeClass = isPositiveMovement
        ? "bg-green-100 text-green-800"
        : "bg-blue-100 text-blue-800";
      const quantityClass = isPositiveMovement
        ? "text-green-600"
        : "text-blue-600";
      const quantitySign = isPositiveMovement ? "+" : "-";
      const product = productMap.get(record.productId);
      const displayProductName = product
        ? product.name
        : record.productName || "未知商品";
      const supplierName =
        record.supplierName ||
        (product ? supplierMap.get(product.supplierId) : "") ||
        "-";
      const safeProductName = escapeHTML(displayProductName);
      const safeSupplierName = escapeHTML(supplierName);
      const safeRemark = escapeHTML(record.remark || "-");
      const storageMeta = [record.locationCode || ""]
        .filter(Boolean)
        .join(" / ");
      const storageMarkup = `<div class="mt-1 text-xs text-gray-400">${escapeHTML(storageMeta)}</div>`;
      const safeUnit = escapeHTML(record.unit || "");
      const createdUpdatedMarkup = buildCreatedUpdatedMarkup(
        record,
        record.operator,
      );

      const row = document.createElement("tr");
      row.dataset.recordId = record.id;
      if (filter === "delivery-note") {
        const safeCompanyName = escapeHTML(record.companyName || "-");
        const safeDeliveryAmount = escapeHTML(
          formatStockCurrency(record.totalAmount),
        );
        const deliveryCreatedUpdatedMarkup = buildCreatedUpdatedMarkup(
          record,
          record.companyContact || record.customerContact || currentUser.name,
        );

        row.innerHTML = `
                    <td class="px-6 py-4 text-sm text-gray-900"><div class="table-long-text stock-movement-cell-wrap" title="${safeCompanyName}">${safeCompanyName}</div></td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        <div class="space-y-1">${buildDeliveryNoteProductsMarkup(record)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${safeDeliveryAmount}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${getDeliveryNoteRemark(record)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${deliveryCreatedUpdatedMarkup}</td>
                    <td class="table-action-cell px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div class="table-action-links">
                            <button class="text-primary hover:text-primary-dark" onclick="showViewDeliveryNoteModal('${record.id}')">
                                查看
                            </button>
                            <button class="text-orange-600 hover:text-orange-800" data-delivery-bill="${escapeHTML(record.id)}">
                                对账
                            </button>
                        </div>
                    </td>
                `;
        row
          .querySelector("[data-delivery-bill]")
          ?.addEventListener("click", () =>
            global.openCreateBillFromSource?.(record),
          );
      } else if (filter === "inbound") {
        let priceHtml = '<span class="text-gray-400">-</span>';
        if (record.price !== null && record.price !== undefined) {
          const priceClass =
            record.priceType === "custom" ? "text-gray-900" : "text-gray-500";
          priceHtml = `<span class="${priceClass}">¥${parseFloat(record.price).toLocaleString()}</span>`;
        }

        row.innerHTML = `
                    <td class="px-6 py-4 text-sm text-gray-900"><div class="table-long-text stock-movement-cell-wrap" title="${safeProductName}">${safeProductName}</div></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${priceHtml}</td>
                    <td class="px-6 py-4 text-sm text-gray-500"><div class="table-long-text stock-movement-cell-wrap" title="${safeSupplierName}">${safeSupplierName}</div></td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}${storageMarkup}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${createdUpdatedMarkup}</td>
                    <td class="table-action-cell px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div class="table-action-links">
                            <button class="text-primary hover:text-primary-dark">查看</button>
                            <button class="text-yellow-600 hover:text-yellow-800">编辑</button>
                            <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">删除</button>
                        </div>
                    </td>
                `;
      } else if (filter === "outbound") {
        const safeCustomerName = escapeHTML(record.customerName || "-");
        const safeCompanyName = escapeHTML(record.companyName || "-");

        row.innerHTML = `
                    <td class="px-6 py-4 text-sm text-gray-900"><div class="table-long-text stock-movement-cell-wrap" title="${safeProductName}">${safeProductName}</div></td>
                    <td class="px-6 py-4 text-sm text-gray-500"><div class="table-long-text stock-movement-cell-wrap" title="${safeCustomerName}">${safeCustomerName}</div></td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                    </td>
                    <td class="px-6 py-4 text-sm text-gray-500"><div class="table-long-text stock-movement-cell-wrap" title="${safeCompanyName}">${safeCompanyName}</div></td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}${storageMarkup}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${createdUpdatedMarkup}</td>
                    <td class="table-action-cell px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div class="table-action-links">
                            <button class="text-primary hover:text-primary-dark">查看</button>
                            <button class="text-yellow-600 hover:text-yellow-800">编辑</button>
                            <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">删除</button>
                        </div>
                    </td>
                `;
      } else {
        row.innerHTML = `
                    <td class="px-6 py-4 text-sm text-gray-900"><div class="table-long-text stock-movement-cell-wrap" title="${safeProductName}">${safeProductName}</div></td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}${storageMarkup}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${createdUpdatedMarkup}</td>
                    <td class="table-action-cell px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
                        <div class="table-action-links">
                            <button class="text-primary hover:text-primary-dark">查看</button>
                            <button class="text-yellow-600 hover:text-yellow-800">编辑</button>
                            <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">删除</button>
                        </div>
                    </td>
                `;
      }

      tableBody.appendChild(row);
    });

    renderPaginationControl(
      "stock-pagination-container",
      "stock",
      renderStockMovementTable,
    );
  }

  async function addInboundRecord(recordData) {
    const product = mockData.products.find(
      (item) => item.id === recordData.productId,
    );
    if (!product) {
      alert("商品不存在！");
      return;
    }

    const supplier = mockData.suppliers.find(
      (item) => item.id === product.supplierId,
    );
    const company =
      mockData.companies.find((item) => item.id === recordData.companyId) ||
      mockData.companies.find((item) => item.status !== "inactive") ||
      null;
    const now = new Date();
    const warehouseId = getSingleWarehouseId();
    const newRecord = {
      id: createRuntimeId("SM"),
      type: "inbound",
      status: "confirmed",
      productId: recordData.productId,
      productName: product.name,
      quantity: recordData.quantity,
      unit: product.unit,
      supplierId: product.supplierId,
      supplierName: supplier ? supplier.name : "-",
      companyId: company?.id || "",
      companyName: company?.name || "-",
      price: Number(recordData.price ?? product.costPrice ?? 0),
      priceType: "custom",
      operator: currentUser.name,
      warehouseId,
      locationCode:
        recordData.locationCode || getSingleLocationCode(warehouseId),
      batchNo: recordData.batchNo || "",
      expiryDate: recordData.expiryDate || null,
      remark: (recordData.remark || "").trim(),
      createdAt: now,
      updatedAt: now,
    };

    stockMovementData.unshift(newRecord);

    const previousStockQuantity = product.stockQuantity;
    const previousUpdatedAt = product.updatedAt;
    product.stockQuantity += recordData.quantity;
    product.updatedAt = getLocalISOString();
    const auditLogs = stageAuditLogs({
      actionType: "add",
      objectType: "inventory",
      objectName: product.name,
      details: `进货入库，数量：${recordData.quantity}`,
    });
    const saved = await saveMockData();
    if (saved === false) {
      rollbackStagedAuditLogs(auditLogs);
      stockMovementData.shift();
      product.stockQuantity = previousStockQuantity;
      product.updatedAt = previousUpdatedAt;
      updateInventoryTable();
      renderStockMovementTable("all");
      renderDashboardActivity();
      alert("进货失败：数据未能保存，本次库存变更已回滚。");
      return false;
    }

    updateInventoryTable();
    renderStockMovementTable("all");
    renderDashboardActivity();
    finalizeStagedAuditLogs(auditLogs);
    return true;
  }

  function showAddOutboundModal() {
    const content = `
            <form id="add-outbound-form" class="app-modal-form-grid">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">商品 <span class="text-danger">*</span></label>
                    <div id="outbound-product-select-container" class="w-full"></div>
                    <input type="hidden" name="productId" id="outbound-product-id" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">数量 <span class="text-danger">*</span></label>
                    <input type="number" name="quantity" min="1" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                </div>
                <div class="app-modal-wide-field">
                    <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                    <textarea name="remark" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>
                </div>
            </form>
        `;

    showModal(
      "新增出货",
      content,
      async function onConfirm() {
        const form = document.getElementById("add-outbound-form");
        const formData = new FormData(form);
        const productId = document.getElementById("outbound-product-id").value;
        const quantityStr = formData.get("quantity");
        const warehouseId = getSingleWarehouseId();

        if (!productId) {
          return formError(
            form,
            "#outbound-product-select-container",
            "请选择商品（必填）",
          );
        }
        if (!quantityStr) {
          return formError(form, '[name="quantity"]', "请输入数量（必填）");
        }

        const product = mockData.products.find((item) => item.id === productId);
        if (!product) {
          alert("商品无效，请重新选择");
          return false;
        }

        const quantity = parseInt(quantityStr, 10);
        if (Number.isNaN(quantity) || quantity <= 0) {
          return formError(form, '[name="quantity"]', "请输入有效的数量");
        }

        const warehouseStock =
          typeof global.getLedgerQuantity === "function"
            ? global.getLedgerQuantity(product.id, warehouseId)
            : Number(product.stockQuantity || 0);
        const availableStock = warehouseStock;
        if (availableStock < quantity) {
          return formError(
            form,
            '[name="quantity"]',
            `商品库存不足！当前可用库存：${availableStock}`,
          );
        }

        const previousStockQuantity = product.stockQuantity;
        const previousUpdatedAt = product.updatedAt;
        product.stockQuantity -= quantity;
        product.updatedAt = getLocalISOString();

        const record = {
          id: createRuntimeId("SM"),
          type: "outbound",
          status: "confirmed",
          productId: product.id,
          productName: product.name,
          quantity,
          unit: product.unit,
          operator: currentUser.name,
          warehouseId,
          locationCode: getSingleLocationCode(warehouseId),
          batchNo: "",
          expiryDate: null,
          remark: formData.get("remark") || "出货出库",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        stockMovementData.unshift(record);

        const auditLogs = stageAuditLogs({
          actionType: "add",
          objectType: "stock_movement",
          objectName: product.name,
          details: `出货 ${quantity} ${product.unit}`,
        });
        const saved = await saveMockData();
        if (saved === false) {
          rollbackStagedAuditLogs(auditLogs);
          stockMovementData.shift();
          product.stockQuantity = previousStockQuantity;
          product.updatedAt = previousUpdatedAt;
          refreshActiveStockTable();
          updateInventoryTable();
          renderDashboardActivity();
          alert("出货失败：数据未能保存，本次库存变更已回滚。");
          return false;
        }

        finalizeStagedAuditLogs(auditLogs);
        refreshActiveStockTable();
        updateInventoryTable();
        renderDashboardActivity();

        alert("出货记录添加成功");
        return true;
      },
      {
        confirmText: "保存并返回",
        allowContinue: true,
        continueText: "保存并继续出货",
        onContinue: showAddOutboundModal,
      },
    );

    const productOptions = mockData.products
      .filter(
        (product) =>
          product.status !== "inactive" &&
          Number(product.stockQuantity || 0) > 0,
      )
      .map((product) => ({
        value: product.id,
        label: `${product.name} (库存: ${product.stockQuantity})`,
      }));
    renderAntdSelect(
      "outbound-product-select-container",
      "outbound-product-id",
      productOptions,
      "请选择或搜索商品...",
    );
  }

  global.deleteStockMovement = deleteStockMovement;
  global.renderDashboardActivity = renderDashboardActivity;
  global.getInitial = getInitial;
  global.renderStockMovementTable = renderStockMovementTable;
  global.showViewDeliveryNoteModal = showViewDeliveryNoteModal;
  global.addInboundRecord = addInboundRecord;
  function showAddInboundModal() {
    const buildEditableFieldCard = (
      labelMarkup,
      fieldMarkup,
      extraClasses = "",
    ) => {
      const className = extraClasses ? ` ${extraClasses}` : "";
      return `
                <div class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5${className}">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5">${labelMarkup}</label>
                    ${fieldMarkup}
                </div>
            `;
    };

    const buildFormIntroCard = (iconClass, title, description) => `
            <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 h-10 w-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center">
                        <i class="fa fa-${iconClass} text-blue-600 text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="text-base font-semibold text-gray-900">${escapeHTML(title)}</div>
                        <div class="text-sm text-gray-600 mt-0.5">${escapeHTML(description)}</div>
                    </div>
                </div>
            </div>
        `;

    const content = `
            <form id="add-inbound-form" class="space-y-2.5">
                ${buildFormIntroCard("truck", "新增进货 / 商品", "选择已有商品即补货；输入新商品名称则会同时完成商品建档和首次入库。")}
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    ${buildEditableFieldCard(
                      '商品名称 <span class="text-danger">*</span>',
                      '<div id="inbound-product-select-container" class="w-full"></div><input type="hidden" name="name" id="inbound-product-name-input" required><input type="hidden" id="inbound-product-choice-input">',
                      "xl:col-span-2",
                    )}
                    ${buildEditableFieldCard(
                      '分类 <span class="text-danger">*</span>',
                      '<div id="inbound-category-select-container" class="w-full"></div><input type="hidden" name="category" id="inbound-category-input" required>',
                    )}
                    ${buildEditableFieldCard(
                      '入库公司 <span class="text-danger">*</span>',
                      '<div id="inbound-company-select-container" class="w-full"></div><input type="hidden" name="companyId" id="inbound-company-id" required>',
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
                      '最低库存 <span class="text-danger">*</span>',
                      '<input type="number" name="minStock" value="10" required min="0" step="1" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '最高库存 <span class="text-danger">*</span>',
                      '<input type="number" name="maxStock" value="100" required min="1" step="1" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      '供应商 <span class="text-danger">*</span>',
                      '<div id="inbound-supplier-select-container" class="w-full"></div><input type="hidden" name="supplierId" id="inbound-supplier-id" required>',
                      "xl:col-span-2",
                    )}
                    ${buildEditableFieldCard(
                      '单位 <span class="text-danger">*</span>',
                      '<input type="text" name="unit" required placeholder="如：个、件、箱" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">',
                    )}
                    ${buildEditableFieldCard(
                      "备注",
                      '<textarea name="remark" rows="2" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>',
                      "app-modal-wide-field",
                    )}
                </div>
                <p class="text-xs text-gray-500">搜索到已有商品后，会自动带出分类、供应商、单位、成本单价和销售单价；新商品则按你当前填写的数据创建并记录本次进货。</p>
            </form>
        `;

    const productOptions = [...mockData.products]
      .filter((product) => product.status !== "inactive")
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      )
      .map((product) => ({
        value: product.id,
        label: product.name,
      }));
    const categoryOptions = Array.from(
      new Set([
        "电子产品",
        "服装",
        "家具",
        "图书",
        ...mockData.products
          .map((product) => String(product.category || "").trim())
          .filter(Boolean),
      ]),
    ).map((category) => ({ value: category, label: category }));
    const supplierOptions = mockData.suppliers
      .filter((supplier) => supplier.status !== "inactive")
      .map((supplier) => ({
        value: supplier.id,
        label: supplier.name,
      }));
    const companyOptions = mockData.companies
      .filter((company) => company.status !== "inactive")
      .map((company) => ({
        value: company.id,
        label: company.name,
      }));
    const defaultCompanyId = companyOptions[0]?.value || "";
    let lastLoadedProductId = "";

    showBusinessEditor(
      "新增进货 / 商品",
      content,
      async function onConfirm() {
        const form = document.getElementById("add-inbound-form");
        const formData = new FormData(form);
        const getPendingSelectText = (containerId) =>
          String(
            document
              .getElementById(containerId)
              ?.querySelector(".ant-select-selection-search-input")?.value ||
              "",
          ).trim();
        const pendingProductName = getPendingSelectText(
          "inbound-product-select-container",
        );
        const pendingCategory = getPendingSelectText(
          "inbound-category-select-container",
        );
        const selectedProductValue = String(
          document.getElementById("inbound-product-choice-input")?.value ||
            pendingProductName,
        ).trim();
        const selectedProduct = mockData.products.find(
          (item) => item.id === selectedProductValue,
        );
        const productName = String(
          formData.get("name") || selectedProduct?.name || pendingProductName,
        ).trim();
        const category = String(
          formData.get("category") || pendingCategory,
        ).trim();
        const supplierId = String(formData.get("supplierId") || "").trim();
        const companyId = String(formData.get("companyId") || "").trim();
        const unit = String(formData.get("unit") || "").trim();
        const quantityStr = String(formData.get("quantity") || "").trim();
        const costPriceStr = String(formData.get("costPrice") || "").trim();
        const retailPriceStr = String(formData.get("retailPrice") || "").trim();
        const minStockStr = String(formData.get("minStock") || "").trim();
        const maxStockStr = String(formData.get("maxStock") || "").trim();
        const warehouseId = getSingleWarehouseId();
        const locationCode = getSingleLocationCode(warehouseId);

        if (!productName) {
          return formError(
            form,
            "#inbound-product-select-container",
            "请输入商品名称",
          );
        }
        if (!category) {
          return formError(
            form,
            "#inbound-category-select-container",
            "请选择分类",
          );
        }
        if (!quantityStr) {
          return formError(form, '[name="quantity"]', "请输入数量");
        }
        if (!costPriceStr) {
          return formError(form, '[name="costPrice"]', "请输入成本单价");
        }
        if (!retailPriceStr) {
          return formError(form, '[name="retailPrice"]', "请输入销售单价");
        }
        if (!supplierId) {
          return formError(
            form,
            "#inbound-supplier-select-container",
            "请选择供应商",
          );
        }
        if (!companyId) {
          return formError(
            form,
            "#inbound-company-select-container",
            "请选择入库公司",
          );
        }
        if (!unit) {
          return formError(form, '[name="unit"]', "请输入单位");
        }
        const quantity = parseInt(quantityStr, 10);
        if (Number.isNaN(quantity) || quantity <= 0) {
          return formError(form, '[name="quantity"]', "请输入有效的数量");
        }

        const costPrice = parseFloat(costPriceStr);
        if (Number.isNaN(costPrice) || costPrice < 0) {
          return formError(form, '[name="costPrice"]', "请输入有效的成本单价");
        }

        const retailPrice = parseFloat(retailPriceStr);
        if (Number.isNaN(retailPrice) || retailPrice < 0) {
          return formError(
            form,
            '[name="retailPrice"]',
            "请输入有效的销售单价",
          );
        }

        const minStock = Number(minStockStr);
        const maxStock = Number(maxStockStr);
        if (!Number.isInteger(minStock) || minStock < 0) {
          return formError(form, '[name="minStock"]', "请输入有效的最低库存");
        }
        if (!Number.isInteger(maxStock) || maxStock <= minStock) {
          return formError(
            form,
            '[name="maxStock"]',
            "最高库存必须是大于最低库存的整数",
          );
        }

        const supplier = mockData.suppliers.find(
          (item) => item.id === supplierId,
        );
        if (!supplier) {
          return formError(
            form,
            "#inbound-supplier-select-container",
            "供应商无效，请重新选择",
          );
        }
        const company = mockData.companies.find(
          (item) => item.id === companyId,
        );
        if (!company) {
          return formError(
            form,
            "#inbound-company-select-container",
            "入库公司无效，请重新选择",
          );
        }

        const now = getLocalISOString();
        const previousProducts = mockData.products.slice();
        const previousProductSnapshots = new Map(
          mockData.products.map((product) => [
            product.id,
            {
              ...product,
              stockQuantity: Number(product.stockQuantity || 0),
            },
          ]),
        );
        let finalProduct =
          mockData.products.find((item) => item.id === selectedProductValue) ||
          mockData.products.find((item) => item.name === productName);
        let createdProduct = false;

        if (!finalProduct) {
          finalProduct = {
            id: createSequentialId(mockData.products, "P"),
            name: productName,
            category,
            unit,
            costPrice,
            retailPrice,
            stockQuantity: 0,
            minStock,
            maxStock,
            supplierId,
            status: "active",
            createdAt: now,
            updatedAt: now,
          };
          mockData.products.push(finalProduct);
          createdProduct = true;
        } else {
          finalProduct.name = productName;
          finalProduct.category = category;
          finalProduct.unit = unit;
          finalProduct.costPrice = costPrice;
          finalProduct.retailPrice = retailPrice;
          finalProduct.minStock = minStock;
          finalProduct.maxStock = maxStock;
          finalProduct.supplierId = supplierId;
          finalProduct.updatedAt = now;
        }

        finalProduct.stockQuantity =
          Number(finalProduct.stockQuantity || 0) + quantity;
        finalProduct.updatedAt = now;

        const remarkValue = String(formData.get("remark") || "").trim();
        const record = {
          id: createRuntimeId("SM"),
          type: "inbound",
          status: "confirmed",
          productId: finalProduct.id,
          productName: finalProduct.name,
          quantity,
          unit: finalProduct.unit,
          supplierId: supplier.id,
          supplierName: supplier.name,
          companyId: company.id,
          companyName: company.name,
          price: costPrice,
          priceType: "custom",
          operator: currentUser.name,
          warehouseId,
          locationCode,
          batchNo: "",
          expiryDate: null,
          remark: remarkValue || "-",
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        stockMovementData.unshift(record);

        const auditLogs = stageAuditLogs([
          createdProduct
            ? {
                actionType: "add",
                objectType: "product",
                objectName: finalProduct.name,
                details: "自动创建新商品",
              }
            : null,
          {
            actionType: "add",
            objectType: "stock_movement",
            objectName: finalProduct.name,
            details: `进货 ${quantity} ${finalProduct.unit}`,
          },
        ]);
        const saved = await saveMockData();
        if (saved === false) {
          rollbackStagedAuditLogs(auditLogs);
          stockMovementData.shift();
          mockData.products = previousProducts;
          mockData.products.forEach((product) => {
            const snapshot = previousProductSnapshots.get(product.id);
            if (snapshot) Object.assign(product, snapshot);
          });
          refreshActiveStockTable();
          updateInventoryTable();
          updateSupplierTable();
          renderDashboardActivity();
          alert("进货失败：数据未能保存，本次商品和库存变更已回滚。");
          return false;
        }

        finalizeStagedAuditLogs(auditLogs);
        refreshActiveStockTable();
        updateInventoryTable();
        updateSupplierTable();
        renderDashboardActivity();

        alert(createdProduct ? "商品创建并入库成功" : "进货记录添加成功");
        return true;
      },
      {
        confirmText: "入库并返回",
        allowContinue: true,
        continueText: "入库并继续新增",
        onContinue: showAddInboundModal,
      },
    );

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
      confirmBtn.textContent = "入库并返回";
    }
    global.configureBusinessFormPage?.("入库并返回");

    if (cancelBtn) {
      cancelBtn.classList.remove("hidden");
      cancelBtn.textContent = "取消";
    }

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
        "inbound-category-select-container",
        "inbound-category-input",
        categoryOptions,
        {
          placeholder: "请输入或搜索分类...",
          mode: "tags",
          controlSearchValue: true,
          keepSearchTextOnBlur: true,
          enableCreateOption: true,
          createOptionLabel: (text) => `添加 ${text}`,
          value: value || undefined,
        },
        (selectedValue) => {
          setHiddenValue(
            "inbound-category-input",
            String(selectedValue ?? "").trim(),
          );
        },
      );
      setHiddenValue("inbound-category-input", value);
    };

    const renderSupplierSelect = (value = "") => {
      renderAntdSelect(
        "inbound-supplier-select-container",
        "inbound-supplier-id",
        supplierOptions,
        {
          placeholder: "请选择供应商",
          value: value || undefined,
        },
      );
      setHiddenValue("inbound-supplier-id", value);
    };

    const clearAutofillFields = () => {
      renderCategorySelect();
      renderSupplierSelect();
      setInputValue('#add-inbound-form input[name="unit"]', "");
      setInputValue('#add-inbound-form input[name="costPrice"]', "");
      setInputValue('#add-inbound-form input[name="retailPrice"]', "");
      setInputValue('#add-inbound-form input[name="minStock"]', "10");
      setInputValue('#add-inbound-form input[name="maxStock"]', "100");
    };

    const applyProductDefaults = (product) => {
      if (!product) return;
      renderCategorySelect(product.category || "");
      renderSupplierSelect(product.supplierId || "");
      setInputValue('#add-inbound-form input[name="unit"]', product.unit || "");
      setInputValue(
        '#add-inbound-form input[name="costPrice"]',
        product.costPrice ?? "",
      );
      setInputValue(
        '#add-inbound-form input[name="retailPrice"]',
        product.retailPrice ?? "",
      );
      setInputValue(
        '#add-inbound-form input[name="minStock"]',
        product.minStock ?? 10,
      );
      setInputValue(
        '#add-inbound-form input[name="maxStock"]',
        product.maxStock ?? 100,
      );
    };

    renderAntdSelect(
      "inbound-product-select-container",
      "inbound-product-choice-input",
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
          "inbound-product-name-input",
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
    renderAntdSelect(
      "inbound-company-select-container",
      "inbound-company-id",
      companyOptions,
      {
        placeholder: "请选择入库公司",
        value: defaultCompanyId || undefined,
      },
    );
    setHiddenValue("inbound-company-id", defaultCompanyId);
  }

  function showAddBatchInboundModal() {
    const activeCompanies = (mockData.companies || []).filter(
      (company) => company.status !== "inactive",
    );
    const activeSuppliers = (mockData.suppliers || []).filter(
      (supplier) => supplier.status !== "inactive",
    );
    const activeProducts = (mockData.products || [])
      .filter((product) => product.status !== "inactive")
      .sort(
        (a, b) =>
          new Date(b.updatedAt || 0).getTime() -
          new Date(a.updatedAt || 0).getTime(),
      );
    const productOptions = activeProducts.map((product) => ({
      value: product.id,
      label: product.name,
    }));
    const companyOptions = activeCompanies.map((company) => ({
      value: company.id,
      label: company.name,
    }));
    const supplierOptions = activeSuppliers.map((supplier) => ({
      value: supplier.id,
      label: supplier.name,
    }));
    const defaultCompanyId = companyOptions[0]?.value || "";
    const compactDate = new Date()
      .toLocaleDateString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\D/g, "");
    const inboundPrefix = `JH${compactDate}`;
    const existingInboundNumbers = new Set(
      (mockData.deliveryNotes || [])
        .map((note) => String(note.orderNo || ""))
        .filter((orderNo) => orderNo.startsWith(inboundPrefix)),
    );
    let inboundSequence = existingInboundNumbers.size + 1;
    let inboundOrderNo = `${inboundPrefix}${String(inboundSequence).padStart(4, "0")}`;
    while (existingInboundNumbers.has(inboundOrderNo)) {
      inboundSequence += 1;
      inboundOrderNo = `${inboundPrefix}${String(inboundSequence).padStart(4, "0")}`;
    }

    let rowSequence = 0;
    const createRow = () => ({
      id: String(++rowSequence),
      productValue: "",
      productName: "",
      category: "",
      unit: "",
      quantity: "",
      costPrice: "",
      retailPrice: "",
      minStock: "10",
      maxStock: "100",
      remark: "",
    });
    const batchRows = [createRow()];

    const content = `
      <form id="add-inbound-batch-form" class="space-y-4">
        <div class="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="flex items-start gap-3">
              <div class="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-green-100 bg-white">
                <i class="fa fa-truck text-lg text-green-600"></i>
              </div>
              <div>
                <div class="text-base font-semibold text-gray-900">批量新增进货</div>
                <div class="mt-0.5 text-sm text-gray-600">公司和供应商只选择一次，再连续添加本批进货商品。</div>
              </div>
            </div>
            <div class="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-green-700">进货单号：${escapeHTML(inboundOrderNo)}</div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 md:grid-cols-2">
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-gray-600">入库公司 <span class="text-danger">*</span></label>
            <div id="inbound-batch-company-container"></div>
            <input id="inbound-batch-company-id" type="hidden" value="${escapeHTML(defaultCompanyId)}">
          </div>
          <div>
            <label class="mb-1.5 block text-xs font-semibold text-gray-600">本批供应商 <span class="text-danger">*</span></label>
            <div id="inbound-batch-supplier-container"></div>
            <input id="inbound-batch-supplier-id" type="hidden">
          </div>
          <div class="md:col-span-2">
            <label class="mb-1.5 block text-xs font-semibold text-gray-600">整批备注</label>
            <input id="inbound-batch-remark" type="text" placeholder="如：9 月补货、采购单备注（选填）" class="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-primary">
          </div>
        </div>

        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="font-semibold text-gray-900">进货商品明细</div>
            <div id="inbound-batch-summary" class="text-xs text-gray-500">当前 1 条商品</div>
          </div>
          <button id="inbound-batch-add-row" type="button" class="rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">
            <i class="fa fa-plus mr-1.5"></i>继续添加商品
          </button>
        </div>

        <div id="inbound-batch-rows" class="space-y-3"></div>
      </form>
    `;

    const readRowFromDom = (row) => {
      const root = document.querySelector(`[data-inbound-row="${row.id}"]`);
      if (!root) return row;
      const read = (field) =>
        String(
          root.querySelector(`[data-field="${field}"]`)?.value || "",
        ).trim();
      const productInput = document.getElementById(
        `inbound-batch-product-${row.id}`,
      );
      const pendingProductName = String(
        document
          .getElementById(`inbound-batch-product-container-${row.id}`)
          ?.querySelector(".ant-select-selection-search-input")?.value || "",
      ).trim();
      row.productValue = String(
        productInput?.value || row.productValue || pendingProductName,
      ).trim();
      row.productName = row.productName || pendingProductName;
      [
        "category",
        "unit",
        "quantity",
        "costPrice",
        "retailPrice",
        "minStock",
        "maxStock",
        "remark",
      ].forEach((field) => {
        row[field] = read(field);
      });
      return row;
    };

    const syncAllRows = () => batchRows.forEach(readRowFromDom);

    const renderBatchRows = () => {
      const container = document.getElementById("inbound-batch-rows");
      if (!container) return;
      container
        .querySelectorAll('[id^="inbound-batch-product-container-"]')
        .forEach((productContainer) => productContainer._reactRoot?.unmount());
      container.innerHTML = batchRows
        .map(
          (row, index) => `
            <div data-inbound-row="${row.id}" class="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
              <div class="mb-3 flex items-center justify-between gap-3">
                <div class="font-semibold text-gray-800">商品 ${index + 1}</div>
                <button type="button" data-remove-inbound-row="${row.id}" class="${batchRows.length === 1 ? "invisible" : ""} rounded p-1.5 text-red-500 hover:bg-red-50" title="移除此商品">
                  <i class="fa fa-trash"></i>
                </button>
              </div>
              <div class="grid grid-cols-1 gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                <div class="xl:col-span-2">
                  <label class="mb-1 block text-xs font-semibold text-gray-500">商品名称 <span class="text-danger">*</span></label>
                  <div id="inbound-batch-product-container-${row.id}"></div>
                  <input id="inbound-batch-product-${row.id}" type="hidden" value="${escapeHTML(row.productValue)}">
                </div>
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-500">数量 <span class="text-danger">*</span></label>
                  <input data-field="quantity" type="number" min="1" step="1" value="${escapeHTML(row.quantity)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                </div>
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-500">进货单价 <span class="text-danger">*</span></label>
                  <input data-field="costPrice" type="number" min="0" step="0.01" value="${escapeHTML(row.costPrice)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                </div>
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-500">分类 <span class="text-danger">*</span></label>
                  <input data-field="category" type="text" value="${escapeHTML(row.category)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                </div>
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-500">单位 <span class="text-danger">*</span></label>
                  <input data-field="unit" type="text" value="${escapeHTML(row.unit)}" placeholder="个、件、箱" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                </div>
                <div>
                  <label class="mb-1 block text-xs font-semibold text-gray-500">销售单价 <span class="text-danger">*</span></label>
                  <input data-field="retailPrice" type="number" min="0" step="0.01" value="${escapeHTML(row.retailPrice)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="mb-1 block text-xs font-semibold text-gray-500">最低库存</label>
                    <input data-field="minStock" type="number" min="0" step="1" value="${escapeHTML(row.minStock)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-semibold text-gray-500">最高库存</label>
                    <input data-field="maxStock" type="number" min="1" step="1" value="${escapeHTML(row.maxStock)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  </div>
                </div>
                <div class="md:col-span-2 xl:col-span-4">
                  <label class="mb-1 block text-xs font-semibold text-gray-500">本商品备注</label>
                  <input data-field="remark" type="text" value="${escapeHTML(row.remark)}" class="w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                </div>
              </div>
            </div>
          `,
        )
        .join("");

      batchRows.forEach((row) => {
        renderAntdSelect(
          `inbound-batch-product-container-${row.id}`,
          `inbound-batch-product-${row.id}`,
          productOptions,
          {
            placeholder: "选择已有商品，或输入新商品名称",
            mode: "tags",
            virtual: false,
            controlSearchValue: true,
            keepSearchTextOnBlur: true,
            enableCreateOption: true,
            createOptionLabel: (text) => `新增 ${text}`,
            value: row.productValue || undefined,
            listHeight: 160,
          },
          (value) => {
            readRowFromDom(row);
            const normalizedValue = String(
              Array.isArray(value) ? value.at(-1) || "" : value || "",
            ).trim();
            const product = activeProducts.find(
              (item) => item.id === normalizedValue,
            );
            row.productValue = normalizedValue;
            row.productName = product?.name || normalizedValue;
            if (product) {
              row.category = product.category || "";
              row.unit = product.unit || "";
              row.costPrice = String(product.costPrice ?? "");
              row.retailPrice = String(product.retailPrice ?? "");
              row.minStock = String(product.minStock ?? 10);
              row.maxStock = String(product.maxStock ?? 100);
            } else {
              row.category = "";
              row.unit = "";
              row.costPrice = "";
              row.retailPrice = "";
              row.minStock = "10";
              row.maxStock = "100";
            }
            const root = document.querySelector(
              `[data-inbound-row="${row.id}"]`,
            );
            [
              "category",
              "unit",
              "costPrice",
              "retailPrice",
              "minStock",
              "maxStock",
            ].forEach((field) => {
              const input = root?.querySelector(`[data-field="${field}"]`);
              if (input) input.value = row[field];
            });
          },
        );

        const root = document.querySelector(`[data-inbound-row="${row.id}"]`);
        root?.querySelectorAll("[data-field]").forEach((input) => {
          input.addEventListener("input", () => readRowFromDom(row));
        });
      });

      container
        .querySelectorAll("[data-remove-inbound-row]")
        .forEach((button) => {
          button.addEventListener("click", () => {
            syncAllRows();
            const rowId = button.getAttribute("data-remove-inbound-row");
            const rowIndex = batchRows.findIndex((row) => row.id === rowId);
            if (rowIndex >= 0 && batchRows.length > 1)
              batchRows.splice(rowIndex, 1);
            renderBatchRows();
          });
        });

      const summary = document.getElementById("inbound-batch-summary");
      if (summary) summary.textContent = `当前 ${batchRows.length} 条商品`;
    };

    showBusinessEditor(
      "批量新增进货",
      content,
      async function onConfirm() {
        syncAllRows();
        const form = document.getElementById("add-inbound-batch-form");
        const companyId = String(
          document.getElementById("inbound-batch-company-id")?.value || "",
        ).trim();
        const supplierId = String(
          document.getElementById("inbound-batch-supplier-id")?.value || "",
        ).trim();
        const batchRemark = String(
          document.getElementById("inbound-batch-remark")?.value || "",
        ).trim();
        const company = activeCompanies.find((item) => item.id === companyId);
        const supplier = activeSuppliers.find((item) => item.id === supplierId);

        if (!company) {
          return formError(
            form,
            "#inbound-batch-company-container",
            "请选择有效的入库公司。",
          );
        }
        if (!supplier) {
          return formError(
            form,
            "#inbound-batch-supplier-container",
            "请选择本批进货的供应商。",
          );
        }

        const normalizedRows = [];
        const productKeys = new Set();
        for (let index = 0; index < batchRows.length; index += 1) {
          const row = batchRows[index];
          const selectedProduct = activeProducts.find(
            (item) => item.id === row.productValue,
          );
          const enteredProductName = String(
            selectedProduct?.name || row.productName || row.productValue,
          ).trim();
          const existingProduct =
            selectedProduct ||
            activeProducts.find(
              (item) =>
                String(item.name || "").toLocaleLowerCase("zh-CN") ===
                enteredProductName.toLocaleLowerCase("zh-CN"),
            );
          const productName = existingProduct?.name || enteredProductName;
          const quantity = Number(row.quantity);
          const costPrice = Number(row.costPrice);
          const retailPrice = Number(row.retailPrice);
          const minStock = Number(row.minStock);
          const maxStock = Number(row.maxStock);
          const lineNumber = index + 1;

          if (!productName) {
            return formError(
              form,
              `#inbound-batch-product-container-${row.id}`,
              `请为第 ${lineNumber} 行选择或输入商品名称。`,
            );
          }
          if (!row.category) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="category"]`,
              `请填写商品“${productName}”的分类。`,
            );
          }
          if (!row.unit) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="unit"]`,
              `请填写商品“${productName}”的单位。`,
            );
          }
          if (!Number.isInteger(quantity) || quantity <= 0) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="quantity"]`,
              `商品“${productName}”的数量必须是大于 0 的整数。`,
            );
          }
          if (!Number.isFinite(costPrice) || costPrice < 0) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="costPrice"]`,
              `商品“${productName}”的进货单价无效。`,
            );
          }
          if (!Number.isFinite(retailPrice) || retailPrice < 0) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="retailPrice"]`,
              `商品“${productName}”的销售单价无效。`,
            );
          }
          if (!Number.isInteger(minStock) || minStock < 0) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="minStock"]`,
              `商品“${productName}”的最低库存无效。`,
            );
          }
          if (!Number.isInteger(maxStock) || maxStock <= minStock) {
            return formError(
              form,
              `[data-inbound-row="${row.id}"] [data-field="maxStock"]`,
              `商品“${productName}”的最高库存必须大于最低库存。`,
            );
          }

          const productKey = existingProduct
            ? `id:${existingProduct.id}`
            : `name:${productName.toLocaleLowerCase("zh-CN")}`;
          if (productKeys.has(productKey)) {
            return formError(
              form,
              `#inbound-batch-product-container-${row.id}`,
              `商品“${productName}”在本批进货中重复，请合并为一行。`,
            );
          }
          productKeys.add(productKey);
          normalizedRows.push({
            ...row,
            selectedProduct: existingProduct,
            productName,
            quantity,
            costPrice,
            retailPrice,
            minStock,
            maxStock,
          });
        }

        const previousProducts = mockData.products.map((product) => ({
          ...product,
        }));
        const previousStockMovements = stockMovementData.slice();
        const previousDeliveryNotes = (mockData.deliveryNotes || []).slice();
        const now = new Date();
        const nowString = getLocalISOString();
        const warehouseId = getSingleWarehouseId();
        const locationCode = getSingleLocationCode(warehouseId);
        const purchaseNoteId = createRuntimeId("PD");
        const createdProductNames = [];
        const records = [];
        const details = [];

        normalizedRows.forEach((row) => {
          let product =
            mockData.products.find(
              (item) => item.id === row.selectedProduct?.id,
            ) ||
            mockData.products.find(
              (item) =>
                String(item.name || "").toLocaleLowerCase("zh-CN") ===
                row.productName.toLocaleLowerCase("zh-CN"),
            );
          if (!product) {
            product = {
              id: createSequentialId(mockData.products, "P"),
              name: row.productName,
              category: row.category,
              unit: row.unit,
              costPrice: row.costPrice,
              retailPrice: row.retailPrice,
              stockQuantity: 0,
              minStock: row.minStock,
              maxStock: row.maxStock,
              supplierId: supplier.id,
              status: "active",
              createdAt: nowString,
              updatedAt: nowString,
            };
            mockData.products.push(product);
            createdProductNames.push(product.name);
          } else {
            Object.assign(product, {
              name: row.productName,
              category: row.category,
              unit: row.unit,
              costPrice: row.costPrice,
              retailPrice: row.retailPrice,
              minStock: row.minStock,
              maxStock: row.maxStock,
              supplierId: supplier.id,
              status: "active",
              updatedAt: nowString,
            });
          }
          product.stockQuantity =
            Number(product.stockQuantity || 0) + row.quantity;

          const lineRemark = [batchRemark, row.remark]
            .filter(Boolean)
            .join(" / ");
          records.push({
            id: createRuntimeId("SM"),
            type: "inbound",
            status: "confirmed",
            productId: product.id,
            productName: product.name,
            quantity: row.quantity,
            unit: product.unit,
            supplierId: supplier.id,
            supplierName: supplier.name,
            companyId: company.id,
            companyName: company.name,
            price: row.costPrice,
            priceType: "custom",
            operator: currentUser.name,
            warehouseId,
            locationCode,
            batchNo: "",
            expiryDate: null,
            inboundOrderNo,
            orderNo: inboundOrderNo,
            deliveryNoteId: purchaseNoteId,
            remark: lineRemark || "-",
            createdAt: now,
            updatedAt: now,
          });
          details.push({
            id: createRuntimeId("PDD"),
            deliveryId: purchaseNoteId,
            productId: product.id,
            productName: product.name,
            productNameSnapshot: product.name,
            quantity: row.quantity,
            receivedQuantity: row.quantity,
            unit: product.unit,
            unitSnapshot: product.unit,
            unitPrice: row.costPrice,
            confirmedUnitPrice: row.costPrice,
            lineAmount: Math.round(row.quantity * row.costPrice * 100) / 100,
            totalAmount: Math.round(row.quantity * row.costPrice * 100) / 100,
            notes: row.remark || "",
            status: "received",
          });
        });

        const totalAmount =
          Math.round(
            details.reduce((total, detail) => total + detail.lineAmount, 0) *
              100,
          ) / 100;
        if (!Array.isArray(mockData.deliveryNotes)) mockData.deliveryNotes = [];
        mockData.deliveryNotes.unshift({
          id: purchaseNoteId,
          type: "purchase",
          orderNo: inboundOrderNo,
          issueDate: compactDate,
          deliveryDate: compactDate,
          status: "received",
          supplierId: supplier.id,
          supplierName: supplier.name,
          companyId: company.id,
          companyName: company.name,
          warehouseId,
          subtotal: totalAmount,
          taxAmount: 0,
          totalAmount,
          notes: batchRemark,
          createdAt: now,
          updatedAt: now,
          details,
        });
        stockMovementData.unshift(...records);

        const auditLogs = stageAuditLogs([
          ...createdProductNames.map((productName) => ({
            actionType: "add",
            objectType: "product",
            objectName: productName,
            details: `批量进货自动创建商品：${inboundOrderNo}`,
          })),
          {
            actionType: "add",
            objectType: "delivery-note",
            objectName: inboundOrderNo,
            details: `批量进货：${supplier.name} / ${records.length} 种商品`,
          },
        ]);
        const saved = await saveMockData();
        if (saved === false) {
          rollbackStagedAuditLogs(auditLogs);
          mockData.products = previousProducts;
          mockData.deliveryNotes = previousDeliveryNotes;
          stockMovementData = previousStockMovements;
          refreshActiveStockTable();
          updateInventoryTable();
          updateSupplierTable();
          renderDashboardActivity();
          alert("批量进货保存失败，本批商品和库存变更已全部回滚。");
          return false;
        }

        finalizeStagedAuditLogs(auditLogs);
        refreshActiveStockTable();
        updateInventoryTable();
        updateSupplierTable();
        renderDashboardActivity();
        const totalQuantity = normalizedRows.reduce(
          (total, row) => total + row.quantity,
          0,
        );
        alert(
          `本批进货已保存：${normalizedRows.length} 种商品，合计数量 ${totalQuantity}（单位以各商品明细为准）。`,
        );
        return true;
      },
      {
        confirmText: "整批入库并返回",
        allowContinue: true,
        continueText: "入库并继续下一批",
        onContinue: showAddBatchInboundModal,
      },
    );

    const modalPanel = document.getElementById("modal-panel");
    const modalContent = document.getElementById("modal-content");
    const confirmButton = document.getElementById("modal-confirm");
    const cancelButton = document.getElementById("modal-cancel");
    if (modalPanel) {
      modalPanel.className = "bg-white rounded-lg shadow-xl w-full mx-3";
      modalPanel.style.maxWidth = "1180px";
    }
    if (modalContent) {
      modalContent.className =
        "p-3 md:p-4 max-h-[78vh] overflow-y-auto overflow-x-hidden";
    }
    if (confirmButton) confirmButton.textContent = "整批入库并返回";
    global.configureBusinessFormPage?.("整批入库并返回");
    if (cancelButton) {
      cancelButton.classList.remove("hidden");
      cancelButton.textContent = "取消";
    }

    renderAntdSelect(
      "inbound-batch-company-container",
      "inbound-batch-company-id",
      companyOptions,
      {
        placeholder: "请选择入库公司",
        value: defaultCompanyId || undefined,
      },
    );
    renderAntdSelect(
      "inbound-batch-supplier-container",
      "inbound-batch-supplier-id",
      supplierOptions,
      { placeholder: "请选择本批供应商" },
    );
    document
      .getElementById("inbound-batch-add-row")
      ?.addEventListener("click", () => {
        syncAllRows();
        batchRows.push(createRow());
        renderBatchRows();
      });
    renderBatchRows();
  }

  global.showAddInboundModal = showAddBatchInboundModal;
  global.showAddOutboundModal = showAddOutboundModal;

  global.AppStockModule = Object.freeze({
    deleteStockMovement,
    renderDashboardActivity,
    getInitial,
    renderStockMovementTable,
    addInboundRecord,
    showAddInboundModal: showAddBatchInboundModal,
    showSingleInboundModal: showAddInboundModal,
    showAddOutboundModal,
  });
})(window);
