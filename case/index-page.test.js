const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  dispatchDomContentLoaded,
  flushAsyncTasks,
  loadScripts,
  projectRoot,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function readJson(relativePath) {
  return JSON.parse(readProjectFile(relativePath));
}

function getIndexScriptPaths() {
  return [
    ...readProjectFile("index.html").matchAll(/<script[^>]+src="([^"]+)"/g),
  ]
    .map((match) => match[1])
    .filter((src) => src.endsWith(".js") && !src.startsWith("lib/"));
}

function installProjectFetch(window) {
  window.fetch = async (input) => {
    const rawUrl = typeof input === "string" ? input : input.url;
    const parsedUrl = new URL(String(rawUrl), "http://127.0.0.1/");
    const relativePath = parsedUrl.pathname.replace(/^\/+/, "");

    if (relativePath === "data.json" || relativePath.startsWith("data/")) {
      const data = readJson(relativePath);
      return {
        ok: true,
        status: 200,
        async json() {
          return JSON.parse(JSON.stringify(data));
        },
        async text() {
          return JSON.stringify(data);
        },
      };
    }

    if (relativePath.startsWith("api/save/")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return { ok: true };
        },
        async text() {
          return "";
        },
      };
    }

    throw new Error(`Unexpected fetch in index page test: ${rawUrl}`);
  };
}

async function bootRealIndexPage(options = {}) {
  const harness = createWindow({
    documentHtml: readProjectFile("index.html"),
    loadReactRuntime: true,
  });

  installProjectFetch(harness.window);

  if (options.hash) {
    harness.window.location.hash = options.hash;
  }

  loadScripts(harness.window, getIndexScriptPaths());
  dispatchDomContentLoaded(harness.window);
  await flushAsyncTasks(12);

  return harness;
}

