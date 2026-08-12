const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  clickModalConfirm,
  createWindow,
  flushAsyncTasks,
  loadScripts,
  setRenderedInputValue,
  setRenderedRadioGroupValue,
  setRenderedSelectValue,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createMasterDataMarkup() {
  return `
        <section id="inventory" class="page-section">
            <input id="filter-company" value="">
            <input id="filter-status" value="">
            <select id="filter-supplier"></select>
            <input id="filter-search" value="">
            <table><tbody id="inventory-table-body"></tbody></table>
            <div id="inventory-pagination-container"></div>
        </section>
        <section id="companies" class="page-section">
            <table><tbody></tbody></table>
        </section>
        <div id="company-pagination-container"></div>
        <section id="suppliers" class="page-section">
            <table><tbody id="suppliers-table-body"></tbody></table>
        </section>
        <div id="suppliers-pagination-container"></div>
        <section id="customers" class="page-section">
            <table><tbody></tbody></table>
        </section>
        <div id="customer-pagination-container"></div>
    `;
}

function createStockMovementMarkup() {
  return `
        <section id="stock" class="page-section">
            <div id="stock-tabs">
                <button class="active" data-tab="all" type="button">all</button>
            </div>
            <table>
                <thead id="stock-movement-table-head"></thead>
                <tbody id="stock-movement-table-body"></tbody>
            </table>
            <div id="stock-pagination-container"></div>
        </section>
    `;
}

test("addProduct creates a new product and renders the inventory table", () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const logCalls = [];
  let saveCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.addProduct({
    name: "Fresh Product",
    category: "家具",
    unit: "盒",
    quantity: 4,
    costPrice: 20,
    retailPrice: 30,
    supplierId: "S001",
    notes: "new",
  });

  assert.equal(harness.window.mockData.products.length, 3);
  assert.equal(
    harness.window.mockData.products.some((product) => product.id === "P003"),
    true,
  );
  assert.equal(harness.window.stockMovementData.length, 3);
  assert.equal(harness.window.stockMovementData[0].type, "inbound");
  assert.equal(harness.window.stockMovementData[0].productId, "P003");
  assert.equal(
    harness.window.stockMovementData[0].productName,
    "Fresh Product",
  );
  assert.equal(
    harness.window.mockData.products.find(
      (product) => product.name === "Fresh Product",
    ).unit,
    "盒",
  );
  assert.equal(harness.window.stockMovementData[0].quantity, 4);
  assert.equal(harness.window.stockMovementData[0].unit, "盒");
  assert.equal(harness.window.stockMovementData[0].supplierName, "Acme Supply");
  assert.equal(harness.window.stockMovementData[0].price, 20);
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(harness.alerts.at(-1), /已成功添加/);
  assert.equal(
    harness.window.document.querySelectorAll("#inventory-table-body tr").length,
    3,
  );

  harness.close();
});

test("showAddProductModal allows creating a product with a new category", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.addLog = () => {};
  harness.window.saveMockData = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddProductModal();

  assert.equal(
    harness.window.__testHarness.renderSelects.get("modal-category-input")
      .config.mode,
    "tags",
  );
  assert.equal(
    harness.window.__testHarness.renderSelects.get("modal-category-input")
      .config.enableCreateOption,
    true,
  );

  setRenderedSelectValue(
    harness.window,
    "modal-product-choice-input",
    "Flexible Stand",
  );
  setRenderedSelectValue(harness.window, "modal-category-input", "办公耗材");
  setRenderedSelectValue(harness.window, "modal-supplier-input", "S001");
  harness.window.document.querySelector(
    '#add-product-form [name="unit"]',
  ).value = "套";
  harness.window.document.querySelector(
    '#add-product-form [name="quantity"]',
  ).value = "7";
  harness.window.document.querySelector(
    '#add-product-form [name="costPrice"]',
  ).value = "12.5";
  harness.window.document.querySelector(
    '#add-product-form [name="retailPrice"]',
  ).value = "25";

  await clickModalConfirm(harness.window);

  const createdProduct = harness.window.mockData.products.find(
    (product) => product.name === "Flexible Stand",
  );
  assert.ok(createdProduct);
  assert.equal(createdProduct.category, "办公耗材");
  assert.equal(createdProduct.unit, "套");

  harness.close();
});

