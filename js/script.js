// 当前登录用户
// --- Ant Design 集成 ---
// 延迟初始化以确保资源加载
const ensureAntdFeedbackState = () => {
  if (!window.__antdFeedbackState) {
    window.__antdFeedbackState = {
      pendingMessages: [],
      pendingConfirms: [],
    };
  }

  return window.__antdFeedbackState;
};

const normalizeAntdMessageType = (type) => {
  const allowedTypes = new Set([
    "success",
    "error",
    "warning",
    "info",
    "loading",
  ]);

  return allowedTypes.has(type) ? type : "info";
};

const inferAlertMessageType = (messageText) => {
  const text = String(messageText || "");

  if (
    /失败|错误|无效|不存在|未找到|找不到|不足|损坏|异常|未能|阻止|为空/.test(
      text,
    )
  ) {
    return "error";
  }

  if (
    /成功|完成|已添加|已更新|已删除|已提交|已创建|已回滚|已导出|已导入|已保存|已关闭/.test(
      text,
    )
  ) {
    return "success";
  }

  if (/警告|注意|提醒|风险/.test(text)) {
    return "warning";
  }

  if (/请|不能|不可/.test(text)) {
    return "error";
  }

  return "info";
};

const renderAntdConfirmContent = (React, content) => {
  if (Array.isArray(content)) {
    const lines = content.filter(
      (line) => line !== null && line !== undefined && String(line).trim(),
    );

    if (lines.length === 0) {
      return React.createElement("div", null, "");
    }

    if (lines.length === 1) {
      return React.createElement("div", null, lines[0]);
    }

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        },
      },
      ...lines.map((line, index) =>
        React.createElement(
          "div",
          {
            key: `antd-confirm-line-${index}`,
          },
          line,
        ),
      ),
    );
  }

  if (typeof content === "string") {
    const lines = content
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length <= 1) {
      return React.createElement("div", null, content);
    }

    return React.createElement(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        },
      },
      ...lines.map((line, index) =>
        React.createElement(
          "div",
          {
            key: `antd-confirm-line-${index}`,
          },
          line,
        ),
      ),
    );
  }

  return content;
};

const queueAntdMessage = (entry) => {
  ensureAntdFeedbackState().pendingMessages.push(entry);
};

const flushPendingAntdMessages = () => {
  const feedbackState = ensureAntdFeedbackState();

  if (typeof window.__dispatchAntdMessage !== "function") {
    return false;
  }

  while (feedbackState.pendingMessages.length > 0) {
    const nextMessage = feedbackState.pendingMessages.shift();
    window.__dispatchAntdMessage(
      nextMessage.type,
      nextMessage.content,
      nextMessage.options,
    );
  }

  return true;
};

const queueAntdConfirm = (entry) => {
  ensureAntdFeedbackState().pendingConfirms.push(entry);
};

const flushPendingAntdConfirms = () => {
  const feedbackState = ensureAntdFeedbackState();

  if (typeof window.__openAntdConfirm !== "function") {
    return false;
  }

  while (feedbackState.pendingConfirms.length > 0) {
    const nextConfirm = feedbackState.pendingConfirms.shift();
    window.__openAntdConfirm(nextConfirm.options).then(nextConfirm.resolve);
  }

  return true;
};

window.__flushPendingAntdMessages = flushPendingAntdMessages;
window.__flushPendingAntdConfirms = flushPendingAntdConfirms;

window.showAntdMessage = function (type, content, options) {
  const normalizedContent = String(content ?? "");
  if (!normalizedContent) return;

  const nextEntry = {
    type: normalizeAntdMessageType(type),
    content: normalizedContent,
    options: options && typeof options === "object" ? options : {},
  };

  if (typeof window.__dispatchAntdMessage === "function") {
    window.__dispatchAntdMessage(
      nextEntry.type,
      nextEntry.content,
      nextEntry.options,
    );
    return;
  }

  queueAntdMessage(nextEntry);
};

window.showAntdConfirm = function (options) {
  const normalizedOptions =
    options && typeof options === "object"
      ? options
      : { content: String(options ?? "确认？") };

  if (typeof window.__openAntdConfirm === "function") {
    return window.__openAntdConfirm(normalizedOptions);
  }

  return new Promise((resolve) => {
    queueAntdConfirm({
      options: normalizedOptions,
      resolve,
    });
  });
};

if (!window.alertOverridden) {
  window.originalAlert = window.alert;
  window.alert = function (msg) {
    if (msg === undefined || msg === null || msg === "") return;
    const strMsg = String(msg);
    window.showAntdMessage(inferAlertMessageType(strMsg), strMsg);
  };
  window.alertOverridden = true;
}