test("index.html boots from the real page markup and renders data-aware sections", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;

  assert.equal(
    document.getElementById("dashboard").classList.contains("hidden"),
    false,
  );
  assert.equal(document.documentElement.classList.contains("design-v2"), true);
  assert.ok(document.querySelector('link[href="css/design-preview.css"]'));
  assert.ok(
    document
      .querySelector("body > .flex > .flex-1")
      .classList.contains("min-w-0"),
    "the responsive app shell should be allowed to shrink within the viewport",
  );
  assert.equal(document.querySelectorAll(".filter-toolbar").length, 4);
  assert.equal(
    document.querySelector(".design-preview-header-title").textContent.trim(),
    "仪表盘",
  );
  assert.equal(
    document
      .querySelector(".design-preview-header-subtitle")
      .textContent.trim(),
    "欢迎回来，管理员！这是您的库存管理概览。",
  );
  assert.equal(
    document
      .querySelector("#dashboard > :first-child")
      .classList.contains("page-heading-shell-empty"),
    true,
    "the dashboard heading should move into the application header",
  );
  assert.equal(document.title, "仓库库存管理系统");
  assert.match(readProjectFile("css/design-preview.css"), /--brand:\s*#654df1/);
  assert.match(readProjectFile("css/design-preview.css"), /flex:\s*0 0 168px/);
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.design-v2 header \{[\s\S]*?min-height:\s*60px/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /white-space:\s*nowrap/,
  );
  assert.match(
    readProjectFile("css/style.css"),
    /#modal-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh - 32px\)/,
  );
  assert.equal(
    document.getElementById("inventory").classList.contains("hidden"),
    true,
  );

  assert.ok(document.getElementById("inventory-table-body"));
  assert.ok(document.getElementById("usage-guide"));
  assert.equal(
    document
      .querySelector('[data-target="usage-guide"] span')
      .textContent.trim(),
    "使用说明",
  );
  assert.equal(
    document.querySelectorAll("#usage-guide .usage-guide-flow > li").length,
    6,
  );
  assert.ok(document.getElementById("suppliers-table-body"));
  assert.ok(document.querySelector("#companies tbody"));
  assert.ok(document.querySelector("#customers tbody"));
  assert.equal(document.querySelectorAll("#customers thead th").length, 9);
  assert.equal(document.querySelectorAll("#suppliers thead th").length, 7);
  assert.equal(
    document.querySelector(".business-data-table--customer col:nth-child(2)")
      .style.width,
    "15%",
  );
  assert.equal(
    document.querySelector(".business-data-table--customer col:nth-child(5)")
      .style.width,
    "14%",
  );
  assert.equal(
    document.querySelector(".business-data-table--customer col:nth-child(8)")
      .style.width,
    "21%",
  );
  assert.equal(
    document.querySelector(".business-data-table--customer col:nth-child(9)")
      .style.width,
    "230px",
  );
  [
    ["supplier", "176px"],
    ["company", "136px"],
    ["customer", "230px"],
  ].forEach(([tableType, expectedWidth]) => {
    assert.equal(
      document.querySelector(
        `.business-data-table--${tableType} col:last-child`,
      ).style.width,
      expectedWidth,
    );
  });
  assert.equal(
    document.querySelector(".inventory-data-table col:last-child").style.width,
    "136px",
  );
  assert.ok(document.getElementById("suppliers-pagination-container"));
  assert.equal(
    document.querySelector("#customers thead th").textContent.trim(),
    "客户编号",
  );
  ["suppliers", "companies", "customers"].forEach((sectionId) => {
    assert.ok(document.querySelector(`#${sectionId} .business-data-table`));
    assert.ok(document.querySelector(`#${sectionId} .business-table-scroll`));
  });
  assert.doesNotMatch(
    document.querySelector("#suppliers thead").textContent,
    /电子邮箱/,
  );
  assert.doesNotMatch(
    document.querySelector("#customers thead").textContent,
    /电子邮箱/,
  );
  assert.ok(document.getElementById("bills-table-body"));
  assert.ok(document.getElementById("dashboard-activity-table-body"));
  const customerPairSelector = document.querySelector(
    ".customer-price-pair-selector",
  );
  assert.ok(customerPairSelector);
  assert.equal(
    document.getElementById("customer-price-pair-actions").parentElement,
    customerPairSelector,
  );
  assert.equal(
    document.getElementById("customer-price-pair-summary").parentElement,
    customerPairSelector,
  );
  assert.match(
    readProjectFile("css/style.css"),
    /\.customer-price-pair-selector\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\) auto/,
  );
  assert.equal(document.querySelectorAll(".data-table-card").length, 7);
  const operationHeaders = Array.from(
    document.querySelectorAll(".data-table-card thead th"),
  ).filter((header) => header.textContent.trim() === "操作");
  assert.equal(operationHeaders.length, 6);
  operationHeaders.forEach((header) => {
    assert.equal(header.classList.contains("table-action-header"), true);
    assert.equal(header.classList.contains("text-left"), true);
    assert.equal(header.classList.contains("text-right"), false);
  });
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.table-action-header,[\s\S]*?width:\s*1%\s*!important;[\s\S]*?text-align:\s*left\s*!important;/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /> \.table-action-links \{[\s\S]*?justify-content:\s*flex-start\s*!important;[\s\S]*?margin-left:\s*0;/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.data-table-card thead tr \{[\s\S]*?height:\s*52px/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.data-table-card \.app-empty-table-row > td \{[\s\S]*?height:\s*208px/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /@media \(min-width:\s*1360px\)[\s\S]*?\.business-table-scroll[\s\S]*?overflow-x:\s*auto/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.business-data-table thead th:last-child,[\s\S]*?position:\s*sticky;[\s\S]*?right:\s*0;/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.business-data-table \.app-empty-table-row > td:last-child \{[\s\S]*?position:\s*static !important;/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /#desktop-sidebar\.is-collapsed \{[\s\S]*?width:\s*0 !important;[\s\S]*?flex-basis:\s*0;/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.design-v2 main \{[\s\S]*?padding:\s*18px 16px 28px !important;/,
  );
  assert.match(
    readProjectFile("css/design-preview.css"),
    /\.design-v2 \.page-section \{[\s\S]*?max-width:\s*none;/,
  );

  assert.ok(
    document.querySelector('#desktop-sidebar-menu [data-menu-key="dashboard"]'),
  );
  const sidebarToggleButton = document.getElementById("sidebar-toggle-button");
  sidebarToggleButton.click();
  await flushAsyncTasks();
  assert.equal(
    document
      .getElementById("desktop-sidebar")
      .classList.contains("is-collapsed"),
    true,
  );
  assert.ok(
    document.querySelector("#desktop-sidebar-menu .ant-menu-inline-collapsed"),
  );
  sidebarToggleButton.click();
  await flushAsyncTasks();
  assert.equal(
    document
      .getElementById("desktop-sidebar")
      .classList.contains("is-collapsed"),
    false,
  );
  assert.ok(document.getElementById("inventoryValueChart"));
  assert.ok(document.getElementById("inventoryTurnoverRankingChart"));

  harness.close();
});

test("index.html opens the usage guide below system settings", async () => {
  const harness = await bootRealIndexPage({ hash: "#usage-guide" });
  const { document } = harness.window;

  assert.equal(
    document.getElementById("usage-guide").classList.contains("hidden"),
    false,
  );
  assert.equal(
    document.getElementById("settings").classList.contains("hidden"),
    true,
  );
  assert.match(
    document.getElementById("usage-guide").textContent,
    /推荐建档顺序/,
  );
  assert.match(
    document.getElementById("usage-guide").textContent,
    /资料停用与历史保护/,
  );

  harness.close();
});

test("index.html honors hash routing and reaches the sales-order workflow from the real page", async () => {
  const harness = await bootRealIndexPage({ hash: "#stock-movement" });
  const { document } = harness.window;
  applyFixtureState(harness.window, createFixtureData());

  assert.equal(
    document.getElementById("stock-movement").classList.contains("hidden"),
    false,
  );
  assert.ok(
    document.querySelectorAll("#stock-movement-table-body tr").length > 0,
  );
  assert.ok(document.querySelector('#stock-tabs [data-tab="delivery-note"]'));
  assert.equal(harness.window.location.hash, "#stock-movement");

  document.getElementById("add-outbound-btn").click();
  await flushAsyncTasks(8);

  assert.equal(
    document.getElementById("sales-order").classList.contains("hidden"),
    false,
  );
  assert.match(
    document.getElementById("sales-order-no").textContent.trim(),
    /^XS\d{12}$/,
  );
  assert.ok(document.querySelectorAll("#sales-order-table-body tr").length > 0);
  assert.ok(document.getElementById("sales-order-company-input"));
  assert.ok(document.getElementById("sales-order-customer-input"));

  harness.close();
});

test("a direct sales-order route restores its document copy and form rows", async () => {
  const harness = await bootRealIndexPage({ hash: "#sales-order" });
  const { document } = harness.window;

  assert.equal(
    document.getElementById("sales-order").classList.contains("hidden"),
    false,
  );
  assert.match(
    document.getElementById("sales-order-no").textContent.trim(),
    /^XS\d{12}$/,
  );
  assert.ok(document.querySelectorAll("#sales-order-table-body tr").length > 0);
  assert.match(
    document.getElementById("sales-order-agreement-text").textContent,
    /货品保证质量/,
  );
  assert.match(
    document.getElementById("sales-order-note-text").textContent,
    /第一联白仓库存收款根联/,
  );

  harness.close();
});

test("a direct history import route without a draft returns to import settings", async () => {
  const harness = await bootRealIndexPage({
    hash: "#history-import-workflow",
  });
  const { document } = harness.window;

  assert.equal(
    document
      .getElementById("history-import-workflow")
      .classList.contains("hidden"),
    true,
  );
  assert.equal(
    document.getElementById("settings").classList.contains("hidden"),
    false,
  );
  const historyTab = document.querySelector(
    '#settings-tabs button[data-target="settings-history-import"]',
  );
  assert.equal(historyTab.classList.contains("active"), true);
  assert.equal(historyTab.getAttribute("aria-selected"), "true");
  assert.equal(
    document
      .getElementById("settings-history-import")
      .classList.contains("hidden"),
    false,
  );
  assert.equal(harness.window.location.hash, "#settings");

  harness.close();
});

test("index.html renders filters and opens supplier editing on a routed page", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;
  applyFixtureState(harness.window, createFixtureData());

  assert.ok(document.querySelector("#filter-search-container input"));
  assert.ok(document.querySelector("#log-filter-user-container input"));
  assert.ok(document.querySelector("#log-filter-search-container input"));
  assert.ok(document.querySelector("#log-date-range-picker-container input"));
  assert.ok(document.querySelector("#bills-date-range-picker-container input"));
  assert.ok(document.querySelector("#bills-filter-search-container input"));
  assert.equal(document.getElementById("stock-warehouse-filter"), null);
  assert.equal(document.getElementById("sales-order-warehouse-input"), null);
  assert.doesNotMatch(
    document.getElementById("stock-movement").textContent,
    /仓间调拨|新增仓库/,
  );

  document.getElementById("add-supplier-btn").click();
  await flushAsyncTasks(6);

  assert.equal(
    document.getElementById("modal").classList.contains("hidden"),
    true,
  );
  assert.equal(
    document
      .getElementById("business-form-workflow")
      .classList.contains("hidden"),
    false,
  );
  assert.ok(
    document.querySelector("#business-form-workflow-content .app-modal-form"),
  );
  assert.equal(
    document.querySelector('#add-supplier-form [name="email"]'),
    null,
  );
  const supplierAddressField = document
    .querySelector('#add-supplier-form [name="address"]')
    .closest(".app-modal-two-thirds-row");
  const supplierPaymentField = document
    .getElementById("add-supplier-payment-container")
    .closest(".app-modal-third-row");
  assert.ok(supplierAddressField);
  assert.ok(supplierPaymentField);
  assert.match(
    document.getElementById("business-form-workflow-title").textContent,
    /供应商/,
  );
  assert.equal(harness.window.location.hash, "#business-form-workflow");

  harness.close();
});

test("index.html hides log pagination when there are no matching records", async () => {
  const harness = await bootRealIndexPage({ hash: "#logs" });
  const { document } = harness.window;

  document.getElementById("log-filter-search").value =
    "__definitely_no_matching_log__";
  harness.window.renderLogsTable();
  await flushAsyncTasks(4);

  assert.equal(
    document.getElementById("logs-pagination-container").hidden,
    true,
  );
  assert.match(
    document.getElementById("logs-table-body").textContent,
    /没有找到匹配的日志记录/,
  );

  harness.close();
});

test("index.html balances incomplete rows in three-column modal forms", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;
  applyFixtureState(harness.window, createFixtureData());

  document.getElementById("add-company-btn").click();
  await flushAsyncTasks(4);
  const companyFields = document.querySelectorAll(
    "#add-company-form > .grid > *",
  );
  assert.equal(companyFields.length, 5);
  assert.ok(companyFields[3].querySelector('[name="address"]'));
  assert.ok(companyFields[4].querySelector('[name="email"]'));
  assert.equal(
    companyFields[3].classList.contains("app-modal-two-thirds-row"),
    true,
  );
  assert.equal(
    companyFields[4].classList.contains("app-modal-third-row"),
    true,
  );

  document.getElementById("add-customer-btn").click();
  await flushAsyncTasks(4);
  const customerForm = document.getElementById("add-customer-form");
  const customerFields = customerForm.querySelectorAll(":scope > .grid > *");
  assert.equal(customerFields.length, 8);
  assert.equal(customerForm.querySelector('[name="email"]'), null);
  assert.equal(
    customerForm
      .querySelector('[name="hasTaxRate"]')
      .closest(".app-modal-two-thirds-row") !== null,
    true,
  );
  assert.equal(
    customerForm
      .querySelector('[name="address"]')
      .closest(".app-modal-two-thirds-row") !== null,
    true,
  );
  assert.equal(
    customerForm
      .querySelector('[name="paymentTerms"]')
      .closest(".app-modal-third-row") !== null,
    true,
  );

  document.getElementById("add-product-btn").click();
  await flushAsyncTasks(4);
  const inboundBatchForm = document.getElementById("add-inbound-batch-form");
  assert.ok(inboundBatchForm);
  assert.ok(document.getElementById("inbound-batch-company-id"));
  assert.ok(document.getElementById("inbound-batch-supplier-id"));
  assert.equal(
    document.querySelectorAll("#inbound-batch-rows [data-inbound-row]").length,
    1,
  );
  assert.ok(document.getElementById("inbound-batch-add-row"));
  assert.equal(inboundBatchForm.querySelector('[name="warehouseId"]'), null);
  assert.equal(inboundBatchForm.querySelector('[name="locationCode"]'), null);
  assert.equal(inboundBatchForm.querySelector('[name="batchNo"]'), null);
  assert.equal(inboundBatchForm.querySelector('[name="expiryDate"]'), null);

  harness.close();
});

test("index.html reroutes alert messages into Ant Design message prompts", async () => {
  const harness = await bootRealIndexPage();

  harness.window.alert("进货记录添加成功");
  await flushAsyncTasks(4);

  assert.equal(harness.alerts.length, 0);
  assert.equal(harness.antdMessages.at(-1)?.type, "success");
  assert.match(
    String(harness.antdMessages.at(-1)?.content || ""),
    /进货记录添加成功/,
  );
  assert.ok(harness.window.document.getElementById("antd-message-host"));

  harness.window.alert("进货失败：数据未能保存，本次变更已回滚");
  await flushAsyncTasks(4);
  assert.equal(harness.antdMessages.at(-1)?.type, "error");

  harness.close();
});

test("business form route returns to its source from back and cancel", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;
  applyFixtureState(harness.window, createFixtureData());

  harness.window.showSection("companies");
  document.getElementById("add-company-btn").click();
  await flushAsyncTasks(4);
  assert.equal(
    document
      .getElementById("business-form-workflow")
      .classList.contains("hidden"),
    false,
  );
  document.getElementById("business-form-back").click();
  assert.equal(
    document.getElementById("companies").classList.contains("hidden"),
    false,
  );

  document.getElementById("add-company-btn").click();
  await flushAsyncTasks(4);
  document.getElementById("business-form-workflow-cancel").click();
  assert.equal(
    document.getElementById("companies").classList.contains("hidden"),
    false,
  );

  harness.close();
});

