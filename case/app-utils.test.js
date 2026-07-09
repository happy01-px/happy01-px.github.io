const test = require("node:test");
const assert = require("node:assert/strict");
const {
  createWindow,
  flushAsyncTasks,
  loadScripts,
} = require("./helpers/browser-harness");

test("AppUtils normalizes lists and escapes html safely", () => {
  const harness = createWindow();
  loadScripts(harness.window, ["js/modules/app-utils.js"]);

  const normalized = harness.window.normalizeMockData({
    products: [{ id: "P001" }],
    suppliers: null,
    customers: "bad",
    companies: undefined,
  });

  assert.equal(
    JSON.stringify(normalized),
    JSON.stringify({
      products: [{ id: "P001" }],
      suppliers: [],
      customers: [],
      companies: [],
      bills: [],
      deliveryNotes: [],
    }),
  );
  assert.equal(
    harness.window.escapeHTML("<script>\"bad\"&'x'</script>"),
    "&lt;script&gt;&quot;bad&quot;&amp;&#39;x&#39;&lt;/script&gt;",
  );

  harness.close();
});

test("AppUtils restores dates and creates sequential ids from existing records", () => {
  const harness = createWindow();
  loadScripts(harness.window, ["js/modules/app-utils.js"]);

  const restored = harness.window.restoreStockMovementDates([
    {
      id: "SM001",
      createdAt: "2026-04-01T10:00:00",
      updatedAt: "2026-04-02T10:00:00",
    },
    { id: "SM002" },
  ]);

  assert.ok(restored[0].createdAt instanceof harness.window.Date);
  assert.ok(restored[0].updatedAt instanceof harness.window.Date);
  assert.ok(restored[1].createdAt instanceof harness.window.Date);
  assert.equal(
    harness.window.createSequentialId(
      [{ id: "P001" }, { id: "P009-A" }, { id: "X999" }],
      "P",
    ),
    "P010",
  );
  assert.match(harness.window.createRuntimeId("ID"), /^ID\d{13}\d{3}$/);

  harness.close();
});

test("AppUtils sanitizes html fragments before insertion", () => {
  const harness = createWindow({ markup: '<div id="host"></div>' });
  loadScripts(harness.window, ["js/modules/app-utils.js"]);

  const host = harness.window.document.getElementById("host");
  harness.window.setSafeInnerHTML(
    host,
    '<div onclick="bad()" style="color:red"><a href="javascript:bad()">Link</a><script>bad()</script><img src="data:text/html,bad" onerror="bad()"></div>',
  );

  assert.equal(host.querySelector("script"), null);
  assert.equal(host.querySelector("[onclick]"), null);
  assert.equal(host.querySelector("[style]"), null);
  assert.equal(host.querySelector("a").hasAttribute("href"), false);
  assert.equal(host.querySelector("img").hasAttribute("src"), false);
  assert.match(host.textContent, /Link/);

  harness.close();
});

test("AppUtils renders Ant Design Empty for shared empty states when runtime is available", async () => {
  const harness = createWindow({
    markup:
      '<div id="empty-host"></div><table><tbody id="empty-table"></tbody></table>',
    loadReactRuntime: true,
  });
  loadScripts(harness.window, ["js/modules/app-utils.js"]);

  assert.equal(
    harness.window.renderAntdEmptyState("empty-host", "暂无数据"),
    true,
  );
  harness.window.renderAntdEmptyTableRow(
    harness.window.document.getElementById("empty-table"),
    3,
    "暂无记录",
  );
  await flushAsyncTasks();

  assert.ok(
    harness.window.document
      .getElementById("empty-host")
      .querySelector('[data-role="antd-empty"]'),
  );
  assert.equal(
    harness.window.document
      .querySelector('#empty-table [data-role="antd-empty"]')
      ?.getAttribute("data-image"),
    "simple",
  );
  assert.match(
    harness.window.document.getElementById("empty-table").textContent,
    /暂无记录/,
  );

  harness.close();
});
