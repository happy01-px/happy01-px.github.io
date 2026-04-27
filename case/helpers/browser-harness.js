const fs = require("fs");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");
const { clone, createPaginationState } = require("./fixtures");

const projectRoot = path.resolve(__dirname, "..", "..");

const MODAL_MARKUP = `
    <div id="modal" class="hidden">
        <div id="modal-panel">
            <div>
                <h3 id="modal-title"></h3>
                <button id="close-modal" type="button">x</button>
            </div>
            <div id="modal-content"></div>
            <div>
                <button id="modal-cancel" type="button">取消</button>
                <button id="modal-confirm" type="button">确认</button>
            </div>
        </div>
    </div>
`;

const APP_SHELL_SCRIPT_PATHS = Object.freeze([
  "js/script.js",
  "js/ui/antd-bridge.js",
  "js/app/navigation.js",
  "js/app/router.js",
  "js/app/charts.js",
]);

function readProjectFile(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

function loadScripts(window, relativePaths) {
  relativePaths.forEach((relativePath) => {
    window.eval(readProjectFile(relativePath));
  });
}

function buildDocumentHtml(options = {}) {
  if (options.documentHtml) {
    return options.documentHtml;
  }

  const modalMarkup = options.appendModalMarkup === false ? "" : MODAL_MARKUP;
  return `<!doctype html><html><head></head><body>${options.markup || ""}${modalMarkup}</body></html>`;
}

function createWindow(options = {}) {
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    if (
      String(error?.message || "").includes(
        "Not implemented: navigation to another Document",
      )
    ) {
      return;
    }
  });

  const dom = new JSDOM(buildDocumentHtml(options), {
    url: options.url || "http://127.0.0.1/",
    pretendToBeVisual: true,
    runScripts: "outside-only",
    virtualConsole,
  });

  const { window } = dom;
  const harnessState = {
    alerts: [],
    antdMessages: [],
    confirmCalls: [],
    confirmQueue: [],
    renderSelects: new Map(),
    renderInputs: new Map(),
    paginationCalls: [],
    showSectionCalls: [],
    modalConfirmHandler: null,
  };

  window.__testHarness = {
    renderSelects: harnessState.renderSelects,
    renderInputs: harnessState.renderInputs,
    antdMessages: harnessState.antdMessages,
    confirmCalls: harnessState.confirmCalls,
  };

  window.console = {
    log() {},
    warn() {},
    error() {},
    info() {},
    debug() {},
  };
  window.fetch = global.fetch ? global.fetch.bind(global) : undefined;
  window.scrollTo = () => {};
  window.requestIdleCallback =
    window.requestIdleCallback ||
    ((callback) =>
      setTimeout(
        () =>
          callback({
            didTimeout: false,
            timeRemaining: () => 0,
          }),
        0,
      ));
  window.cancelIdleCallback =
    window.cancelIdleCallback || ((handle) => clearTimeout(handle));
  window.Chart = function Chart() {};
  window.tailwind = window.tailwind || {};
  window.URL.createObjectURL =
    window.URL.createObjectURL || (() => "blob:test-url");
  window.URL.revokeObjectURL = window.URL.revokeObjectURL || (() => {});
  window.alert = (message) => {
    harnessState.alerts.push(String(message));
  };
  window.queueConfirmResult = (value) => {
    harnessState.confirmQueue.push(Boolean(value));
  };
  window.showAntdConfirm = async (options) => {
    harnessState.confirmCalls.push(options);
    if (harnessState.confirmQueue.length > 0) {
      return harnessState.confirmQueue.shift();
    }
    return true;
  };
  window.renderPaginationControl = (containerId, stateKey, onPageChange) => {
    harnessState.paginationCalls.push({ containerId, stateKey, onPageChange });
    const container = window.document.getElementById(containerId);
    if (container) {
      container.dataset.stateKey = stateKey;
    }
  };
  window.showSection = (sectionId) => {
    harnessState.showSectionCalls.push(sectionId);
    window.document.querySelectorAll(".page-section").forEach((section) => {
      section.classList.add("hidden");
    });
    window.document.getElementById(sectionId)?.classList.remove("hidden");
  };
  window.renderAntdSelect = (
    containerId,
    inputId,
    optionsList,
    placeholderOrConfig,
    onChange,
  ) => {
    const container = window.document.getElementById(containerId);
    const input = window.document.getElementById(inputId);
    const config =
      placeholderOrConfig && typeof placeholderOrConfig === "object"
        ? placeholderOrConfig
        : { placeholder: placeholderOrConfig };

    if (input && config.value !== undefined) {
      input.value = config.value ?? "";
    }

    const control = window.document.createElement("input");
    control.type = "text";
    control.dataset.role = "antd-select";
    control.dataset.inputId = inputId;
    control.value = input ? input.value : "";
    if (container) {
      container.replaceChildren(control);
    }

    harnessState.renderSelects.set(inputId, {
      containerId,
      inputId,
      optionsList: clone(optionsList || []),
      config: clone(config),
      onChange,
      control,
      input,
    });

    return true;
  };
  window.renderAntdInput = (
    containerId,
    inputId,
    placeholderOrConfig,
    onChange,
  ) => {
    const container = window.document.getElementById(containerId);
    const input = window.document.getElementById(inputId);
    const config =
      placeholderOrConfig && typeof placeholderOrConfig === "object"
        ? placeholderOrConfig
        : { placeholder: placeholderOrConfig };

    const nextValue = config.defaultValue ?? (input ? input.value : "") ?? "";
    if (input) {
      input.value = nextValue;
    }

    const control = window.document.createElement("input");
    control.type = "text";
    control.dataset.role = "antd-input";
    control.dataset.inputId = inputId;
    control.value = nextValue;
    control.addEventListener("input", (event) => {
      if (input) {
        input.value = event.target.value;
      }
      if (typeof onChange === "function") {
        onChange(event.target.value);
      }
    });
    if (container) {
      container.replaceChildren(control);
    }

    harnessState.renderInputs.set(inputId, {
      containerId,
      inputId,
      config: clone(config),
      onChange,
      control,
      input,
    });

    return true;
  };
  window.showModal = (title, content, confirmCallback) => {
    window.document.getElementById("modal-title").textContent = title;
    window.document.getElementById("modal-content").innerHTML = content;
    window.document.getElementById("modal").classList.remove("hidden");
    harnessState.modalConfirmHandler = confirmCallback || null;
    window.__testModalConfirmHandler = harnessState.modalConfirmHandler;
  };

  if (options.loadReactRuntime) {
    loadScripts(window, [
      "lib/react.production.min.js",
      "lib/react-dom.production.min.js",
      "lib/dayjs.min.js",
    ]);
    installAntdComponentStubs(window);
  }

  return {
    window,
    dom,
    alerts: harnessState.alerts,
    antdMessages: harnessState.antdMessages,
    confirmCalls: harnessState.confirmCalls,
    paginationCalls: harnessState.paginationCalls,
    renderSelects: harnessState.renderSelects,
    renderInputs: harnessState.renderInputs,
    showSectionCalls: harnessState.showSectionCalls,
    close() {
      window.close();
    },
  };
}