test("business form route exits to its source after a successful save", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;

  harness.window.showSection("inventory");
  harness.window.showBusinessFormPage(
    "编辑商品",
    '<form id="edit-product-test"><input name="name" value="测试商品"></form>',
    async () => {
      harness.window.alert("商品信息已更新");
      return true;
    },
  );

  document.getElementById("business-form-workflow-confirm").click();
  await flushAsyncTasks(4);

  assert.equal(
    document.getElementById("inventory").classList.contains("hidden"),
    false,
  );
  assert.equal(
    document
      .getElementById("business-form-workflow")
      .classList.contains("hidden"),
    true,
  );
  assert.match(
    String(harness.antdMessages.at(-1)?.content || ""),
    /商品信息已更新/,
  );

  harness.close();
});

test("business form supports save-and-return and save-and-continue", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;
  let saveCount = 0;
  let continueCount = 0;

  harness.window.showSection("companies");
  harness.window.showBusinessFormPage(
    "新增公司",
    '<form id="add-company-test"><input name="name" value="测试公司"></form>',
    async () => {
      saveCount += 1;
      return true;
    },
    {
      allowContinue: true,
      onContinue: () => {
        continueCount += 1;
      },
    },
  );

  const continueButton = document.getElementById(
    "business-form-workflow-confirm-continue",
  );
  assert.equal(continueButton.hidden, false);
  continueButton.click();
  await flushAsyncTasks(4);
  assert.equal(saveCount, 1);
  assert.equal(continueCount, 1);
  assert.equal(
    document
      .getElementById("business-form-workflow")
      .classList.contains("hidden"),
    false,
  );

  document.getElementById("business-form-workflow-confirm").click();
  await flushAsyncTasks(4);
  assert.equal(saveCount, 2);
  assert.equal(
    document.getElementById("companies").classList.contains("hidden"),
    false,
  );
  harness.close();
});

