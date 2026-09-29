const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const XLSX = require(path.join(__dirname, "..", "lib", "xlsx.full.min.js"));
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
  assert.equal(
    harness.window.document
      .getElementById("add-bill-btn")
      .classList.contains("px-4"),
    true,
    "the statement action should match the compact inventory action size",
  );
  assert.equal(
    harness.window.document
      .getElementById("add-bill-btn")
      .parentElement.classList.contains("bills-list-toolbar"),
    true,
    "the statement action should use the shared left-aligned toolbar",
  );
  assert.match(text, /BILL-C-001/);
  assert.doesNotMatch(text, /BILL-S-001/);
  assert.equal(
    harness.window.document
      .querySelector("#bills thead th:last-child")
      .classList.contains("table-action-header"),
    true,
  );
  const actionCell = harness.window.document.querySelector(
    "#bills-table-body tr:first-child td:last-child",
  );
  assert.equal(actionCell.classList.contains("table-action-cell"), true);
  assert.ok(actionCell.querySelector(".table-action-links"));

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

test("statement Excel export builds a real readable xlsx workbook", () => {
  const harness = createWindow({ markup: createBillsMarkup() });
  const fixture = createFixtureData();
  harness.window.XLSX = XLSX;

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  const statement = {
    ...fixture.mockData.bills[0],
    companyNameSnapshot: "示例公司",
    contactNameSnapshot: "示例联系人",
    contactPhoneSnapshot: "未提供",
    documentCount: 1,
    currentAmount: 1200,
    amountWithTax: 1200,
    arrearsAmount: 0,
    details: [
      {
        bizDate: "2026-04-10",
        sourceNo: "TEST-001",
        productNameSnapshot: "示例商品",
        specSnapshot: "标准",
        unitSnapshot: "件",
        quantity: 2,
        unitPrice: 600,
        lineAmount: 1200,
        remark: "验证导出",
      },
    ],
    arrears: [],
    payments: [],
  };

  const workbook =
    harness.window.AppBillsExport.buildStatementExcelWorkbook(statement);
  const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" });
  assert.equal(Buffer.from(bytes).subarray(0, 2).toString("utf8"), "PK");

  const reopened = XLSX.read(bytes, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(reopened.Sheets["对账单"], {
    header: 1,
    raw: true,
  });
  assert.ok(rows.some((row) => row.includes("示例商品")));
  assert.ok(rows.some((row) => row.includes("对账总额")));
  assert.ok(rows.some((row) => row.includes(1200)));

  const populatedWorkbook =
    harness.window.AppBillsExport.buildStatementExcelWorkbook({
      ...statement,
      amountWithTax: 1296,
      arrearsAmount: 300,
      totalAmount: 1596,
      totalAmountUppercase: "壹仟伍佰玖拾陆元整",
      arrears: [{ monthLabel: "2026-03", amount: 300 }],
      payments: [
        {
          payDate: "2026-04-20",
          payMethod: "银行转账",
          payAmount: 500,
          remark: "测试付款",
        },
      ],
    });
  const populatedRows = XLSX.utils.sheet_to_json(
    populatedWorkbook.Sheets["对账单"],
    { header: 1, raw: true },
  );
  assert.ok(populatedRows.some((row) => row.includes("2026-03")));
  assert.ok(populatedRows.some((row) => row.includes("银行转账")));
  assert.ok(populatedRows.some((row) => row.includes("壹仟伍佰玖拾陆元整")));

  const downloads = [];
  harness.window.HTMLAnchorElement.prototype.click = function click() {
    downloads.push(this.download);
  };
  assert.equal(
    harness.window.AppBillsExport.exportStatementAsExcel(statement),
    true,
  );
  assert.deepEqual(downloads, ["BILL-C-001.xlsx"]);

  const fallbackWorkbook =
    harness.window.AppBillsExport.buildStatementExcelWorkbook({
      statementType: "supplier",
      details: [{}],
      arrears: [{}],
      payments: [{}],
    });
  const fallbackRows = XLSX.utils.sheet_to_json(
    fallbackWorkbook.Sheets["对账单"],
    { header: 1, raw: true },
  );
  assert.ok(fallbackRows.some((row) => row.includes("供应商对账单")));

  harness.window.XLSX = undefined;
  assert.equal(
    harness.window.AppBillsExport.exportStatementAsExcel(statement),
    false,
  );
  assert.match(harness.alerts.at(-1), /Excel 导出组件未加载/);

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

test("delivery note can open a prefilled bill with both save choices", async () => {
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
  dispatchDomContentLoaded(harness.window);
  await flushAsyncTasks();

  harness.window.openCreateBillFromSource({
    id: "SD-DIRECT",
    type: "sales",
    issueDate: "2026-06-18",
    companyId: "CO001",
    customerId: "C001",
  });
  await flushAsyncTasks();

  assert.equal(
    harness.window.document.getElementById("bill-create-type").value,
    "customer",
  );
  assert.equal(
    harness.window.document.getElementById("bill-create-company").value,
    "CO001",
  );
  assert.equal(
    harness.window.document.getElementById("bill-create-party").value,
    "C001",
  );
  assert.equal(
    harness.window.document.getElementById("bill-create-period-start").value,
    "2026-06-01",
  );
  assert.ok(harness.window.document.getElementById("bill-create-continue-btn"));
  assert.match(
    harness.window.document.getElementById("bill-create-submit-btn")
      .textContent,
    /生成并查看/,
  );

  harness.close();
});

test("bill list can batch-create grouped unbilled periods", async () => {
  const harness = createWindow({
    markup: createBillsMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();
  fixture.mockData.deliveryNotes = [
    {
      id: "SD-BULK-001",
      type: "sales",
      orderNo: "XS-BULK-001",
      issueDate: "2026-11-08",
      status: "confirmed",
      companyId: "CO001",
      customerId: "C001",
      details: [
        {
          productId: "P001",
          productName: "Widget",
          quantity: 2,
          unit: "个",
          unitPrice: 150,
          totalAmount: 300,
          status: "confirmed",
        },
      ],
    },
  ];
  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.showAntdConfirm = async () => true;
  harness.window.saveMockData = async () => true;
  harness.window.addLog = () => {};
  dispatchDomContentLoaded(harness.window);
  await flushAsyncTasks();

  const initialCount = harness.window.mockData.bills.length;
  harness.window.document.getElementById("bulk-create-bills-btn").click();
  await flushAsyncTasks(6);

  assert.equal(harness.window.mockData.bills.length, initialCount + 1);
  const created = harness.window.mockData.bills.at(-1);
  assert.equal(created.periodStart, "2026-11-01");
  assert.equal(created.periodEnd, "2026-11-30");
  assert.deepEqual(created.sourceDocumentIds, ["SD-BULK-001"]);

  harness.close();
});

test("create bill flow rolls back the statement when persistence fails", async () => {
  const harness = createWindow({
    markup: createBillsMarkup(),
    loadReactRuntime: true,
  });
  const fixture = createFixtureData();
  fixture.mockData.deliveryNotes = [
    {
      id: "SD-ROLLBACK",
      type: "sales",
      orderNo: "XS-ROLLBACK",
      issueDate: "2026-05-10",
      status: "confirmed",
      companyId: "CO001",
      customerId: "C001",
      details: [
        {
          id: "SDD-ROLLBACK",
          deliveryId: "SD-ROLLBACK",
          productId: "P001",
          productName: "Widget",
          quantity: 2,
          unit: "个",
          unitPrice: 150,
          totalAmount: 300,
          status: "confirmed",
        },
      ],
      createdAt: "2026-05-10T10:00:00",
      updatedAt: "2026-05-10T10:00:00",
    },
  ];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/bills-core.js",
    "js/modules/bills-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = async () => false;
  harness.window.addLog = () => {};

  dispatchDomContentLoaded(harness.window);
  await flushAsyncTasks();
  const initialBillCount = harness.window.mockData.bills.length;
  harness.window.document.getElementById("add-bill-btn").click();
  harness.window.document.getElementById("bill-create-type").value = "customer";
  harness.window.document.getElementById("bill-create-company").value = "CO001";
  harness.window.document.getElementById("bill-create-party").value = "C001";
  harness.window.document.getElementById("bill-create-date").value =
    "2026-05-31";
  harness.window.document.getElementById("bill-create-period-start").value =
    "2026-05-01";
  harness.window.document.getElementById("bill-create-period-end").value =
    "2026-05-31";
  harness.window.document.getElementById("bill-create-tax-rate").value = "1";

  harness.window.document.getElementById("bill-create-submit-btn").click();
  await flushAsyncTasks(6);

  assert.equal(harness.window.mockData.bills.length, initialBillCount);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});
