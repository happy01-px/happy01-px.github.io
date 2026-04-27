const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const { projectRoot } = require("./helpers/browser-harness");

function readJson(relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(projectRoot, relativePath), "utf8"),
  );
}

function assertPlainObject(value, message) {
  assert.equal(typeof value, "object", message);
  assert.ok(value && !Array.isArray(value), message);
}

function assertString(value, message) {
  assert.equal(typeof value, "string", message);
  assert.notEqual(value.trim(), "", message);
}

function assertOptionalString(value, message) {
  if (value === undefined || value === null) {
    return;
  }
  assert.equal(typeof value, "string", message);
}

function assertStringAllowEmpty(value, message) {
  assert.equal(typeof value, "string", message);
}

function assertNumber(value, message, options = {}) {
  if (options.allowNull && value === null) {
    return;
  }
  assert.equal(typeof value, "number", message);
  assert.ok(Number.isFinite(value), message);
}

function assertArray(value, message) {
  assert.ok(Array.isArray(value), message);
}

function assertDateLike(value, message) {
  assertString(value, message);
}

function validateProduct(record, label) {
  assertPlainObject(record, `${label} should be an object`);
  ["id", "name", "category", "unit", "supplierId"].forEach((key) =>
    assertString(record[key], `${label}.${key} should be a non-empty string`),
  );
  ["retailPrice", "stockQuantity", "minStock", "maxStock"].forEach((key) =>
    assertNumber(record[key], `${label}.${key} should be a finite number`),
  );
  assertNumber(
    record.costPrice,
    `${label}.costPrice should be a finite number or null`,
    { allowNull: true },
  );
  ["createdAt", "updatedAt"].forEach((key) =>
    assertDateLike(record[key], `${label}.${key} should be a date-like string`),
  );
}

function validatePartyRecord(record, label, options = {}) {
  assertPlainObject(record, `${label} should be an object`);
  [
    "id",
    "name",
    "contactPerson",
    "contactPhone",
    "address",
    "status",
    "createdAt",
    "updatedAt",
  ].forEach((key) => {
    assertString(record[key], `${label}.${key} should be a non-empty string`);
  });
  assertOptionalString(
    record.email,
    `${label}.email should be a string when present`,
  );

  if (options.requirePaymentTerms) {
    assertString(
      record.paymentTerms,
      `${label}.paymentTerms should be a non-empty string`,
    );
    assertNumber(
      record.creditLimit,
      `${label}.creditLimit should be a finite number`,
    );
  }
}

function validateBillDetail(detail, label) {
  assertPlainObject(detail, `${label} should be an object`);
  [
    "id",
    "sourceType",
    "sourceId",
    "sourceNo",
    "bizDate",
    "productId",
    "productNameSnapshot",
  ].forEach((key) => {
    assertString(detail[key], `${label}.${key} should be a non-empty string`);
  });
  ["quantity", "unitPrice", "lineAmount", "sortOrder"].forEach((key) => {
    assertNumber(detail[key], `${label}.${key} should be a finite number`);
  });
  assertOptionalString(
    detail.specSnapshot,
    `${label}.specSnapshot should be a string when present`,
  );
  assertOptionalString(
    detail.unitSnapshot,
    `${label}.unitSnapshot should be a string when present`,
  );
  assertOptionalString(
    detail.remark,
    `${label}.remark should be a string when present`,
  );
}