test("index.html uses the Ant Design modal host for secondary confirmations", async () => {
  const harness = await bootRealIndexPage();
  const confirmationPromise = harness.window.showAntdConfirm({
    title: "Basic Modal",
    content: "Some contents...",
  });

  await flushAsyncTasks(4);

  const confirmHost =
    harness.window.document.getElementById("antd-confirm-host");
  assert.ok(confirmHost);
  assert.match(confirmHost.textContent, /Basic Modal/);
  assert.match(confirmHost.textContent, /Some contents/);

  const closeButton = confirmHost.querySelector(
    'button[aria-label="关闭确认弹窗"]',
  );
  assert.ok(closeButton);

  closeButton.click();
  await flushAsyncTasks(4);

  assert.equal(await confirmationPromise, false);

  harness.close();
});

test("index.html renders Ant Design Empty for missing bills route views", async () => {
  const missingStatementId = "MISSING-BILL-001";
  const harness = await bootRealIndexPage();
  const { document, Event } = harness.window;

  harness.window.location.hash = `#/bills/view/${missingStatementId}`;
  harness.window.dispatchEvent(new Event("hashchange"));
  await flushAsyncTasks(6);

  const billsView = document.getElementById("bills-view");
  assert.ok(billsView);
  assert.equal(billsView.classList.contains("hidden"), false);
  assert.match(billsView.textContent, /未找到/);
  assert.match(billsView.textContent, new RegExp(missingStatementId));
  assert.ok(billsView.querySelector('[data-role="antd-empty"]'));

  harness.close();
});

