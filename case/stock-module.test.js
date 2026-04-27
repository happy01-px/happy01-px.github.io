const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  clickModalConfirm,
  createWindow,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createStockMarkup() {
  return `
        <div id="stock-tabs">
            <button class="active" data-tab="all" type="button">全部</button>
        </div>
        <table>
            <thead id="stock-movement-table-head"></thead>
            <tbody id="stock-movement-table-body"></tbody>
        </table>
        <div id="stock-pagination-container"></div>
        <table><tbody id="dashboard-activity-table-body"></tbody></table>
        <select id="filter-supplier"></select>
    `;
}

test("addInboundRecord updates inventory, storage and activity views", () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  let inventoryRefreshCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.updateInventoryTable = () => {
    inventoryRefreshCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };

  harness.window.addInboundRecord({
    productId: "P001",
    quantity: 3,
    remark: "Restock",
  });

  assert.equal(harness.window.mockData.products[0].stockQuantity, 23);
  assert.equal(harness.window.stockMovementData[0].type, "inbound");
  assert.equal(saveCalls, 1);
  assert.equal(inventoryRefreshCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.equal(
    harness.window.document.querySelectorAll(
      "#dashboard-activity-table-body tr",
    ).length,
    3,
  );

  harness.close();
});

test("deleteStockMovement warns when the target record no longer exists", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.updateInventoryTable = () => {};
  harness.window.addLog = () => {};
  harness.window.queueConfirmResult(true);

  await harness.window.deleteStockMovement("missing-record");

  assert.match(harness.alerts.at(-1), /记录未找到/);

  harness.close();
});

test("showAddOutboundModal blocks outbound records that exceed current stock", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.updateInventoryTable = () => {};
  harness.window.addLog = () => {};
  harness.window.saveMockData = () => {};

  harness.window.showAddOutboundModal();
  harness.window.document.getElementById("outbound-product-id").value = "P001";
  harness.window.document.querySelector(
    '#add-outbound-form [name="quantity"]',
  ).value = "999";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.match(harness.alerts.at(-1), /库存不足/);

  harness.close();
});

test("showAddOutboundModal creates an outbound record for a valid request", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  let inventoryRefreshCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.updateInventoryTable = () => {
    inventoryRefreshCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };

  harness.window.showAddOutboundModal();
  harness.window.document.getElementById("outbound-product-id").value = "P001";
  harness.window.document.querySelector(
    '#add-outbound-form [name="quantity"]',
  ).value = "2";
  harness.window.document.querySelector(
    '#add-outbound-form [name="remark"]',
  ).value = "Ship it";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, true);
  assert.equal(harness.window.mockData.products[0].stockQuantity, 18);
  assert.equal(harness.window.stockMovementData[0].type, "outbound");
  assert.equal(saveCalls, 1);
  assert.equal(inventoryRefreshCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(harness.alerts.at(-1), /出货记录添加成功/);

  harness.close();
});