function installAntdComponentStubs(window) {
  const React = window.React;
  const noop = () => {};
  const pushAntdMessage = (entry) => {
    if (!window.__testHarness?.antdMessages) {
      return;
    }
    window.__testHarness.antdMessages.push({
      ...(entry || {}),
    });
  };

  function InputComponent(props) {
    return React.createElement("input", {
      type: props.type || "text",
      min: props.min,
      step: props.step,
      disabled: props.disabled,
      value: props.value ?? "",
      className: props.className,
      style: props.style,
      placeholder: props.placeholder,
      onInput: props.onInput,
      onChange: props.onChange,
    });
  }

  function SelectComponent(props) {
    const isMultiple = props.mode === "multiple" || props.mode === "tags";
    const currentValue = props.value ?? (isMultiple ? [] : "");
    const normalizedValue = Array.isArray(currentValue)
      ? currentValue.map((value) => String(value))
      : String(currentValue ?? "");

    return React.createElement(
      "select",
      {
        multiple: isMultiple,
        value: normalizedValue,
        className: props.className,
        style: props.style,
        onChange: (event) => {
          if (typeof props.onChange !== "function") {
            return;
          }

          if (isMultiple) {
            const values = Array.from(event.target.selectedOptions).map(
              (option) => option.value,
            );
            props.onChange(values);
            return;
          }

          props.onChange(event.target.value);
        },
      },
      !isMultiple && props.allowClear
        ? React.createElement("option", { value: "" }, props.placeholder || "")
        : null,
      ...(props.options || []).map((option) =>
        React.createElement(
          "option",
          {
            key: option.value,
            value: option.value,
          },
          option.label,
        ),
      ),
    );
  }

  function DatePickerComponent(props) {
    const value =
      props.value && typeof props.value.format === "function"
        ? props.value.format("YYYYMMDD")
        : (props.value ?? "");

    return React.createElement("input", {
      type: "text",
      value,
      style: props.style,
      onInput: (event) => {
        if (typeof props.onChange === "function") {
          props.onChange(null, event.target.value);
        }
      },
      onChange: (event) => {
        if (typeof props.onChange === "function") {
          props.onChange(null, event.target.value);
        }
      },
    });
  }

  DatePickerComponent.RangePicker = function RangePicker(props) {
    const values = Array.isArray(props.value) ? props.value : [];
    const startValue =
      values[0] && typeof values[0].format === "function"
        ? values[0].format("YYYY-MM-DD")
        : (values[0] ?? "");
    const endValue =
      values[1] && typeof values[1].format === "function"
        ? values[1].format("YYYY-MM-DD")
        : (values[1] ?? "");

    const emitChange = (nextStart, nextEnd) => {
      if (typeof props.onChange === "function") {
        props.onChange([], [nextStart, nextEnd]);
      }
    };

    return React.createElement(
      "div",
      {
        className: props.className,
        style: props.style,
      },
      React.createElement("input", {
        type: "text",
        defaultValue: startValue,
        onChange: (event) => emitChange(event.target.value, endValue),
      }),
      React.createElement("input", {
        type: "text",
        defaultValue: endValue,
        onChange: (event) => emitChange(startValue, event.target.value),
      }),
    );
  };

  function ModalComponent(props) {
    if (!props.open) {
      return null;
    }

    const closeButtonAriaLabel =
      props.closable && typeof props.closable === "object"
        ? props.closable["aria-label"] || "Close"
        : "Close";

    return React.createElement(
      "div",
      {
        className: props.className || "antd-modal-stub",
      },
      React.createElement(
        "div",
        null,
        props.title,
        props.closable === false
          ? null
          : React.createElement(
              "button",
              {
                type: "button",
                "aria-label": closeButtonAriaLabel,
                onClick: props.onCancel,
              },
              "x",
            ),
      ),
      props.children,
      React.createElement(
        "button",
        {
          type: "button",
          onClick: props.onOk,
        },
        props.okText || "OK",
      ),
      React.createElement(
        "button",
        {
          type: "button",
          onClick: props.onCancel,
        },
        props.cancelText || "Cancel",
      ),
    );
  }

  function EmptyComponent(props) {
    const descriptionNode =
      props.description === undefined ? "No Data" : props.description;
    const imageType =
      props.image === EmptyComponent.PRESENTED_IMAGE_SIMPLE
        ? "simple"
        : "default";

    return React.createElement(
      "div",
      {
        className: props.className || "antd-empty-stub",
        "data-role": "antd-empty",
        "data-image": imageType,
      },
      descriptionNode,
    );
  }

  EmptyComponent.PRESENTED_IMAGE_SIMPLE = "PRESENTED_IMAGE_SIMPLE";

  function PaginationComponent(props) {
    return React.createElement(
      "div",
      {
        className: props.className || "antd-pagination-stub",
      },
      typeof props.showTotal === "function"
        ? props.showTotal(props.total || 0, [
            1,
            Math.min(props.total || 0, props.pageSize || 0),
          ])
        : `${props.current || 1}/${props.total || 0}`,
    );
  }

  function MenuComponent(props) {
    const items = props.items || [];

    const renderItem = (item) => {
      if (Array.isArray(item.children) && item.children.length > 0) {
        return React.createElement(
          "div",
          {
            key: item.key,
            "data-menu-key": item.key,
          },
          React.createElement("div", null, item.label),
          ...(item.children || []).map(renderItem),
        );
      }

      return React.createElement(
        "button",
        {
          key: item.key,
          type: "button",
          "data-menu-key": item.key,
          onClick: () => {
            if (typeof props.onClick === "function") {
              props.onClick({ key: item.key });
            }
          },
        },
        item.label,
      );
    };

    return React.createElement(
      "div",
      {
        className: props.className || "antd-menu-stub",
        style: props.style,
      },
      ...items.map(renderItem),
    );
  }

  window.antd = {
    Select: SelectComponent,
    Input: InputComponent,
    InputNumber(props) {
      return React.createElement("input", {
        type: "number",
        min: props.min,
        step: props.step,
        disabled: props.disabled,
        value: props.value ?? "",
        className: props.className,
        style: props.style,
        onInput: (event) => {
          if (typeof props.onChange === "function") {
            props.onChange(event.target.value);
          }
        },
        onChange: (event) => {
          if (typeof props.onChange === "function") {
            props.onChange(event.target.value);
          }
        },
      });
    },
    Button(props) {
      return React.createElement(
        "button",
        {
          type: "button",
          disabled: props.disabled,
          className: props.className,
          onClick: props.onClick,
        },
        props.icon,
        props.children,
      );
    },
    Flex(props) {
      return React.createElement(
        "div",
        {
          className: props.className,
          style: {
            display: "flex",
            gap: props.gap === "small" ? "8px" : props.gap,
          },
        },
        props.children,
      );
    },
    Space(props) {
      return React.createElement(
        "div",
        {
          className: props.className,
          style: props.style,
        },
        props.children,
      );
    },
    DatePicker: DatePickerComponent,
    Pagination: PaginationComponent,
    Menu: MenuComponent,
    ConfigProvider(props) {
      return React.createElement(React.Fragment, null, props.children);
    },
    Modal: ModalComponent,
    Empty: EmptyComponent,
    message: {
      config: noop,
      open(config) {
        pushAntdMessage(config);
      },
      info(content) {
        pushAntdMessage({ type: "info", content });
      },
      success(content) {
        pushAntdMessage({ type: "success", content });
      },
      error(content) {
        pushAntdMessage({ type: "error", content });
      },
      warning(content) {
        pushAntdMessage({ type: "warning", content });
      },
      useMessage() {
        return [
          {
            open(config) {
              pushAntdMessage(config);
            },
            info(content) {
              pushAntdMessage({ type: "info", content });
            },
            success(content) {
              pushAntdMessage({ type: "success", content });
            },
            error(content) {
              pushAntdMessage({ type: "error", content });
            },
            warning(content) {
              pushAntdMessage({ type: "warning", content });
            },
          },
          React.createElement("div", { "data-role": "antd-message-holder" }),
        ];
      },
    },
    theme: {
      darkAlgorithm: "darkAlgorithm",
      defaultAlgorithm: "defaultAlgorithm",
    },
  };
}

