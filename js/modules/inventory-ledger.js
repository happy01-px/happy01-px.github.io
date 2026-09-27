(function initInventoryLedger(global) {
  let cachedMovementData = null;
  let cachedMovementSignature = "";
  let cachedInventoryIndex = null;

  function getMovementSignature(records) {
    const first = records[0];
    const last = records[records.length - 1];
    return [
      records.length,
      first?.id || "",
      first?.updatedAt || "",
      first?.quantity || "",
      last?.id || "",
      last?.updatedAt || "",
      last?.quantity || "",
    ].join(":");
  }

  function getInventoryIndex() {
    const records = Array.isArray(global.stockMovementData)
      ? global.stockMovementData
      : [];
    const signature = getMovementSignature(records);
    if (
      cachedMovementData !== records ||
      cachedMovementSignature !== signature ||
      !cachedInventoryIndex
    ) {
      cachedMovementData = records;
      cachedMovementSignature = signature;
      cachedInventoryIndex = global.InventoryCore.buildInventoryIndex(records);
    }
    return cachedInventoryIndex;
  }

  function invalidateInventoryLedgerIndex() {
    cachedMovementData = null;
    cachedMovementSignature = "";
    cachedInventoryIndex = null;
  }

  function getWarehouses() {
    return Array.isArray(global.mockData?.warehouses)
      ? global.mockData.warehouses
      : [];
  }

  function getActiveWarehouses() {
    return getWarehouses().filter(
      (warehouse) => warehouse.status !== "inactive",
    );
  }

  function getDefaultWarehouse() {
    return (
      getActiveWarehouses()[0] ||
      getWarehouses()[0] ||
      global.AppDataSchema?.DEFAULT_WAREHOUSE ||
      null
    );
  }

  function getDefaultWarehouseId() {
    return (
      getDefaultWarehouse()?.id ||
      global.AppDataSchema?.DEFAULT_WAREHOUSE_ID ||
      "WH001"
    );
  }

  function getDefaultLocationCode(warehouseId = getDefaultWarehouseId()) {
    const warehouse = getWarehouses().find(
      (entry) => String(entry.id) === String(warehouseId),
    );
    return warehouse?.locations?.[0]?.code || "";
  }

  function getLedgerQuantity(productId, warehouseId = "", dimensions = {}) {
    return global.InventoryCore.getIndexedQuantity(
      getInventoryIndex(),
      productId,
      {
        ...dimensions,
        warehouseId,
      },
    );
  }

  function getInventoryConsistencyReport() {
    return global.InventoryCore.createConsistencyReport(
      global.mockData?.products,
      global.stockMovementData,
    );
  }

  function syncProductStockFromLedger() {
    const report = getInventoryConsistencyReport();
    if (report.negativeLedgers.length > 0) return report;
    const timestamp =
      typeof global.getLocalISOString === "function"
        ? global.getLocalISOString()
        : new Date().toISOString();
    report.mismatches.forEach((row) => {
      const product = global.mockData.products.find(
        (entry) => String(entry.id) === String(row.productId),
      );
      if (!product) return;
      product.stockQuantity = row.ledgerQuantity;
      product.updatedAt = timestamp;
    });
    return report;
  }

  function renderWarehouseInventoryControls() {
    const report = getInventoryConsistencyReport();
    const status = document.getElementById("inventory-ledger-status");
    if (status) {
      status.textContent = report.isConsistent
        ? `账实一致 · ${report.checkedProducts} 项商品`
        : `发现 ${report.mismatches.length} 项库存差异`;
      status.className = report.isConsistent
        ? "text-sm font-medium text-green-700"
        : "text-sm font-medium text-red-600";
    }
  }

  function refreshStockViews() {
    renderWarehouseInventoryControls();
    global.updateInventoryTable?.();
    global.renderStockMovementTable?.();
    global.renderDashboardActivity?.();
  }

  function showInventoryReconciliation() {
    const report = getInventoryConsistencyReport();
    const rows = report.mismatches
      .map(
        (row) => `
          <tr>
            <td class="px-3 py-2">${global.escapeHTML(row.productName)}</td>
            <td class="px-3 py-2 text-right">${row.cachedQuantity}</td>
            <td class="px-3 py-2 text-right">${row.ledgerQuantity}</td>
            <td class="px-3 py-2 text-right font-semibold ${row.difference === 0 ? "text-green-600" : "text-red-600"}">${row.difference}</td>
          </tr>`,
      )
      .join("");
    const content = report.isConsistent
      ? `<div class="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800">已核对 ${report.checkedProducts} 项商品，商品库存与流水账本一致。</div>`
      : `
        <div class="space-y-3">
          <div class="rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">流水是库存账本依据。修复后会用流水汇总数覆盖商品库存缓存。</div>
          <div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead><tr><th class="px-3 py-2 text-left">商品</th><th class="px-3 py-2 text-right">缓存</th><th class="px-3 py-2 text-right">账本</th><th class="px-3 py-2 text-right">差异</th></tr></thead>
            <tbody class="divide-y divide-gray-100">${rows}</tbody>
          </table></div>
        </div>`;

    global.showModal?.("库存账实核对", content, async () => {
      if (report.isConsistent) return true;
      if (report.negativeLedgers.length > 0) {
        global.alert("流水账本存在负库存，请先补录入库或撤销错误出库。");
        return false;
      }
      const previousProducts = global.deepClone(global.mockData.products);
      const repaired = syncProductStockFromLedger();
      const auditLogs = global.stageAuditLogs({
        actionType: "edit",
        objectType: "inventory",
        objectName: "库存账实核对",
        details: `按流水账本修复 ${repaired.mismatches.length} 项库存差异`,
      });
      const saved = await global.saveMockData();
      if (!saved) {
        global.mockData.products = previousProducts;
        global.rollbackStagedAuditLogs(auditLogs);
        global.alert("库存修复保存失败，已恢复原数据。");
        return false;
      }
      global.finalizeStagedAuditLogs(auditLogs);
      refreshStockViews();
      global.alert("库存缓存已按流水账本修复。");
      return true;
    });
    const confirmButton = document.getElementById("modal-confirm");
    if (confirmButton) {
      confirmButton.textContent = report.isConsistent ? "关闭" : "按账本修复";
    }
    if (report.isConsistent) {
      document.getElementById("modal-cancel")?.classList.add("hidden");
    }
  }

  function showAddWarehouseModal() {
    const content = `
      <form id="add-warehouse-form" class="app-modal-form-grid">
        <div><label class="block text-sm font-medium text-gray-700 mb-1">仓库编码 *</label><input name="code" required class="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="如 WH-SZ"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">仓库名称 *</label><input name="name" required class="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="如 深圳仓"></div>
        <div class="app-modal-wide-field"><label class="block text-sm font-medium text-gray-700 mb-1">默认库位编码 *</label><input name="locationCode" required class="w-full border border-gray-300 rounded-md px-3 py-2" placeholder="如 A01"></div>
      </form>`;
    global.showModal?.("新增仓库", content, async () => {
      const data = new FormData(
        /** @type {HTMLFormElement} */ (
          document.getElementById("add-warehouse-form")
        ),
      );
      const code = String(data.get("code") || "")
        .trim()
        .toUpperCase();
      const name = String(data.get("name") || "").trim();
      const locationCode = String(data.get("locationCode") || "")
        .trim()
        .toUpperCase();
      if (!code || !name || !locationCode) {
        global.alert("请完整填写仓库和默认库位信息。");
        return false;
      }
      if (getWarehouses().some((warehouse) => warehouse.code === code)) {
        global.alert("仓库编码已存在。");
        return false;
      }
      const now = global.getLocalISOString();
      const warehouse = {
        id: global.createSequentialId(getWarehouses(), "WH"),
        code,
        name,
        status: "active",
        locations: [{ code: locationCode, name: "默认库位" }],
        createdAt: now,
        updatedAt: now,
      };
      global.mockData.warehouses.push(warehouse);
      const auditLogs = global.stageAuditLogs({
        actionType: "add",
        objectType: "warehouse",
        objectName: name,
        details: `新增仓库 ${code}，默认库位 ${locationCode}`,
      });
      const saved = await global.saveMockData();
      if (!saved) {
        global.mockData.warehouses = getWarehouses().filter(
          (entry) => entry !== warehouse,
        );
        global.rollbackStagedAuditLogs(auditLogs);
        return false;
      }
      global.finalizeStagedAuditLogs(auditLogs);
      renderWarehouseInventoryControls();
      global.alert("仓库创建成功。");
      return true;
    });
  }

  function showTransferStockModal() {
    const warehouses = getActiveWarehouses();
    if (warehouses.length < 2) {
      global.alert("至少需要两个启用中的仓库才能进行调拨。");
      return;
    }
    const warehouseOptions = warehouses
      .map(
        (warehouse) =>
          `<option value="${global.escapeHTML(warehouse.id)}">${global.escapeHTML(warehouse.name)}</option>`,
      )
      .join("");
    const productOptions = (global.mockData.products || [])
      .filter((product) => product.status !== "inactive")
      .map(
        (product) =>
          `<option value="${global.escapeHTML(product.id)}">${global.escapeHTML(product.name)}</option>`,
      )
      .join("");
    const content = `
      <form id="warehouse-transfer-form" class="app-modal-form-grid">
        <div class="app-modal-wide-field"><label class="block text-sm font-medium text-gray-700 mb-1">商品 *</label><select name="productId" required class="w-full border border-gray-300 rounded-md px-3 py-2">${productOptions}</select></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">调出仓 *</label><select name="fromWarehouseId" required class="w-full border border-gray-300 rounded-md px-3 py-2">${warehouseOptions}</select></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">调入仓 *</label><select name="toWarehouseId" required class="w-full border border-gray-300 rounded-md px-3 py-2">${warehouseOptions}</select></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">数量 *</label><input name="quantity" type="number" min="1" step="1" required class="w-full border border-gray-300 rounded-md px-3 py-2"></div>
        <div><label class="block text-sm font-medium text-gray-700 mb-1">批次</label><input name="batchNo" class="w-full border border-gray-300 rounded-md px-3 py-2"></div>
      </form>`;
    global.showModal?.("仓间调拨", content, async () => {
      const data = new FormData(
        /** @type {HTMLFormElement} */ (
          document.getElementById("warehouse-transfer-form")
        ),
      );
      const productId = String(data.get("productId") || "");
      const fromWarehouseId = String(data.get("fromWarehouseId") || "");
      const toWarehouseId = String(data.get("toWarehouseId") || "");
      const quantity = Number(data.get("quantity"));
      const batchNo = String(data.get("batchNo") || "").trim();
      if (fromWarehouseId === toWarehouseId) {
        global.alert("调出仓和调入仓不能相同。");
        return false;
      }
      if (!Number.isInteger(quantity) || quantity <= 0) {
        global.alert("请输入有效的调拨数量。");
        return false;
      }
      const availableStock = getLedgerQuantity(productId, fromWarehouseId, {
        batchNo,
      });
      if (availableStock < quantity) {
        global.alert(
          `${batchNo ? `批次 ${batchNo}` : "调出仓"}可用库存不足，当前为 ${availableStock}。`,
        );
        return false;
      }
      const product = global.mockData.products.find(
        (entry) => String(entry.id) === productId,
      );
      if (!product) return false;
      const now = new Date();
      const transferId = global.createRuntimeId("TR");
      const shared = {
        status: "confirmed",
        productId,
        productName: product.name,
        quantity,
        unit: product.unit,
        batchNo,
        expiryDate: null,
        transferId,
        operator: global.currentUser.name,
        remark: `仓间调拨 ${transferId}`,
        createdAt: now,
        updatedAt: now,
      };
      const movements = [
        {
          ...shared,
          id: global.createRuntimeId("SM"),
          type: "transfer_out",
          warehouseId: fromWarehouseId,
          locationCode: getDefaultLocationCode(fromWarehouseId),
        },
        {
          ...shared,
          id: global.createRuntimeId("SM"),
          type: "transfer_in",
          warehouseId: toWarehouseId,
          locationCode: getDefaultLocationCode(toWarehouseId),
        },
      ];
      global.stockMovementData.unshift(...movements);
      invalidateInventoryLedgerIndex();
      const auditLogs = global.stageAuditLogs({
        actionType: "add",
        objectType: "stock_transfer",
        objectName: transferId,
        details: `${product.name} 调拨 ${quantity} ${product.unit}`,
      });
      const saved = await global.saveMockData();
      if (!saved) {
        const movementIds = new Set(movements.map((movement) => movement.id));
        global.stockMovementData = global.stockMovementData.filter(
          (movement) => !movementIds.has(movement.id),
        );
        invalidateInventoryLedgerIndex();
        global.rollbackStagedAuditLogs(auditLogs);
        return false;
      }
      global.finalizeStagedAuditLogs(auditLogs);
      refreshStockViews();
      global.alert("仓间调拨完成。");
      return true;
    });
  }

  global.getDefaultWarehouseId = getDefaultWarehouseId;
  global.getDefaultLocationCode = getDefaultLocationCode;
  global.getLedgerQuantity = getLedgerQuantity;
  global.invalidateInventoryLedgerIndex = invalidateInventoryLedgerIndex;
  global.getInventoryConsistencyReport = getInventoryConsistencyReport;
  global.syncProductStockFromLedger = syncProductStockFromLedger;
  global.renderWarehouseInventoryControls = renderWarehouseInventoryControls;
  global.showInventoryReconciliation = showInventoryReconciliation;
  global.showAddWarehouseModal = showAddWarehouseModal;
  global.showTransferStockModal = showTransferStockModal;
  global.InventoryLedger = Object.freeze({
    getWarehouses,
    getActiveWarehouses,
    getDefaultWarehouse,
    getDefaultWarehouseId,
    getDefaultLocationCode,
    getLedgerQuantity,
    invalidateInventoryLedgerIndex,
    getInventoryConsistencyReport,
    syncProductStockFromLedger,
  });
})(window);