// 渲染 Ant Design Select 组件
const renderAntdSelect = (
  containerId,
  inputId,
  options,
  placeholderOrConfig,
  onChangeCallback,
) => {
  if (!window.React || !window.ReactDOM || !window.antd) return false;

  // 防止重复注入样式，并应用强制高度修复
  if (!document.getElementById("antd-select-fix-style")) {
    const fixStyles = document.createElement("style");
    fixStyles.id = "antd-select-fix-style";
    fixStyles.innerHTML = `
             /* 1. 强制 Select 输入框高度固定 */
             /* 针对所有 Ant Design Select 选择器，使用 32px (Ant Design 默认高度，匹配 RangePicker) */
             .ant-select .ant-select-selector {
                 height: 32px !important;       
                 min-height: 32px !important;
                 max-height: 32px !important;
                 padding: 0 11px !important;    /* 移除垂直内边距，完全依靠 flex 居中 */
                 border-radius: 0.375rem !important;
                 border-color: #d1d5db !important;
                 display: flex !important;
                 align-items: center !important;
                 background-color: white !important;
                 position: relative !important;
                 overflow: hidden !important;
                 box-shadow: none !important;
             }
             
             /* 聚焦状态优化 */
             .ant-select-focused .ant-select-selector {
                 border-color: #3b82f6 !important; /* blue-500 */
                 box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
             }
             
             /* 2. 限制下拉菜单高度 */
             .ant-select-dropdown {
                 max-height: 250px !important;
                 z-index: 10000 !important;
                 padding: 4px 0 !important;
                 border-radius: 0.375rem !important;
                 box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06) !important;
             }
             .ant-select-dropdown .rc-virtual-list-holder {
                 max-height: 250px !important;
             }

             .product-name-select-dropdown.ant-select-dropdown {
                 max-height: 176px !important;
                 overflow: hidden !important;
             }

             .product-name-select-dropdown .rc-virtual-list {
                 overflow: hidden !important;
             }

             .product-name-select-dropdown .rc-virtual-list-holder {
                 max-height: 176px !important;
                 overflow-y: auto !important;
                 overflow-x: hidden !important;
             }

             .product-name-select-dropdown .rc-virtual-list-scrollbar {
                 display: none !important;
             }
 
             /* 8. 修复 Tags 模式下的输入体验 (模仿 Single Select) */
             
             /* 让 Search Input 绝对定位覆盖整个区域，确保始终可点击输入 */
              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selection-search {
                 position: absolute !important;
                 inset: 0 !important;
                 left: 0 !important;
                 right: 0 !important;
                 width: 100% !important;
                 max-width: 100% !important;
                 height: 100% !important;
                 margin: 0 !important;
                 display: flex !important;
                 align-items: center !important;
                 flex: 1 1 auto !important;
                 min-width: 0 !important;
                 z-index: 1 !important; /* 不遮挡 clear/arrow */
             }
 
              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selector {
                 padding-left: 8px !important;
              }

              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selection-overflow {
                 position: relative !important;
                 width: 100% !important;
              }

              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selection-overflow-item-suffix {
                 position: absolute !important;
                 inset: 0 !important;
                 width: 100% !important;
                 display: flex !important;
                 align-items: center !important;
                 opacity: 1 !important;
                 z-index: 1 !important;
              }

              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selection-search-input {
                 padding: 0 30px 0 8px !important;
                 box-sizing: border-box !important;
                 width: 100% !important;
                 flex: 1 1 auto !important;
                 min-width: 0 !important;
                 text-align: left !important;
              }

             /* 确保 Tag 在下方显示，且不干扰输入 */
              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selection-item {
                 position: absolute !important;
                 left: 8px !important;
                 top: 50% !important;
                 transform: translateY(-50%) !important;
                 z-index: 1 !important;
                 pointer-events: none !important; /* 点击穿透到 Search Input */
                 max-width: calc(100% - 45px) !important;
             }

              .ant-select.ant-select-multiple.ant-select-tag-single-mode .ant-select-selection-placeholder {
                 left: 20px !important;
              }
             
             /* 当有搜索内容时，隐藏背后的 Tag */
              .ant-select.ant-select-multiple.ant-select-tag-single-mode.has-search-text .ant-select-selection-item {
                 opacity: 0 !important;
                 visibility: hidden !important;
             }
             
             /* 搜索框容器 - 单选模式 */
             .ant-select-single .ant-select-selection-search {
                 position: absolute !important;
                 left: 0 !important;
                 right: 0 !important;
                 top: 0 !important;
                 bottom: 0 !important;
                 display: flex !important;
                 align-items: center !important;
                 margin: 0 !important;
             }

             .ant-select-single .ant-select-selection-search-input {
                 padding: 0 30px 0 11px !important;
                 box-sizing: border-box !important;
                 width: 100% !important;
                 flex: 1 1 auto !important;
                 min-width: 0 !important;
             }
             
             /* 搜索框容器 - 多选/标签模式 */
             .ant-select-multiple .ant-select-selection-search {
                 position: relative !important;
                 inset: auto !important;
                 width: auto !important;
                 min-width: 4px !important;
                 margin-left: 0 !important; 
                 display: flex !important;
                 align-items: center !important;
                 height: 100% !important;
                 order: 999999 !important; /* 确保在最后 */
             }
             
             /* 搜索输入框本体 */
             .ant-select-selection-search-input {
                 height: 100% !important;
                 width: 100% !important;
                 display: block !important;
                 padding: 0 !important;
                 margin: 0 !important;
                 opacity: 1 !important;
             }
 
             /* 占位符 & 选中项 - 单选模式 */
             .ant-select-single .ant-select-selection-placeholder,
             .ant-select-single .ant-select-selection-item {
                 position: absolute !important;
                 left: 11px !important;
                 right: 30px !important;
                 top: 50% !important;
                 transform: translateY(-50%) !important;
                 line-height: 30px !important; 
                 display: block !important; 
                 overflow: hidden !important;
                 white-space: nowrap !important;
                 text-overflow: ellipsis !important;
                 pointer-events: none !important;
                 margin: 0 !important;
                 padding: 0 !important;
                 background: none !important;
                 border: none !important;
                 font-size: 14px !important;
             }

             /* 占位符 - 多选模式 */
             .ant-select-multiple .ant-select-selection-placeholder {
                 position: absolute !important;
                 left: 11px !important;
                 right: 30px !important;
                 top: 50% !important;
                 transform: translateY(-50%) !important;
                 line-height: 30px !important;
                 pointer-events: none !important;
                 z-index: 1 !important;
             }

             /* 选中项 - 多选模式 (Tags) - 仿单选样式 */
             .ant-select-multiple .ant-select-selection-item {
                 position: relative !important;
                 display: flex !important;
                 align-items: center !important;
                 height: 30px !important;
                 margin: 0 !important;
                 padding: 0 !important;
                 background: none !important;
                 border: none !important;
                 border-radius: 0 !important;
                 line-height: 30px !important;
                 top: auto !important;
                 transform: none !important;
                 left: auto !important;
                 right: auto !important;
                 user-select: none !important;
                 color: rgba(0, 0, 0, 0.88) !important;
             }
             
             .ant-select-multiple .ant-select-selection-item-content {
                 margin-right: 0 !important;
                 font-size: 14px !important;
             }
             
             /* 隐藏 Tag 模式下的删除图标 */
             .ant-select-multiple .ant-select-selection-item-remove {
                 display: none !important;
             }
 
             /* 4. 图标垂直居中 (Arrow / Clear) */
             .ant-select-arrow, 
             .ant-select-clear {
                 top: 50% !important;
                 transform: translateY(-50%) !important;
                 margin-top: 0 !important; 
                 right: 11px !important;
                 width: 12px !important;
                 height: 12px !important;
                 display: flex !important;
                 align-items: center !important;
                 justify-content: center !important;
                 color: #9ca3af !important; /* gray-400 */
                 font-size: 12px !important;
                 z-index: 5 !important;
             }

             /* 5. 强制调整 Ant Design 日历组件样式以保持一致 */
             .ant-picker {
                 height: 32px !important;
                 padding: 0 11px !important;
                 border-radius: 0.375rem !important;
                 border-color: #d1d5db !important;
                 box-shadow: none !important;
             }
             .ant-picker-focused {
                 border-color: #3b82f6 !important;
                 box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2) !important;
             }
             .ant-picker-input > input {
                 font-size: 14px !important;
             }
 
             /* 6. 隐藏干扰元素 */
            /* .ant-select-selection-overflow { display: none !important; } */
            .ant-select-selection-search-mirror { display: none !important; }
            .ant-select-multiple .ant-select-selection-item-remove { display: none !important; }
            
            /* 针对 tags/multiple 模式的特殊处理 */
            .ant-select-selection-overflow {
                display: flex !important;
                flex-wrap: nowrap !important;
                overflow: hidden !important;
                width: 100% !important;
                height: 100% !important;
                align-items: center !important;
            }
            
            .ant-select-selection-overflow-item {
                flex: none !important;
                max-width: 100% !important;
            }

            .ant-select-multiple .ant-select-selection-overflow-item-suffix {
                display: flex !important;
                flex: 1 1 auto !important;
                min-width: 8px !important;
                width: auto !important;
            }

            .ant-select-multiple .ant-select-selection-search {
                width: 100% !important;
                flex: 1 1 auto !important;
            }

            .ant-select-multiple .ant-select-selection-search-input {
                width: 100% !important;
                min-width: 0 !important;
            }

            /* 7. 分页组件样式修复 */
            /* 确保分页选择器有足够宽度显示 "10 / page" */
            .ant-pagination-options-size-changer {
                width: auto !important;
                min-width: 100px !important; 
            }
            
            /* 调整分页选择器内部间距 */
            .ant-pagination-options-size-changer .ant-select-selector {
                padding: 0 8px !important; 
            }
            
            .ant-pagination-options-size-changer .ant-select-selection-item {
                left: 8px !important;
                right: 25px !important; 
            }
            
            .ant-pagination-options-size-changer .ant-select-arrow {
                right: 8px !important;
            }

            /* 确保分页按钮高度和对齐一致 */
            .ant-pagination-item, 
            .ant-pagination-prev, 
            .ant-pagination-next,
            .ant-pagination-total-text {
                height: 32px !important;
                line-height: 30px !important;
                border-radius: 4px !important;
                vertical-align: middle !important;
            }
            
            .ant-pagination-prev .ant-pagination-item-link,
            .ant-pagination-next .ant-pagination-item-link {
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                border-radius: 4px !important;
                border-color: #d1d5db !important;
            }
            
            /* 修正分页选项容器对齐 */
            .ant-pagination-options {
                height: 32px !important;
                vertical-align: middle !important;
            }
       `;
    document.head.appendChild(fixStyles);
  }

  const { Select } = window.antd;
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState } = React;

  let placeholder = placeholderOrConfig;
  let config = {};
  if (typeof placeholderOrConfig === "object") {
    config = placeholderOrConfig;
    placeholder = config.placeholder;
  }

  const App = () => {
    const { useEffect } = React;
    const isTagMode = config.mode === "tags";
    const isMultiMode = config.mode === "multiple";
    const controlSearchValue = !!config.controlSearchValue;
    const keepSearchTextOnBlur = !!config.keepSearchTextOnBlur;
    const enableCreateOption = !!config.enableCreateOption;

    const processValue = (v) => {
      if ((isTagMode || isMultiMode) && !config.keepArray) {
        if (Array.isArray(v)) {
          const lastItem = v.length > 0 ? v[v.length - 1] : undefined;
          return lastItem ? [lastItem] : [];
        }
        if (v === undefined || v === null || v === "") return [];
        return [v];
      }
      return v;
    };

    const initialVal = (() => {
      const dv =
        config.value !== undefined ? config.value : config.defaultValue;
      return processValue(dv);
    })();

    const [val, setVal] = useState(initialVal);
    const [searchText, setSearchText] = useState("");
    const [open, setOpen] = useState(false);

    // 监听外部 value 变化
    useEffect(() => {
      if (config.value !== undefined) {
        setVal(processValue(config.value));
      }
    }, [config.value]);

    const handleSearch = (value) => {
      setSearchText(value);
      if (config.onSearch) config.onSearch(value);
    };

    const normalizeText = (v) => String(v ?? "").trim();
    const normalizeCompareText = (v) => normalizeText(v).toLowerCase();

    const canCreate = (() => {
      if (!enableCreateOption || !isTagMode) return false;
      const text = normalizeText(searchText);
      if (!text) return false;
      const exists = (options || []).some((o) => {
        const label = normalizeCompareText(o?.label);
        const value = normalizeCompareText(o?.value);
        const t = normalizeCompareText(text);
        return label === t || value === t;
      });
      return !exists;
    })();

    const handleChange = (value) => {
      let nextVal = value; // 用于 UI 显示 (Select value prop)
      let exportVal = value; // 用于输出 (Input value & callback)

      // 清空搜索文本
      setSearchText("");
      setOpen(false);

      if (Array.isArray(value)) {
        if (config.mode === "tags" || config.mode === "multiple") {
          if (!config.keepArray) {
            // 强制单选行为：取最后一个值
            const lastItem =
              value.length > 0 ? value[value.length - 1] : undefined;

            // UI 上，如果是 tags 模式，value 必须是数组
            nextVal = lastItem ? [lastItem] : [];

            // 输出值
            exportVal = lastItem || "";
          }
        }
      }

      setVal(nextVal);

      const input = document.getElementById(inputId);
      if (input) {
        input.value = Array.isArray(exportVal)
          ? exportVal.join(",")
          : exportVal || "";
        // 触发原生事件以便兼容性
        const event = new Event("change", { bubbles: true });
        input.dispatchEvent(event);

        if (onChangeCallback) onChangeCallback(exportVal);
      }
    };

    // 构建 className
    let className = config.className || "";
    if (isTagMode) {
      className += " ant-select-tag-single-mode"; // 标记为 Tag 单选模式
      if (searchText) {
        className += " has-search-text"; // 标记有搜索内容
      }
    }

    const notFoundContent = config.notFoundContent ?? undefined;

    const createOptionLabel = (() => {
      const text = normalizeText(searchText);
      if (typeof config.createOptionLabel === "function") {
        return config.createOptionLabel(text);
      }
      if (typeof config.createOptionLabel === "string") {
        return config.createOptionLabel.replace("{text}", text);
      }
      return `新建 "${text}"`;
    })();

    const dropdownRender = enableCreateOption
      ? (menu) =>
          React.createElement(
            "div",
            null,
            menu,
            canCreate
              ? React.createElement(
                  "div",
                  {
                    style: {
                      padding: "8px 12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      color: "#1677ff",
                    },
                    onMouseDown: (e) => e.preventDefault(),
                    onClick: () => {
                      const text = normalizeText(searchText);
                      if (!text) return;
                      handleChange([text]);
                    },
                  },
                  React.createElement("i", {
                    className: "fa fa-plus",
                    style: { fontSize: "12px" },
                  }),
                  React.createElement("span", null, createOptionLabel),
                )
              : null,
          )
      : undefined;

    const resolvedListHeight = config.listHeight ?? 256;
    const resolvedDropdownStyle = {
      maxHeight: resolvedListHeight,
      overflow: "auto",
      zIndex: 10001,
      ...(config.dropdownStyle || {}),
    };

    const props = /** @type {any} */ ({
      placeholder: placeholder,
      style: { width: "100%" },
      showSearch: true,
      allowClear: true,
      optionFilterProp: "label",
      ...config, // 允许覆盖配置，如 mode: 'tags'
      className: className,
      value: val, // 受控模式
      onChange: handleChange,
      onSearch: handleSearch, // 监听搜索
      onBlur: () => {
        if (!keepSearchTextOnBlur) setSearchText("");
      },
      onClear: () => {
        setSearchText("");
        setOpen(false);
        const clearedVal = isTagMode || isMultiMode ? [] : undefined;
        setVal(clearedVal);

        const input = document.getElementById(inputId);
        if (input) {
          input.value = "";
          const event = new Event("change", { bubbles: true });
          input.dispatchEvent(event);
        }
        if (onChangeCallback) onChangeCallback("");
      },
      notFoundContent: notFoundContent,
      options: options,
      listHeight: resolvedListHeight,
      dropdownStyle: resolvedDropdownStyle,
      filterOption: (input, option) =>
        (option?.label ?? "").toLowerCase().includes(input.toLowerCase()),
    });

    if (controlSearchValue) {
      props.searchValue = searchText;
      props.autoClearSearchValue = false;
    }

    if (enableCreateOption) {
      props.open = open;
      props.onDropdownVisibleChange = setOpen;
      props.dropdownRender = dropdownRender;
    }

    return React.createElement(Select, props);
  };

  // 渲染组件
  const container = document.getElementById(containerId);
  if (!container) return false;

  if (!container._reactRoot) {
    container._reactRoot = ReactDOM.createRoot(container);
  }
  container._reactRoot.render(React.createElement(App));
  return true;
};

