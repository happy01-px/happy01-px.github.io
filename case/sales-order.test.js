const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  flushAsyncTasks,
  getFirstMatchingInputId,
  loadScripts,
  setRenderedSelectValue,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createSalesOrderMarkup() {
  return `
        <section id="sales-order" class="page-section">
            <span id="sales-order-no"></span>
            <div id="sales-order-step-1-badge"></div>
            <div id="sales-order-step-1-text"></div>
            <div id="sales-order-step-2-badge"></div>
            <div id="sales-order-step-2-text"></div>
            <div id="sales-order-step-3-badge"></div>
            <div id="sales-order-step-3-text"></div>
            <div id="sales-order-form-panel">
                <div id="sales-order-company-container"></div>
                <input type="hidden" id="sales-order-company-input">
                <div id="sales-order-date-container"></div>
                <input type="hidden" id="sales-order-date-input">
                <div id="sales-order-customer-container"></div>
                <input type="hidden" id="sales-order-customer-input">
                <input id="sales-company-address-input">
                <input id="sales-company-phone-input">
                <input id="sales-company-contact-input">
                <input id="sales-customer-address-input">
                <input id="sales-customer-contact-input">
                <input id="sales-customer-phone-input">
                <input id="sales-customer-payment-input">
                <span id="sales-customer-no"></span>
                <table><tbody id="sales-order-table-body"></tbody></table>
                <div id="sales-order-total-amount-display"></div>
                <div id="sales-order-total-amount-uppercase"></div>
                <div id="sales-order-add-row-button"></div>
                <div id="sales-order-agreement-text"></div>
                <div id="sales-order-note-text"></div>
            </div>
            <div id="sales-order-preview-panel" class="hidden">
                <div id="sales-order-preview-content"></div>
            </div>
        </section>
        <section id="stock-movement" class="page-section hidden"></section>
    `;
}

test("goToSalesOrderPreview rejects incomplete forms", async () => {
  const harness = createWindow({
    markup: createSalesOrderMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/sales-order.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.initSalesOrder();
  await flushAsyncTasks();

  harness.window.goToSalesOrderPreview();

  assert.match(harness.alerts.at(-1), /请选择发货公司/);

  harness.close();
});

test("submitSalesOrder creates delivery notes and outbound stock records", async () => {
  const harness = createWindow({
    markup: createSalesOrderMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();
  const logCalls = [];
  let saveCalls = 0;
  let inventoryRefreshCalls = 0;
  let dashboardRefreshCalls = 0;
  let stockRenderCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/sales-order.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.mockData.deliveryNotes = [];
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.saveMockData = async () => {
    saveCalls += 1;
  };
  harness.window.updateInventoryTable = () => {
    inventoryRefreshCalls += 1;
  };
  harness.window.renderDashboardActivity = () => {
    dashboardRefreshCalls += 1;
  };
  harness.window.renderStockMovementTable = () => {
    stockRenderCalls += 1;
  };

  harness.window.initSalesOrder();
  await flushAsyncTasks();

  setRenderedSelectValue(harness.window, "sales-order-company-input", "CO001");
  setRenderedSelectValue(harness.window, "sales-order-customer-input", "C001");

  const productInputId = getFirstMatchingInputId(
    harness.renderSelects,
    "sales-order-item-product-input-",
  );
  assert.ok(productInputId);

  setRenderedSelectValue(harness.window, productInputId, "P001");
  await flushAsyncTasks();

  const rowId = productInputId.replace("sales-order-item-product-input-", "");
  const quantityInput = harness.window.document.querySelector(
    `#sales-order-item-qty-container-${rowId} input`,
  );
  quantityInput.value = "2";
  quantityInput.dispatchEvent(
    new harness.window.Event("input", { bubbles: true }),
  );
  await flushAsyncTasks();

  await harness.window.submitSalesOrder();

  assert.equal(harness.window.mockData.products[0].stockQuantity, 18);
  assert.equal(harness.window.mockData.deliveryNotes.length, 1);
  assert.equal(harness.window.stockMovementData[0].type, "outbound");
  assert.equal(saveCalls, 1);
  assert.equal(inventoryRefreshCalls, 1);
  assert.equal(dashboardRefreshCalls, 1);
  assert.equal(stockRenderCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(harness.alerts.at(-1), /销售出库已提交/);
  assert.ok(harness.showSectionCalls.includes("stock-movement"));

  harness.close();
});
