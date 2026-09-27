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

test("company table keeps long names and addresses inside their columns", () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.companies[0].name = "示例工业科技有限公司";
  fixture.mockData.companies[0].contactPerson = "熊总";
  fixture.mockData.companies[0].contactPhone = "13800000000";
  fixture.mockData.companies[0].address = "示例市示例产业园16号";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.getInitial = (name) => String(name || "?").charAt(0);
  harness.window.updateCompanyTable();

  const cells = harness.window.document.querySelectorAll(
    "#companies tbody tr:first-child td",
  );
  assert.equal(
    cells[0].querySelector(".company-cell-wrap").textContent,
    fixture.mockData.companies[0].name,
  );
  assert.equal(cells[1].textContent.trim(), "熊总");
  assert.equal(cells[2].textContent.trim(), "13800000000");
  assert.equal(
    cells[3].querySelector(".company-cell-wrap").textContent,
    fixture.mockData.companies[0].address,
  );

  harness.close();
});

test("supplier table wraps long names and payment terms within their columns", () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.suppliers[0].name = "示例新材料科技有限公司供应中心";
  fixture.mockData.suppliers[0].contactPerson = "张总";
  fixture.mockData.suppliers[0].contactPhone = "13800138000";
  fixture.mockData.suppliers[0].paymentTerms = "月结三十天并于次月十五日前付款";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.getInitial = (name) => String(name || "?").charAt(0);
  harness.window.updateSupplierTable();

  const cells = harness.window.document.querySelectorAll(
    "#suppliers-table-body tr:first-child td",
  );
  assert.equal(
    cells[0].querySelector(".supplier-cell-wrap").textContent,
    fixture.mockData.suppliers[0].name,
  );
  assert.equal(cells[1].textContent.trim(), "张总");
  assert.equal(cells[2].textContent.trim(), "13800138000");
  assert.equal(
    cells[3].querySelector(".supplier-cell-wrap").textContent,
    fixture.mockData.suppliers[0].paymentTerms,
  );

  harness.close();
});

test("customer table wraps long imported names and addresses within their columns", () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.customers[0].name = "示例金属表面处理有限公司";
  fixture.mockData.customers[0].contactPerson = "新";
  fixture.mockData.customers[0].contactPhone = "13800000001";
  fixture.mockData.customers[0].address = "示例产业园B08栋3楼";
  fixture.mockData.customers[0].paymentTerms = "月结30天";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.getInitial = (name) => String(name || "?").charAt(0);
  harness.window.updateCustomerTable();

  const cells = harness.window.document.querySelectorAll(
    "#customers tbody tr:first-child td",
  );
  assert.equal(
    cells[1].querySelector(".customer-cell-wrap").textContent,
    fixture.mockData.customers[0].name,
  );
  assert.equal(cells[2].textContent.trim(), "新");
  assert.equal(cells[3].textContent.trim(), "13800000001");
  assert.equal(
    cells[4].querySelector(".customer-cell-wrap").textContent,
    fixture.mockData.customers[0].address,
  );
  assert.equal(
    cells[5].querySelector(".customer-cell-wrap").textContent,
    "月结30天",
  );

  harness.close();
});