test("showAddProductModal blocks invalid required number fields", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.addLog = () => {};
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddProductModal();
  setRenderedSelectValue(
    harness.window,
    "modal-product-choice-input",
    "Invalid Required Product",
  );
  setRenderedSelectValue(harness.window, "modal-category-input", "临时分类");
  setRenderedSelectValue(harness.window, "modal-supplier-input", "S001");
  harness.window.document.querySelector(
    '#add-product-form [name="unit"]',
  ).value = "件";
  harness.window.document.querySelector(
    '#add-product-form [name="quantity"]',
  ).value = "0";
  harness.window.document.querySelector(
    '#add-product-form [name="costPrice"]',
  ).value = "12.5";
  harness.window.document.querySelector(
    '#add-product-form [name="retailPrice"]',
  ).value = "25";

  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请输入有效的数量/);

  harness.window.document.querySelector(
    '#add-product-form [name="quantity"]',
  ).value = "3";
  harness.window.document.querySelector(
    '#add-product-form [name="costPrice"]',
  ).value = "-1";

  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请输入有效的成本单价/);

  harness.window.document.querySelector(
    '#add-product-form [name="costPrice"]',
  ).value = "12.5";
  harness.window.document.querySelector(
    '#add-product-form [name="retailPrice"]',
  ).value = "-1";

  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请输入有效的销售单价/);
  assert.equal(saveCalls, 0);
  assert.equal(
    harness.window.mockData.products.some(
      (product) => product.name === "Invalid Required Product",
    ),
    false,
  );

  harness.close();
});

test("addProduct syncs new inventory to all and inbound stock tables", () => {
  const harness = createWindow({
    markup: `${createMasterDataMarkup()}${createStockMovementMarkup()}`,
  });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.addLog = () => {};
  harness.window.saveMockData = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.addProduct({
    name: "Synced Product",
    category: "瀹跺叿",
    unit: "箱",
    quantity: 7,
    costPrice: 25,
    retailPrice: 40,
    supplierId: "S001",
    notes: "stock sync",
  });

  assert.match(
    harness.window.document.querySelector("#stock-movement-table-body")
      .textContent,
    /Synced Product/,
  );

  harness.window.renderStockMovementTable("inbound");
  assert.match(
    harness.window.document.querySelector("#stock-movement-table-body")
      .textContent,
    /Synced Product/,
  );
  assert.doesNotMatch(
    harness.window.document.querySelector("#stock-movement-table-body")
      .textContent,
    /Gadget/,
  );

  harness.close();
});

test("addProduct merges inventory when the same product already exists", () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.saveMockData = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.addProduct({
    name: "Widget",
    category: "电子产品",
    quantity: 6,
    costPrice: 100,
    retailPrice: 150,
    supplierId: "S001",
    notes: "",
  });

  assert.equal(harness.window.mockData.products.length, 2);
  assert.equal(harness.window.mockData.products[0].stockQuantity, 26);
  assert.equal(harness.window.stockMovementData.length, 3);
  assert.equal(harness.window.stockMovementData[0].type, "inbound");
  assert.equal(harness.window.stockMovementData[0].productId, "P001");
  assert.equal(harness.window.stockMovementData[0].quantity, 6);
  assert.equal(harness.window.stockMovementData[0].supplierName, "Acme Supply");
  assert.equal(harness.window.stockMovementData[0].price, 100);
  assert.equal(logCalls[0][0], "edit");
  assert.match(harness.alerts.at(-1), /已存在/);

  harness.close();
});

