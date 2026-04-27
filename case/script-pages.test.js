const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createWindow,
  flushAsyncTasks,
  getAppShellScriptPaths,
  loadScripts,
} = require("./helpers/browser-harness");

function createScriptPageMarkup() {
  return `
        <aside id="desktop-sidebar">
            <nav>
                <div id="desktop-sidebar-menu"></div>
                <ul>
                    <li><a href="#dashboard" class="nav-link active" data-target="dashboard">dashboard</a></li>
                    <li><a href="#inventory" class="nav-link" data-target="inventory">inventory</a></li>
                    <li><a href="#stock-movement" class="nav-link" data-target="stock-movement">stock</a></li>
                    <li class="nav-dropdown">
                        <a href="#" id="management-center-link"><span>mgmt</span><i class="fa fa-chevron-down"></i></a>
                        <ul class="hidden">
                            <li><a href="#suppliers" class="nav-link" data-target="suppliers">suppliers</a></li>
                            <li><a href="#customers" class="nav-link" data-target="customers">customers</a></li>
                            <li><a href="#companies" class="nav-link" data-target="companies">companies</a></li>
                        </ul>
                    </li>
                    <li><a href="#logs" class="nav-link" data-target="logs">logs</a></li>
                    <li><a href="#bills" class="nav-link" data-target="bills">bills</a></li>
                    <li><a href="#reports" class="nav-link" data-target="reports">reports</a></li>
                    <li><a href="#settings" class="nav-link" data-target="settings">settings</a></li>
                </ul>
            </nav>
        </aside>
        <button id="mobile-menu-button" type="button">open mobile</button>
        <button id="sidebar-toggle-button" type="button">toggle sidebar</button>
        <button id="close-mobile-menu" type="button">close mobile</button>
        <button id="user-menu-button" type="button">user</button>
        <div id="user-menu" class="hidden"></div>
        <div id="mobile-sidebar" class="hidden">
            <a href="#dashboard" class="mobile-nav-link active" data-target="dashboard">dashboard</a>
            <a href="#reports" class="mobile-nav-link" data-target="reports">reports</a>
        </div>
        <button id="add-supplier-btn" type="button">add supplier</button>
        <button id="add-product-btn" type="button">add product</button>
        <button id="add-customer-btn" type="button">add customer</button>
        <button id="add-company-btn" type="button">add company</button>
        <button id="add-inbound-btn" type="button">add inbound</button>
        <button id="add-outbound-btn" type="button">add outbound</button>
        <section id="dashboard" class="page-section"></section>
        <section id="inventory" class="page-section hidden"></section>
        <section id="stock-movement" class="page-section hidden">
            <ul id="stock-tabs">
                <li><button type="button" class="active" data-tab="all">all</button></li>
                <li><button type="button" data-tab="inbound">inbound</button></li>
                <li><button type="button" data-tab="outbound">outbound</button></li>
            </ul>
        </section>
        <section id="suppliers" class="page-section hidden"></section>
        <section id="customers" class="page-section hidden"></section>
        <section id="companies" class="page-section hidden"></section>
        <section id="logs" class="page-section hidden"></section>
        <section id="bills" class="page-section hidden"></section>
        <section id="reports" class="page-section hidden"></section>
        <section id="settings" class="page-section hidden"></section>
        <section id="sales-order" class="page-section hidden"></section>
        <canvas id="inventoryValueChart"></canvas>
        <canvas id="inventoryCategoryChart"></canvas>
        <canvas id="inventoryTurnoverChart"></canvas>
        <canvas id="inventoryTurnoverRankingChart"></canvas>
    `;
}

