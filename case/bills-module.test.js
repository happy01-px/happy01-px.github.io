const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  dispatchDomContentLoaded,
  flushAsyncTasks,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createBillsMarkup() {
  const headers = new Array(7).fill("<th></th>").join("");

  return `
        <section id="bills" class="page-section">
            <div>
                <div>
                    <h2>旧标题</h2>
                    <p>旧描述</p>
                </div>
                <div><button id="add-bill-btn" type="button">旧按钮</button></div>
            </div>
            <div class="bg-white rounded-lg shadow-card p-4 mb-6">
                <label id="bills-filter-party-label">对象</label>
                <div id="bills-filter-supplier-container"></div>
                <input id="bills-filter-supplier" value="">
                <label>状态</label>
                <div id="bills-filter-status-container"></div>
                <input id="bills-filter-status" value="">
                <label>日期范围</label>
                <input id="bills-filter-date-start" value="">
                <input id="bills-filter-date-end" value="">
                <label>搜索</label>
                <div id="bills-filter-search-container"></div>
                <input id="bills-filter-search" value="">
            </div>
            <div id="bills-tabs">
                <button type="button" data-tab="customer">客户</button>
                <button type="button" data-tab="supplier">供应商</button>
                <button type="button" data-tab="payment">付款计划</button>
            </div>
            <div class="overflow-x-auto">
                <table>
                    <thead><tr>${headers}</tr></thead>
                    <tbody id="bills-table-body"></tbody>
                </table>
            </div>
            <div id="bills-pagination-container"></div>
        </section>
    `;
}

test("updateBillsTable renders the active customer statements and empty states", async () => {
  const harness = createWindow({
    markup: createBillsMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.updateBillsTable();

  const text =
    harness.window.document.getElementById("bills-table-body").textContent;
  assert.match(
    harness.window.document.querySelector("#bills h2").textContent,
    /对账单系统/,
  );
  assert.match(text, /BILL-C-001/);
  assert.doesNotMatch(text, /BILL-S-001/);

  harness.window.document.getElementById("bills-filter-search").value =
    "missing";
  harness.window.updateBillsTable();
  await flushAsyncTasks();

  assert.match(
    harness.window.document.getElementById("bills-table-body").textContent,
    /当前没有客户对账单/,
  );

  assert.ok(
    harness.window.document
      .getElementById("bills-table-body")
      .querySelector('[data-role="antd-empty"]'),
  );

  harness.close();
});

test("bindBillTabEvents switches tabs, clears filters and re-renders supplier data", () => {
  const harness = createWindow({ markup: createBillsMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.document.getElementById("bills-filter-supplier").value =
    "C001";
  harness.window.document.getElementById("bills-filter-status").value =
    "pending_payment";
  harness.window.document.getElementById("bills-filter-search").value = "north";

  harness.window.bindBillTabEvents();
  harness.window.document
    .querySelector('#bills-tabs button[data-tab="supplier"]')
    .click();

  const text =
    harness.window.document.getElementById("bills-table-body").textContent;
  assert.equal(
    harness.window.document.getElementById("bills-filter-supplier").value,
    "",
  );
  assert.equal(
    harness.window.document.getElementById("bills-filter-status").value,
    "",
  );
  assert.equal(
    harness.window.document.getElementById("bills-filter-search").value,
    "",
  );
  assert.match(text, /BILL-S-001/);
  assert.ok(
    harness.window.document
      .querySelector('#bills-tabs button[data-tab="supplier"]')
      .classList.contains("active"),
  );

  harness.close();
});

test("create bill flow blocks invalid tax rate values", async () => {
  const harness = createWindow({
    markup: createBillsMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {};
  harness.window.addLog = () => {};

  dispatchDomContentLoaded(harness.window);
  await flushAsyncTasks();
  harness.window.document.getElementById("add-bill-btn").click();

  harness.window.document.getElementById("bill-create-type").value = "customer";
  harness.window.document.getElementById("bill-create-company").value = "CO001";
  harness.window.document.getElementById("bill-create-party").value = "C001";
  harness.window.document.getElementById("bill-create-date").value =
    "2026-01-31";
  harness.window.document.getElementById("bill-create-period-start").value =
    "2026-01-01";
  harness.window.document.getElementById("bill-create-period-end").value =
    "2026-01-31";
  harness.window.document.getElementById("bill-create-tax-rate").value = "0";

  harness.window.document.getElementById("bill-create-submit-btn").click();

  assert.match(harness.alerts.at(-1), /请输入有效的税率系数/);
  assert.equal(
    harness.window.mockData.bills.length,
    fixture.mockData.bills.length,
  );

  harness.close();
});
