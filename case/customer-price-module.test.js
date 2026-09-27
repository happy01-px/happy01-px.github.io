const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  clickModalConfirm,
  createWindow,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

test("customer price list saves versioned reference prices without an effective date", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  fixture.mockData.customers[0].defaultTaxRate = 0.07;
  fixture.mockData.customers[0].priceTaxMode = "exclusive";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/customer-price-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = async () => true;
  harness.window.addLog = () => {};

  harness.window.showCustomerPriceListModal("C001");
  const row = harness.window.document.querySelector(
    '[data-price-row][data-product-id="P001"]',
  );
  assert.ok(row);
  row.querySelector('[data-field="referencePrice"]').value = "168.50";
  assert.equal(row.querySelector('[data-field="effectiveFrom"]'), null);

  assert.equal(await clickModalConfirm(harness.window), true);
  assert.equal(harness.window.mockData.customerProductPrices.length, 1);
  assert.equal(
    harness.window.mockData.customerProductPrices[0].companyId,
    "CO001",
  );
  assert.equal(
    harness.window.getEffectiveCustomerPrice("C001", "P001", "CO001")
      .referencePrice,
    168.5,
  );
  assert.equal(
    "effectiveFrom" in harness.window.mockData.customerProductPrices[0],
    false,
  );

  harness.close();
});

test("customer price helper returns the last confirmed transaction price", () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  fixture.mockData.deliveryNotes = [
    {
      id: "SD-1",
      type: "sales",
      customerId: "C001",
      status: "confirmed",
      issueDate: "2026-01-01",
      details: [{ productId: "P001", confirmedUnitPrice: 172.25 }],
    },
    {
      id: "SD-2",
      type: "sales",
      customerId: "C001",
      status: "confirmed",
      issueDate: "2026-05-01",
      details: [{ productId: "P001", confirmedUnitPrice: 188.5 }],
    },
  ];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/customer-price-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  assert.equal(
    harness.window.getLastCustomerProductPrice("C001", "P001"),
    188.5,
  );
  harness.close();
});