test("showAddCompanyModal blocks invalid phone numbers", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {};
  harness.window.addLog = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddCompanyModal();
  harness.window.document.querySelector(
    '#add-company-form [name="name"]',
  ).value = "New Company";
  harness.window.document.querySelector(
    '#add-company-form [name="contactPerson"]',
  ).value = "Neo";
  harness.window.document.querySelector(
    '#add-company-form [name="contactPhone"]',
  ).value = "abc";
  harness.window.document.querySelector(
    '#add-company-form [name="address"]',
  ).value = "Shenzhen";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.equal(harness.window.mockData.companies.length, 2);
  assert.match(harness.alerts.at(-1), /有效的国内联系电话/);

  harness.close();
});

test("showAddCompanyModal saves a valid company through the modal flow", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddCompanyModal();
  harness.window.document.querySelector(
    '#add-company-form [name="name"]',
  ).value = "New Company";
  harness.window.document.querySelector(
    '#add-company-form [name="contactPerson"]',
  ).value = "Neo";
  harness.window.document.querySelector(
    '#add-company-form [name="contactPhone"]',
  ).value = "13800138000";
  harness.window.document.querySelector(
    '#add-company-form [name="address"]',
  ).value = "Shenzhen";
  harness.window.document.querySelector(
    '#add-company-form [name="email"]',
  ).value = "neo@example.com";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, true);
  assert.equal(harness.window.mockData.companies.length, 3);
  assert.equal(harness.window.mockData.companies.at(-1).id, "CO003");
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(
    harness.window.document.querySelector("#companies tbody").textContent,
    /New Company/,
  );

  harness.close();
});

test("showEditCompanyModal blocks duplicate company names", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {};
  harness.window.addLog = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showEditCompanyModal("CO001");
  assert.equal(
    harness.window.document.querySelector('#edit-company-form [name="email"]'),
    null,
  );
  assert.ok(
    harness.window.document
      .querySelector('#edit-company-form [name="status"]')
      .closest(".app-modal-third-row"),
  );
  assert.ok(
    harness.window.document
      .querySelector('#edit-company-form [name="address"]')
      .closest(".app-modal-two-thirds-row"),
  );
  harness.window.document.querySelector(
    '#edit-company-form [name="name"]',
  ).value = "Backup Warehouse";
  harness.window.document.querySelector(
    '#edit-company-form [name="contactPerson"]',
  ).value = "Carol";
  harness.window.document.querySelector(
    '#edit-company-form [name="contactPhone"]',
  ).value = "13500135000";
  harness.window.document.querySelector(
    '#edit-company-form [name="address"]',
  ).value = "Guangzhou";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.match(harness.alerts.at(-1), /名称已存在/);

  harness.close();
});

test("showAddSupplierModal saves a valid supplier", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddSupplierModal();
  harness.window.document.querySelector(
    '#add-supplier-form [name="name"]',
  ).value = "New Supplier";
  harness.window.document.querySelector(
    '#add-supplier-form [name="contactPerson"]',
  ).value = "Nora";
  harness.window.document.querySelector(
    '#add-supplier-form [name="contactPhone"]',
  ).value = "13800138001";
  harness.window.document.getElementById("add-supplier-payment-input").value =
    "Net 45";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, true);
  assert.equal(harness.window.mockData.suppliers.length, 3);
  assert.equal(
    harness.window.mockData.suppliers.some(
      (supplier) => supplier.id === "S003",
    ),
    true,
  );
  assert.equal(harness.window.mockData.suppliers.at(-1).address, "-");
  assert.equal(harness.window.mockData.suppliers.at(-1).email, "-");
  assert.equal(harness.window.mockData.suppliers.at(-1).creditLimit, 0);
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(
    harness.window.document.getElementById("suppliers-table-body").textContent,
    /New Supplier/,
  );

  harness.close();
});

