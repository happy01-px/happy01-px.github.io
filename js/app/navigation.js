(function initNavigationModule(global) {
  const DESKTOP_SIDEBAR_SUBMENU_KEY = "management-center";
  const DESKTOP_SIDEBAR_CHILD_KEYS = new Set([
    "suppliers",
    "customers",
    "companies",
  ]);
  const DESKTOP_SIDEBAR_SECTION_MAP = {
    "sales-order": "stock-movement",
    "bills-create": "bills",
    "bills-view": "bills",
  };

  let desktopSidebarMenuSelectedKey = "dashboard";
  let desktopSidebarMenuOpenKeys = [DESKTOP_SIDEBAR_SUBMENU_KEY];

  function normalizeDesktopSidebarSection(sectionId) {
    return DESKTOP_SIDEBAR_SECTION_MAP[sectionId] || sectionId;
  }

  function getVisiblePageSectionId() {
    const visibleSection = document.querySelector(".page-section:not(.hidden)");
    return visibleSection ? visibleSection.id : "";
  }

  function setLegacyDesktopNavState(sectionId) {
    const normalizedSection = normalizeDesktopSidebarSection(sectionId);
    const navLinks = document.querySelectorAll("#desktop-sidebar .nav-link");
    navLinks.forEach((item) =>
      item.classList.remove("active", "bg-gray-800", "text-white"),
    );

    const activeLink = document.querySelector(
      `#desktop-sidebar .nav-link[data-target="${normalizedSection}"]`,
    );
    if (activeLink) {
      activeLink.classList.add("active", "bg-gray-800", "text-white");
    }
  }

  function setMobileNavState(sectionId) {
    const normalizedSection = normalizeDesktopSidebarSection(sectionId);
    const mobileNavLinks = document.querySelectorAll(".mobile-nav-link");
    mobileNavLinks.forEach((item) =>
      item.classList.remove("active", "bg-gray-800", "text-white"),
    );

    const activeLink = document.querySelector(
      `.mobile-nav-link[data-target="${normalizedSection}"]`,
    );
    if (activeLink) {
      activeLink.classList.add("active", "bg-gray-800", "text-white");
    }
  }

  function createDesktopSidebarIcon(iconClass) {
    if (!global.React) return null;
    return global.React.createElement("i", {
      className: iconClass,
      "aria-hidden": "true",
    });
  }

  function getDesktopSidebarMenuItems() {
    return [
      {
        key: "dashboard",
        label: "仪表盘",
        icon: createDesktopSidebarIcon("fa fa-dashboard"),
      },
      {
        key: "inventory",
        label: "库存管理",
        icon: createDesktopSidebarIcon("fa fa-list"),
      },
      {
        key: "stock-movement",
        label: "进出货管理",
        icon: createDesktopSidebarIcon("fa fa-exchange"),
      },
      {
        key: DESKTOP_SIDEBAR_SUBMENU_KEY,
        label: "管理中心",
        icon: createDesktopSidebarIcon("fa fa-cogs"),
        children: [
          { key: "suppliers", label: "供应商管理" },
          { key: "customers", label: "客户管理" },
          { key: "companies", label: "公司管理" },
        ],
      },
      {
        key: "logs",
        label: "日志系统",
        icon: createDesktopSidebarIcon("fa fa-history"),
      },
      {
        key: "bills",
        label: "对账单系统",
        icon: createDesktopSidebarIcon("fa fa-file-text"),
      },
      {
        key: "reports",
        label: "报表分析",
        icon: createDesktopSidebarIcon("fa fa-bar-chart"),
      },
      {
        key: "settings",
        label: "系统设置",
        icon: createDesktopSidebarIcon("fa fa-cog"),
      },
    ];
  }

  function renderDesktopSidebarMenu(sectionId = "") {
    const container = document.getElementById("desktop-sidebar-menu");
    const fallbackNav = document.querySelector("#desktop-sidebar nav > ul");
    if (!container) return false;

    if (!global.React || !global.ReactDOM || !global.antd) {
      if (fallbackNav) fallbackNav.classList.remove("hidden");
      return false;
    }

    if (fallbackNav) fallbackNav.classList.add("hidden");

    const resolvedSectionId =
      sectionId || getVisiblePageSectionId() || desktopSidebarMenuSelectedKey;
    const normalizedSection = normalizeDesktopSidebarSection(resolvedSectionId);
    desktopSidebarMenuSelectedKey = normalizedSection;

    if (DESKTOP_SIDEBAR_CHILD_KEYS.has(normalizedSection)) {
      desktopSidebarMenuOpenKeys = [DESKTOP_SIDEBAR_SUBMENU_KEY];
    }

    const React = global.React;
    const ReactDOM = global.ReactDOM;
    const { Menu, ConfigProvider, theme } = global.antd;

    if (!container._reactRoot) {
      container._reactRoot = ReactDOM.createRoot(container);
    }

    const handleOpenChange = (keys) => {
      desktopSidebarMenuOpenKeys = keys.includes(DESKTOP_SIDEBAR_SUBMENU_KEY)
        ? [DESKTOP_SIDEBAR_SUBMENU_KEY]
        : [];
      renderDesktopSidebarMenu();
    };

    const handleClick = (info) => {
      if (typeof global.showSection === "function") {
        global.showSection(info.key);
      }
    };

    container._reactRoot.render(
      React.createElement(
        ConfigProvider,
        {
          theme: {
            algorithm: theme.darkAlgorithm,
            token: {
              colorPrimary: "#1677ff",
              borderRadius: 10,
              fontSize: 15,
            },
            components: {
              Menu: {
                darkItemBg: "transparent",
                darkSubMenuItemBg: "transparent",
                darkItemColor: "rgba(255,255,255,0.78)",
                darkItemHoverColor: "#ffffff",
                darkItemHoverBg: "rgba(255,255,255,0.08)",
                darkItemSelectedBg: "#1677ff",
                darkItemSelectedColor: "#ffffff",
                itemBorderRadius: 10,
                subMenuItemBorderRadius: 8,
                itemHeight: 44,
                iconSize: 16,
              },
            },
          },
        },
        React.createElement(Menu, {
          theme: "dark",
          mode: "inline",
          inlineIndent: 20,
          triggerSubMenuAction: "click",
          style: {
            width: "100%",
            background: "transparent",
            borderInlineEnd: "none",
          },
          items: getDesktopSidebarMenuItems(),
          selectedKeys: [desktopSidebarMenuSelectedKey],
          openKeys: desktopSidebarMenuOpenKeys,
          onOpenChange: handleOpenChange,
          onClick: handleClick,
        }),
      ),
    );

    return true;
  }

  function bindElementEventOnce(element, datasetKey, eventName, handler) {
    if (!element) return false;
    if (element.dataset[datasetKey] === "true") return false;

    element.dataset[datasetKey] = "true";
    element.addEventListener(eventName, handler);
    return true;
  }

  function bindDocumentEventOnce(datasetKey, eventName, handler) {
    const bindingHost = document.body || document.documentElement;
    if (!bindingHost) return false;
    if (bindingHost.dataset[datasetKey] === "true") return false;

    bindingHost.dataset[datasetKey] = "true";
    document.addEventListener(eventName, handler);
    return true;
  }

  function bindNavigationEvents() {
    const navLinks = document.querySelectorAll(".nav-link");
    console.log("Found nav links:", navLinks.length);
    navLinks.forEach((link) => {
      bindElementEventOnce(
        link,
        "navigationClickBound",
        "click",
        function onNavigate(e) {
          e.preventDefault();
          const target = this.getAttribute("data-target");
          console.log("Navigating to:", target);
          if (typeof global.showSection === "function") {
            global.showSection(target);
          }

          navLinks.forEach((item) =>
            item.classList.remove("active", "bg-gray-800", "text-white"),
          );
          this.classList.add("active", "bg-gray-800", "text-white");
        },
      );
    });

    const stockTabsContainer = document.getElementById("stock-tabs");
    if (
      stockTabsContainer &&
      !stockTabsContainer.querySelector('[data-tab="delivery-note"]')
    ) {
      const deliveryNoteTabItem = document.createElement("li");
      deliveryNoteTabItem.className = "mr-2";
      deliveryNoteTabItem.setAttribute("role", "presentation");
      deliveryNoteTabItem.innerHTML = `
                <button class="inline-block p-4 border-b-2 border-transparent hover:text-gray-600 hover:border-gray-300 rounded-t-lg" id="delivery-note-tab-page" data-tab="delivery-note" type="button" role="tab" aria-selected="false">
                    送货单记录
                </button>
            `;
      stockTabsContainer.appendChild(deliveryNoteTabItem);
    }

    document
      .querySelectorAll('[data-tab="delivery-note"]')
      .forEach((tabButton) => {
        if (!tabButton.closest("#stock-tabs")) {
          const tabListItem = tabButton.closest("li");
          if (tabListItem) {
            tabListItem.remove();
          }
        }
      });

    const stockTabs = document.querySelectorAll("#stock-tabs button");
    stockTabs.forEach((tab) => {
      bindElementEventOnce(
        tab,
        "stockTabClickBound",
        "click",
        function onTabClick() {
          stockTabs.forEach((button) => {
            button.classList.remove("active", "border-primary", "text-primary");
            button.classList.add("border-transparent");
          });
          this.classList.add("active", "border-primary", "text-primary");
          this.classList.remove("border-transparent");

          global.paginationState.stock.page = 1;

          const tabType = this.getAttribute("data-tab");
          global.renderStockMovementTable(tabType);
        },
      );
    });

    const navDropdowns = document.querySelectorAll(".nav-dropdown > a");
    navDropdowns.forEach((dropdown) => {
      bindElementEventOnce(
        dropdown,
        "dropdownClickBound",
        "click",
        function onDropdownClick(e) {
          e.preventDefault();
          const submenu = this.nextElementSibling;
          const icon = this.querySelector(".fa-chevron-down");
          if (submenu.classList.contains("hidden")) {
            submenu.classList.remove("hidden");
            icon.style.transform = "rotate(180deg)";
          } else {
            submenu.classList.add("hidden");
            icon.style.transform = "rotate(0deg)";
          }
        },
      );
    });
  }

  function bindMobileEvents() {
    const mobileNavLinks = document.querySelectorAll(".mobile-nav-link");
    mobileNavLinks.forEach((link) => {
      bindElementEventOnce(
        link,
        "mobileNavigationClickBound",
        "click",
        function onMobileNavigate(e) {
          e.preventDefault();
          const target = this.getAttribute("data-target");
          if (typeof global.showSection === "function") {
            global.showSection(target);
          }
          mobileNavLinks.forEach((item) =>
            item.classList.remove("active", "bg-gray-800", "text-white"),
          );
          this.classList.add("active", "bg-gray-800", "text-white");
          const mobileSidebar = document.getElementById("mobile-sidebar");
          if (mobileSidebar) mobileSidebar.classList.add("hidden");
        },
      );
    });

    const mobileMenuBtn = document.getElementById("mobile-menu-button");
    if (mobileMenuBtn) {
      bindElementEventOnce(
        mobileMenuBtn,
        "mobileMenuClickBound",
        "click",
        function onOpenMobileMenu() {
          document.getElementById("mobile-sidebar").classList.remove("hidden");
        },
      );
    }

    const sidebarToggleBtn = document.getElementById("sidebar-toggle-button");
    if (sidebarToggleBtn) {
      bindElementEventOnce(
        sidebarToggleBtn,
        "sidebarToggleClickBound",
        "click",
        function onSidebarToggle() {
          const isDesktop = global.innerWidth >= 768;
          if (isDesktop) {
            const desktopSidebar = document.getElementById("desktop-sidebar");
            if (!desktopSidebar) return;
            desktopSidebar.style.display =
              desktopSidebar.style.display === "none" ? "" : "none";
            return;
          }

          const mobileSidebar = document.getElementById("mobile-sidebar");
          if (mobileSidebar) {
            mobileSidebar.classList.toggle("hidden");
          }
        },
      );
    }

    const closeMobileMenuBtn = document.getElementById("close-mobile-menu");
    if (closeMobileMenuBtn) {
      bindElementEventOnce(
        closeMobileMenuBtn,
        "closeMobileMenuClickBound",
        "click",
        function onCloseMobileMenu() {
          document.getElementById("mobile-sidebar").classList.add("hidden");
        },
      );
    }

    const userMenuBtn = document.getElementById("user-menu-button");
    if (userMenuBtn) {
      bindElementEventOnce(
        userMenuBtn,
        "userMenuClickBound",
        "click",
        function onToggleUserMenu() {
          document.getElementById("user-menu").classList.toggle("hidden");
        },
      );
    }

    bindDocumentEventOnce(
      "userMenuDocumentClickBound",
      "click",
      function onDocumentClick(e) {
        const userMenu = document.getElementById("user-menu");
        const userMenuButton = document.getElementById("user-menu-button");
        if (
          userMenu &&
          userMenuButton &&
          !userMenu.contains(e.target) &&
          !userMenuButton.contains(e.target)
        ) {
          userMenu.classList.add("hidden");
        }
      },
    );
  }

  function resetPaginationAfterDataChange(clearTotals = false) {
    Object.values(global.paginationState || {}).forEach((state) => {
      if (!state || typeof state !== "object") return;
      state.page = 1;
      if (clearTotals) state.total = 0;
    });
  }

  function refreshViewsAfterDataChange(clearTotals = false) {
    resetPaginationAfterDataChange(clearTotals);

    if (typeof global.updateInventoryTable === "function") {
      global.updateInventoryTable();
    }
    if (typeof global.updateCompanyTable === "function") {
      global.updateCompanyTable();
    }
    if (typeof global.updateSupplierTable === "function") {
      global.updateSupplierTable();
    }
    if (typeof global.updateCustomerTable === "function") {
      global.updateCustomerTable();
    }
    if (typeof global.renderStockMovementTable === "function") {
      global.renderStockMovementTable("all");
    }
    if (typeof global.renderLogsTable === "function") {
      global.renderLogsTable();
    }
    if (typeof global.initBillFilters === "function") {
      global.initBillFilters();
    }
    if (typeof global.updateBillsTable === "function") {
      global.updateBillsTable();
    }
    if (typeof global.renderDashboardActivity === "function") {
      global.renderDashboardActivity();
    }
    if (typeof global.initSalesOrder === "function") {
      global.initSalesOrder();
    }
  }

  async function requestClearAllDataConfirmation() {
    const firstConfirmed =
      typeof global.showAntdConfirm === "function"
        ? await global.showAntdConfirm({
            title: "确认清除所有数据？",
            content: [
              "此操作会清空商品、供应商、客户、公司、进出货记录、送货单、对账单和日志。",
              "建议先在系统设置里导出备份；清空后无法从页面恢复。",
            ],
            okText: "继续",
            cancelText: "取消",
            okType: "primary",
            width: 520,
          })
        : global.confirm("确认清除所有数据？");

    if (!firstConfirmed) return false;

    return typeof global.showAntdConfirm === "function"
      ? global.showAntdConfirm({
          title: "二次确认：清空后不可恢复",
          content: [
            "这是危险操作，会把所有数据文件写成空表。",
            "请确认你确实要清空当前系统内全部业务数据。",
          ],
          okText: "确认清空",
          cancelText: "取消",
          okType: "danger",
          okButtonProps: {
            danger: true,
            style: {
              backgroundColor: "#ef4444",
              borderColor: "#ef4444",
              color: "#ffffff",
            },
          },
          width: 520,
        })
      : global.confirm("二次确认：确定清空全部数据？");
  }

  async function handleClearAllDataClick(event) {
    event.preventDefault();
    const button = event.currentTarget;

    const confirmed = await requestClearAllDataConfirmation();
    if (!confirmed) return;

    if (typeof global.clearAllSystemData !== "function") {
      alert("清空失败：系统尚未加载数据服务。");
      return;
    }

    const previousHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add("opacity-70", "cursor-not-allowed");
    button.innerHTML =
      '<i class="fa fa-spinner fa-spin"></i><span>清空中...</span>';

    try {
      const persisted = await global.clearAllSystemData();
      refreshViewsAfterDataChange(true);

      const mobileSidebar = document.getElementById("mobile-sidebar");
      if (mobileSidebar) {
        mobileSidebar.classList.add("hidden");
      }

      if (persisted) {
        global.showAntdMessage?.("success", "所有数据已清空并保存。");
      } else if (global.getDataPersistenceMode?.() === "memory") {
        global.showAntdMessage?.(
          "warning",
          "所有数据已在当前页面清空，但当前未连接数据目录，无法持久保存。",
        );
      } else {
        global.showAntdMessage?.("error", "清空失败，原数据已保留。");
      }
    } finally {
      button.disabled = false;
      button.classList.remove("opacity-70", "cursor-not-allowed");
      button.innerHTML = previousHtml;
    }
  }

  async function handleSeedTestDataClick(event) {
    event.preventDefault();
    const button = event.currentTarget;

    if (typeof global.seedTestData !== "function") {
      global.showAntdMessage?.("error", "写入失败：系统尚未加载数据服务。");
      return;
    }

    const previousHtml = button.innerHTML;
    button.disabled = true;
    button.classList.add("opacity-70", "cursor-not-allowed");
    button.innerHTML =
      '<i class="fa fa-spinner fa-spin"></i><span>写入中...</span>';

    try {
      const result = await global.seedTestData();

      if (!result?.success) {
        global.showAntdMessage?.("error", "测试数据写入失败，原数据已保留。");
        return;
      }

      refreshViewsAfterDataChange();

      const mobileSidebar = document.getElementById("mobile-sidebar");
      if (mobileSidebar) mobileSidebar.classList.add("hidden");

      if (result.createdCount === 0) {
        const conflictText = result.conflictCount
          ? "客户编号 KH 已被其他客户占用，请先修改该编号。"
          : "预设测试数据已存在，本次未重复写入。";
        global.showAntdMessage?.(
          result.conflictCount ? "warning" : "info",
          conflictText,
        );
      } else if (!result.persisted) {
        global.showAntdMessage?.(
          "warning",
          `已在当前页面写入 ${result.createdCount} 条测试数据和 ${result.logCount} 条日志，但未连接数据目录，刷新后不会保留。`,
        );
      } else if (result.conflictCount) {
        global.showAntdMessage?.(
          "warning",
          `已写入 ${result.createdCount} 条测试数据；客户编号 KH 已被占用，客户数据未写入。`,
        );
      } else {
        global.showAntdMessage?.(
          "success",
          `已写入 ${result.createdCount} 条测试数据，并生成 ${result.logCount} 条日志。`,
        );
      }
    } finally {
      button.disabled = false;
      button.classList.remove("opacity-70", "cursor-not-allowed");
      button.innerHTML = previousHtml;
    }
  }

  function bindModalEvents() {
    const modal = document.getElementById("modal");
    const closeModal = document.getElementById("close-modal");
    const modalCancel = document.getElementById("modal-cancel");

    if (closeModal && modal) {
      bindElementEventOnce(
        closeModal,
        "modalCloseClickBound",
        "click",
        function onCloseModal() {
          modal.classList.add("hidden");
        },
      );
    }

    if (modalCancel && modal) {
      bindElementEventOnce(
        modalCancel,
        "modalCancelClickBound",
        "click",
        function onCancelModal() {
          modal.classList.add("hidden");
        },
      );
    }

    if (modal) {
      bindElementEventOnce(
        modal,
        "modalOverlayClickBound",
        "click",
        function onOverlayClick(e) {
          if (e.target === modal) {
            modal.classList.add("hidden");
          }
        },
      );
    }
  }

  function bindActionButtons() {
    const addSupplierBtn = document.getElementById("add-supplier-btn");
    if (addSupplierBtn) {
      bindElementEventOnce(
        addSupplierBtn,
        "addSupplierClickBound",
        "click",
        global.showAddSupplierModal,
      );
    }

    const addProductBtn = document.getElementById("add-product-btn");
    if (addProductBtn) {
      bindElementEventOnce(
        addProductBtn,
        "addProductClickBound",
        "click",
        global.showAddProductModal,
      );
    }

    const addCustomerBtn = document.getElementById("add-customer-btn");
    if (addCustomerBtn) {
      bindElementEventOnce(
        addCustomerBtn,
        "addCustomerClickBound",
        "click",
        global.showAddCustomerModal,
      );
    }

    const addCompanyBtn = document.getElementById("add-company-btn");
    if (addCompanyBtn) {
      bindElementEventOnce(
        addCompanyBtn,
        "addCompanyClickBound",
        "click",
        global.showAddCompanyModal,
      );
    }

    const addInboundBtn = document.getElementById("add-inbound-btn");
    if (addInboundBtn) {
      bindElementEventOnce(
        addInboundBtn,
        "addInboundClickBound",
        "click",
        global.showAddInboundModal,
      );
    }

    const addOutboundBtn = document.getElementById("add-outbound-btn");
    if (addOutboundBtn) {
      bindElementEventOnce(
        addOutboundBtn,
        "addOutboundClickBound",
        "click",
        function onAddOutbound() {
          if (typeof global.showSection === "function") {
            global.showSection("sales-order");
          }
          if (typeof global.initSalesOrder === "function") {
            global.initSalesOrder();
          }
        },
      );
    }

    [
      document.getElementById("seed-test-data-button"),
      document.getElementById("mobile-seed-test-data-button"),
    ].forEach((button) => {
      if (!button) return;
      bindElementEventOnce(
        button,
        "seedTestDataClickBound",
        "click",
        handleSeedTestDataClick,
      );
    });

    [
      document.getElementById("clear-all-data-button"),
      document.getElementById("mobile-clear-all-data-button"),
    ].forEach((button) => {
      if (!button) return;
      bindElementEventOnce(
        button,
        "clearAllDataClickBound",
        "click",
        handleClearAllDataClick,
      );
    });
  }

  global.normalizeDesktopSidebarSection = normalizeDesktopSidebarSection;
  global.getVisiblePageSectionId = getVisiblePageSectionId;
  global.setLegacyDesktopNavState = setLegacyDesktopNavState;
  global.setMobileNavState = setMobileNavState;
  global.renderDesktopSidebarMenu = renderDesktopSidebarMenu;
  global.bindElementEventOnce = bindElementEventOnce;
  global.bindDocumentEventOnce = bindDocumentEventOnce;
  global.bindNavigationEvents = bindNavigationEvents;
  global.bindMobileEvents = bindMobileEvents;
  global.bindModalEvents = bindModalEvents;
  global.bindActionButtons = bindActionButtons;
})(window);
