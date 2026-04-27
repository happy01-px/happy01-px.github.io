const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createLogsMarkup() {
  return `
        <section id="logs" class="page-section">
            <input id="log-filter-type" value="">
            <input id="log-filter-user" value="">
            <input id="log-filter-date-start" value="">
            <input id="log-filter-date-end" value="">
            <input id="log-filter-search" value="">
            <table><tbody id="logs-table-body"></tbody></table>
            <div id="logs-pagination-container"></div>
        </section>
    `;
}

test("addLog prepends a record and re-renders the visible logs table", () => {
  const harness = createWindow({ markup: createLogsMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/data-store.js",
    "js/modules/stock-module.js",
    "js/modules/logs-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.addLog("delete", "product", "Widget", "Removed one widget");

  assert.equal(harness.window.logsData[0].actionType, "delete");
  assert.equal(harness.window.logsData[0].details, "Removed one widget");
  assert.equal(
    harness.window.document.querySelectorAll("#logs-table-body tr").length,
    3,
  );

  harness.close();
});

test("renderLogsTable supports filters and empty states", () => {
  const harness = createWindow({ markup: createLogsMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/data-store.js",
    "js/modules/stock-module.js",
    "js/modules/logs-module.js",
  ]);
  applyFixtureState(harness.window, fixture);

  harness.window.document.getElementById("log-filter-type").value = "edit";
  harness.window.document.getElementById("log-filter-user").value = "audit";
  harness.window.document.getElementById("log-filter-search").value = "acme";
  harness.window.renderLogsTable();

  const firstPassRows = harness.window.document.querySelectorAll(
    "#logs-table-body tr",
  );
  assert.equal(firstPassRows.length, 1);
  assert.match(firstPassRows[0].textContent, /Auditor/);
  assert.match(firstPassRows[0].textContent, /Acme Supply/);

  harness.window.document.getElementById("log-filter-search").value = "missing";
  harness.window.renderLogsTable();

  assert.match(
    harness.window.document.getElementById("logs-table-body").textContent,
    /没有找到匹配的日志记录/,
  );

  harness.close();
});