test("showEditSupplierModal validates duplicate names before saving", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {};
  harness.window.addLog = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showEditSupplierModal("S001");
  harness.window.document.querySelector(
    '#edit-supplier-form [name="name"]',
  ).value = "Bravo Parts";
  harness.window.document.querySelector(
    '#edit-supplier-form [name="contactPerson"]',
  ).value = "Alice";
  harness.window.document.querySelector(
    '#edit-supplier-form [name="contactPhone"]',
  ).value = "13800138000";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.match(harness.alerts.at(-1), /名称已存在/);

  harness.close();
});

test("showAddCustomerModal saves a valid customer", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddCustomerModal();
  harness.window.document.querySelector(
    '#add-customer-form [name="id"]',
  ).value = "VIP-001";
  harness.window.document.querySelector(
    '#add-customer-form [name="name"]',
  ).value = "New Customer";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPerson"]',
  ).value = "Cora";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPhone"]',
  ).value = "13800138002";
  harness.window.document.querySelector(
    '#add-customer-form [name="address"]',
  ).value = "Beijing";
  setRenderedRadioGroupValue(
    harness.window,
    "add-customer-tax-rate-choice-input",
    "no",
  );
  harness.window.document.getElementById("add-customer-payment-input").value =
    "Net 30";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, true);
  assert.equal(harness.window.mockData.customers.length, 3);
  assert.equal(
    harness.window.mockData.customers.some(
      (customer) => customer.id === "VIP-001",
    ),
    true,
  );
  assert.equal(harness.window.mockData.customers.at(-1).hasTaxRate, false);
  assert.equal(harness.window.mockData.customers.at(-1).email, "-");
  assert.equal(
    harness.window.mockData.customers.at(-1).taxRateCoefficient,
    null,
  );
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(
    harness.window.document.querySelector("#customers tbody").textContent,
    /New Customer/,
  );

  harness.close();
});

test("showAddCustomerModal requires unique customer id before saving", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddCustomerModal();

  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请输入客户编号/);

  harness.window.document.querySelector(
    '#add-customer-form [name="id"]',
  ).value = "C001";
  harness.window.document.querySelector(
    '#add-customer-form [name="name"]',
  ).value = "Duplicate Id Customer";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPerson"]',
  ).value = "Cora";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPhone"]',
  ).value = "13800138002";
  harness.window.document.querySelector(
    '#add-customer-form [name="address"]',
  ).value = "Beijing";
  setRenderedRadioGroupValue(
    harness.window,
    "add-customer-tax-rate-choice-input",
    "no",
  );
  harness.window.document.getElementById("add-customer-payment-input").value =
    "Net 30";

  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /客户编号已存在/);
  assert.equal(saveCalls, 0);
  assert.equal(harness.window.mockData.customers.length, 2);

  harness.close();
});

test("showAddCustomerModal requires payment terms before saving", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddCustomerModal();

  assert.equal(
    harness.window.document.getElementById("add-customer-payment-input").value,
    "",
  );

  harness.window.document.querySelector(
    '#add-customer-form [name="id"]',
  ).value = "VIP-002";
  harness.window.document.querySelector(
    '#add-customer-form [name="name"]',
  ).value = "Missing Payment Customer";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPerson"]',
  ).value = "Cora";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPhone"]',
  ).value = "13800138002";
  harness.window.document.querySelector(
    '#add-customer-form [name="address"]',
  ).value = "Beijing";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.match(harness.alerts.at(-1), /请选择付款条件/);
  assert.equal(saveCalls, 0);
  assert.equal(harness.window.mockData.customers.length, 2);

  harness.close();
});

