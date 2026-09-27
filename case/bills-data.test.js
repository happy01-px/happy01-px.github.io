const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createBillsHarness() {
  const harness = createWindow();
  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-data.js",
    "js/modules/bills-statements.js",
  ]);
  applyFixtureState(harness.window, createFixtureData());
  return harness;
}

test("bills data helpers classify sources and migrate legacy supplier records", () => {
  const harness = createBillsHarness();
  const { AppBillsData } = harness.window;
  harness.window.mockData.deliveryNotes = [
    { id: "PUR-1", type: "purchase", supplierId: "S001" },
  ];

  const records = [
    {
      id: "LEGACY-1",
      supplierId: "S001",
      supplierName: "Acme Supply",
      period: "2026/03/01 至 2026/03/31",
      amount: "¥1,234.50",
      status: "pending",
      createdAt: "2026-04-01T09:00:00",
    },
    {
      id: "BAD-CUSTOMER-STATEMENT",
      recordType: "statement-v1",
      statementType: "customer",
      sourceDocumentIds: ["PUR-1"],
    },
  ];
  const result = AppBillsData.migrateBillsData(records);

  assert.equal(result.changed, true);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].recordType, "statement-v1");
  assert.equal(result.records[0].statementType, "supplier");
  assert.equal(result.records[0].partyId, "S001");
  assert.equal(result.records[0].periodStart, "2026-03-01");
  assert.equal(result.records[0].periodEnd, "2026-03-31");
  assert.equal(result.records[0].totalAmount, 1234.5);
  assert.equal(
    Boolean(AppBillsData.isSalesDeliveryNote({ customerId: "C001" })),
    true,
  );
  assert.equal(
    Boolean(AppBillsData.isPurchaseDeliveryNote({ orderId: "PO-1" })),
    true,
  );
  assert.equal(AppBillsData.getOutstandingAmount({
    totalAmount: 500,
    payments: [{ payAmount: 125 }, { payAmount: 25 }],
  }), 350);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        AppBillsData.parseLegacyStatementPeriod("invalid", "2026-04-02"),
      ),
    ),
    { periodStart: "2026-04-02", periodEnd: "2026-04-02" },
  );
  harness.close();
});

test("delivery notes map to structured customer statements", () => {
  const harness = createBillsHarness();
  const statement = harness.window.AppBillsData.mapDeliveryNoteToStructured(
    {
      id: "DN-1",
      type: "sales",
      orderNo: "XS-001",
      customerId: "C001",
      customerName: "Northwind",
      companyId: "CO001",
      companyName: "Happy Warehouse",
      issueDate: "2026-05-01",
      details: [
        {
          productId: "P001",
          productName: "Widget",
          quantity: 2,
          unit: "个",
          unitPrice: 150,
          totalAmount: 300,
        },
      ],
      createdAt: "2026-05-01T08:00:00",
    },
    2,
  );

  assert.equal(statement.id, "CST0003");
  assert.equal(statement.currentAmount, 300);
  assert.equal(statement.details[0].sourceNo, "XS-001");
  assert.deepEqual(Array.from(statement.sourceDocumentIds), ["DN-1"]);
  harness.close();
});

test("statement builders aggregate eligible sources, arrears and occupancy", () => {
  const harness = createBillsHarness();
  const { AppBillsStatements } = harness.window;
  harness.window.mockData.bills.find(
    (record) => record.id === "BILL-C-001",
  ).companyId = "CO001";
  harness.window.mockData.deliveryNotes = [
    {
      id: "SALE-MAY",
      type: "sales",
      orderNo: "XS-MAY",
      status: "confirmed",
      companyId: "CO001",
      customerId: "C001",
      deliveryDate: "2026-05-10",
      details: [
        {
          productId: "P001",
          productName: "Widget",
          quantity: 2,
          unit: "个",
          unitPrice: 150,
          totalAmount: 300,
        },
      ],
    },
    {
      id: "PUR-APR",
      type: "purchase",
      orderId: "PO-APR",
      status: "received",
      supplierId: "S001",
      deliveryDate: "2026-04-12",
      details: [
        {
          productId: "P001",
          quantity: 1,
          unitPrice: 80,
          totalAmount: 80,
        },
      ],
    },
  ];

  const customerForm = {
    statementType: "customer",
    companyId: "CO001",
    partyId: "C001",
    statementDate: "2026-05-31",
    periodStart: "2026-05-01",
    periodEnd: "2026-05-31",
    taxRate: 1.13,
    includeArrears: true,
  };
  const customerStatement =
    AppBillsStatements.buildCustomerStatementFromForm(customerForm);

  assert.equal(customerStatement.currentAmount, 300);
  assert.equal(customerStatement.amountWithTax, 339);
  assert.equal(customerStatement.arrearsAmount, 1200);
  assert.equal(customerStatement.totalAmount, 1539);
  assert.deepEqual(customerStatement.sourceDocumentIds, ["SALE-MAY"]);
  assert.equal(
    AppBillsStatements.findDuplicateStatement({
      ...customerForm,
      periodStart: "2026-04-01",
      periodEnd: "2026-04-15",
    }).id,
    "BILL-C-001",
  );

  const supplierForm = {
    statementType: "supplier",
    companyId: "CO001",
    partyId: "S001",
    statementDate: "2026-04-30",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
    taxRate: 1,
    includeArrears: false,
  };
  const supplierStatement =
    AppBillsStatements.buildSupplierStatementFromForm(supplierForm);
  assert.deepEqual(
    new Set(supplierStatement.sourceDocumentIds),
    new Set(["PUR-APR", "SM001"]),
  );
  assert.equal(supplierStatement.currentAmount, 80);

  harness.window.mockData.bills.push({
    ...customerStatement,
    id: "CST-OCCUPIED",
    updatedAt: "2026-06-01T10:00:00",
  });
  const occupied =
    AppBillsStatements.getDraftSourceOccupancyEntries(customerForm);
  assert.equal(occupied.length, 1);
  assert.equal(occupied[0].statement.id, "CST-OCCUPIED");
  assert.equal(occupied[0].matchedSources[0].sourceNo, "XS-MAY");
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        AppBillsStatements.normalizeOccupiedContextEntries(occupied),
      ),
    ),
    [
      {
        statementId: "CST-OCCUPIED",
        partyNameSnapshot: "Northwind",
        periodStart: "2026-05-01",
        periodEnd: "2026-05-31",
        status: "pending_check",
        sourceNos: ["XS-MAY"],
      },
    ],
  );

  const candidates = AppBillsStatements.getCreateDraftSourceCandidates(
    "supplier",
    "CO001",
    "S001",
  );
  assert.equal(candidates.length, 2);
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(
        AppBillsStatements.buildCreateBillDraft({ partyId: "S001" }),
      ),
    ),
    {
      statementType: "",
      companyId: "",
      partyId: "S001",
      statementDate: "",
      periodStart: "",
      periodEnd: "",
      taxRate: "",
      includeArrears: false,
    },
  );
  harness.close();
});