// Function to render Ant Design Input
const renderAntdInput = (
  containerId,
  inputId,
  placeholderOrConfig,
  onChangeCallback,
) => {
  if (!window.React || !window.ReactDOM || !window.antd) return false;

  const { Input } = window.antd;
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState } = React;

  let placeholder = "";
  let config = {};
  if (typeof placeholderOrConfig === "object") {
    config = placeholderOrConfig;
    placeholder = config.placeholder || "";
  } else {
    placeholder = placeholderOrConfig || "";
  }

  const App = () => {
    const [val, setVal] = useState(config.defaultValue || "");

    const handleChange = (e) => {
      const newValue = e.target.value;
      setVal(newValue);

      const input = document.getElementById(inputId);
      if (input) {
        input.value = newValue;
        // Trigger native events for legacy compatibility
        const event = new Event("input", { bubbles: true });
        input.dispatchEvent(event);
        const changeEvent = new Event("change", { bubbles: true });
        input.dispatchEvent(changeEvent);
      }

      if (onChangeCallback) onChangeCallback(newValue);
    };

    let prefix = null;
    if (config.prefixIcon) {
      prefix = React.createElement("i", {
        className: config.prefixIcon,
        style: { color: "#9ca3af" },
      });
    }

    return React.createElement(Input, {
      id: inputId + "_antd",
      placeholder: placeholder,
      value: val,
      onChange: handleChange,
      allowClear: true,
      prefix: prefix,
      style: { height: "32px" }, // Enforce 32px height to match Select/Datepicker
      ...config,
    });
  };

  const container = document.getElementById(containerId);
  if (!container) return false;

  if (!container._reactRoot) {
    container._reactRoot = ReactDOM.createRoot(container);
  }
  container._reactRoot.render(React.createElement(App));
  return true;
};