test("addProduct creates a new product and renders the inventory table", async () => {
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

  await harness.window.addProduct({
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
  const productNameCell = harness.window.document.querySelector(
    "#inventory-table-body tr:first-child td:first-child",
  );
  assert.equal(productNameCell.querySelector("i"), null);
  assert.match(productNameCell.textContent, /Fresh Product/);
  const productActionCell = harness.window.document.querySelector(
    "#inventory-table-body tr:first-child td:last-child",
  );
  assert.equal(productActionCell.classList.contains("table-action-cell"), true);
  assert.ok(productActionCell.querySelector(".table-action-links"));

  harness.close();
});

test("showAddProductModal delegates to the unified inbound product flow", () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const receivedOptions = /** @type {any[]} */ ([]);

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  harness.window.showAddInboundModal = (options) => {
    receivedOptions.push(options);
    return "opened";
  };

  assert.equal(harness.window.showAddProductModal(), "opened");
  assert.equal(receivedOptions[0].source, "inventory");

  harness.close();
});
test("showEditProductModal updates product attributes without changing stock", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const originalStockQuantity = fixture.mockData.products[0].stockQuantity;
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
  harness.window.addLog = (...args) => logCalls.push(args);
  harness.window.getInitial = (name) => String(name || "?").charAt(0);

  harness.window.updateInventoryTable();
  const productRow = Array.from(
    harness.window.document.querySelectorAll("#inventory-table-body tr"),
  ).find((row) => row.textContent.includes("Widget"));
  assert.ok(productRow);
  const editButton = productRow.querySelector('[data-action="edit"]');
  assert.ok(editButton);
  editButton.click();
  harness.window.document.querySelector(
    '#edit-product-form [name="name"]',
  ).value = "Widget Pro";
  harness.window.document.querySelector(
    '#edit-product-form [name="unit"]',
  ).value = "箱";
  harness.window.document.querySelector(
    '#edit-product-form [name="costPrice"]',
  ).value = "120";
  harness.window.document.querySelector(
    '#edit-product-form [name="retailPrice"]',
  ).value = "180";
  harness.window.document.querySelector(
    '#edit-product-form [name="minStock"]',
  ).value = "8";
  harness.window.document.querySelector(
    '#edit-product-form [name="maxStock"]',
  ).value = "80";
  setRenderedSelectValue(
    harness.window,
    "edit-product-category-input",
    "办公设备",
  );
  setRenderedSelectValue(harness.window, "edit-product-supplier-input", "S002");
  setRenderedSelectValue(
    harness.window,
    "edit-product-status-input",
    "inactive",
  );

  const result = await clickModalConfirm(harness.window);
  const updatedProduct = harness.window.mockData.products.find(
    (product) => product.id === "P001",
  );

  assert.equal(result, true);
  assert.equal(updatedProduct.name, "Widget Pro");
  assert.equal(updatedProduct.category, "办公设备");
  assert.equal(updatedProduct.unit, "箱");
  assert.equal(updatedProduct.costPrice, 120);
  assert.equal(updatedProduct.retailPrice, 180);
  assert.equal(updatedProduct.minStock, 8);
  assert.equal(updatedProduct.maxStock, 80);
  assert.equal(updatedProduct.supplierId, "S002");
  assert.equal(updatedProduct.status, "inactive");
  assert.equal(updatedProduct.stockQuantity, originalStockQuantity);
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "edit");
  assert.equal(logCalls[0][1], "product");

  harness.close();
});

test("master data and its audit log are persisted in the same save", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const initialLogCount = fixture.logsData.length;
  /** @type {Record<string, unknown> | null} */
  let auditLogAtSave = null;
  let separateLogSaveCalls = 0;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
    "js/modules/logs-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.persistLogsData = () => {
    separateLogSaveCalls += 1;
  };
  harness.window.saveMockData = () => {
    auditLogAtSave = harness.window.logsData[0];
    return true;
  };
  harness.window.getInitial = (name) => String(name || "?").charAt(0);

  const result = await harness.window.addProduct({
    name: "Atomic Audit Product",
    category: "办公设备",
    unit: "件",
    quantity: 3,
    costPrice: 10,
    retailPrice: 18,
    minStock: 2,
    maxStock: 20,
    supplierId: "S001",
    notes: "atomic audit",
  });

  assert.equal(result, true);
  assert.ok(auditLogAtSave);
  assert.equal(auditLogAtSave.objectType, "product");
  assert.equal(auditLogAtSave.objectName, "Atomic Audit Product");
  assert.equal(harness.window.logsData.length, initialLogCount + 1);
  assert.equal(separateLogSaveCalls, 0);

  harness.close();
});

