(function initRouterModule(global) {
  function showSection(sectionId, options = {}) {
    console.log("Showing section:", sectionId);
    const config = options || {};
    const normalizedSection = global.normalizeDesktopSidebarSection(sectionId);

    global.setLegacyDesktopNavState(normalizedSection);
    global.setMobileNavState(normalizedSection);
    global.renderDesktopSidebarMenu(normalizedSection);

    const sections = document.querySelectorAll(".page-section");
    sections.forEach((section) => {
      section.classList.add("hidden");
    });

    const targetSection = document.getElementById(sectionId);
    if (!targetSection) {
      console.error("Target section not found:", sectionId);
      return;
    }

    targetSection.classList.remove("hidden");

    const nextHash = config.routeHash || `#${sectionId}`;
    if (!config.skipHashSync && global.location.hash !== nextHash) {
      global.location.hash = nextHash;
    }

    if (
      sectionId === "dashboard" &&
      typeof global.renderDashboardActivity === "function"
    ) {
      global.renderDashboardActivity();
    } else if (sectionId === "bills") {
      global.initBillFilters();
      global.updateBillsTable();
    } else if (sectionId === "logs") {
      global.renderLogsTable();
    } else if (sectionId === "stock-movement") {
      global.renderStockMovementTable("all");
    }

    if (sectionId === "dashboard" || sectionId === "reports") {
      global.scheduleChartsInitialization(sectionId);
    }
  }

  function getSectionIdFromHash(hashValue = global.location.hash) {
    const rawHash = String(hashValue || "").trim();
    if (!rawHash || !rawHash.startsWith("#") || rawHash.startsWith("#/")) {
      return "";
    }

    return rawHash.slice(1);
  }

  function applyHashDrivenSectionRoute(hashValue = global.location.hash) {
    const sectionId = getSectionIdFromHash(hashValue);
    if (!sectionId) {
      return false;
    }

    if (!document.getElementById(sectionId)) {
      return false;
    }

    showSection(sectionId, { skipHashSync: true });
    return true;
  }

  global.addEventListener("hashchange", function onHashChange() {
    if (String(global.location.hash || "").startsWith("#/")) {
      return;
    }

    applyHashDrivenSectionRoute();
  });

  global.showSection = showSection;
  global.getSectionIdFromHash = getSectionIdFromHash;
  global.applyHashDrivenSectionRoute = applyHashDrivenSectionRoute;
})(window);