const renderAntdRadioGroup = (
  containerId,
  inputId,
  options,
  configOrDefaultValue,
  onChangeCallback,
) => {
  if (!window.React || !window.ReactDOM || !window.antd?.Radio) return false;

  const { Radio } = window.antd;
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const { useState } = React;
  const container = document.getElementById(containerId);
  if (!container) return false;

  const config =
    configOrDefaultValue && typeof configOrDefaultValue === "object"
      ? configOrDefaultValue
      : { defaultValue: configOrDefaultValue };
  const initialValue =
    config.value ??
    config.defaultValue ??
    document.getElementById(inputId)?.value ??
    "";

  const App = () => {
    const [value, setValue] = useState(initialValue);

    const handleChange = (event) => {
      const nextValue = event.target.value;
      setValue(nextValue);

      const input = document.getElementById(inputId);
      if (input) {
        input.value = nextValue;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }

      if (onChangeCallback) onChangeCallback(nextValue);
    };

    return React.createElement(Radio.Group, {
      name: config.name || inputId,
      options,
      value: value || undefined,
      onChange: handleChange,
      ...config,
    });
  };

  if (!container._reactRoot) {
    container._reactRoot = ReactDOM.createRoot(container);
  }
  container._reactRoot.render(React.createElement(App));
  return true;
};

