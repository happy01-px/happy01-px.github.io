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