test("showSection switches pages, syncs hash and triggers page-specific refreshes", () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  const calls = {
    dashboard: 0,
    billsInit: 0,
    billsRender: 0,
    logs: 0,
    stock: 0,
  };

  loadScripts(harness.window, getAppShellScriptPaths());
  harness.window.renderDashboardActivity = () => {
    calls.dashboard += 1;
  };
  harness.window.initBillFilters = () => {
    calls.billsInit += 1;
  };
  harness.window.updateBillsTable = () => {
    calls.billsRender += 1;
  };
  harness.window.renderLogsTable = () => {
    calls.logs += 1;
  };
  harness.window.renderStockMovementTable = () => {
    calls.stock += 1;
  };

  harness.window.showSection("dashboard");
  harness.window.showSection("bills");
  harness.window.showSection("logs");
  harness.window.showSection("stock-movement");
  harness.window.showSection("sales-order");

  assert.equal(calls.dashboard, 1);
  assert.equal(calls.billsInit, 1);
  assert.equal(calls.billsRender, 1);
  assert.equal(calls.logs, 1);
  assert.equal(calls.stock, 1);
  assert.ok(
    !harness.window.document
      .getElementById("sales-order")
      .classList.contains("hidden"),
  );
  assert.ok(
    harness.window.document
      .querySelector('#desktop-sidebar .nav-link[data-target="stock-movement"]')
      .classList.contains("active"),
  );
  assert.equal(harness.window.location.hash, "#sales-order");

  harness.close();
});

test("bindNavigationEvents wires desktop navigation, stock tabs and dropdown toggles", async () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  const stockCalls = [];

  loadScripts(harness.window, getAppShellScriptPaths());
  harness.window.renderStockMovementTable = (tab) => {
    stockCalls.push(tab);
  };

  harness.window.bindNavigationEvents();
  harness.window.document
    .querySelector('.nav-link[data-target="logs"]')
    .click();
  await flushAsyncTasks();

  assert.ok(
    !harness.window.document
      .getElementById("logs")
      .classList.contains("hidden"),
  );
  assert.ok(
    harness.window.document
      .querySelector('.nav-link[data-target="logs"]')
      .classList.contains("active"),
  );
  assert.ok(
    harness.window.document.querySelector(
      '#stock-tabs [data-tab="delivery-note"]',
    ),
  );

  harness.window.paginationState.stock.page = 3;
  harness.window.document
    .querySelector('#stock-tabs button[data-tab="inbound"]')
    .click();
  assert.equal(harness.window.paginationState.stock.page, 1);
  assert.equal(stockCalls.at(-1), "inbound");

  const dropdown = harness.window.document.getElementById(
    "management-center-link",
  );
  const submenu = dropdown.nextElementSibling;
  dropdown.click();
  assert.equal(submenu.classList.contains("hidden"), false);
  dropdown.click();
  assert.equal(submenu.classList.contains("hidden"), true);

  harness.close();
});

test("bindMobileEvents handles mobile sidebar, desktop toggle and user menu dismissal", async () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  loadScripts(harness.window, getAppShellScriptPaths());

  Object.defineProperty(harness.window, "innerWidth", {
    configurable: true,
    value: 500,
  });

  harness.window.bindMobileEvents();
  harness.window.document.getElementById("mobile-menu-button").click();
  assert.equal(
    harness.window.document
      .getElementById("mobile-sidebar")
      .classList.contains("hidden"),
    false,
  );

  harness.window.document
    .querySelector('.mobile-nav-link[data-target="reports"]')
    .click();
  await flushAsyncTasks();
  assert.ok(
    !harness.window.document
      .getElementById("reports")
      .classList.contains("hidden"),
  );
  assert.equal(
    harness.window.document
      .getElementById("mobile-sidebar")
      .classList.contains("hidden"),
    true,
  );

  harness.window.document.getElementById("mobile-menu-button").click();
  harness.window.document.getElementById("close-mobile-menu").click();
  assert.equal(
    harness.window.document
      .getElementById("mobile-sidebar")
      .classList.contains("hidden"),
    true,
  );

  harness.window.document.getElementById("user-menu-button").click();
  assert.equal(
    harness.window.document
      .getElementById("user-menu")
      .classList.contains("hidden"),
    false,
  );
  harness.window.document.body.click();
  assert.equal(
    harness.window.document
      .getElementById("user-menu")
      .classList.contains("hidden"),
    true,
  );

  Object.defineProperty(harness.window, "innerWidth", {
    configurable: true,
    value: 1200,
  });
  harness.window.document.getElementById("sidebar-toggle-button").click();
  assert.equal(
    harness.window.document.getElementById("desktop-sidebar").style.display,
    "none",
  );

  harness.close();
});