// Expose to global scope for other scripts
window.renderAntdSelect = renderAntdSelect;
window.renderAntdInput = renderAntdInput;
window.renderAntdRadioGroup = renderAntdRadioGroup;

const initAntdComponents = () => {
  // 检查依赖是否加载
  if (!window.React || !window.ReactDOM || !window.dayjs || !window.antd) {
    return false;
  }

  const { message, DatePicker } = window.antd;
  const { RangePicker } = DatePicker;
  const React = window.React;
  const ReactDOM = window.ReactDOM;
  const dayjs = window.dayjs;

  if (
    !window.__antdMessageHostInited &&
    message &&
    typeof message.useMessage === "function"
  ) {
    const hostId = "antd-message-host";
    let host = document.getElementById(hostId);
    if (!host) {
      host = document.createElement("div");
      host.id = hostId;
      document.body.appendChild(host);
    }

    if (!window.__antdMessageRoot) {
      window.__antdMessageRoot = ReactDOM.createRoot(host);
    }

    const { useEffect } = React;
    const MessageHost = () => {
      const tuple = message.useMessage();
      const messageApi = tuple[0];
      const contextHolder = tuple[1];

      useEffect(() => {
        window.__antdMessageApi = messageApi;
        if (typeof window.__flushPendingAntdMessages === "function") {
          window.__flushPendingAntdMessages();
        }
      }, [messageApi]);

      return contextHolder;
    };

    window.__antdMessageRoot.render(React.createElement(MessageHost));
    window.__antdMessageHostInited = true;
  }

  window.__dispatchAntdMessage = function (type, content, options) {
    const api = window.__antdMessageApi;
    const opts = options && typeof options === "object" ? options : {};
    const safeType = normalizeAntdMessageType(type);

    if (api && typeof api.open === "function") {
      api.open({ type: safeType, content: content, ...opts });
      return;
    }

    if (message && typeof message[safeType] === "function") {
      message[safeType](content);
      return;
    }

    if (message && typeof message.info === "function") {
      message.info(content);
    }
  };
  flushPendingAntdMessages();

  if (!window.__antdConfirmHostInited && window.antd && window.antd.Modal) {
    const hostId = "antd-confirm-host";
    let host = document.getElementById(hostId);
    if (!host) {
      host = document.createElement("div");
      host.id = hostId;
      document.body.appendChild(host);
    }

    if (!window.__antdConfirmRoot) {
      window.__antdConfirmRoot = ReactDOM.createRoot(host);
    }

    const { Modal } = window.antd;
    const { useEffect } = React;
    const ConfirmHost = () => {
      const [state, setState] = React.useState({
        open: false,
        title: "",
        content: "",
        okText: "确定",
        cancelText: "取消",
        okType: "primary",
        okButtonProps: null,
        cancelButtonProps: null,
        width: undefined,
        centered: true,
        closable: { "aria-label": "关闭确认弹窗" },
        resolve: null,
      });

      useEffect(() => {
        window.__openAntdConfirm = (opts) => {
          const next = opts && typeof opts === "object" ? opts : {};
          return new Promise((resolve) => {
            setState({
              open: true,
              title: next.title || "确认",
              content: next.content || "",
              okText: next.okText || "确定",
              cancelText: next.cancelText || "取消",
              okType: next.okType || "primary",
              okButtonProps:
                next.okButtonProps && typeof next.okButtonProps === "object"
                  ? next.okButtonProps
                  : null,
              cancelButtonProps:
                next.cancelButtonProps &&
                typeof next.cancelButtonProps === "object"
                  ? next.cancelButtonProps
                  : null,
              width: next.width,
              centered: next.centered !== false,
              closable:
                next.closable === false
                  ? false
                  : next.closable &&
                      typeof next.closable === "object" &&
                      !Array.isArray(next.closable)
                    ? next.closable
                    : {
                        "aria-label": next.closeAriaLabel || "关闭确认弹窗",
                      },
              resolve,
            });
          });
        };
        if (typeof window.__flushPendingAntdConfirms === "function") {
          window.__flushPendingAntdConfirms();
        }
      }, []);

      const closeWith = (result) => {
        const r = state.resolve;
        setState((s) => ({ ...s, open: false }));
        if (typeof r === "function") r(result);
      };

      return React.createElement(
        Modal,
        {
          title: state.title,
          open: state.open,
          okText: state.okText,
          cancelText: state.cancelText,
          okType: state.okType,
          okButtonProps: state.okButtonProps || undefined,
          cancelButtonProps: state.cancelButtonProps || undefined,
          onOk: () => closeWith(true),
          onCancel: () => closeWith(false),
          maskClosable: false,
          closable: state.closable,
          destroyOnClose: true,
          width: state.width,
          centered: state.centered,
        },
        renderAntdConfirmContent(React, state.content),
      );
    };

    window.__antdConfirmRoot.render(React.createElement(ConfirmHost));
    window.__antdConfirmHostInited = true;
  }
  flushPendingAntdConfirms();

  // 配置全局 message
  message.config({
    top: 50,
    duration: 3,
    maxCount: 3,
  });

  console.log("Ant Design components loaded and integrated.");

  // 初始化 DatePicker 通用函数
  const renderDatePicker = (
    containerId,
    startInputId,
    endInputId,
    renderCallback,
  ) => {
    const container = document.getElementById(containerId);
    if (container) {
      // 检查是否已经渲染过（防止重复渲染）
      if (container.hasAttribute("data-rendered")) {
        return true;
      }

      const rangePresets = [
        { label: "Last 7 Days", value: [dayjs().add(-7, "d"), dayjs()] },
        { label: "Last 14 Days", value: [dayjs().add(-14, "d"), dayjs()] },
        { label: "Last 30 Days", value: [dayjs().add(-30, "d"), dayjs()] },
        { label: "Last 90 Days", value: [dayjs().add(-90, "d"), dayjs()] },
      ];

      const DatePickerApp = () => {
        const onRangeChange = (dates, dateStrings) => {
          // User provided logging logic
          if (dates) {
            console.log("From: ", dates[0], ", to: ", dates[1]);
            console.log("From: ", dateStrings[0], ", to: ", dateStrings[1]);
          } else {
            console.log("Clear");
          }

          // Integration logic
          const startInput = document.getElementById(startInputId);
          const endInput = document.getElementById(endInputId);

          if (startInput && endInput) {
            startInput.value = dateStrings[0] || "";
            endInput.value = dateStrings[1] || "";

            if (typeof renderCallback === "function") {
              if (window.paginationState) {
                // 尝试推断 stateKey (logs, bills 等)
                // 这里简化处理，假设 callback 是 renderLogsTable 这种命名
                const callbackName = renderCallback.name;
                let stateKey = "";
                if (callbackName.includes("Logs")) stateKey = "logs";
                else if (callbackName.includes("Bills")) stateKey = "bills"; // 假设有 bills 分页

                if (stateKey && window.paginationState[stateKey]) {
                  window.paginationState[stateKey].page = 1;
                }
              }
              renderCallback();
            }
          }
        };

        // Using the 3rd RangePicker from the user's provided code
        return React.createElement(RangePicker, {
          presets: [
            {
              label: React.createElement(
                "span",
                { "aria-label": "Current Time to End of Day" },
                "Now ~ EOD",
              ),
              value: () => [dayjs(), dayjs().endOf("day")],
            },
            ...rangePresets,
          ],
          showTime: true,
          format: "YYYY/MM/DD HH:mm:ss",
          onChange: onRangeChange,
          style: { width: "100%" },
        });
      };

      const root = ReactDOM.createRoot(container);
      root.render(React.createElement(DatePickerApp));
      container.setAttribute("data-rendered", "true");
      return true;
    }
    return false;
  };

  // 初始化各个模块的 DatePicker
  renderDatePicker(
    "log-date-range-picker-container",
    "log-filter-date-start",
    "log-filter-date-end",
    window.renderLogsTable,
  );
  renderDatePicker(
    "bills-date-range-picker-container",
    "bills-filter-date-start",
    "bills-filter-date-end",
    window.renderBillsTable,
  ); // 假设有 renderBillsTable

  // 初始化报表筛选器
  const initReportFilters = () => {
    if (!window.renderAntdSelect) return;

    // Report Type
    const reportTypeOptions = [
      { value: "inventory-turnover", label: "库存周转率" },
      { value: "sales-trend", label: "销售趋势" },
      { value: "accounts-receivable", label: "应收账款" },
      { value: "supplier-performance", label: "供应商表现" },
    ];
    renderAntdSelect(
      "report-type-container",
      "report-type-select",
      reportTypeOptions,
      "库存周转率",
    );

    // Time Range
    const timeRangeOptions = [
      { value: "last-month", label: "上个月" },
      { value: "last-quarter", label: "上季度" },
      { value: "last-year", label: "去年" },
      { value: "custom", label: "自定义" },
    ];
    renderAntdSelect(
      "report-time-range-container",
      "report-time-range-select",
      timeRangeOptions,
      "上个月",
    );

    // Company
    const companyOptions = [
      { value: "", label: "全部公司" },
      { value: "chemical", label: "化工" },
      { value: "labor", label: "劳保" },
    ];
    renderAntdSelect(
      "report-company-container",
      "report-company-select",
      companyOptions,
      "全部公司",
    );
  };
  initReportFilters();

  // Initialize Input Components
  if (window.renderAntdInput) {
    // Inventory Search
    renderAntdInput(
      "filter-search-container",
      "filter-search",
      { placeholder: "搜索商品...", prefixIcon: "fa fa-search" },
      () => {
        if (window.updateInventoryTable) window.updateInventoryTable();
      },
    );

    // Log Filter User
    renderAntdInput(
      "log-filter-user-container",
      "log-filter-user",
      { placeholder: "输入操作人..." },
      () => {
        if (window.renderLogsTable) {
          if (window.paginationState && window.paginationState.logs)
            window.paginationState.logs.page = 1;
          window.renderLogsTable();
        }
      },
    );

    // Log Filter Search
    renderAntdInput(
      "log-filter-search-container",
      "log-filter-search",
      { placeholder: "搜索操作对象...", prefixIcon: "fa fa-search" },
      () => {
        if (window.renderLogsTable) {
          if (window.paginationState && window.paginationState.logs)
            window.paginationState.logs.page = 1;
          window.renderLogsTable();
        }
      },
    );

    // Bills Filter Search
    renderAntdInput(
      "bills-filter-search-container",
      "bills-filter-search",
      { placeholder: "搜索对账单...", prefixIcon: "fa fa-search" },
      () => {
        if (window.updateBillsTable) {
          if (window.paginationState && window.paginationState.bills)
            window.paginationState.bills.page = 1;
          window.updateBillsTable();
        }
      },
    );
  }

  return true;
};
window.initAntdComponents = initAntdComponents;