test("showAddCustomerModal validates conditional tax rate coefficient", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showAddCustomerModal();
  harness.window.document.querySelector(
    '#add-customer-form [name="id"]',
  ).value = "VIP-TAX";
  harness.window.document.querySelector(
    '#add-customer-form [name="name"]',
  ).value = "Tax Customer";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPerson"]',
  ).value = "Tina";
  harness.window.document.querySelector(
    '#add-customer-form [name="contactPhone"]',
  ).value = "13800138003";
  harness.window.document.querySelector(
    '#add-customer-form [name="address"]',
  ).value = "Shenzhen";
  harness.window.document.getElementById("add-customer-payment-input").value =
    "Net 30";

  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请选择是否有税率系数/);

  setRenderedRadioGroupValue(
    harness.window,
    "add-customer-tax-rate-choice-input",
    "yes",
  );

  assert.equal(
    harness.window.document
      .getElementById("add-customer-tax-rate-wrap")
      .classList.contains("hidden"),
    false,
  );
  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请输入税率系数/);

  setRenderedInputValue(harness.window, "add-customer-tax-rate-input", "-1");
  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /请输入有效的税率系数/);

  setRenderedInputValue(harness.window, "add-customer-tax-rate-input", "1.13");
  assert.equal(await clickModalConfirm(harness.window), true);

  const createdCustomer = harness.window.mockData.customers.find(
    (customer) => customer.id === "VIP-TAX",
  );
  assert.ok(createdCustomer);
  assert.equal(createdCustomer.hasTaxRate, true);
  assert.equal(createdCustomer.taxRateCoefficient, 1.13);
  assert.equal(saveCalls, 1);

  harness.close();
});

test("showViewCustomerModal updates customer id and related records", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.deliveryNotes.push({
    id: "DN-C-001",
    customerId: "C001",
    customerName: "Northwind",
  });
  fixture.stockMovementData[1].customerId = "C001";
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
    return true;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.renderBillPartyFilter = () => {};
  harness.window.updateBillsTable = () => {};
  harness.window.renderStockMovementTable = () => {};
  harness.window.renderDashboardActivity = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showViewCustomerModal("C001");
  harness.window.document.getElementById("view-customer-id-input").value =
    "VIP-009";
  harness.window.document.getElementById("view-customer-id-save").click();
  await flushAsyncTasks();

  assert.equal(harness.window.mockData.customers[0].id, "VIP-009");
  assert.equal(
    harness.window.mockData.bills.find((bill) => bill.id === "BILL-C-001")
      .partyId,
    "VIP-009",
  );
  assert.equal(harness.window.mockData.deliveryNotes[0].customerId, "VIP-009");
  assert.equal(harness.window.stockMovementData[1].customerId, "VIP-009");
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "edit");
  assert.match(
    harness.window.document.querySelector("#customers tbody").textContent,
    /VIP-009/,
  );

  harness.close();
});

test("showEditCustomerModal updates an existing customer", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.showEditCustomerModal("C001");
  harness.window.document.querySelector(
    '#edit-customer-form [name="name"]',
  ).value = "Northwind Prime";
  harness.window.document.querySelector(
    '#edit-customer-form [name="contactPerson"]',
  ).value = "Nina";
  harness.window.document.querySelector(
    '#edit-customer-form [name="contactPhone"]',
  ).value = "13700137000";
  harness.window.document.querySelector(
    '#edit-customer-form [name="address"]',
  ).value = "Shanghai Pudong";
  assert.equal(
    harness.window.document.querySelector(
      '#edit-customer-form [name="email"]',
    ),
    null,
  );
  setRenderedRadioGroupValue(
    harness.window,
    "edit-customer-tax-rate-choice-input",
    "yes",
  );
  setRenderedInputValue(
    harness.window,
    "edit-customer-tax-rate-input",
    "1.13",
  );
  harness.window.document.getElementById("edit-customer-payment-input").value =
    "COD";
  harness.window.document.getElementById("edit-customer-status-input").value =
    "inactive";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, true);
  assert.equal(harness.window.mockData.customers[0].name, "Northwind Prime");
  assert.equal(harness.window.mockData.customers[0].paymentTerms, "COD");
  assert.equal(harness.window.mockData.customers[0].status, "inactive");
  assert.equal(harness.window.mockData.customers[0].hasTaxRate, true);
  assert.equal(harness.window.mockData.customers[0].taxRateCoefficient, 1.13);
  assert.equal(
    harness.window.mockData.customers[0].email,
    "nina@example.com",
  );
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "edit");
  assert.match(
    harness.window.document.querySelector("#customers tbody").textContent,
    /Northwind Prime/,
  );

  harness.close();
});

