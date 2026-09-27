(function initInventoryCore(/** @type {any} */ root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) root.InventoryCore = api;
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function createInventoryCore() {
    const OUTBOUND_TYPES = new Set([
      "outbound",
      "adjustment_out",
      "transfer_out",
    ]);

    function getMovementDelta(record) {
      if (!record || record.status === "voided") return 0;
      const quantity = Number(record.quantity) || 0;
      return OUTBOUND_TYPES.has(record.type) ? -quantity : quantity;
    }

    function buildInventoryIndex(records) {
      const byProduct = new Map();
      const byWarehouse = new Map();
      const byLocation = new Map();
      const byBatch = new Map();

      (Array.isArray(records) ? records : []).forEach((record) => {
        const productId = String(record?.productId || "");
        if (!productId) return;
        const warehouseId = String(record.warehouseId || "WH001");
        const locationCode = String(record.locationCode || "");
        const batchNo = String(record.batchNo || "");
        const delta = getMovementDelta(record);

        byProduct.set(productId, (byProduct.get(productId) || 0) + delta);
        const warehouseKey = `${productId}::${warehouseId}`;
        byWarehouse.set(
          warehouseKey,
          (byWarehouse.get(warehouseKey) || 0) + delta,
        );
        if (locationCode) {
          const locationKey = `${warehouseKey}::${locationCode}`;
          byLocation.set(
            locationKey,
            (byLocation.get(locationKey) || 0) + delta,
          );
        }
        if (batchNo) {
          const batchKey = `${warehouseKey}::${batchNo}`;
          byBatch.set(batchKey, (byBatch.get(batchKey) || 0) + delta);
        }
      });

      return { byProduct, byWarehouse, byLocation, byBatch };
    }

    function getIndexedQuantity(index, productId, dimensions = {}) {
      const normalizedProductId = String(productId || "");
      const warehouseId = String(dimensions.warehouseId || "");
      const locationCode = String(dimensions.locationCode || "");
      const batchNo = String(dimensions.batchNo || "");
      if (warehouseId && batchNo) {
        return (
          index.byBatch.get(
            `${normalizedProductId}::${warehouseId}::${batchNo}`,
          ) || 0
        );
      }
      if (warehouseId && locationCode) {
        return (
          index.byLocation.get(
            `${normalizedProductId}::${warehouseId}::${locationCode}`,
          ) || 0
        );
      }
      if (warehouseId) {
        return (
          index.byWarehouse.get(`${normalizedProductId}::${warehouseId}`) || 0
        );
      }
      return index.byProduct.get(normalizedProductId) || 0;
    }

    function hydrateProductStock(products, records) {
      const index = buildInventoryIndex(records);
      return (Array.isArray(products) ? products : []).map((product) => {
        const hydratedProduct = { ...product };
        Object.defineProperty(hydratedProduct, "stockQuantity", {
          configurable: true,
          enumerable: false,
          value: getIndexedQuantity(index, product.id),
          writable: true,
        });
        return hydratedProduct;
      });
    }

    function stripDerivedStock(products) {
      return (Array.isArray(products) ? products : []).map((product) => {
        const persistedProduct = { ...product };
        delete persistedProduct.stockQuantity;
        return persistedProduct;
      });
    }

    function createConsistencyReport(products, records) {
      const index = buildInventoryIndex(records);
      const rows = (Array.isArray(products) ? products : []).map((product) => {
        const cachedQuantity = Number(product.stockQuantity) || 0;
        const ledgerQuantity = getIndexedQuantity(index, product.id);
        return {
          productId: product.id,
          productName: product.name,
          cachedQuantity,
          ledgerQuantity,
          difference: cachedQuantity - ledgerQuantity,
          repairable: ledgerQuantity >= 0,
        };
      });
      const mismatches = rows.filter((row) => row.difference !== 0);
      return {
        checkedProducts: rows.length,
        mismatches,
        negativeLedgers: rows.filter((row) => row.ledgerQuantity < 0),
        isConsistent: mismatches.length === 0,
      };
    }

    return Object.freeze({
      getMovementDelta,
      buildInventoryIndex,
      getIndexedQuantity,
      hydrateProductStock,
      stripDerivedStock,
      createConsistencyReport,
    });
  },
);