function validateBill(record, label) {
  assertPlainObject(record, `${label} should be an object`);
  assertString(record.id, `${label}.id should be a non-empty string`);

  if (record.recordType || record.statementType) {
    [
      "recordType",
      "statementType",
      "partyId",
      "partyNameSnapshot",
      "contactNameSnapshot",
      "contactPhoneSnapshot",
      "partyAddressSnapshot",
      "statementDate",
      "periodStart",
      "periodEnd",
      "totalAmountUppercase",
      "status",
      "createdAt",
      "updatedAt",
    ].forEach((key) =>
      assertString(record[key], `${label}.${key} should be a non-empty string`),
    );
    assertStringAllowEmpty(record.notes, `${label}.notes should be a string`);

    [
      "documentCount",
      "currentAmount",
      "taxRate",
      "amountWithTax",
      "arrearsAmount",
      "totalAmount",
    ].forEach((key) => {
      assertNumber(record[key], `${label}.${key} should be a finite number`);
    });

    assertOptionalString(
      record.companyId,
      `${label}.companyId should be a string when present`,
    );
    assertOptionalString(
      record.companyNameSnapshot,
      `${label}.companyNameSnapshot should be a string when present`,
    );
    assertOptionalString(
      record.companyAddressSnapshot,
      `${label}.companyAddressSnapshot should be a string when present`,
    );
    assertOptionalString(
      record.companyPhoneSnapshot,
      `${label}.companyPhoneSnapshot should be a string when present`,
    );

    assertArray(record.details, `${label}.details should be an array`);
    record.details.forEach((detail, index) =>
      validateBillDetail(detail, `${label}.details[${index}]`),
    );
    ["arrears", "payments", "sourceDocumentIds"].forEach((key) =>
      assertArray(record[key], `${label}.${key} should be an array`),
    );
    return;
  }

  [
    "type",
    "relatedId",
    "periodStart",
    "periodEnd",
    "status",
    "createdAt",
    "updatedAt",
  ].forEach((key) => {
    assertString(record[key], `${label}.${key} should be a non-empty string`);
  });
  assertStringAllowEmpty(record.notes, `${label}.notes should be a string`);
  assertOptionalString(
    record.paymentStatus,
    `${label}.paymentStatus should be a string when present`,
  );
  assertOptionalString(
    record.paymentDate,
    `${label}.paymentDate should be a string when present`,
  );
  assertOptionalString(
    record.paymentMethod,
    `${label}.paymentMethod should be a string when present`,
  );
  assertNumber(
    record.billAmount,
    `${label}.billAmount should be a finite number`,
  );
}

function validateDeliveryDetail(detail, label) {
  assertPlainObject(detail, `${label} should be an object`);
  ["id", "deliveryId", "productId"].forEach((key) =>
    assertString(detail[key], `${label}.${key} should be a non-empty string`),
  );
  ["quantity", "totalAmount"].forEach((key) =>
    assertNumber(detail[key], `${label}.${key} should be a finite number`),
  );
  assertOptionalString(
    detail.productName,
    `${label}.productName should be a string when present`,
  );
  assertOptionalString(
    detail.unit,
    `${label}.unit should be a string when present`,
  );
  assertOptionalString(
    detail.spec,
    `${label}.spec should be a string when present`,
  );
  assertOptionalString(
    detail.notes,
    `${label}.notes should be a string when present`,
  );
  assertOptionalString(
    detail.status,
    `${label}.status should be a string when present`,
  );
  assertOptionalString(
    detail.sourceType,
    `${label}.sourceType should be a string when present`,
  );
  assertOptionalString(
    detail.sourceId,
    `${label}.sourceId should be a string when present`,
  );
  assertOptionalString(
    detail.sourceNo,
    `${label}.sourceNo should be a string when present`,
  );
  assertOptionalString(
    detail.bizDate,
    `${label}.bizDate should be a string when present`,
  );

  if (detail.unitPrice !== undefined && detail.unitPrice !== null) {
    assertNumber(
      detail.unitPrice,
      `${label}.unitPrice should be a finite number`,
    );
  }
  if (detail.lineAmount !== undefined && detail.lineAmount !== null) {
    assertNumber(
      detail.lineAmount,
      `${label}.lineAmount should be a finite number`,
    );
  }
  if (
    detail.receivedQuantity !== undefined &&
    detail.receivedQuantity !== null
  ) {
    assertNumber(
      detail.receivedQuantity,
      `${label}.receivedQuantity should be a finite number`,
    );
  }
}