test("supplier delete button waits for confirmation before removing data", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
    return true;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  harness.window.updateSupplierTable();

  harness.window.queueConfirmResult(false);
  harness.window.document
    .querySelector("#suppliers-table-body [data-action='delete']")
    .click();
  await flushAsyncTasks();

  assert.deepEqual(
    String(harness.confirmCalls.at(-1)?.content || "")
      .split("\n")
      .filter(Boolean),
    [
      "确定要删除“Acme Supply”吗？删除后无法撤销。",
      "删除后，1 个商品会显示为“未知供应商”。",
      "已有 1 张对账单会保留这家供应商的历史快照。",
      "已有 1 条库存流水会保留这家供应商的历史快照。",
    ],
  );
  assert.equal(harness.window.mockData.suppliers.length, 2);
  assert.equal(saveCalls, 0);
  assert.equal(logCalls.length, 0);

  harness.window.queueConfirmResult(true);
  harness.window.document
    .querySelector("#suppliers-table-body [data-action='delete']")
    .click();
  await flushAsyncTasks();

  assert.equal(harness.window.mockData.suppliers.length, 1);
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "delete");
  assert.equal(
    harness.window.document
      .getElementById("suppliers-table-body")
      .textContent.includes("Acme Supply"),
    false,
  );
  assert.match(harness.alerts.at(-1), /已删除/);

  harness.close();
});

[
  {
    name: "product",
    setup(window) {
      window.updateInventoryTable();
    },
    selector: "#inventory-table-body [data-action='delete']",
    collectionName: "products",
    deletedName: "Widget",
  },
  {
    name: "company",
    setup(window) {
      window.updateCompanyTable();
    },
    selector: "#companies tbody [data-action='delete']",
    collectionName: "companies",
    deletedName: "Happy Warehouse",
  },
  {
    name: "customer",
    setup(window) {
      window.updateCustomerTable();
    },
    selector: "#customers tbody [data-action='delete']",
    collectionName: "customers",
    deletedName: "Northwind",
  },
].forEach((scenario) => {
  test(`${scenario.name} delete button removes the record after confirmation`, async () => {
    const harness = createWindow({ markup: createMasterDataMarkup() });
    const fixture = createFixtureData();
    let saveCalls = 0;
    const logCalls = [];

    loadScripts(harness.window, [
      "js/modules/app-utils.js",
      "js/modules/app-state.js",
      "js/modules/master-data-module.js",
    ]);
    applyFixtureState(harness.window, fixture);
    harness.window.saveMockData = () => {
      saveCalls += 1;
      return true;
    };
    harness.window.addLog = (...args) => {
      logCalls.push(args);
    };
    harness.window.getInitial = (name) =>
      String(name || "?")
        .charAt(0)
        .toUpperCase();

    scenario.setup(harness.window);
    harness.window.queueConfirmResult(true);
    harness.window.document.querySelector(scenario.selector).click();
    await flushAsyncTasks();

    assert.equal(harness.window.mockData[scenario.collectionName].length, 1);
    assert.equal(saveCalls, 1);
    assert.equal(logCalls[0][0], "delete");
    assert.equal(
      harness.window.document.body.textContent.includes(scenario.deletedName),
      false,
    );
    assert.match(harness.alerts.at(-1), /已删除/);

    harness.close();
  });
});
