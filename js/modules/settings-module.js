(function initSettingsModule(global) {
  function activateSettingsTab(targetId) {
    const settingsTabs = document.querySelectorAll("#settings-tabs button");
    settingsTabs.forEach((item) => {
      const isActive = item.getAttribute("data-target") === targetId;
      item.classList.toggle("border-primary", isActive);
      item.classList.toggle("text-primary", isActive);
      item.classList.toggle("active", isActive);
      item.classList.toggle("border-transparent", !isActive);
      item.classList.toggle("text-gray-500", !isActive);
      item.classList.toggle("hover:text-gray-700", !isActive);
      item.classList.toggle("hover:border-gray-300", !isActive);
      item.setAttribute("aria-selected", String(isActive));
    });

    document.querySelectorAll(".settings-content").forEach((content) => {
      content.classList.toggle("hidden", content.id !== targetId);
    });
  }

  function returnToHistoricalImportSettings() {
    if (typeof global.showSection === "function") {
      global.showSection("settings");
    }
    activateSettingsTab("settings-history-import");
  }

  function bindSettingsEvents() {
    const settingsTabs = document.querySelectorAll("#settings-tabs button");
    settingsTabs.forEach((tab) => {
      tab.addEventListener("click", function onClick() {
        const targetId = this.getAttribute("data-target");
        activateSettingsTab(targetId);
      });
    });

    const exportBtn = document.getElementById("export-data-btn");
    if (exportBtn) {
      exportBtn.addEventListener("click", exportAllData);
    }

    const importBtn = document.getElementById("import-data-btn");
    const importInput = document.getElementById("import-data-input");
    if (importBtn && importInput) {
      importBtn.addEventListener("click", () => importInput.click());
      importInput.addEventListener("change", async (event) => {
        if (event.target.files.length > 0) {
          const ok = await window.showAntdConfirm({
            title: "导入数据",
            content: "导入数据将覆盖当前所有数据，确定要继续吗？",
            okText: "继续",
            cancelText: "取消",
          });
          if (ok) {
            importData(event.target.files[0]);
          }
          event.target.value = "";
        }
      });
    }

    const historicalImportBtn = document.getElementById(
      "historical-business-import-btn",
    );
    const historicalImportInput = document.getElementById(
      "historical-business-import-input",
    );
    if (historicalImportBtn && historicalImportInput) {
      historicalImportBtn.addEventListener("click", () => {
        global.openDeliveryNoteImportPicker?.();
      });
      historicalImportInput.addEventListener("change", (event) => {
        global.handleDeliveryNoteImportFiles?.(event.target.files);
        event.target.value = "";
      });
    }

    const goInventoryBtn = document.getElementById("settings-go-inventory-btn");
    if (goInventoryBtn) {
      goInventoryBtn.addEventListener("click", () => {
        if (typeof global.showSection === "function") {
          global.showSection("inventory");
        }
      });
    }

    const importWorkflowBack = document.getElementById(
      "history-import-back-to-settings",
    );
    if (importWorkflowBack) {
      importWorkflowBack.addEventListener(
        "click",
        returnToHistoricalImportSettings,
      );
    }
  }

  global.activateSettingsTab = activateSettingsTab;
  global.returnToHistoricalImportSettings = returnToHistoricalImportSettings;
  global.bindSettingsEvents = bindSettingsEvents;
  global.AppSettingsModule = Object.freeze({
    activateSettingsTab,
    returnToHistoricalImportSettings,
    bindSettingsEvents,
  });
})(window);