function validateDeliveryNote(record, label) {
  assertPlainObject(record, `${label} should be an object`);
  ["id", "notes", "createdAt", "updatedAt"].forEach((key) =>
    assertString(record[key], `${label}.${key} should be a non-empty string`),
  );
  assertNumber(
    record.totalAmount,
    `${label}.totalAmount should be a finite number`,
  );
  assertArray(record.details, `${label}.details should be an array`);
  record.details.forEach((detail, index) =>
    validateDeliveryDetail(detail, `${label}.details[${index}]`),
  );

  if (record.type === "sales") {
    [
      "type",
      "orderNo",
      "issueDate",
      "deliveryDate",
      "status",
      "companyId",
      "customerId",
    ].forEach((key) => {
      assertString(record[key], `${label}.${key} should be a non-empty string`);
    });
  } else {
    ["supplierId", "orderId", "deliveryDate", "expectedDate", "status"].forEach(
      (key) => {
        assertString(
          record[key],
          `${label}.${key} should be a non-empty string`,
        );
      },
    );
  }
}

function validateLog(record, label) {
  assertPlainObject(record, `${label} should be an object`);
  [
    "id",
    "timestamp",
    "userId",
    "userName",
    "actionType",
    "objectType",
    "objectName",
    "details",
    "ipAddress",
  ].forEach((key) => {
    assertString(record[key], `${label}.${key} should be a non-empty string`);
  });
}

function validateStockMovement(record, label) {
  assertPlainObject(record, `${label} should be an object`);
  [
    "id",
    "type",
    "productId",
    "productName",
    "unit",
    "operator",
    "remark",
    "createdAt",
    "updatedAt",
  ].forEach((key) => {
    assertString(record[key], `${label}.${key} should be a non-empty string`);
  });
  assertNumber(record.quantity, `${label}.quantity should be a finite number`);

  [
    "supplierId",
    "supplierName",
    "customerId",
    "customerName",
    "companyId",
    "companyName",
    "deliveryNoteId",
    "orderNo",
    "priceType",
  ].forEach((key) => {
    assertOptionalString(
      record[key],
      `${label}.${key} should be a string when present`,
    );
  });

  if (record.price !== undefined && record.price !== null) {
    assertNumber(record.price, `${label}.price should be a finite number`);
  }
}

function assertDatasetShape(dataset, label) {
  assertPlainObject(dataset, `${label} should be an object`);

  [
    "products",
    "suppliers",
    "customers",
    "companies",
    "bills",
    "deliveryNotes",
    "stockMovements",
    "logs",
  ].forEach((key) =>
    assertArray(dataset[key], `${label}.${key} should be an array`),
  );

  assert.ok(
    dataset.products.length > 0,
    `${label}.products should not be empty`,
  );
  assert.ok(
    dataset.suppliers.length > 0,
    `${label}.suppliers should not be empty`,
  );
  assert.ok(
    dataset.customers.length > 0,
    `${label}.customers should not be empty`,
  );

  dataset.products.forEach((record, index) =>
    validateProduct(record, `${label}.products[${index}]`),
  );
  dataset.suppliers.forEach((record, index) =>
    validatePartyRecord(record, `${label}.suppliers[${index}]`, {
      requirePaymentTerms: true,
    }),
  );
  dataset.customers.forEach((record, index) =>
    validatePartyRecord(record, `${label}.customers[${index}]`, {
      requirePaymentTerms: true,
    }),
  );
  dataset.companies.forEach((record, index) =>
    validatePartyRecord(record, `${label}.companies[${index}]`),
  );
  dataset.bills.forEach((record, index) =>
    validateBill(record, `${label}.bills[${index}]`),
  );
  dataset.deliveryNotes.forEach((record, index) =>
    validateDeliveryNote(record, `${label}.deliveryNotes[${index}]`),
  );
  dataset.stockMovements.forEach((record, index) =>
    validateStockMovement(record, `${label}.stockMovements[${index}]`),
  );
  dataset.logs.forEach((record, index) =>
    validateLog(record, `${label}.logs[${index}]`),
  );
}

