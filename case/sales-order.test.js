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
                <div id="sales-order-paper-viewport">
                    <div id="sales-order-paper"></div>
                </div>
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
                <div id="sales-order-preview-viewport">
                    <div id="sales-order-preview-content"></div>
                </div>
            </div>
            <div id="sales-order-print-panel" class="hidden">
                <div id="sales-order-print-viewport">
                    <div id="sales-order-print-content"></div>
                </div>
            </div>
        </section>
        <section id="stock-movement" class="page-section hidden"></section>
    `;
}

test("sales order paper scales proportionally to the available content width", () => {
  const harness = createWindow({ markup: createSalesOrderMarkup() });

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/sales-order.js",
  ]);

  const formViewport = harness.window.document.getElementById(
    "sales-order-paper-viewport",
  );
  const formPaper = harness.window.document.getElementById("sales-order-paper");
  const previewViewport = harness.window.document.getElementById(
    "sales-order-preview-viewport",
  );
  const previewPaper = harness.window.document.getElementById(
    "sales-order-preview-content",
  );

  Object.defineProperties(formViewport, { clientWidth: { value: 1000 } });
  Object.defineProperties(formPaper, {
    offsetWidth: { value: 1220 },
    offsetHeight: { value: 600 },
  });
  Object.defineProperties(previewViewport, { clientWidth: { value: 610 } });
  Object.defineProperties(previewPaper, {
    offsetWidth: { value: 1220 },
    offsetHeight: { value: 400 },
  });

  harness.window.syncSalesOrderPaperLayout();

  assert.equal(formViewport.dataset.scale, "0.8197");
  assert.equal(formViewport.style.height, "492px");
  assert.match(formPaper.style.transform, /scale\(0\.819672/);
  assert.equal(previewViewport.dataset.scale, "0.5000");
  assert.equal(previewViewport.style.height, "200px");
  assert.equal(previewPaper.style.transform, "scale(0.5)");

  harness.close();
});

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

test("customer delivery number uses the first two letters of the customer id", async () => {
  const harness = createWindow({
    markup: createSalesOrderMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();
  fixture.mockData.customers[0].id = "KH";
  fixture.mockData.deliveryNotes = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/sales-order.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.initSalesOrder();
  await flushAsyncTasks();
  setRenderedSelectValue(harness.window, "sales-order-customer-input", "KH");

  assert.match(
    harness.window.document.getElementById("sales-customer-no").textContent,
    /^KH\d{2}-001$/,
  );

  harness.close();
});

test("submitSalesOrder creates delivery notes and outbound stock records", async () => {
  const harness = createWindow({
    markup: createSalesOrderMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();
  fixture.mockData.customers[0].defaultTaxRate = 0.07;
  fixture.mockData.customers[0].priceTaxMode = "exclusive";
  fixture.mockData.customerProductPrices.push({
    id: "CPP-001",
    companyId: "CO001",
    customerId: "C001",
    productId: "P001",
    referencePrice: 168.5,
    priceTaxMode: "exclusive",
    effectiveFrom: "2026-01-01",
    effectiveTo: null,
    status: "active",
    remark: "contract price",
    createdAt: "2026-01-01T00:00:00",
    updatedAt: "2026-01-01T00:00:00",
  });
  const logCalls = [];
  let saveCalls = 0;
  let inventoryRefreshCalls = 0;
  let dashboardRefreshCalls = 0;
  let stockRenderCalls = 0;
  let printCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/customer-price-module.js",
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
  harness.window.print = () => {
    printCalls += 1;
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
  assert.equal(harness.window.mockData.deliveryNotes[0].subtotal, 337);
  assert.equal(harness.window.mockData.deliveryNotes[0].taxAmount, 23.59);
  assert.equal(harness.window.mockData.deliveryNotes[0].totalAmount, 360.59);
  assert.equal(harness.window.mockData.deliveryNotes[0].taxRateSnapshot, 0.07);
  assert.equal(
    harness.window.mockData.deliveryNotes[0].details[0].referencePriceSnapshot,
    168.5,
  );
  assert.equal(
    harness.window.mockData.deliveryNotes[0].details[0].confirmedUnitPrice,
    168.5,
  );
  assert.equal(harness.window.stockMovementData[0].type, "outbound");
  assert.equal(saveCalls, 1);
  assert.equal(inventoryRefreshCalls, 1);
  assert.equal(dashboardRefreshCalls, 1);
  assert.equal(stockRenderCalls, 0);
  assert.equal(logCalls[0][0], "add");
  assert.match(harness.alerts.at(-1), /销售出库已提交/);
  assert.equal(harness.showSectionCalls.includes("stock-movement"), false);
  assert.equal(
    harness.window.document
      .getElementById("sales-order-print-panel")
      .classList.contains("hidden"),
    false,
  );
  assert.match(
    harness.window.document.getElementById("sales-order-print-content")
      .textContent,
    /Widget/,
  );
  assert.equal(harness.window.printCurrentSalesOrder(), true);
  assert.equal(printCalls, 1);

  harness.close();
});

test("submitSalesOrder rolls back inventory and documents when saving fails", async () => {
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
  harness.window.mockData.deliveryNotes = [];
  harness.window.addLog = () => {
    assert.fail("failed sales orders must not be logged as successful");
  };
  harness.window.saveMockData = async () => false;
  harness.window.updateInventoryTable = () => {};
  harness.window.renderDashboardActivity = () => {};

  harness.window.initSalesOrder();
  await flushAsyncTasks();
  setRenderedSelectValue(harness.window, "sales-order-company-input", "CO001");
  setRenderedSelectValue(harness.window, "sales-order-customer-input", "C001");
  const productInputId = getFirstMatchingInputId(
    harness.renderSelects,
    "sales-order-item-product-input-",
  );
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

  const result = await harness.window.submitSalesOrder();

  assert.equal(result, false);
  assert.equal(harness.window.mockData.products[0].stockQuantity, 20);
  assert.equal(harness.window.mockData.deliveryNotes.length, 0);
  assert.equal(harness.window.stockMovementData.length, 2);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});