test("addProduct syncs new inventory to all and inbound stock tables", async () => {
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

  await harness.window.addProduct({
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

test("addProduct merges inventory and reactivates the same product", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.mockData.products[0].status = "inactive";
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };
  harness.window.saveMockData = () => {};
  harness.window.getInitial = (name) =>
    String(name || "?")
      .charAt(0)
      .toUpperCase();

  await harness.window.addProduct({
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
  assert.equal(harness.window.mockData.products[0].status, "active");
  assert.equal(harness.window.stockMovementData.length, 3);
  assert.equal(harness.window.stockMovementData[0].type, "inbound");
  assert.equal(harness.window.stockMovementData[0].status, "confirmed");
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

test("showAddCustomerModal validates the conditional default tax point", async () => {
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
  assert.match(harness.alerts.at(-1), /请选择是否有税点/);

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
  assert.match(harness.alerts.at(-1), /请输入税点/);

  setRenderedInputValue(harness.window, "add-customer-tax-rate-input", "-1");
  assert.equal(await clickModalConfirm(harness.window), false);
  assert.match(harness.alerts.at(-1), /税点必须/);

  setRenderedInputValue(harness.window, "add-customer-tax-rate-input", "13");
  assert.equal(await clickModalConfirm(harness.window), true);

  const createdCustomer = harness.window.mockData.customers.find(
    (customer) => customer.id === "VIP-TAX",
  );
  assert.ok(createdCustomer);
  assert.equal(createdCustomer.hasTaxRate, true);
  assert.equal(createdCustomer.taxRateCoefficient, 1.13);
  assert.equal(createdCustomer.defaultTaxRate, 0.13);
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
    harness.window.document.querySelector('#edit-customer-form [name="email"]'),
    null,
  );
  setRenderedRadioGroupValue(
    harness.window,
    "edit-customer-tax-rate-choice-input",
    "yes",
  );
  setRenderedInputValue(harness.window, "edit-customer-tax-rate-input", "13");
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
  assert.equal(harness.window.mockData.customers[0].defaultTaxRate, 0.13);
  assert.equal(harness.window.mockData.customers[0].email, "nina@example.com");
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "edit");
  assert.match(
    harness.window.document.querySelector("#customers tbody").textContent,
    /Northwind Prime/,
  );

  harness.close();
});

test("referenced supplier delete requires confirmation and deactivates the record", async () => {
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
      "“Acme Supply”已有业务数据，不能直接删除。是否改为停用？",
      "停用后不会出现在新业务的选择列表中，已有历史记录仍会完整保留。",
      "已有 1 个商品关联了这家供应商。",
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

  assert.equal(harness.window.mockData.suppliers.length, 2);
  assert.equal(harness.window.mockData.suppliers[0].status, "inactive");
  assert.equal(saveCalls, 1);
  assert.equal(logCalls[0][0], "edit");
  assert.equal(
    harness.window.document
      .getElementById("suppliers-table-body")
      .textContent.includes("Acme Supply"),
    true,
  );
  assert.match(harness.alerts.at(-1), /已停用/);

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
    referenced: true,
  },
  {
    name: "company",
    setup(window) {
      window.updateCompanyTable();
    },
    selector: "#companies tbody [data-action='delete']",
    collectionName: "companies",
    deletedName: "Happy Warehouse",
    referenced: false,
  },
  {
    name: "customer",
    setup(window) {
      window.updateCustomerTable();
    },
    selector: "#customers tbody [data-action='delete']",
    collectionName: "customers",
    deletedName: "Northwind",
    referenced: true,
  },
].forEach((scenario) => {
  test(`${scenario.name} delete keeps referenced history and removes unused records`, async () => {
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

    assert.equal(
      harness.window.mockData[scenario.collectionName].length,
      scenario.referenced ? 2 : 1,
    );
    if (scenario.referenced) {
      assert.equal(
        harness.window.mockData[scenario.collectionName][0].status,
        "inactive",
      );
    }
    assert.equal(saveCalls, 1);
    assert.equal(logCalls[0][0], scenario.referenced ? "edit" : "delete");
    assert.equal(
      harness.window.document.body.textContent.includes(scenario.deletedName),
      scenario.referenced,
    );
    assert.match(
      harness.alerts.at(-1),
      scenario.referenced ? /已停用/ : /已删除/,
    );

    harness.close();
  });
});

test("addProduct restores product and stock movement data when persistence fails", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  const originalMockData = JSON.stringify(harness.window.mockData);
  const originalStockMovements = JSON.stringify(
    harness.window.stockMovementData,
  );
  const originalLogs = JSON.stringify(harness.window.logsData);
  harness.window.saveMockData = async () => false;
  harness.window.addLog = (...args) => logCalls.push(args);

  const result = await harness.window.addProduct({
    name: "Rollback Product",
    category: "家具",
    unit: "件",
    quantity: 5,
    costPrice: 20,
    retailPrice: 30,
    supplierId: "S001",
    notes: "must roll back",
  });

  assert.equal(result, false);
  assert.equal(JSON.stringify(harness.window.mockData), originalMockData);
  assert.equal(
    JSON.stringify(harness.window.stockMovementData),
    originalStockMovements,
  );
  assert.equal(JSON.stringify(harness.window.logsData), originalLogs);
  assert.equal(logCalls.length, 0);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});

test("product edit restores attributes and audit log when persistence fails", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  const originalMockData = JSON.stringify(harness.window.mockData);
  const originalLogs = JSON.stringify(harness.window.logsData);
  harness.window.saveMockData = () => false;
  harness.window.addLog = (...args) => logCalls.push(args);

  harness.window.showEditProductModal("P001");
  harness.window.document.querySelector(
    '#edit-product-form [name="name"]',
  ).value = "Should Roll Back";
  harness.window.document.querySelector(
    '#edit-product-form [name="costPrice"]',
  ).value = "999";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.equal(JSON.stringify(harness.window.mockData), originalMockData);
  assert.equal(JSON.stringify(harness.window.logsData), originalLogs);
  assert.equal(logCalls.length, 0);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});

[
  {
    name: "company",
    show(window) {
      window.showEditCompanyModal("CO001");
      window.document.querySelector('#edit-company-form [name="name"]').value =
        "Company Rollback";
    },
  },
  {
    name: "supplier",
    show(window) {
      window.showEditSupplierModal("S001");
      window.document.querySelector('#edit-supplier-form [name="name"]').value =
        "Supplier Rollback";
    },
  },
  {
    name: "customer",
    show(window) {
      window.showEditCustomerModal("C001");
      window.document.querySelector('#edit-customer-form [name="name"]').value =
        "Customer Rollback";
    },
  },
].forEach((scenario) => {
  test(`${scenario.name} edit restores the complete dataset when persistence fails`, async () => {
    const harness = createWindow({ markup: createMasterDataMarkup() });
    const fixture = createFixtureData();
    const logCalls = [];

    loadScripts(harness.window, [
      "js/modules/app-utils.js",
      "js/modules/app-state.js",
      "js/modules/master-data-module.js",
    ]);
    applyFixtureState(harness.window, fixture);
    const originalMockData = JSON.stringify(harness.window.mockData);
    const originalStockMovements = JSON.stringify(
      harness.window.stockMovementData,
    );
    harness.window.saveMockData = () => false;
    harness.window.addLog = (...args) => logCalls.push(args);

    scenario.show(harness.window);
    const result = await clickModalConfirm(harness.window);

    assert.equal(result, false);
    assert.equal(JSON.stringify(harness.window.mockData), originalMockData);
    assert.equal(
      JSON.stringify(harness.window.stockMovementData),
      originalStockMovements,
    );
    assert.equal(logCalls.length, 0);
    assert.match(harness.alerts.at(-1), /已回滚/);

    harness.close();
  });
});

test("supplier deactivation is rolled back and not logged when persistence fails", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  const originalMockData = JSON.stringify(harness.window.mockData);
  harness.window.saveMockData = () => false;
  harness.window.addLog = (...args) => logCalls.push(args);
  harness.window.queueConfirmResult(true);

  const result = await harness.window.deleteSupplier("S001");

  assert.equal(result, false);
  assert.equal(JSON.stringify(harness.window.mockData), originalMockData);
  assert.equal(logCalls.length, 0);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});

test("customer id edit restores all related references when persistence fails", async () => {
  const harness = createWindow({ markup: createMasterDataMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.deliveryNotes.push({
    id: "DN-C-ROLLBACK",
    customerId: "C001",
    customerName: "Northwind",
  });
  fixture.stockMovementData[1].customerId = "C001";
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/master-data-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  const originalMockData = JSON.stringify(harness.window.mockData);
  const originalStockMovements = JSON.stringify(
    harness.window.stockMovementData,
  );
  harness.window.saveMockData = () => false;
  harness.window.addLog = (...args) => logCalls.push(args);

  harness.window.showViewCustomerModal("C001");
  const idInput = harness.window.document.getElementById(
    "view-customer-id-input",
  );
  idInput.value = "VIP-ROLLBACK";
  harness.window.document.getElementById("view-customer-id-save").click();
  await flushAsyncTasks();

  assert.equal(JSON.stringify(harness.window.mockData), originalMockData);
  assert.equal(
    JSON.stringify(harness.window.stockMovementData),
    originalStockMovements,
  );
  assert.equal(idInput.value, "C001");
  assert.equal(logCalls.length, 0);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});
