const test = require("node:test");
const assert = require("node:assert/strict");
const { createWindow, loadScripts } = require("./helpers/browser-harness");

function createSettingsMarkup() {
  return `
        <div id="settings-tabs">
            <button type="button" class="border-primary text-primary" data-target="settings-general">常规</button>
            <button type="button" class="border-transparent text-gray-500" data-target="settings-backup">备份</button>
        </div>
        <div id="settings-general" class="settings-content">General</div>
        <div id="settings-backup" class="settings-content hidden">Backup</div>
        <input type="file" id="import-data-input">
        <button id="export-data-btn" type="button">导出</button>
        <button id="import-data-btn" type="button">导入</button>
    `;
}

test("bindSettingsEvents switches tabs and wires export and import actions", async () => {
  const harness = createWindow({ markup: createSettingsMarkup() });
  let exportCalls = 0;
  const importCalls = [];
  let pickerClicks = 0;

  loadScripts(harness.window, ["js/modules/settings-module.js"]);
  harness.window.exportAllData = () => {
    exportCalls += 1;
  };
  harness.window.importData = (file) => {
    importCalls.push(file.name);
  };
  harness.window.document.getElementById("import-data-input").click = () => {
    pickerClicks += 1;
  };
  harness.window.bindSettingsEvents();

  harness.window.document
    .querySelector('#settings-tabs button[data-target="settings-backup"]')
    .click();
  assert.ok(
    harness.window.document
      .getElementById("settings-general")
      .classList.contains("hidden"),
  );
  assert.ok(
    !harness.window.document
      .getElementById("settings-backup")
      .classList.contains("hidden"),
  );

  harness.window.document.getElementById("export-data-btn").click();
  harness.window.document.getElementById("import-data-btn").click();

  assert.equal(exportCalls, 1);
  assert.equal(pickerClicks, 1);

  const importInput =
    harness.window.document.getElementById("import-data-input");
  const file = new harness.window.File(["{}"], "backup.json", {
    type: "application/json",
  });

  Object.defineProperty(importInput, "files", {
    configurable: true,
    value: [file],
  });
  harness.window.queueConfirmResult(false);
  importInput.dispatchEvent(
    new harness.window.Event("change", { bubbles: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(importCalls, []);

  Object.defineProperty(importInput, "files", {
    configurable: true,
    value: [file],
  });
  harness.window.queueConfirmResult(true);
  importInput.dispatchEvent(
    new harness.window.Event("change", { bubbles: true }),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));

  assert.deepEqual(importCalls, ["backup.json"]);

  harness.close();
});
