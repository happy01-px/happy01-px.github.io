const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  flushAsyncTasks,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createPriceManagementMarkup() {
  return `
    <section id="price-management">
      <button id="price-management-tab-purchase"></button>
      <button id="price-management-tab-customer"></button>
      <div id="price-management-purchase-panel">
        <select id="purchase-price-company-filter"></select>
        <select id="purchase-price-supplier-filter"></select>
        <table><tbody id="purchase-price-table-body"></tbody></table>
      </div>
      <div id="price-management-customer-panel" class="hidden">
        <select id="customer-price-company-select"></select>
        <select id="customer-price-customer-select"></select>
        <button id="confirm-customer-price-pair"></button>
        <button id="reset-customer-price-pair"></button>
        <div id="customer-price-pair-summary"></div>
        <div id="customer-pair-price-content" hidden>
          <table><tbody id="customer-pair-price-table-body"></tbody></table>
          <button id="save-customer-pair-prices"></button>
        </div>
      </div>
    </section>`;
}

test("price management materializes purchase and company-customer price tables", async () => {
  const harness = createWindow({
    markup: createPriceManagementMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();
  fixture.stockMovementData[0].companyId = "CO001";
  fixture.stockMovementData[0].companyName =
    "Happy Warehouse Long Company Name";
  fixture.stockMovementData[0].supplierName = "Acme Supply Long Supplier Name";
  fixture.stockMovementData[0].productName = "Widget Long Product Name";
  fixture.stockMovementData[0].price = 100;
  fixture.stockMovementData[0].inboundOrderNo = "JH202609250001";
  fixture.mockData.customers[0].defaultTaxRate = 0.07;
  fixture.mockData.customers[0].priceTaxMode = "exclusive";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/customer-price-module.js",
    "js/modules/price-management-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = async () => true;
  harness.window.addLog = () => {};

  harness.window.renderPriceManagement();
  assert.match(
    harness.window.document.getElementById("purchase-price-table-body")
      .textContent,
    /Acme Supply/,
  );
  assert.match(
    harness.window.document.getElementById("purchase-price-table-body")
      .textContent,
    /JH202609250001/,
  );
  assert.match(
    harness.window.document.getElementById("purchase-price-table-body")
      .textContent,
    /¥2,000|¥2000|¥2000\.00|¥2,000\.00/,
  );
  assert.equal(
    harness.window.document.querySelectorAll(
      "#purchase-price-table-body .price-history-cell-wrap",
    ).length,
    4,
  );

  harness.window.openCustomerPriceManagement("C001");
  assert.equal(
    harness.window.document.querySelector("[data-customer-pair-price-row]"),
    null,
  );
  assert.equal(
    harness.window.document.getElementById("customer-pair-price-content")
      .hidden,
    true,
  );
  assert.equal(
    harness.window.document.getElementById("customer-price-company-select")
      .value,
    "",
  );
  assert.equal(
    harness.window.document.getElementById("customer-price-customer-select")
      .value,
    "C001",
  );

  harness.window.document.getElementById(
    "customer-price-company-select",
  ).value = "CO001";
  harness.window.document.getElementById("confirm-customer-price-pair").click();
  await flushAsyncTasks();
  const row = harness.window.document.querySelector(
    '[data-customer-pair-price-row][data-product-id="P001"]',
  );
  assert.ok(row);
  assert.equal(
    harness.window.document.getElementById("customer-pair-price-content")
      .hidden,
    false,
  );
  assert.equal(
    harness.window.document.getElementById("customer-price-company-select")
      .disabled,
    true,
  );
  assert.equal(
    harness.window.document.getElementById("customer-price-customer-select")
      .disabled,
    true,
  );
  assert.match(
    harness.window.document.getElementById("customer-price-pair-summary")
      .textContent,
    /Happy Warehouse → Northwind.*默认税点 7%.*当前未税价/,
  );
  assert.equal(row.querySelector('[data-field="effectiveFrom"]'), null);
  row.querySelector('[data-field="referencePrice"]').value = "100";
  const taxSwitch = harness.window.document.querySelector(
    '[data-role="antd-switch"]',
  );
  assert.ok(taxSwitch);
  taxSwitch.click();
  await flushAsyncTasks();
  const inclusiveRow = harness.window.document.querySelector(
    '[data-customer-pair-price-row][data-product-id="P001"]',
  );
  assert.equal(
    inclusiveRow.querySelector('[data-field="referencePrice"]').value,
    "107",
  );
  assert.equal(
    inclusiveRow.querySelector('[data-field="priceTaxMode"]').value,
    "inclusive",
  );
  inclusiveRow.querySelector('[data-field="referencePrice"]').value = "175.50";

  assert.equal(await harness.window.saveCustomerPairPrices(), true);
  const savedPrice = harness.window.mockData.customerProductPrices.at(-1);
  assert.equal(savedPrice.companyId, "CO001");
  assert.equal(savedPrice.customerId, "C001");
  assert.equal(savedPrice.productId, "P001");
  assert.equal(savedPrice.referencePrice, 175.5);
  assert.equal(savedPrice.priceTaxMode, "inclusive");
  assert.equal("effectiveFrom" in savedPrice, false);

  harness.window.document.getElementById("reset-customer-price-pair").click();
  assert.equal(
    harness.window.document.getElementById("customer-pair-price-content")
      .hidden,
    true,
  );
  assert.equal(
    harness.window.document.getElementById("customer-price-company-select")
      .disabled,
    false,
  );
  assert.equal(
    harness.window.document.getElementById("customer-price-customer-select")
      .disabled,
    false,
  );

  harness.close();
});

test("customer price tax switch warns and stays off when the customer has no tax point", () => {
  const harness = createWindow({ markup: createPriceManagementMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.customers[0].defaultTaxRate = 0;
  fixture.mockData.customers[0].taxRateCoefficient = null;
  harness.window.showAntdMessage = (type, content) => {
    harness.antdMessages.push({ type, content });
  };

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/customer-price-module.js",
    "js/modules/price-management-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.openCustomerPriceManagement("C001");
  harness.window.document.getElementById(
    "customer-price-company-select",
  ).value = "CO001";
  harness.window.document.getElementById("confirm-customer-price-pair").click();
  harness.window.document.querySelector('[role="switch"]').click();

  assert.equal(
    harness.window.document
      .querySelector('[role="switch"]')
      .getAttribute("aria-checked"),
    "false",
  );
  assert.deepEqual(harness.antdMessages.at(-1), {
    type: "warning",
    content: "该公司没有税点，无法切换为税后价",
  });

  harness.close();
});
