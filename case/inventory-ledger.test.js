const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function loadLedger(harness, fixture) {
  loadScripts(harness.window, [
    "js/modules/data-schema.js",
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/inventory-core.js",
    "js/modules/inventory-ledger.js",
  ]);
  applyFixtureState(harness.window, fixture);
}

test("inventory ledger is authoritative and can rebuild product stock cache", () => {
  const harness = createWindow({
    markup:
      '<select id="stock-warehouse-filter"></select><span id="inventory-ledger-status"></span>',
  });
  const fixture = createFixtureData();
  loadLedger(harness, fixture);

  assert.equal(harness.window.getLedgerQuantity("P001"), 20);
  assert.equal(harness.window.getLedgerQuantity("P001", "WH001"), 20);

  harness.window.mockData.products[0].stockQuantity = 99;
  const report = harness.window.getInventoryConsistencyReport();
  assert.equal(report.isConsistent, false);
  assert.equal(report.mismatches[0].ledgerQuantity, 20);

  harness.window.syncProductStockFromLedger();
  assert.equal(harness.window.mockData.products[0].stockQuantity, 20);
  assert.equal(
    harness.window.getInventoryConsistencyReport().isConsistent,
    true,
  );

  harness.window.renderWarehouseInventoryControls();
  assert.match(
    harness.window.document.getElementById("inventory-ledger-status")
      .textContent,
    /账实一致/,
  );

  harness.close();
});

test("warehouse transfer writes paired ledger movements without changing total stock", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  fixture.mockData.warehouses.push({
    id: "WH002",
    code: "SZ",
    name: "深圳仓",
    status: "active",
    locations: [{ code: "B01", name: "默认库位" }],
    createdAt: "2026-04-10T10:00:00",
    updatedAt: "2026-04-10T10:00:00",
  });
  loadLedger(harness, fixture);

  let confirmTransfer = async () => false;
  harness.window.showModal = (_title, content, onConfirm) => {
    const host = harness.window.document.createElement("div");
    host.innerHTML = content;
    harness.window.document.body.appendChild(host);
    confirmTransfer = onConfirm;
  };
  harness.window.saveMockData = async () => true;
  harness.window.updateInventoryTable = () => {};
  harness.window.renderStockMovementTable = () => {};
  harness.window.renderDashboardActivity = () => {};

  harness.window.showTransferStockModal();
  const form = harness.window.document.getElementById(
    "warehouse-transfer-form",
  );
  form.elements.productId.value = "P001";
  form.elements.fromWarehouseId.value = "WH001";
  form.elements.toWarehouseId.value = "WH002";
  form.elements.quantity.value = "3";

  assert.equal(await confirmTransfer(), true);
  assert.equal(harness.window.getLedgerQuantity("P001", "WH001"), 17);
  assert.equal(harness.window.getLedgerQuantity("P001", "WH002"), 3);
  assert.equal(harness.window.getLedgerQuantity("P001"), 20);
  assert.equal(harness.window.mockData.products[0].stockQuantity, 20);
  assert.equal(harness.window.stockMovementData[0].type, "transfer_out");
  assert.equal(harness.window.stockMovementData[1].type, "transfer_in");
  assert.equal(
    harness.window.stockMovementData[0].transferId,
    harness.window.stockMovementData[1].transferId,
  );

  harness.close();
});
