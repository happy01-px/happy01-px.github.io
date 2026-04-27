(function initBootstrapModule(global) {
  async function bootstrapApplication() {
    if (global.__appBootstrapStarted) {
      return;
    }

    global.__appBootstrapStarted = true;
    console.log("DOM Content Loaded - Starting initialization");

    try {
      if (typeof global.startAntdInit === "function") {
        global.startAntdInit();
      }

      global.bindNavigationEvents();
      global.bindMobileEvents();
      global.renderDesktopSidebarMenu();
      global.bindModalEvents();
      global.bindActionButtons();
      global.bindBillTabEvents();
      global.bindSettingsEvents();
    } catch (error) {
      console.error("Error binding events:", error);
    }

    try {
      await global.loadMockData();
      global.loadStockMovementData();
      global.loadLogsData();

      global.initInventoryFilters();
      global.initLogFilters();
      global.initBillFilters();

      global.updateInventoryTable();
      global.updateCompanyTable();
      global.updateSupplierTable();
      global.updateCustomerTable();
      global.updateBillsTable();

      if (!global.applyHashDrivenSectionRoute()) {
        const activeLink = document.querySelector(".nav-link.active");
        if (activeLink) {
          const target = activeLink.getAttribute("data-target");
          global.showSection(target);
        }
      }
    } catch (error) {
      console.error("Error loading data:", error);
    }

    try {
      if (typeof global.renderDashboardActivity === "function") {
        global.renderDashboardActivity();
      }
    } catch (error) {
      console.error("Dashboard activity render failed:", error);
    }

    try {
      global.scheduleChartsInitialization(global.getVisiblePageSectionId());
    } catch (error) {
      console.error("Chart initialization scheduling failed:", error);
    }
  }

  function startBootstrap() {
    bootstrapApplication().catch((error) => {
      console.error("Application bootstrap failed:", error);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startBootstrap);
  } else {
    startBootstrap();
  }

  global.bootstrapApplication = bootstrapApplication;
})(window);
