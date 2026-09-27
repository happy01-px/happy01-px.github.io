const test = require("node:test");
const assert = require("node:assert/strict");
const { createWindow, loadScripts } = require("./helpers/browser-harness");

test("antd bridge initializes once and notifies queued listeners", () => {
  const harness = createWindow({ loadReactRuntime: true });
  let initCalls = 0;
  let readyCalls = 0;
  harness.window.initAntdComponents = () => {
    initCalls += 1;
    return true;
  };

  loadScripts(harness.window, ["js/ui/antd-bridge.js"]);
  assert.equal(harness.window.hasCoreUiDependencies(), true);
  assert.equal(harness.window.hasCoreUiDependencies(true), true);
  harness.window.onUiRuntimeReady(() => {
    readyCalls += 1;
  });

  assert.equal(harness.window.startAntdInit(), true);
  assert.equal(harness.window.startAntdInit(), true);
  assert.equal(initCalls, 1);
  assert.equal(readyCalls, 1);

  harness.window.onUiRuntimeReady(() => {
    readyCalls += 1;
  });
  assert.equal(readyCalls, 2);
  harness.close();
});

test("antd bridge schedules one retry while dependencies are unavailable", () => {
  const harness = createWindow();
  const scheduled = [];
  harness.window.setTimeout = (callback) => {
    scheduled.push(callback);
    return scheduled.length;
  };

  loadScripts(harness.window, ["js/ui/antd-bridge.js"]);
  assert.equal(harness.window.hasCoreUiDependencies(), false);
  assert.equal(harness.window.startAntdInit(), false);
  assert.equal(harness.window.startAntdInit(), false);
  assert.equal(scheduled.length, 1);

  harness.close();
});

test("antd bridge renders a safe fallback after retries are exhausted", () => {
  const harness = createWindow({
    markup: `
      <div id="log-date-range-picker-container"></div>
      <div id="bills-date-range-picker-container" data-rendered="true"></div>
    `,
  });
  harness.window.escapeHTML = (value) => String(value).replace(/</g, "&lt;");

  loadScripts(harness.window, ["js/ui/antd-bridge.js"]);
  assert.equal(harness.window.startAntdInit(12), false);

  const fallback = harness.window.document.getElementById(
    "log-date-range-picker-container",
  );
  assert.match(fallback.textContent, /组件加载失败/);
  assert.equal(
    harness.window.document.getElementById("bills-date-range-picker-container")
      .textContent,
    "",
  );
  assert.doesNotThrow(() => harness.window.onUiRuntimeReady(null));
  harness.close();
});

test("antd bridge retries when component initialization returns false", () => {
  const harness = createWindow({ loadReactRuntime: true });
  let scheduled = 0;
  harness.window.setTimeout = () => {
    scheduled += 1;
    return scheduled;
  };
  harness.window.initAntdComponents = () => false;

  loadScripts(harness.window, ["js/ui/antd-bridge.js"]);
  assert.equal(harness.window.startAntdInit(), false);
  assert.equal(scheduled, 1);
  harness.close();
});
