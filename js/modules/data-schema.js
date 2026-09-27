(function initDataSchema(/** @type {any} */ root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.AppDataSchema = api;
  }
})(
  typeof globalThis !== "undefined" ? globalThis : this,
  function createSchema() {
    const DATA_FORMAT_VERSION = 4;
    const DEFAULT_WAREHOUSE_ID = "WH001";
    const DEFAULT_LOCATION_CODE = "A01";
    const DEFAULT_WAREHOUSE = Object.freeze({
      id: DEFAULT_WAREHOUSE_ID,
      code: "MAIN",
      name: "主仓库",
      status: "active",
      locations: Object.freeze([
        Object.freeze({ code: DEFAULT_LOCATION_CODE, name: "默认库位" }),
      ]),
      createdAt: "2026-01-01T00:00:00",
      updatedAt: "2026-01-01T00:00:00",
    });
    const DATA_TABLES = Object.freeze([
      "products",
      "suppliers",
      "customers",
      "customerProductPrices",
      "companies",
      "warehouses",
      "bills",
      "deliveryNotes",
      "stockMovements",
      "logs",
    ]);
    const PARTY_STATUS = new Set(["active", "inactive"]);
    const PRICE_TAX_MODE = new Set(["exclusive", "inclusive"]);
    const MOVEMENT_TYPE = new Set([
      "inbound",
      "outbound",
      "opening",
      "adjustment_in",
      "adjustment_out",
      "transfer_in",
      "transfer_out",
    ]);
    const MOVEMENT_STATUS = new Set(["draft", "confirmed", "voided"]);
    const DELIVERY_TYPE = new Set(["sales", "purchase"]);
    const DELIVERY_STATUS = new Set([
      "draft",
      "created",
      "confirmed",
      "received",
      "completed",
      "voided",
      "cancelled",
    ]);
    const BILL_TYPE = new Set(["customer", "supplier"]);
    const BILL_STATUS = new Set([
      "pending_check",
      "pending_payment",
      "partial_paid",
      "paid",
      "cancelled",
      "pending",
      "created",
      "draft",
      "verified",
      "sent",
      "partial",
      "confirmed",
      "canceled",
    ]);
    const AUDIT_ACTION = new Set([
      "add",
      "edit",
      "delete",
      "cancel",
      "import",
      "export",
    ]);

    function isPlainObject(value) {
      return (
        !!value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        Object.prototype.toString.call(value) === "[object Object]"
      );
    }

    function isNonEmptyString(value) {
      return typeof value === "string" && value.trim().length > 0;
    }

    function isFiniteNumber(value) {
      return typeof value === "number" && Number.isFinite(value);
    }

    function isDateLike(value) {
      return (
        (typeof value === "string" || value instanceof Date) &&
        !Number.isNaN(new Date(value).getTime())
      );
    }

    function requiredString(record, key, label) {
      return isNonEmptyString(record[key])
        ? null
        : `${label}.${key} must be a non-empty string`;
    }

    function optionalString(record, key, label) {
      return record[key] === undefined ||
        record[key] === null ||
        typeof record[key] === "string"
        ? null
        : `${label}.${key} must be a string`;
    }

    function requiredNumber(record, key, label, options = {}) {
      const value = record[key];
      if (!isFiniteNumber(value))
        return `${label}.${key} must be a finite number`;
      if (options.integer && !Number.isInteger(value)) {
        return `${label}.${key} must be an integer`;
      }
      if (options.min !== undefined && value < options.min) {
        return `${label}.${key} must be at least ${options.min}`;
      }
      return null;
    }

    function optionalNumber(record, key, label, options = {}) {
      if (record[key] === undefined || record[key] === null) return null;
      return requiredNumber(record, key, label, options);
    }

    function optionalArray(record, key, label) {
      return record[key] === undefined || Array.isArray(record[key])
        ? null
        : `${label}.${key} must be an array`;
    }

    function requiredDate(record, key, label) {
      return isDateLike(record[key])
        ? null
        : `${label}.${key} must be a valid date`;
    }

    function optionalDate(record, key, label) {
      return record[key] === undefined ||
        record[key] === null ||
        record[key] === "-" ||
        isDateLike(record[key])
        ? null
        : `${label}.${key} must be a valid date`;
    }

    function enumValue(record, key, label, allowed, options = {}) {
      if (
        options.optional &&
        (record[key] === undefined || record[key] === null)
      ) {
        return null;
      }
      return allowed.has(record[key])
        ? null
        : `${label}.${key} has an unsupported value`;
    }

    function firstError(checks) {
      for (const check of checks) {
        if (check) return check;
      }
      return null;
    }

    function validateProduct(record, label) {
      const error = firstError([
        requiredString(record, "id", label),
        requiredString(record, "name", label),
        requiredString(record, "category", label),
        requiredString(record, "unit", label),
        requiredString(record, "supplierId", label),
        requiredNumber(record, "costPrice", label, { min: 0 }),
        requiredNumber(record, "retailPrice", label, { min: 0 }),
        requiredNumber(record, "minStock", label, { min: 0, integer: true }),
        requiredNumber(record, "maxStock", label, { min: 1, integer: true }),
        enumValue(record, "status", label, PARTY_STATUS, { optional: true }),
        optionalString(record, "notes", label),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
      ]);
      if (error) return error;
      if (Object.prototype.hasOwnProperty.call(record, "stockQuantity")) {
        return `${label}.stockQuantity is derived from stockMovements and must not be persisted`;
      }
      if (record.maxStock <= record.minStock) {
        return `${label}.maxStock must be greater than minStock`;
      }
      return null;
    }

    function validateParty(record, label, needsPaymentTerms) {
      const checks = [
        requiredString(record, "id", label),
        requiredString(record, "name", label),
        requiredString(record, "contactPerson", label),
        requiredString(record, "contactPhone", label),
        requiredString(record, "address", label),
        optionalString(record, "email", label),
        enumValue(record, "status", label, PARTY_STATUS),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
      ];
      if (needsPaymentTerms) {
        checks.push(
          requiredString(record, "paymentTerms", label),
          requiredNumber(record, "creditLimit", label, { min: 0 }),
        );
      }
      if (
        record.hasTaxRate !== undefined &&
        typeof record.hasTaxRate !== "boolean"
      ) {
        checks.push(`${label}.hasTaxRate must be a boolean`);
      }
      if (
        record.taxRateCoefficient !== undefined &&
        record.taxRateCoefficient !== null
      ) {
        checks.push(
          optionalNumber(record, "taxRateCoefficient", label, { min: 0 }),
        );
      }
      if (
        record.defaultTaxRate !== undefined &&
        record.defaultTaxRate !== null
      ) {
        checks.push(
          optionalNumber(record, "defaultTaxRate", label, { min: 0 }),
        );
        if (Number(record.defaultTaxRate) > 1) {
          checks.push(`${label}.defaultTaxRate must not exceed 1`);
        }
      }
      if (record.priceTaxMode !== undefined) {
        checks.push(
          enumValue(record, "priceTaxMode", label, PRICE_TAX_MODE, {
            optional: true,
          }),
        );
      }
      return firstError(checks);
    }

    function validateCustomerProductPrice(record, label) {
      const error = firstError([
        requiredString(record, "id", label),
        requiredString(record, "companyId", label),
        requiredString(record, "customerId", label),
        requiredString(record, "productId", label),
        requiredNumber(record, "referencePrice", label, { min: 0 }),
        enumValue(record, "priceTaxMode", label, PRICE_TAX_MODE),
        enumValue(record, "status", label, PARTY_STATUS),
        optionalString(record, "remark", label),
        optionalDate(record, "effectiveFrom", label),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
      ]);
      return error;
    }

    function validateWarehouse(record, label) {
      const error = firstError([
        requiredString(record, "id", label),
        requiredString(record, "code", label),
        requiredString(record, "name", label),
        enumValue(record, "status", label, PARTY_STATUS),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
        Array.isArray(record.locations)
          ? null
          : `${label}.locations must be an array`,
      ]);
      if (error) return error;

      const locationCodes = new Set();
      for (let index = 0; index < record.locations.length; index += 1) {
        const location = record.locations[index];
        const locationLabel = `${label}.locations[${index}]`;
        if (!isPlainObject(location))
          return `${locationLabel} must be an object`;
        const locationError = firstError([
          requiredString(location, "code", locationLabel),
          requiredString(location, "name", locationLabel),
        ]);
        if (locationError) return locationError;
        if (locationCodes.has(location.code)) {
          return `${label}.locations contains duplicate code: ${location.code}`;
        }
        locationCodes.add(location.code);
      }
      return null;
    }

    function validateStockMovement(record, label) {
      return firstError([
        requiredString(record, "id", label),
        enumValue(record, "type", label, MOVEMENT_TYPE),
        enumValue(record, "status", label, MOVEMENT_STATUS, { optional: true }),
        requiredString(record, "productId", label),
        requiredString(record, "productName", label),
        requiredString(record, "unit", label),
        requiredString(record, "operator", label),
        requiredString(record, "warehouseId", label),
        optionalString(record, "locationCode", label),
        optionalString(record, "batchNo", label),
        optionalDate(record, "expiryDate", label),
        optionalString(record, "transferId", label),
        optionalString(record, "remark", label),
        requiredNumber(record, "quantity", label, { min: 1 }),
        optionalNumber(record, "price", label, { min: 0 }),
        optionalString(record, "supplierId", label),
        optionalString(record, "customerId", label),
        optionalString(record, "companyId", label),
        optionalString(record, "deliveryNoteId", label),
        optionalString(record, "inboundOrderNo", label),
        optionalString(record, "orderNo", label),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
      ]);
    }

    function validateDeliveryDetail(detail, label) {
      return firstError([
        requiredString(detail, "id", label),
        requiredString(detail, "productId", label),
        requiredNumber(detail, "quantity", label, { min: 1 }),
        optionalNumber(detail, "unitPrice", label, { min: 0 }),
        optionalNumber(detail, "confirmedUnitPrice", label, { min: 0 }),
        optionalNumber(detail, "referencePriceSnapshot", label, { min: 0 }),
        optionalNumber(detail, "referencePriceOriginalSnapshot", label, {
          min: 0,
        }),
        optionalNumber(detail, "lastTransactionPriceSnapshot", label, {
          min: 0,
        }),
        optionalNumber(detail, "taxRateSnapshot", label, { min: 0 }),
        optionalNumber(detail, "totalAmount", label, { min: 0 }),
        optionalNumber(detail, "lineAmount", label, { min: 0 }),
        optionalNumber(detail, "receivedQuantity", label, { min: 0 }),
        optionalString(detail, "productName", label),
        optionalString(detail, "productNameSnapshot", label),
        optionalString(detail, "unit", label),
        optionalString(detail, "unitSnapshot", label),
        optionalString(detail, "specificationSnapshot", label),
        optionalString(detail, "priceSource", label),
        optionalString(detail, "referencePriceTaxModeSnapshot", label),
        optionalString(detail, "notes", label),
        optionalString(detail, "status", label),
      ]);
    }

    function validateDeliveryNote(record, label) {
      const type = record.type || "purchase";
      const error = firstError([
        requiredString(record, "id", label),
        enumValue({ type }, "type", label, DELIVERY_TYPE),
        enumValue(record, "status", label, DELIVERY_STATUS),
        requiredNumber(record, "totalAmount", label, { min: 0 }),
        optionalNumber(record, "subtotal", label, { min: 0 }),
        optionalNumber(record, "taxAmount", label, { min: 0 }),
        optionalNumber(record, "taxRateSnapshot", label, { min: 0 }),
        optionalString(record, "warehouseId", label),
        optionalString(record, "notes", label),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
        Array.isArray(record.details)
          ? null
          : `${label}.details must be an array`,
      ]);
      if (error) return error;
      if (
        record.priceTaxModeSnapshot !== undefined &&
        !PRICE_TAX_MODE.has(record.priceTaxModeSnapshot)
      ) {
        return `${label}.priceTaxModeSnapshot has an unsupported value`;
      }
      if (type === "sales") {
        const salesError = firstError([
          requiredString(record, "orderNo", label),
          requiredString(record, "companyId", label),
          requiredString(record, "customerId", label),
        ]);
        if (salesError) return salesError;
      } else if (!isNonEmptyString(record.supplierId)) {
        return `${label}.supplierId must be a non-empty string`;
      }
      for (let index = 0; index < record.details.length; index += 1) {
        if (!isPlainObject(record.details[index]))
          return `${label}.details[${index}] must be an object`;
        const detailError = validateDeliveryDetail(
          record.details[index],
          `${label}.details[${index}]`,
        );
        if (detailError) return detailError;
      }
      return null;
    }

    function validateBill(record, label) {
      const statementType = record.statementType || record.type;
      const partyId = record.partyId || record.relatedId;
      const error = firstError([
        requiredString(record, "id", label),
        enumValue({ statementType }, "statementType", label, BILL_TYPE),
        isNonEmptyString(partyId)
          ? null
          : `${label}.partyId must be a non-empty string`,
        enumValue(record, "status", label, BILL_STATUS),
        optionalNumber(record, "totalAmount", label, { min: 0 }),
        optionalNumber(record, "billAmount", label, { min: 0 }),
        optionalNumber(record, "currentAmount", label, { min: 0 }),
        optionalNumber(record, "amountWithTax", label, { min: 0 }),
        optionalNumber(record, "arrearsAmount", label, { min: 0 }),
        optionalNumber(record, "taxRate", label, { min: 0 }),
        optionalArray(record, "details", label),
        optionalArray(record, "arrears", label),
        optionalArray(record, "payments", label),
        optionalArray(record, "sourceDocumentIds", label),
        optionalDate(record, "statementDate", label),
        optionalDate(record, "periodStart", label),
        optionalDate(record, "periodEnd", label),
        requiredDate(record, "createdAt", label),
        requiredDate(record, "updatedAt", label),
      ]);
      if (error) return error;
      for (let index = 0; index < (record.details || []).length; index += 1) {
        const detail = record.details[index];
        if (!isPlainObject(detail))
          return `${label}.details[${index}] must be an object`;
        const detailError = firstError([
          requiredString(detail, "id", `${label}.details[${index}]`),
          requiredString(detail, "productId", `${label}.details[${index}]`),
          requiredNumber(detail, "quantity", `${label}.details[${index}]`, {
            min: 0,
          }),
          requiredNumber(detail, "unitPrice", `${label}.details[${index}]`, {
            min: 0,
          }),
          requiredNumber(detail, "lineAmount", `${label}.details[${index}]`, {
            min: 0,
          }),
        ]);
        if (detailError) return detailError;
      }
      return null;
    }

    function validateLog(record, label) {
      return firstError([
        requiredString(record, "id", label),
        requiredDate(record, "timestamp", label),
        requiredString(record, "userId", label),
        requiredString(record, "userName", label),
        enumValue(record, "actionType", label, AUDIT_ACTION),
        requiredString(record, "objectType", label),
        requiredString(record, "objectName", label),
        requiredString(record, "details", label),
        requiredString(record, "ipAddress", label),
      ]);
    }

    const RECORD_VALIDATORS = Object.freeze({
      products: validateProduct,
      suppliers: (record, label) => validateParty(record, label, true),
      customers: (record, label) => validateParty(record, label, true),
      customerProductPrices: validateCustomerProductPrice,
      companies: (record, label) => validateParty(record, label, false),
      warehouses: validateWarehouse,
      bills: validateBill,
      deliveryNotes: validateDeliveryNote,
      stockMovements: validateStockMovement,
      logs: validateLog,
    });

    function validateTable(tableName, records) {
      if (!DATA_TABLES.includes(tableName))
        return `Unknown dataset table: ${tableName}`;
      if (!Array.isArray(records)) return `${tableName} must be an array`;
      const ids = new Set();
      for (let index = 0; index < records.length; index += 1) {
        const record = records[index];
        const label = `${tableName}[${index}]`;
        if (!isPlainObject(record)) return `${label} must be an object`;
        const id = String(record.id || "").trim();
        if (!id) return `${label}.id must be a non-empty string`;
        if (ids.has(id)) return `${tableName} contains duplicate id: ${id}`;
        ids.add(id);
        const error = RECORD_VALIDATORS[tableName](record, label);
        if (error) return error;
      }
      return null;
    }

    function validateReferences(dataset) {
      const ids = Object.fromEntries(
        DATA_TABLES.map((name) => [
          name,
          new Set(dataset[name].map((record) => String(record.id))),
        ]),
      );
      for (const product of dataset.products) {
        if (!ids.suppliers.has(String(product.supplierId))) {
          return `Product ${product.id} references missing supplier ${product.supplierId}`;
        }
      }
      for (const price of dataset.customerProductPrices) {
        if (!ids.companies.has(String(price.companyId))) {
          return `Customer product price ${price.id} references missing company ${price.companyId}`;
        }
        if (!ids.customers.has(String(price.customerId))) {
          return `Customer product price ${price.id} references missing customer ${price.customerId}`;
        }
        if (!ids.products.has(String(price.productId))) {
          return `Customer product price ${price.id} references missing product ${price.productId}`;
        }
      }
      for (const movement of dataset.stockMovements) {
        if (!ids.products.has(String(movement.productId)))
          return `Stock movement ${movement.id} references missing product ${movement.productId}`;
        if (
          movement.supplierId &&
          !ids.suppliers.has(String(movement.supplierId))
        )
          return `Stock movement ${movement.id} references missing supplier ${movement.supplierId}`;
        if (
          movement.customerId &&
          !ids.customers.has(String(movement.customerId))
        )
          return `Stock movement ${movement.id} references missing customer ${movement.customerId}`;
        if (
          movement.companyId &&
          !ids.companies.has(String(movement.companyId))
        )
          return `Stock movement ${movement.id} references missing company ${movement.companyId}`;
        if (
          movement.deliveryNoteId &&
          !ids.deliveryNotes.has(String(movement.deliveryNoteId))
        )
          return `Stock movement ${movement.id} references missing delivery note ${movement.deliveryNoteId}`;
        if (!ids.warehouses.has(String(movement.warehouseId))) {
          return `Stock movement ${movement.id} references missing warehouse ${movement.warehouseId}`;
        }
        const warehouse = dataset.warehouses.find(
          (entry) => String(entry.id) === String(movement.warehouseId),
        );
        if (
          movement.locationCode &&
          warehouse &&
          !warehouse.locations.some(
            (location) => location.code === movement.locationCode,
          )
        ) {
          return `Stock movement ${movement.id} references missing location ${movement.locationCode}`;
        }
      }
      for (const note of dataset.deliveryNotes) {
        if (note.warehouseId && !ids.warehouses.has(String(note.warehouseId))) {
          return `Delivery note ${note.id} references missing warehouse ${note.warehouseId}`;
        }
        if (note.supplierId && !ids.suppliers.has(String(note.supplierId)))
          return `Delivery note ${note.id} references missing supplier ${note.supplierId}`;
        if (note.customerId && !ids.customers.has(String(note.customerId)))
          return `Delivery note ${note.id} references missing customer ${note.customerId}`;
        if (note.companyId && !ids.companies.has(String(note.companyId)))
          return `Delivery note ${note.id} references missing company ${note.companyId}`;
        for (const detail of note.details) {
          if (!ids.products.has(String(detail.productId)))
            return `Delivery note ${note.id} references missing product ${detail.productId}`;
        }
      }
      for (const bill of dataset.bills) {
        const type = bill.statementType || bill.type;
        const partyId = bill.partyId || bill.relatedId;
        if (type === "customer" && !ids.customers.has(String(partyId)))
          return `Bill ${bill.id} references missing customer ${partyId}`;
        if (type === "supplier" && !ids.suppliers.has(String(partyId)))
          return `Bill ${bill.id} references missing supplier ${partyId}`;
        if (bill.companyId && !ids.companies.has(String(bill.companyId)))
          return `Bill ${bill.id} references missing company ${bill.companyId}`;
        for (const detail of bill.details || []) {
          if (!ids.products.has(String(detail.productId)))
            return `Bill ${bill.id} references missing product ${detail.productId}`;
        }
        for (const sourceId of bill.sourceDocumentIds || []) {
          if (
            !ids.deliveryNotes.has(String(sourceId)) &&
            !ids.stockMovements.has(String(sourceId))
          ) {
            return `Bill ${bill.id} references missing source document ${sourceId}`;
          }
        }
      }
      const warehouseTotals = new Map();
      dataset.stockMovements.forEach((movement) => {
        const key = `${movement.productId}::${movement.warehouseId}`;
        warehouseTotals.set(
          key,
          (warehouseTotals.get(key) || 0) + getMovementDelta(movement),
        );
      });
      for (const [key, quantity] of warehouseTotals) {
        if (quantity < 0) {
          return `Warehouse inventory ${key} cannot be negative`;
        }
      }
      const ledgerTotals = calculateLedgerTotals(dataset.stockMovements);
      for (const [productId, ledgerQuantity] of ledgerTotals) {
        if (ledgerQuantity < 0) {
          return `Product ${productId} has negative ledger inventory`;
        }
      }
      return null;
    }

    function getMovementDelta(record) {
      if (!record || record.status === "voided") return 0;
      const quantity = Number(record.quantity) || 0;
      return ["outbound", "adjustment_out", "transfer_out"].includes(
        record.type,
      )
        ? -quantity
        : quantity;
    }

    function calculateLedgerTotals(records) {
      const totals = new Map();
      (Array.isArray(records) ? records : []).forEach((record) => {
        const productId = String(record?.productId || "");
        if (!productId) return;
        totals.set(
          productId,
          (totals.get(productId) || 0) + getMovementDelta(record),
        );
      });
      return totals;
    }

    function cloneDefaultWarehouse() {
      return JSON.parse(JSON.stringify(DEFAULT_WAREHOUSE));
    }

    function migrateDataset(rawDataset) {
      if (!isPlainObject(rawDataset))
        throw new Error("Dataset must be an object");
      const dataset = Object.fromEntries(
        DATA_TABLES.map((tableName) => [
          tableName,
          Array.isArray(rawDataset[tableName])
            ? JSON.parse(JSON.stringify(rawDataset[tableName]))
            : [],
        ]),
      );
      if (dataset.warehouses.length === 0) {
        dataset.warehouses.push(cloneDefaultWarehouse());
      }
      const defaultWarehouse = dataset.warehouses[0];
      const defaultLocation = defaultWarehouse.locations?.[0]?.code || "";
      dataset.stockMovements = dataset.stockMovements.map((record) => ({
        ...record,
        status: record.status || "confirmed",
        warehouseId: record.warehouseId || defaultWarehouse.id,
        locationCode:
          record.locationCode === undefined
            ? defaultLocation
            : record.locationCode,
        batchNo: record.batchNo || "",
        expiryDate: record.expiryDate || null,
      }));
      dataset.customers = dataset.customers.map((customer) => {
        const legacyCoefficient = Number(customer.taxRateCoefficient);
        const inferredRate =
          customer.hasTaxRate && Number.isFinite(legacyCoefficient)
            ? legacyCoefficient > 1
              ? legacyCoefficient - 1
              : legacyCoefficient
            : 0;
        const defaultTaxRate = Number.isFinite(Number(customer.defaultTaxRate))
          ? Number(customer.defaultTaxRate)
          : inferredRate;
        return {
          ...customer,
          defaultTaxRate: Math.max(0, Math.min(1, defaultTaxRate)),
          priceTaxMode:
            customer.priceTaxMode === "inclusive" ? "inclusive" : "exclusive",
        };
      });
      const defaultCompanyId = dataset.companies[0]?.id || "";
      dataset.customerProductPrices = dataset.customerProductPrices.map(
        (record) => ({
          ...record,
          companyId: record.companyId || defaultCompanyId,
        }),
      );

      const requestedStock = new Map(
        dataset.products
          .filter((product) => Number.isFinite(Number(product.stockQuantity)))
          .map((product) => [
            String(product.id),
            Number(product.stockQuantity),
          ]),
      );
      dataset.products = dataset.products.map((product) => {
        const persistedProduct = { ...product };
        delete persistedProduct.stockQuantity;
        return persistedProduct;
      });

      const ledgerTotals = calculateLedgerTotals(dataset.stockMovements);
      const usedIds = new Set(
        dataset.stockMovements.map((record) => record.id),
      );
      dataset.products.forEach((product) => {
        if (!requestedStock.has(String(product.id))) return;
        const difference =
          requestedStock.get(String(product.id)) -
          (ledgerTotals.get(String(product.id)) || 0);
        if (difference === 0) return;
        let id = `OPEN-${product.id}`;
        let suffix = 1;
        while (usedIds.has(id)) {
          id = `OPEN-${product.id}-${suffix}`;
          suffix += 1;
        }
        usedIds.add(id);
        dataset.stockMovements.push({
          id,
          type: difference > 0 ? "opening" : "adjustment_out",
          status: "confirmed",
          productId: product.id,
          productName: product.name,
          quantity: Math.abs(difference),
          unit: product.unit,
          warehouseId: defaultWarehouse.id,
          locationCode: defaultLocation,
          batchNo: "OPENING",
          expiryDate: null,
          operator: "系统迁移",
          remark: "数据升级生成的期初库存",
          createdAt: product.createdAt || new Date(0).toISOString(),
          updatedAt:
            product.updatedAt || product.createdAt || new Date(0).toISOString(),
        });
      });
      return dataset;
    }

    function validateDataset(dataset) {
      if (!isPlainObject(dataset)) return "Dataset must be an object";
      for (const tableName of DATA_TABLES) {
        if (!Object.prototype.hasOwnProperty.call(dataset, tableName)) {
          return `Missing dataset table: ${tableName}`;
        }
        const error = validateTable(tableName, dataset[tableName]);
        if (error) return error;
      }
      return validateReferences(dataset);
    }

    function migrateBackupPayload(payload) {
      if (!isPlainObject(payload)) throw new Error("备份文件根节点必须是对象");
      const version =
        payload.formatVersion === undefined ? 1 : Number(payload.formatVersion);
      if (![1, 2, 3, DATA_FORMAT_VERSION].includes(version)) {
        throw new Error(`不支持的备份版本：${payload.formatVersion}`);
      }
      const backupDataset = isPlainObject(payload.dataset)
        ? payload.dataset
        : isPlainObject(payload.mockData)
          ? {
              ...payload.mockData,
              stockMovements: payload.stockMovementData,
              logs: payload.logsData,
            }
          : null;
      if (!backupDataset) throw new Error("备份文件缺少业务数据");
      const requiredTables = DATA_TABLES.filter(
        (tableName) =>
          tableName !== "customerProductPrices" &&
          (version === DATA_FORMAT_VERSION || tableName !== "warehouses"),
      );
      const missingTable = requiredTables.find(
        (tableName) => !Array.isArray(backupDataset[tableName]),
      );
      if (missingTable) {
        throw new Error(`Missing dataset table: ${missingTable}`);
      }
      const dataset = migrateDataset(backupDataset);
      const error = validateDataset(dataset);
      if (error) throw new Error(error);
      return { formatVersion: DATA_FORMAT_VERSION, dataset };
    }

    return Object.freeze({
      DATA_FORMAT_VERSION,
      DATA_TABLES,
      DEFAULT_WAREHOUSE_ID,
      DEFAULT_LOCATION_CODE,
      DEFAULT_WAREHOUSE,
      isPlainObject,
      getMovementDelta,
      calculateLedgerTotals,
      migrateDataset,
      validateTable,
      validateDataset,
      migrateBackupPayload,
    });
  },
);
