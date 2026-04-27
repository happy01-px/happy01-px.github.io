(function initAntdBridge(global) {
  const UI_READY_EVENT = "app:ui-ready";
  const UI_INIT_RETRY_LIMIT = 12;

  function hasCoreUiDependencies(includeDayjs = false) {
    const baseReady = !!global.React && !!global.ReactDOM && !!global.antd;
    return includeDayjs ? baseReady && !!global.dayjs : baseReady;
  }

  function reportAntdInitFailure() {
    console.error("Failed to load Ant Design components.");

    const missing = [];
    if (!global.React) missing.push("React");
    if (!global.ReactDOM) missing.push("ReactDOM");
    if (!global.dayjs) missing.push("dayjs");
    if (!global.antd) missing.push("antd");

    const errorMsg =
      missing.length > 0
        ? `组件加载失败，缺失依赖：${missing.join(", ")}。请检查资源是否已正确加载。`
        : "组件加载失败（未知原因），请刷新页面重试。";

    console.error(errorMsg);

    const fallback = (id) => {
      const container = document.getElementById(id);
      if (
        container &&
        !container.hasAttribute("data-rendered") &&
        !container.hasChildNodes()
      ) {
        const safeErrorMsg =
          typeof global.escapeHTML === "function"
            ? global.escapeHTML(errorMsg)
            : errorMsg;
        container.innerHTML = `
                    <div class="flex items-center space-x-2 text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
                        <i class="fa fa-exclamation-circle"></i>
                        <span>${safeErrorMsg}</span>
                    </div>
                `;
      }
    };

    fallback("log-date-range-picker-container");
    fallback("bills-date-range-picker-container");
  }

  function notifyUiReady() {
    if (global.__appUiReady) {
      return;
    }

    global.__appUiReady = true;
    document.dispatchEvent(new Event(UI_READY_EVENT));
  }

  function onUiRuntimeReady(callback) {
    if (typeof callback !== "function") {
      return;
    }

    if (global.__appUiReady) {
      callback();
      return;
    }

    document.addEventListener(UI_READY_EVENT, callback, { once: true });
  }

  function queueAntdInitRetry(attempt) {
    if (global.__appUiInitRetryScheduled) {
      return;
    }

    global.__appUiInitRetryScheduled = true;
    global.setTimeout(() => {
      global.__appUiInitRetryScheduled = false;
      startAntdInit(attempt + 1);
    }, 0);
  }

  function startAntdInit(attempt = 0) {
    if (global.__appUiInitialized) {
      return global.__appUiReady;
    }

    if (
      !hasCoreUiDependencies(true) ||
      typeof global.initAntdComponents !== "function"
    ) {
      if (attempt < UI_INIT_RETRY_LIMIT) {
        queueAntdInitRetry(attempt);
        return false;
      }
      reportAntdInitFailure();
      return false;
    }

    const initResult = global.initAntdComponents();
    if (initResult === false) {
      if (attempt < UI_INIT_RETRY_LIMIT) {
        queueAntdInitRetry(attempt);
        return false;
      }
      reportAntdInitFailure();
      return false;
    }

    global.__appUiInitialized = true;
    notifyUiReady();
    return true;
  }

  global.hasCoreUiDependencies = hasCoreUiDependencies;
  global.reportAntdInitFailure = reportAntdInitFailure;
  global.startAntdInit = startAntdInit;
  global.onUiRuntimeReady = onUiRuntimeReady;
})(window);
