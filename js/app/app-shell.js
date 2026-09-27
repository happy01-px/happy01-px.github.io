// 应用启动、导航、路由和图表初始化已拆分到独立脚本。

// 共享工具与数据状态已移动到 js/modules/app-utils.js 和 js/modules/app-state.js

// 全局分页状态管理
const paginationState = {
  inventory: { page: 1, pageSize: 10, total: 0 },
  stock: { page: 1, pageSize: 10, total: 0 },
  logs: { page: 1, pageSize: 10, total: 0 },
  suppliers: { page: 1, pageSize: 10, total: 0 },
  companies: { page: 1, pageSize: 10, total: 0 },
  customers: { page: 1, pageSize: 10, total: 0 },
  bills: { page: 1, pageSize: 10, total: 0 },
};
window.paginationState = paginationState;

// 存储 React Roots 以支持多次渲染
window.paginationRoots = {};

// 分页控件渲染函数 (Ant Design 版)
function renderPaginationControl(containerId, stateKey, onPageChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = paginationState[stateKey];
  if (!state) return;

  if (state.total <= 0) {
    container.hidden = true;
    const existingRoot = window.paginationRoots[containerId];
    if (existingRoot) {
      existingRoot.render(null);
    } else {
      container.replaceChildren();
    }
    return;
  }

  container.hidden = false;

  // 检查 Ant Design 依赖
  if (!window.antd || !window.React || !window.ReactDOM) {
    console.warn(
      "Ant Design dependencies not loaded, skipping pagination render.",
    );
    return;
  }

  const { Pagination, ConfigProvider, theme } = window.antd;
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  // 如果没有 root，创建一个
  if (!window.paginationRoots[containerId]) {
    window.paginationRoots[containerId] = ReactDOM.createRoot(container);
  }
  const root = window.paginationRoots[containerId];

  const onChange = (page, pageSize) => {
    // 更新状态
    paginationState[stateKey].page = page;
    paginationState[stateKey].pageSize = pageSize;

    // 触发回调
    if (typeof onPageChange === "function") {
      onPageChange();
    }
  };

  // 使用 ConfigProvider 配置中文文案（简易版，不依赖外部 locale 文件）
  // 注意：完整的中文支持通常需要引入 antd/locale/zh_CN，这里通过自定义 showTotal 等属性实现部分汉化
  const App = React.createElement(
    ConfigProvider,
    {
      theme: {
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#1a56db",
        },
      },
    },
    React.createElement(
      "div",
      { className: "flex justify-end" },
      React.createElement(Pagination, {
        current: state.page,
        pageSize: state.pageSize,
        total: state.total,
        showSizeChanger: state.total > state.pageSize,
        pageSizeOptions: ["10", "20", "50", "100"],
        onChange: onChange,
        showTotal: (total, range) =>
          `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
        // 强制英文部分尽可能通过 prop 覆盖，或者接受默认
      }),
    ),
  );

  root.render(App);
}

// 旧的分页辅助函数 (已废弃，保留占位防止报错)
function generatePageNumbers() {
  return "";
}
window.changePageSize = function () {};
window.changePage = function () {};

// 初始化库存筛选器
function initInventoryFilters() {
  const searchFilter = document.getElementById("filter-search");

  // 定义选项数据
  const statusOptions = [
    { value: "normal", label: "正常" },
    { value: "low", label: "库存不足" },
    { value: "overstock", label: "库存过剩" },
    { value: "out", label: "缺货" },
  ];

  if (
    typeof window.hasCoreUiDependencies === "function" &&
    window.hasCoreUiDependencies() &&
    !!mockData.suppliers
  ) {
    const supplierOptions = mockData.suppliers.map((s) => ({
      value: s.id,
      label: s.name,
    }));

    renderAntdSelect(
      "filter-status-container",
      "filter-status",
      statusOptions,
      "全部状态",
      () => {
        paginationState.inventory.page = 1;
        updateInventoryTable();
      },
    );

    renderAntdSelect(
      "filter-supplier-container",
      "filter-supplier",
      supplierOptions,
      "全部供应商",
      () => {
        paginationState.inventory.page = 1;
        updateInventoryTable();
      },
    );
  }

  // 绑定搜索框事件
  if (searchFilter && !searchFilter.dataset.bound) {
    searchFilter.dataset.bound = "true";
    const handler = () => {
      paginationState.inventory.page = 1; // 重置到第一页
      updateInventoryTable();
    };
    searchFilter.addEventListener("input", handler);
  }
}

// 初始化日志筛选器
function initLogFilters() {
  const userFilter = document.getElementById("log-filter-user");
  const searchFilter = document.getElementById("log-filter-search");

  // 操作类型选项
  const typeOptions = [
    { value: "add", label: "新增" },
    { value: "edit", label: "编辑" },
    { value: "delete", label: "删除" },
    { value: "cancel", label: "作废" },
    { value: "import", label: "导入" },
    { value: "export", label: "导出" },
  ];

  if (
    typeof window.hasCoreUiDependencies === "function" &&
    window.hasCoreUiDependencies()
  ) {
    renderAntdSelect(
      "log-filter-type-container",
      "log-filter-type",
      typeOptions,
      "全部类型",
      () => {
        paginationState.logs.page = 1;
        renderLogsTable();
      },
    );
  }

  const filters = [userFilter, searchFilter]; // Removed date filters from listener because they are handled by React component
  filters.forEach((filter) => {
    if (filter && !filter.dataset.bound) {
      filter.dataset.bound = "true";
      const handler = () => {
        paginationState.logs.page = 1; // 重置到第一页
        renderLogsTable();
      };
      filter.addEventListener("input", handler);
      filter.addEventListener("change", handler);
    }
  });
}

// 对账单功能由 bills-core.js 与 bills-module.js 统一提供。

// 导航、路由、图表和 bootstrap 已迁移到 js/app/*。

let activeBusinessFormOrigin = "dashboard";

function prepareBusinessFormLayout(container) {
  const managedForms = container.querySelectorAll(
    'form[id^="add-"], form[id^="edit-"]',
  );
  managedForms.forEach((form) => {
    form.classList.add("app-modal-form");
    const layoutContainers = form.classList.contains("app-modal-form-grid")
      ? [form]
      : Array.from(form.children).filter((child) =>
          child.classList.contains("grid"),
        );
    layoutContainers.forEach((layout) => {
      const fields = Array.from(layout.children).filter(
        (field) => !field.classList.contains("app-modal-wide-field"),
      );
      fields.forEach((field) =>
        field.classList.remove("app-modal-half-row", "app-modal-fill-row"),
      );
      const remainder = fields.length % 3;
      if (remainder === 1) {
        fields[fields.length - 1]?.classList.add("app-modal-fill-row");
      } else if (remainder === 2) {
        fields
          .slice(-2)
          .forEach((field) => field.classList.add("app-modal-half-row"));
      }
    });
  });
}

function closeBusinessFormPage() {
  const target =
    activeBusinessFormOrigin &&
    activeBusinessFormOrigin !== "business-form-workflow"
      ? activeBusinessFormOrigin
      : "dashboard";
  window.showSection?.(target);
}

function configureBusinessFormPage(confirmText = "保存") {
  const confirmButton = document.getElementById(
    "business-form-workflow-confirm",
  );
  if (confirmButton) confirmButton.textContent = confirmText;
}

function showBusinessFormPage(title, content, confirmCallback, options = {}) {
  const section = document.getElementById("business-form-workflow");
  const pageContent = document.getElementById("business-form-workflow-content");
  if (!section || !pageContent) {
    showModal(title, content, confirmCallback);
    return false;
  }

  const visibleSection = window.getVisiblePageSectionId?.();
  activeBusinessFormOrigin =
    options.returnSection ||
    (visibleSection && visibleSection !== "business-form-workflow"
      ? visibleSection
      : activeBusinessFormOrigin);
  section.dataset.navSection = options.navSection || activeBusinessFormOrigin;

  document.getElementById("business-form-workflow-title").textContent = title;
  document.getElementById("business-form-workflow-subtitle").textContent =
    options.subtitle || "填写并检查资料，保存成功后会返回原业务页面。";
  if (content instanceof Node) {
    pageContent.replaceChildren(content);
  } else if (typeof window.setSafeInnerHTML === "function") {
    window.setSafeInnerHTML(pageContent, content);
  } else {
    pageContent.textContent = String(content ?? "");
  }
  prepareBusinessFormLayout(pageContent);

  const cancelButton = document.getElementById("business-form-workflow-cancel");
  const backButton = document.getElementById("business-form-back");
  const confirmButton = document.getElementById(
    "business-form-workflow-confirm",
  );
  if (cancelButton) {
    cancelButton.textContent = options.cancelText || "取消";
    cancelButton.onclick = closeBusinessFormPage;
  }
  if (backButton) backButton.onclick = closeBusinessFormPage;
  if (confirmButton) {
    confirmButton.textContent = options.confirmText || "保存";
    const confirmHandler = async () => {
      const originalText = confirmButton.textContent;
      try {
        confirmButton.disabled = true;
        const result = await confirmCallback?.();
        if (result === false) return false;
        closeBusinessFormPage();
        return true;
      } catch (error) {
        console.error("Business form submission failed:", error);
        alert("操作失败，请重试。");
        return false;
      } finally {
        if (confirmButton.onclick === confirmHandler) {
          confirmButton.disabled = false;
          confirmButton.textContent = originalText;
        }
      }
    };
    confirmButton.onclick = confirmHandler;
  }

  window.showSection?.("business-form-workflow", {
    navSection: section.dataset.navSection,
  });
  const main = document.querySelector("main");
  if (main && typeof main.scrollTo === "function") main.scrollTo(0, 0);
  return true;
}

window.showBusinessFormPage = showBusinessFormPage;
window.configureBusinessFormPage = configureBusinessFormPage;
window.closeBusinessFormPage = closeBusinessFormPage;

// 显示模态框
function showModal(title, content, confirmCallback) {
  const modal = document.getElementById("modal");
  const modalPanel = document.getElementById("modal-panel");
  const modalContent = document.getElementById("modal-content");

  if (modalPanel) {
    modalPanel.className =
      "bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4";
    modalPanel.style.maxWidth = "";
    modalPanel.style.width = "";
  }
  if (modalContent) {
    modalContent.className = "p-4";
  }

  document.getElementById("modal-title").textContent = title;
  if (content instanceof Node) {
    modalContent.replaceChildren(content);
  } else if (typeof window.setSafeInnerHTML === "function") {
    window.setSafeInnerHTML(modalContent, content);
  } else {
    modalContent.textContent = String(content ?? "");
  }

  const managedForms = modalContent.querySelectorAll(
    'form[id^="add-"], form[id^="edit-"]',
  );
  managedForms.forEach((form) => {
    form.classList.add("app-modal-form");

    const layoutContainers = form.classList.contains("app-modal-form-grid")
      ? [form]
      : Array.from(form.children).filter((child) =>
          child.classList.contains("grid"),
        );

    layoutContainers.forEach((layout) => {
      const fields = Array.from(layout.children).filter(
        (field) => !field.classList.contains("app-modal-wide-field"),
      );
      fields.forEach((field) =>
        field.classList.remove("app-modal-half-row", "app-modal-fill-row"),
      );

      const remainder = fields.length % 3;
      if (remainder === 1) {
        fields[fields.length - 1]?.classList.add("app-modal-fill-row");
      } else if (remainder === 2) {
        fields
          .slice(-2)
          .forEach((field) => field.classList.add("app-modal-half-row"));
      }
    });
  });
  if (managedForms.length > 0 && modalPanel) {
    modalPanel.className =
      "bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4";
    modalContent.className = "p-2.5 md:p-3";
  }

  modal.classList.remove("hidden");
  modalContent.scrollTop = 0;

  // 设置确认按钮回调
  const confirmBtn = document.getElementById("modal-confirm");
  const cancelBtn = document.getElementById("modal-cancel");
  const closeBtn = document.getElementById("close-modal");
  const hideModal = () => modal.classList.add("hidden");
  if (confirmBtn) {
    confirmBtn.textContent = "确认";
  }
  if (cancelBtn) {
    cancelBtn.textContent = "取消";
    cancelBtn.classList.remove("hidden");
    cancelBtn.onclick = hideModal;
  }
  if (closeBtn) closeBtn.onclick = hideModal;
  // Remove old event listener by cloning node or just setting onclick (simpler for now)
  confirmBtn.onclick = async function () {
    const originalText = confirmBtn.textContent;
    try {
      confirmBtn.disabled = true;
      if (typeof confirmCallback === "function") {
        const result = await confirmCallback();
        if (result === false) return; // 如果回调返回false，则阻止关闭
      }
      hideModal();
    } catch (error) {
      console.error("Modal confirmation failed:", error);
      alert("操作失败，请重试。");
    } finally {
      confirmBtn.disabled = false;
      confirmBtn.textContent = originalText;
    }
  };
}