function applyFixtureState(window, fixtureData) {
  const data = clone(fixtureData);

  window.currentUser = data.currentUser || {
    id: "U001",
    name: "Tester",
    role: "admin",
  };
  window.clientIP = data.clientIP || "127.0.0.1";
  window.defaultMockData = clone(data.mockData);
  window.defaultStockMovementData = clone(data.stockMovementData || []);
  window.defaultLogsData = clone(data.logsData || []);
  window.mockData = clone(data.mockData);
  window.stockMovementData = clone(data.stockMovementData || []);
  window.logsData = clone(data.logsData || []);
  window.paginationState = clone(
    data.paginationState || createPaginationState(),
  );
}

function setRenderedSelectValue(window, inputId, value) {
  const entry = window.__testHarness?.renderSelects?.get(inputId);
  if (!entry) {
    throw new Error(`No rendered select found for ${inputId}`);
  }
  if (entry.input) {
    entry.input.value = value;
  }
  if (entry.control) {
    entry.control.value = value;
  }
  if (typeof entry.onChange === "function") {
    entry.onChange(value);
  }
}

function setRenderedInputValue(window, inputId, value) {
  const entry = window.__testHarness?.renderInputs?.get(inputId);
  if (!entry) {
    throw new Error(`No rendered input found for ${inputId}`);
  }
  if (entry.input) {
    entry.input.value = value;
  }
  if (entry.control) {
    entry.control.value = value;
  }
  if (typeof entry.onChange === "function") {
    entry.onChange(value);
  }
}