test("history import tab owns test and clear actions and shows its selected state", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;
  const historyTab = document.querySelector(
    '#settings-tabs button[data-target="settings-history-import"]',
  );

  historyTab.click();

  assert.equal(historyTab.classList.contains("active"), true);
  assert.equal(historyTab.getAttribute("aria-selected"), "true");
  assert.equal(
    document
      .querySelector('#settings-tabs button[data-target="settings-basic"]')
      .classList.contains("active"),
    false,
  );
  assert.ok(
    document.querySelector("#settings-history-import #seed-test-data-button"),
  );
  assert.ok(
    document.querySelector("#settings-history-import #clear-all-data-button"),
  );
  assert.equal(document.querySelector("aside #seed-test-data-button"), null);

  harness.close();
});

test("archive review uses an Ant Design navigation menu", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;
  loadScripts(harness.window, ["lib/antd.min.js"]);
  const documentData = {
    ok: true,
    fileName: "客户甲AA26-001.xlsx",
    sourceFileName: "客户甲AA26-001.xlsx",
    sheetName: "Sheet1",
    errors: [],
    warnings: [],
    metadata: {
      orderNo: "AA26-001",
      issueDate: "2026-08-01",
      companyName: "测试公司",
      companyContact: "",
      companyPhone: "",
      companyAddress: "",
      customerName: "测试客户",
      customerContact: "",
      customerPhone: "",
      customerAddress: "",
      paymentTerms: "月结",
    },
    priceTaxMode: "exclusive",
    calculatedTotal: 10,
    items: [
      {
        productName: "测试商品",
        specification: "",
        unit: "个",
        quantity: 1,
        unitPrice: 10,
        notes: "",
      },
    ],
  };

  harness.window.DeliveryNoteImport.showBatchReviewPage([
    {
      archiveName: "销售出货单.rar",
      relativePath: "客户甲/送货单.xlsx",
      fileName: "送货单.xlsx",
      status: "pending",
      documentCount: 1,
      itemCount: 1,
      documents: [documentData],
      errors: [],
      warnings: [],
    },
  ]);
  await flushAsyncTasks(4);

  assert.ok(
    document.querySelector("#delivery-import-batch-menu .ant-menu-inline"),
  );
  assert.equal(
    document.querySelector(
      "#delivery-import-batch-menu .ant-menu-item-selected [data-batch-record-id]",
    ).dataset.batchRecordId,
    "batch-file-1",
  );

  harness.close();
});
