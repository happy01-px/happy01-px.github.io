const test = require("node:test");
const assert = require("node:assert/strict");
const { createWindow, loadScripts } = require("./helpers/browser-harness");

test("AppState exposes synchronized property accessors on window", () => {
  const harness = createWindow();
  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
  ]);

  const replacement = harness.window.normalizeMockData({
    products: [{ id: "P999" }],
  });
  harness.window.mockData = replacement;
  harness.window.AppState.logsData = [{ id: "LOGX" }];

  assert.equal(harness.window.AppState.mockData, replacement);
  assert.deepEqual(harness.window.logsData, [{ id: "LOGX" }]);

  harness.close();
});

test("AppState reuses an existing state object when one is already present", () => {
  const harness = createWindow();
  loadScripts(harness.window, ["js/modules/app-utils.js"]);

  const existingState = {
    defaultMockData: harness.window.normalizeMockData(),
    defaultStockMovementData: [{ id: "SM-A" }],
    defaultLogsData: [],
    mockData: harness.window.normalizeMockData(),
    stockMovementData: [{ id: "SM-B" }],
    logsData: [{ id: "LOG-A" }],
  };
  harness.window.AppState = existingState;

  loadScripts(harness.window, ["js/modules/app-state.js"]);

  assert.equal(harness.window.AppState, existingState);
  assert.deepEqual(harness.window.stockMovementData, [{ id: "SM-B" }]);
  assert.deepEqual(harness.window.logsData, [{ id: "LOG-A" }]);

  harness.close();
});