async function clickModalConfirm(window) {
  const confirmHandler = window.__testModalConfirmHandler;
  if (typeof confirmHandler === "function") {
    const result = await confirmHandler();
    if (result === false) {
      return false;
    }
  }
  window.document.getElementById("modal").classList.add("hidden");
  return true;
}

function wireModalHelper(window) {
  const originalShowModal = window.showModal;
  window.showModal = (title, content, confirmCallback) => {
    window.__testModalConfirmHandler = confirmCallback || null;
    originalShowModal(title, content, confirmCallback);
  };
}

function getFirstMatchingInputId(renderMap, prefix) {
  for (const inputId of renderMap.keys()) {
    if (inputId.startsWith(prefix)) {
      return inputId;
    }
  }
  return null;
}

async function flushAsyncTasks(iterations = 3) {
  for (let index = 0; index < iterations; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

function dispatchDomContentLoaded(window) {
  window.document.dispatchEvent(
    new window.Event("DOMContentLoaded", {
      bubbles: true,
      cancelable: true,
    }),
  );
}

function getAppShellScriptPaths() {
  return [...APP_SHELL_SCRIPT_PATHS];
}

module.exports = {
  applyFixtureState,
  clickModalConfirm,
  createWindow,
  dispatchDomContentLoaded,
  flushAsyncTasks,
  getAppShellScriptPaths,
  getFirstMatchingInputId,
  loadScripts,
  projectRoot,
  setRenderedInputValue,
  setRenderedSelectValue,
  wireModalHelper,
};
