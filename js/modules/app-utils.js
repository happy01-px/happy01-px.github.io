(function initAppUtils(global) {
  const existingUser = global.currentUser;

  global.currentUser = existingUser || {
    id: "U001",
    name: "张三",
    role: "admin",
  };

  global.clientIP = global.clientIP || "192.168.1.100";

  function getLocalISOString() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
  }

  function deepClone(data) {
    return JSON.parse(JSON.stringify(data ?? {}));
  }

  function normalizeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeMockData(data = {}) {
    return {
      products: normalizeList(data.products),
      suppliers: normalizeList(data.suppliers),
      customers: normalizeList(data.customers),
      companies: normalizeList(data.companies),
      bills: normalizeList(data.bills),
      deliveryNotes: normalizeList(data.deliveryNotes),
    };
  }

  function restoreStockMovementDates(records = []) {
    return normalizeList(records).map((record) => ({
      ...record,
      createdAt: record?.createdAt ? new Date(record.createdAt) : new Date(),
      updatedAt: record?.updatedAt ? new Date(record.updatedAt) : new Date(),
    }));
  }

  function restoreLogDates(records = []) {
    return normalizeList(records).map((log) => ({
      ...log,
      timestamp: log?.timestamp ? new Date(log.timestamp) : new Date(),
    }));
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function createSequentialId(items, prefix, padLength = 3) {
    const maxId = normalizeList(items).reduce((max, item) => {
      const rawId = String(item?.id ?? "");
      if (!rawId.startsWith(prefix)) return max;

      const numericPart = rawId.slice(prefix.length).match(/\d+/)?.[0];
      const parsedNumber = Number.parseInt(numericPart, 10);
      return Number.isFinite(parsedNumber) ? Math.max(max, parsedNumber) : max;
    }, 0);

    return `${prefix}${String(maxId + 1).padStart(padLength, "0")}`;
  }

  function createRuntimeId(prefix) {
    return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, "0")}`;
  }

  function ensureAntdRenderRoots() {
    if (!global.__antdRenderRoots) {
      global.__antdRenderRoots = new WeakMap();
    }

    return global.__antdRenderRoots;
  }

  function renderAntdNode(target, node) {
    if (!target || !global.React || !global.ReactDOM || !node) {
      return false;
    }

    const renderRoots = ensureAntdRenderRoots();
    let root = renderRoots.get(target);

    if (!root) {
      if (typeof global.ReactDOM.createRoot === "function") {
        root = global.ReactDOM.createRoot(target);
      } else if (typeof global.ReactDOM.render === "function") {
        root = {
          render(nextNode) {
            global.ReactDOM.render(nextNode, target);
          },
        };
      } else {
        return false;
      }

      renderRoots.set(target, root);
    }

    root.render(node);
    target.dataset.rendered = "true";
    return true;
  }

  function createAntdEmptyNode(description, options = {}) {
    if (!global.React || !global.antd || !global.antd.Empty) {
      return null;
    }

    const Empty = global.antd.Empty;
    const config =
      options && typeof options === "object" ? options : { description };
    const descriptionNode =
      config.description !== undefined
        ? config.description
        : description || "暂无数据";

    return global.React.createElement(
      "div",
      {
        className: config.wrapperClassName || "py-4",
        style: config.wrapperStyle,
      },
      global.React.createElement(Empty, {
        image: config.image || Empty.PRESENTED_IMAGE_SIMPLE,
        description: descriptionNode,
        imageStyle: config.imageStyle,
      }),
    );
  }

  function renderAntdEmptyState(targetOrId, description, options = {}) {
    const target =
      typeof targetOrId === "string"
        ? document.getElementById(targetOrId)
        : targetOrId;
    if (!target) return false;

    const config = options && typeof options === "object" ? options : {};
    const node = createAntdEmptyNode(description, config);
    if (node) {
      target.replaceChildren();
      return renderAntdNode(target, node);
    }

    target.innerHTML = `<div class="${escapeHTML(
      config.fallbackClassName || "py-4 text-center text-sm text-gray-500",
    )}">${escapeHTML(description || "暂无数据")}</div>`;
    return false;
  }

  function renderAntdEmptyTableRow(tbody, colspan, description, options = {}) {
    if (!tbody) return false;

    const config = options && typeof options === "object" ? options : {};
    const row = document.createElement("tr");
    if (config.rowClassName) {
      row.className = config.rowClassName;
    }

    const cell = document.createElement("td");
    cell.colSpan = colspan;
    cell.className = config.cellClassName || "px-6 py-4";

    const host = document.createElement("div");
    host.className =
      config.hostClassName || "flex items-center justify-center w-full";
    cell.appendChild(host);
    row.appendChild(cell);

    tbody.replaceChildren(row);
    return renderAntdEmptyState(host, description, {
      ...config,
      wrapperClassName: config.wrapperClassName || "py-2",
    });
  }

  global.getLocalISOString = getLocalISOString;
  global.deepClone = deepClone;
  global.normalizeList = normalizeList;
  global.normalizeMockData = normalizeMockData;
  global.restoreStockMovementDates = restoreStockMovementDates;
  global.restoreLogDates = restoreLogDates;
  global.escapeHTML = escapeHTML;
  global.createSequentialId = createSequentialId;
  global.createRuntimeId = createRuntimeId;
  global.createAntdEmptyNode = createAntdEmptyNode;
  global.renderAntdEmptyState = renderAntdEmptyState;
  global.renderAntdEmptyTableRow = renderAntdEmptyTableRow;

  global.AppUtils = Object.freeze({
    getLocalISOString,
    deepClone,
    normalizeList,
    normalizeMockData,
    restoreStockMovementDates,
    restoreLogDates,
    escapeHTML,
    createSequentialId,
    createRuntimeId,
    createAntdEmptyNode,
    renderAntdEmptyState,
    renderAntdEmptyTableRow,
  });
})(window);