function assertDatasetReferences(dataset, label) {
  const productIds = new Set(dataset.products.map((record) => record.id));
  const supplierIds = new Set(dataset.suppliers.map((record) => record.id));
  const customerIds = new Set(dataset.customers.map((record) => record.id));
  const companyIds = new Set(dataset.companies.map((record) => record.id));
  const deliveryIds = new Set(dataset.deliveryNotes.map((record) => record.id));
  const stockMovementIds = new Set(
    dataset.stockMovements.map((record) => record.id),
  );

  dataset.products.forEach((record, index) => {
    assert.ok(
      supplierIds.has(record.supplierId),
      `${label}.products[${index}].supplierId should point to an existing supplier`,
    );
  });

  dataset.stockMovements.forEach((record, index) => {
    assert.ok(
      productIds.has(record.productId),
      `${label}.stockMovements[${index}].productId should point to an existing product`,
    );

    if (record.supplierId) {
      assert.ok(
        supplierIds.has(record.supplierId),
        `${label}.stockMovements[${index}].supplierId should point to an existing supplier`,
      );
    }
    if (record.customerId) {
      assert.ok(
        customerIds.has(record.customerId),
        `${label}.stockMovements[${index}].customerId should point to an existing customer`,
      );
    }
    if (record.companyId) {
      assert.ok(
        companyIds.has(record.companyId),
        `${label}.stockMovements[${index}].companyId should point to an existing company`,
      );
    }
    if (record.deliveryNoteId) {
      assert.ok(
        deliveryIds.has(record.deliveryNoteId),
        `${label}.stockMovements[${index}].deliveryNoteId should point to an existing delivery note`,
      );
    }
  });

  dataset.deliveryNotes.forEach((record, index) => {
    if (record.supplierId) {
      assert.ok(
        supplierIds.has(record.supplierId),
        `${label}.deliveryNotes[${index}].supplierId should point to an existing supplier`,
      );
    }
    if (record.customerId) {
      assert.ok(
        customerIds.has(record.customerId),
        `${label}.deliveryNotes[${index}].customerId should point to an existing customer`,
      );
    }
    if (record.companyId) {
      assert.ok(
        companyIds.has(record.companyId),
        `${label}.deliveryNotes[${index}].companyId should point to an existing company`,
      );
    }

    record.details.forEach((detail, detailIndex) => {
      assert.ok(
        productIds.has(detail.productId),
        `${label}.deliveryNotes[${index}].details[${detailIndex}].productId should point to an existing product`,
      );
    });
  });

  dataset.bills.forEach((record, index) => {
    const partyType = record.statementType || record.type;
    const partyId = record.partyId || record.relatedId;

    if (partyType === "supplier") {
      assert.ok(
        supplierIds.has(partyId),
        `${label}.bills[${index}] supplier party should point to an existing supplier`,
      );
    }
    if (partyType === "customer") {
      assert.ok(
        customerIds.has(partyId),
        `${label}.bills[${index}] customer party should point to an existing customer`,
      );
    }
    if (record.companyId) {
      assert.ok(
        companyIds.has(record.companyId),
        `${label}.bills[${index}].companyId should point to an existing company`,
      );
    }

    if (Array.isArray(record.details)) {
      record.details.forEach((detail, detailIndex) => {
        assert.ok(
          productIds.has(detail.productId),
          `${label}.bills[${index}].details[${detailIndex}].productId should point to an existing product`,
        );
      });
    }

    if (Array.isArray(record.sourceDocumentIds)) {
      record.sourceDocumentIds.forEach((sourceId, sourceIndex) => {
        const isKnownSource =
          deliveryIds.has(sourceId) || stockMovementIds.has(sourceId);
        assert.ok(
          isKnownSource,
          `${label}.bills[${index}].sourceDocumentIds[${sourceIndex}] should point to an existing delivery note or stock movement`,
        );
      });
    }
  });
}

function readSplitDataset() {
  return {
    products: readJson("data/products.json"),
    suppliers: readJson("data/suppliers.json"),
    customers: readJson("data/customers.json"),
    companies: readJson("data/companies.json"),
    bills: readJson("data/bills.json"),
    deliveryNotes: readJson("data/deliveryNotes.json"),
    stockMovements: readJson("data/stockMovements.json"),
    logs: readJson("data/logs.json"),
  };
}

test("data/*.json files follow the expected collection schemas", () => {
  const splitDataset = readSplitDataset();
  assertDatasetShape(splitDataset, "splitDataset");
});

test("data/*.json files maintain cross-file referential integrity", () => {
  const splitDataset = readSplitDataset();
  assertDatasetReferences(splitDataset, "splitDataset");
});
