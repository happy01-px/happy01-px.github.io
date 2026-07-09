const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  clickModalConfirm,
  createWindow,
  loadScripts,
  setRenderedSelectValue,
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

test("showAddInboundModal creates products with custom category and unit", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
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
  harness.window.updateInventoryTable = () => {};
  harness.window.updateSupplierTable = () => {};
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };

  harness.window.showAddInboundModal();

  assert.equal(
    harness.window.__testHarness.renderSelects.get("inbound-category-input")
      .config.mode,
    "tags",
  );
  assert.equal(
    harness.window.__testHarness.renderSelects.get("inbound-category-input")
      .config.enableCreateOption,
    true,
  );

  setRenderedSelectValue(
    harness.window,
    "inbound-product-choice-input",
    "Inbound Custom Product",
  );
  setRenderedSelectValue(harness.window, "inbound-category-input", "临时分类");
  setRenderedSelectValue(harness.window, "inbound-supplier-id", "S001");
  harness.window.document.querySelector(
    '#add-inbound-form [name="unit"]',
  ).value = "包";
  harness.window.document.querySelector(
    '#add-inbound-form [name="quantity"]',
  ).value = "9";
  harness.window.document.querySelector(
    '#add-inbound-form [name="costPrice"]',
  ).value = "11";
  harness.window.document.querySelector(
    '#add-inbound-form [name="retailPrice"]',
  ).value = "22";

  const result = await clickModalConfirm(harness.window);

  const createdProduct = harness.window.mockData.products.find(
    (product) => product.name === "Inbound Custom Product",
  );
  assert.equal(result, true);
  assert.ok(createdProduct);
  assert.equal(createdProduct.category, "临时分类");
  assert.equal(createdProduct.unit, "包");
  assert.equal(harness.window.stockMovementData[0].unit, "包");
  assert.equal(harness.window.stockMovementData[0].quantity, 9);
  assert.equal(saveCalls, 1);
  assert.equal(logCalls.at(-1)[0], "add");

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
