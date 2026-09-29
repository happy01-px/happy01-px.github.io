(function initRouterModule(global) {
  const PAGE_HEADER_META = Object.freeze({
    dashboard: {
      title: "仪表盘",
      subtitle: "欢迎回来，管理员！这是您的库存管理概览。",
    },
    inventory: {
      title: "库存管理",
      subtitle: "管理所有商品库存",
    },
    "price-management": {
      title: "采购与客户价格表",
      subtitle: "查看每次进货成本，并按“公司 + 客户”维护独立商品参考价。",
    },
    "sales-order": {
      title: "新增出货",
      subtitle: "按销售出库单格式填写公司、客户和商品信息。",
    },
    suppliers: {
      title: "供应商管理",
      subtitle: "管理所有供应商信息",
    },
    companies: {
      title: "公司管理",
      subtitle: "管理所有公司信息",
    },
    customers: {
      title: "客户管理",
      subtitle: "管理所有客户信息",
    },
    "stock-movement": {
      title: "进出货管理",
      subtitle: "管理商品的进货和出货记录",
    },
    logs: {
      title: "日志系统",
      subtitle: "查看所有操作日志记录",
    },
    bills: {
      title: "对账单系统",
      subtitle: "管理所有客户和供应商对账单",
    },
    reports: {
      title: "报表分析",
      subtitle: "查看库存和财务报表",
    },
    settings: {
      title: "系统设置",
      subtitle: "查看库存规则并管理数据备份",
    },
    "history-import-workflow": {
      title: "历史送货单导入",
      subtitle: "核对解析资料并预览本次实际变更，最终确认后才写入系统。",
    },
    "business-form-workflow": {
      title: "业务资料维护",
      subtitle: "在独立页面中完成新增或修改，保存成功后返回原业务页面。",
    },
    "usage-guide": {
      title: "系统使用说明",
      subtitle: "按业务发生顺序建档，系统会自动校验前置数据并保护历史记录。",
    },
  });

  function preparePageHeadingLayout() {
    document.querySelectorAll(".page-section").forEach((section) => {
      const headingShell = section.firstElementChild;
      const heading = headingShell?.querySelector("h2");
      const headingCopy = heading?.parentElement;

      if (
        !headingShell ||
        !headingCopy ||
        !headingShell.contains(headingCopy)
      ) {
        return;
      }

      headingShell.classList.add("page-heading-shell");
      headingCopy.classList.add("page-heading-copy");

      if (
        headingCopy === headingShell ||
        (headingShell.children.length === 1 &&
          headingShell.firstElementChild === headingCopy)
      ) {
        headingShell.classList.add("page-heading-shell-empty");
      }
    });
  }

  function updatePageHeader(sectionId) {
    const pageMeta = PAGE_HEADER_META[sectionId];
    if (!pageMeta) {
      return false;
    }

    const title = document.getElementById("app-page-header-title");
    const subtitle = document.getElementById("app-page-header-subtitle");

    if (title) {
      title.textContent = pageMeta.title;
    }
    if (subtitle) {
      subtitle.textContent = pageMeta.subtitle;
    }

    return Boolean(title || subtitle);
  }

  function showSection(sectionId, options = {}) {
    console.log("Showing section:", sectionId);
    const config = options || {};
    const visibleSectionId = document.querySelector(
      ".page-section:not(.hidden)",
    )?.id;
    if (
      !config.skipUnsavedCheck &&
      visibleSectionId &&
      visibleSectionId !== sectionId &&
      typeof global.requestAppNavigation === "function"
    ) {
      const canNavigate = global.requestAppNavigation(() =>
        showSection(sectionId, { ...config, skipUnsavedCheck: true }),
      );
      if (canNavigate === false) return;
    }
    const targetSection = document.getElementById(sectionId);
    if (!targetSection) {
      console.error("Target section not found:", sectionId);
      return;
    }
    const navSection =
      config.navSection || targetSection.dataset.navSection || sectionId;
    const normalizedSection = global.normalizeDesktopSidebarSection(navSection);

    global.setLegacyDesktopNavState(normalizedSection);
    global.setMobileNavState(normalizedSection);
    global.renderDesktopSidebarMenu(normalizedSection);

    preparePageHeadingLayout();
    updatePageHeader(sectionId);

    const targetWasHidden = targetSection.classList.contains("hidden");
    const sections = document.querySelectorAll(".page-section");
    sections.forEach((section) => {
      section.classList.add("hidden");
    });

    targetSection.classList.remove("hidden");

    if (!config.preserveScroll) {
      const main = document.querySelector("main");
      if (main) {
        main.scrollTop = 0;
        if (typeof main.scrollTo === "function") {
          main.scrollTo({ top: 0, left: 0, behavior: "auto" });
        }
      }
    }

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
    } else if (sectionId === "price-management") {
      global.renderPriceManagement?.();
    } else if (
      sectionId === "sales-order" &&
      targetWasHidden &&
      typeof global.initSalesOrder === "function"
    ) {
      global.initSalesOrder();
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
  global.PAGE_HEADER_META = PAGE_HEADER_META;
  global.preparePageHeadingLayout = preparePageHeadingLayout;
  global.updatePageHeader = updatePageHeader;
})(window);
