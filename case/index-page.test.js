const fs = require("fs");
const path = require("path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createWindow,
  dispatchDomContentLoaded,
  flushAsyncTasks,
  loadScripts,
  projectRoot,
} = require("./helpers/browser-harness");

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

test("index.html boots from the real page markup and renders data-backed sections", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;

  assert.equal(
    document.getElementById("dashboard").classList.contains("hidden"),
    false,
  );
  assert.equal(
    document.getElementById("inventory").classList.contains("hidden"),
    true,
  );

  assert.ok(document.querySelectorAll("#inventory-table-body tr").length > 0);
  assert.ok(document.querySelectorAll("#suppliers-table-body tr").length > 0);
  assert.ok(document.querySelectorAll("#companies tbody tr").length > 0);
  assert.ok(document.querySelectorAll("#customers tbody tr").length > 0);
  assert.ok(document.querySelectorAll("#bills-table-body tr").length > 0);
  assert.ok(
    document.querySelectorAll("#dashboard-activity-table-body tr").length > 0,
  );

  assert.ok(
    document.querySelector('#desktop-sidebar-menu [data-menu-key="dashboard"]'),
  );
  assert.ok(document.getElementById("inventoryValueChart"));
  assert.ok(document.getElementById("inventoryTurnoverRankingChart"));

  harness.close();
});

test("index.html honors hash routing and reaches the sales-order workflow from the real page", async () => {
  const harness = await bootRealIndexPage({ hash: "#stock-movement" });
  const { document } = harness.window;

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

test("index.html renders filter controls and keeps the supplier action available", async () => {
  const harness = await bootRealIndexPage();
  const { document } = harness.window;

  assert.ok(document.querySelector("#filter-search-container input"));
  assert.ok(document.querySelector("#log-filter-user-container input"));
  assert.ok(document.querySelector("#log-filter-search-container input"));
  assert.ok(document.querySelector("#log-date-range-picker-container input"));
  assert.ok(document.querySelector("#bills-date-range-picker-container input"));
  assert.ok(document.querySelector("#bills-filter-search-container input"));

  document.getElementById("add-supplier-btn").click();
  await flushAsyncTasks(6);

  assert.equal(
    document.getElementById("modal").classList.contains("hidden"),
    false,
  );
  assert.match(document.getElementById("modal-title").textContent, /供应商/);

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