test("bindModalEvents closes the modal from close, cancel and overlay actions", () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  loadScripts(harness.window, getAppShellScriptPaths());
  harness.window.bindModalEvents();

  harness.window.showModal("Demo", "<div>Body</div>");
  assert.equal(
    harness.window.document
      .getElementById("modal")
      .classList.contains("hidden"),
    false,
  );

  harness.window.document.getElementById("close-modal").click();
  assert.equal(
    harness.window.document
      .getElementById("modal")
      .classList.contains("hidden"),
    true,
  );

  harness.window.showModal("Demo", "<div>Body</div>");
  harness.window.document.getElementById("modal-cancel").click();
  assert.equal(
    harness.window.document
      .getElementById("modal")
      .classList.contains("hidden"),
    true,
  );

  harness.window.showModal("Demo", "<div>Body</div>");
  harness.window.document.getElementById("modal").dispatchEvent(
    new harness.window.MouseEvent("click", {
      bubbles: true,
    }),
  );
  assert.equal(
    harness.window.document
      .getElementById("modal")
      .classList.contains("hidden"),
    true,
  );

  harness.close();
});

test("bindActionButtons routes button clicks to the expected handlers", async () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  const calls = {
    addSupplier: 0,
    addProduct: 0,
    addCustomer: 0,
    addCompany: 0,
    addInbound: 0,
    initSalesOrder: 0,
  };

  loadScripts(harness.window, getAppShellScriptPaths());
  harness.window.showAddSupplierModal = () => {
    calls.addSupplier += 1;
  };
  harness.window.showAddProductModal = () => {
    calls.addProduct += 1;
  };
  harness.window.showAddCustomerModal = () => {
    calls.addCustomer += 1;
  };
  harness.window.showAddCompanyModal = () => {
    calls.addCompany += 1;
  };
  harness.window.showAddInboundModal = () => {
    calls.addInbound += 1;
  };
  harness.window.initSalesOrder = () => {
    calls.initSalesOrder += 1;
  };

  harness.window.bindActionButtons();
  harness.window.document.getElementById("add-supplier-btn").click();
  harness.window.document.getElementById("add-product-btn").click();
  harness.window.document.getElementById("add-customer-btn").click();
  harness.window.document.getElementById("add-company-btn").click();
  harness.window.document.getElementById("add-inbound-btn").click();
  harness.window.document.getElementById("add-outbound-btn").click();
  await flushAsyncTasks();

  assert.deepEqual(calls, {
    addSupplier: 1,
    addProduct: 1,
    addCustomer: 1,
    addCompany: 1,
    addInbound: 1,
    initSalesOrder: 1,
  });
  assert.ok(
    !harness.window.document
      .getElementById("sales-order")
      .classList.contains("hidden"),
  );

  harness.close();
});

test("applyHashDrivenSectionRoute honors page hashes and ignores nested bill routes", () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  loadScripts(harness.window, getAppShellScriptPaths());

  harness.window.location.hash = "#reports";
  assert.equal(harness.window.applyHashDrivenSectionRoute(), true);
  assert.ok(
    !harness.window.document
      .getElementById("reports")
      .classList.contains("hidden"),
  );

  harness.window.location.hash = "#/bills/create";
  assert.equal(harness.window.applyHashDrivenSectionRoute(), false);

  harness.close();
});

test("initCharts initializes every configured dashboard and report chart", () => {
  const harness = createWindow({ markup: createScriptPageMarkup() });
  const chartCalls = [];

  loadScripts(harness.window, getAppShellScriptPaths());
  harness.window.Chart = function Chart(element, config) {
    chartCalls.push({
      id: element.id,
      type: config.type,
    });
  };

  harness.window.initCharts();

  assert.deepEqual(
    chartCalls.map((entry) => entry.id),
    [
      "inventoryValueChart",
      "inventoryCategoryChart",
      "inventoryTurnoverChart",
      "inventoryTurnoverRankingChart",
    ],
  );
  assert.deepEqual(
    chartCalls.map((entry) => entry.type),
    ["line", "doughnut", "line", "bar"],
  );

  harness.close();
});
