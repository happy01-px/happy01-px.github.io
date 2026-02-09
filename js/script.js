﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿﻿// 当前登录用户
const currentUser = {
    id: 'U001',
    name: '张三',
    role: 'admin'
};

// --- Ant Design 集成 ---
// 延迟初始化以确保资源加载
// 渲染 Ant Design Select 组件
const renderAntdSelect = (containerId, inputId, options, placeholderOrConfig, onChangeCallback) => {
    if (!window.React || !window.ReactDOM || !window.antd) return false;
    
    // 防止重复注入样式，并应用强制高度修复
    if (!document.getElementById('antd-select-fix-style')) {
        const fixStyles = document.createElement('style');
        fixStyles.id = 'antd-select-fix-style';
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
    if (typeof placeholderOrConfig === 'object') {
        config = placeholderOrConfig;
        placeholder = config.placeholder;
    }

    const App = () => {
        const isTagMode = config.mode === 'tags';
        const isMultiMode = config.mode === 'multiple';
        const controlSearchValue = !!config.controlSearchValue;
        const keepSearchTextOnBlur = !!config.keepSearchTextOnBlur;
        const enableCreateOption = !!config.enableCreateOption;

        const initialVal = (() => {
            const dv = config.defaultValue;
            if ((isTagMode || isMultiMode) && !config.keepArray) {
                if (Array.isArray(dv)) {
                    const lastItem = dv.length > 0 ? dv[dv.length - 1] : undefined;
                    return lastItem ? [lastItem] : [];
                }
                if (dv === undefined || dv === null || dv === '') return [];
                return [dv];
            }
            return dv;
        })();

        const [val, setVal] = useState(initialVal);
        const [searchText, setSearchText] = useState('');
        const [open, setOpen] = useState(false);

        const handleSearch = (value) => {
            setSearchText(value);
            if (config.onSearch) config.onSearch(value);
        };

        const normalizeText = (v) => String(v ?? '').trim();
        const normalizeCompareText = (v) => normalizeText(v).toLowerCase();

        const canCreate = (() => {
            if (!enableCreateOption || !isTagMode) return false;
            const text = normalizeText(searchText);
            if (!text) return false;
            const exists = (options || []).some(o => {
                const label = normalizeCompareText(o?.label);
                const value = normalizeCompareText(o?.value);
                const t = normalizeCompareText(text);
                return label === t || value === t;
            });
            return !exists;
        })();

        const handleChange = (value) => {
            let nextVal = value;      // 用于 UI 显示 (Select value prop)
            let exportVal = value;    // 用于输出 (Input value & callback)
            
            // 清空搜索文本
            setSearchText('');
            setOpen(false);

            if (Array.isArray(value)) {
                if (config.mode === 'tags' || config.mode === 'multiple') {
                    if (!config.keepArray) {
                        // 强制单选行为：取最后一个值
                        const lastItem = value.length > 0 ? value[value.length - 1] : undefined;
                        
                        // UI 上，如果是 tags 模式，value 必须是数组
                        nextVal = lastItem ? [lastItem] : [];
                        
                        // 输出值
                        exportVal = lastItem || '';
                    }
                }
            }
            
            setVal(nextVal);

            const input = document.getElementById(inputId);
            if (input) {
                input.value = Array.isArray(exportVal) ? exportVal.join(',') : (exportVal || '');
                // 触发原生事件以便兼容性
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
                
                if (onChangeCallback) onChangeCallback(exportVal);
            }
        };
        
        // 构建 className
        let className = config.className || '';
        if (isTagMode) {
            className += ' ant-select-tag-single-mode'; // 标记为 Tag 单选模式
            if (searchText) {
                className += ' has-search-text'; // 标记有搜索内容
            }
        }

        const notFoundContent = config.notFoundContent ?? undefined;

        const dropdownRender = enableCreateOption
            ? (menu) => React.createElement(
                'div',
                null,
                menu,
                canCreate
                    ? React.createElement(
                        'div',
                        {
                            style: {
                                padding: '8px 12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#1677ff'
                            },
                            onMouseDown: (e) => e.preventDefault(),
                            onClick: () => {
                                const text = normalizeText(searchText);
                                if (!text) return;
                                handleChange([text]);
                            }
                        },
                        React.createElement('i', { className: 'fa fa-plus', style: { fontSize: '12px' } }),
                        React.createElement('span', null, `新建 "${normalizeText(searchText)}"`)
                    )
                    : null
            )
            : undefined;

        const props = {
            placeholder: placeholder,
            style: { width: '100%' },
            showSearch: true,
            allowClear: true,
            optionFilterProp: "label",
            ...config, // 允许覆盖配置，如 mode: 'tags'
            className: className,
            value: val, // 受控模式
            onChange: handleChange,
            onSearch: handleSearch, // 监听搜索
            onBlur: () => {
                if (!keepSearchTextOnBlur) setSearchText('');
            },
            onClear: () => {
                setSearchText('');
                setOpen(false);
                const clearedVal = (isTagMode || isMultiMode) ? [] : undefined;
                setVal(clearedVal);

                const input = document.getElementById(inputId);
                if (input) {
                    input.value = '';
                    const event = new Event('change', { bubbles: true });
                    input.dispatchEvent(event);
                }
                if (onChangeCallback) onChangeCallback('');
            },
            notFoundContent: notFoundContent,
            options: options,
            // 显式限制下拉菜单样式
            listHeight: 256,
            dropdownStyle: { maxHeight: 256, overflow: 'auto', zIndex: 10001 },
            filterOption: (input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase()),
        };

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
        const renderAntdInput = (containerId, inputId, placeholderOrConfig, onChangeCallback) => {
            if (!window.React || !window.ReactDOM || !window.antd) return false;
            
            const { Input } = window.antd;
            const React = window.React;
            const ReactDOM = window.ReactDOM;
            const { useState, useEffect } = React;

            let placeholder = '';
            let config = {};
            if (typeof placeholderOrConfig === 'object') {
                config = placeholderOrConfig;
                placeholder = config.placeholder || '';
            } else {
                placeholder = placeholderOrConfig || '';
            }

            const App = () => {
                const [val, setVal] = useState(config.defaultValue || '');

                const handleChange = (e) => {
                    const newValue = e.target.value;
                    setVal(newValue);
                    
                    const input = document.getElementById(inputId);
                    if (input) {
                        input.value = newValue;
                        // Trigger native events for legacy compatibility
                        const event = new Event('input', { bubbles: true });
                        input.dispatchEvent(event);
                        const changeEvent = new Event('change', { bubbles: true });
                        input.dispatchEvent(changeEvent);
                    }
                    
                    if (onChangeCallback) onChangeCallback(newValue);
                };

                let prefix = null;
                if (config.prefixIcon) {
                    prefix = React.createElement('i', { className: config.prefixIcon, style: { color: '#9ca3af' } });
                }

                return React.createElement(Input, {
                    id: inputId + '_antd',
                    placeholder: placeholder,
                    value: val,
                    onChange: handleChange,
                    allowClear: true,
                    prefix: prefix,
                    style: { height: '32px' }, // Enforce 32px height to match Select/Datepicker
                    ...config
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

// Expose to global scope for other scripts
window.renderAntdSelect = renderAntdSelect;
window.renderAntdInput = renderAntdInput;

const initAntdComponents = () => {
    // 检查依赖是否加载
    if (!window.React || !window.ReactDOM || !window.dayjs || !window.antd) {
        return false;
    }

    const { message, DatePicker, Space } = window.antd;
    const { RangePicker } = DatePicker;
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const dayjs = window.dayjs;

    if (!window.__antdMessageHostInited && message && typeof message.useMessage === 'function') {
        const hostId = 'antd-message-host';
        let host = document.getElementById(hostId);
        if (!host) {
            host = document.createElement('div');
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
            }, [messageApi]);

            return contextHolder;
        };

        window.__antdMessageRoot.render(React.createElement(MessageHost));
        window.__antdMessageHostInited = true;
    }

    window.showAntdMessage = function(type, content, options) {
        const api = window.__antdMessageApi;
        const opts = options && typeof options === 'object' ? options : {};
        const safeType = type || 'info';

        if (api && typeof api.open === 'function') {
            api.open({ type: safeType, content: content, ...opts });
            return;
        }

        if (message && typeof message[safeType] === 'function') {
            message[safeType](content);
            return;
        }

        if (message && typeof message.info === 'function') {
            message.info(content);
        }
    };

    if (!window.__antdConfirmHostInited && window.antd && window.antd.Modal) {
        const hostId = 'antd-confirm-host';
        let host = document.getElementById(hostId);
        if (!host) {
            host = document.createElement('div');
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
                title: '',
                content: '',
                okText: '确定',
                cancelText: '取消',
                resolve: null
            });

            useEffect(() => {
                window.__openAntdConfirm = (opts) => {
                    const next = opts && typeof opts === 'object' ? opts : {};
                    return new Promise((resolve) => {
                        setState({
                            open: true,
                            title: next.title || '确认',
                            content: next.content || '',
                            okText: next.okText || '确定',
                            cancelText: next.cancelText || '取消',
                            resolve
                        });
                    });
                };
            }, []);

            const closeWith = (result) => {
                const r = state.resolve;
                setState((s) => ({ ...s, open: false }));
                if (typeof r === 'function') r(result);
            };

            return React.createElement(
                Modal,
                {
                    title: state.title,
                    open: state.open,
                    okText: state.okText,
                    cancelText: state.cancelText,
                    onOk: () => closeWith(true),
                    onCancel: () => closeWith(false),
                    maskClosable: false,
                    destroyOnClose: true
                },
                typeof state.content === 'string'
                    ? React.createElement('div', null, state.content)
                    : state.content
            );
        };

        window.__antdConfirmRoot.render(React.createElement(ConfirmHost));
        window.__antdConfirmHostInited = true;
    }

    window.showAntdConfirm = function(opts) {
        if (typeof window.__openAntdConfirm === 'function') {
            return window.__openAntdConfirm(opts);
        }
        const content = opts && typeof opts === 'object' ? (opts.content || '确认？') : '确认？';
        return Promise.resolve(confirm(content));
    };

    // 配置全局 message
    message.config({
        top: 50,
        duration: 3,
        maxCount: 3,
    });

    // 覆盖原生 alert (仅一次)
    if (!window.alertOverridden) {
        window.originalAlert = window.alert;
        window.alert = function(msg) {
            if (!msg) return;
            const strMsg = String(msg);
            if (strMsg.includes('成功') || strMsg.includes('完成')) {
                window.showAntdMessage('success', strMsg);
            } else if (strMsg.includes('失败') || strMsg.includes('错误') || strMsg.includes('请') || strMsg.includes('无效')) {
                window.showAntdMessage('error', strMsg);
            } else if (strMsg.includes('警告')) {
                window.showAntdMessage('warning', strMsg);
            } else {
                window.showAntdMessage('info', strMsg);
            }
        };
        window.alertOverridden = true;
    }
    
    console.log('Ant Design components loaded and integrated.');

    // 初始化 DatePicker 通用函数
    const renderDatePicker = (containerId, startInputId, endInputId, renderCallback) => {
        const container = document.getElementById(containerId);
        if (container) {
            // 检查是否已经渲染过（防止重复渲染）
            if (container.hasAttribute('data-rendered')) {
                return true;
            }

            const rangePresets = [
                { label: 'Last 7 Days', value: [dayjs().add(-7, 'd'), dayjs()] },
                { label: 'Last 14 Days', value: [dayjs().add(-14, 'd'), dayjs()] },
                { label: 'Last 30 Days', value: [dayjs().add(-30, 'd'), dayjs()] },
                { label: 'Last 90 Days', value: [dayjs().add(-90, 'd'), dayjs()] },
            ];

            const DatePickerApp = () => {
                const onRangeChange = (dates, dateStrings) => {
                    // User provided logging logic
                    if (dates) {
                        console.log('From: ', dates[0], ', to: ', dates[1]);
                        console.log('From: ', dateStrings[0], ', to: ', dateStrings[1]);
                    } else {
                        console.log('Clear');
                    }

                    // Integration logic
                    const startInput = document.getElementById(startInputId);
                    const endInput = document.getElementById(endInputId);
                    
                    if (startInput && endInput) {
                        startInput.value = dateStrings[0] || '';
                        endInput.value = dateStrings[1] || '';
                        
                        if (typeof renderCallback === 'function') {
                            if (window.paginationState) {
                                // 尝试推断 stateKey (logs, bills 等)
                                // 这里简化处理，假设 callback 是 renderLogsTable 这种命名
                                const callbackName = renderCallback.name;
                                let stateKey = '';
                                if (callbackName.includes('Logs')) stateKey = 'logs';
                                else if (callbackName.includes('Bills')) stateKey = 'bills'; // 假设有 bills 分页
                                
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
                            label: React.createElement('span', { 'aria-label': 'Current Time to End of Day' }, 'Now ~ EOD'),
                            value: () => [dayjs(), dayjs().endOf('day')],
                        },
                        ...rangePresets,
                    ],
                    showTime: true,
                    format: "YYYY/MM/DD HH:mm:ss",
                    onChange: onRangeChange,
                    style: { width: '100%' }
                });
            };

            const root = ReactDOM.createRoot(container);
            root.render(React.createElement(DatePickerApp));
            container.setAttribute('data-rendered', 'true');
            return true;
        }
        return false;
    };

    // 初始化各个模块的 DatePicker
    const logInit = renderDatePicker('log-date-range-picker-container', 'log-filter-date-start', 'log-filter-date-end', window.renderLogsTable);
    const billsInit = renderDatePicker('bills-date-range-picker-container', 'bills-filter-date-start', 'bills-filter-date-end', window.renderBillsTable); // 假设有 renderBillsTable

    // 初始化报表筛选器
    const initReportFilters = () => {
        if (!window.renderAntdSelect) return;
        
        // Report Type
        const reportTypeOptions = [
            { value: 'inventory-turnover', label: '库存周转率' },
            { value: 'sales-trend', label: '销售趋势' },
            { value: 'accounts-receivable', label: '应收账款' },
            { value: 'supplier-performance', label: '供应商表现' }
        ];
        renderAntdSelect('report-type-container', 'report-type-select', reportTypeOptions, '库存周转率');

        // Time Range
        const timeRangeOptions = [
            { value: 'last-month', label: '上个月' },
            { value: 'last-quarter', label: '上季度' },
            { value: 'last-year', label: '去年' },
            { value: 'custom', label: '自定义' }
        ];
        renderAntdSelect('report-time-range-container', 'report-time-range-select', timeRangeOptions, '上个月');

        // Company
        const companyOptions = [
             { value: '', label: '全部公司' },
             { value: 'chemical', label: '化工' },
             { value: 'labor', label: '劳保' }
        ];
        renderAntdSelect('report-company-container', 'report-company-select', companyOptions, '全部公司');
    };
    initReportFilters();

    // Initialize Input Components
    if (window.renderAntdInput) {
        // Inventory Search
        renderAntdInput('filter-search-container', 'filter-search', { placeholder: '搜索商品...', prefixIcon: 'fa fa-search' }, (val) => {
             if (window.updateInventoryTable) window.updateInventoryTable();
        });

        // Log Filter User
        renderAntdInput('log-filter-user-container', 'log-filter-user', { placeholder: '输入操作人...' }, (val) => {
             if (window.renderLogsTable) {
                  if (window.paginationState && window.paginationState.logs) window.paginationState.logs.page = 1;
                  window.renderLogsTable();
             }
        });

        // Log Filter Search
        renderAntdInput('log-filter-search-container', 'log-filter-search', { placeholder: '搜索操作对象...', prefixIcon: 'fa fa-search' }, (val) => {
             if (window.renderLogsTable) {
                  if (window.paginationState && window.paginationState.logs) window.paginationState.logs.page = 1;
                  window.renderLogsTable();
             }
        });

        // Bills Filter Search
        renderAntdInput('bills-filter-search-container', 'bills-filter-search', { placeholder: '搜索对账单...', prefixIcon: 'fa fa-search' }, (val) => {
             if (window.updateBillsTable) {
                  if (window.paginationState && window.paginationState.bills) window.paginationState.bills.page = 1;
                  window.updateBillsTable();
             }
        });
    }

    // 只要有一个成功初始化，就认为成功（或者可以更严格）
    return logInit || billsInit;
};

// 启动初始化流程
const startAntdInit = () => {
    let attempts = 0;
    const maxAttempts = 100; // 10 seconds
    
    const tryInit = () => {
        // 尝试初始化
        const initSuccess = initAntdComponents();
        
        // 如果 initAntdComponents 返回 true，说明所有组件都已成功渲染，直接退出
        if (initSuccess) {
            return;
        }

        attempts++;
        if (attempts < maxAttempts) {
            setTimeout(tryInit, 100);
        } else {
            console.error('Failed to load Ant Design components or container after 10 seconds.');
            
            // 详细的错误诊断
            const missing = [];
            if (!window.React) missing.push('React');
            if (!window.ReactDOM) missing.push('ReactDOM');
            if (!window.dayjs) missing.push('dayjs');
            if (!window.antd) missing.push('antd');
            
            const errorMsg = missing.length > 0 
                ? `组件加载失败，缺失依赖：${missing.join(', ')}。请检查网络或刷新重试。` 
                : '组件加载失败（未知原因），请刷新页面重试。';

            console.error(errorMsg);
            
            const fallback = (id) => {
                const c = document.getElementById(id);
                // 只有当容器存在且没有被渲染过（data-rendered）且没有子节点时，才显示错误
                if (c && !c.hasAttribute('data-rendered') && !c.hasChildNodes()) {
                    c.innerHTML = `
                        <div class="flex items-center space-x-2 text-sm text-red-500 bg-red-50 p-2 rounded border border-red-200">
                            <i class="fa fa-exclamation-circle"></i>
                            <span>${errorMsg}</span>
                        </div>
                    `;
                }
            };
            
            fallback('log-date-range-picker-container');
            fallback('bills-date-range-picker-container');
        }
    };
    
    tryInit();
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startAntdInit);
} else {
    startAntdInit();
}
// ----------------------

// 获取客户端IP地址（模拟）
const clientIP = '192.168.1.100';

    // 获取本地日期的ISO字符串格式 (YYYY-MM-DD)
function getLocalISOString() {
    const now = new Date();
    // 使用本地时间而不是UTC时间
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
}

// 模拟数据
let defaultMockData = {}; // 将从 data.json 加载

// 实际使用的数据（支持持久化）
let mockData = JSON.parse(JSON.stringify(defaultMockData));

// 进出货记录数据
let stockMovementData = [];

// 日志数据
let logsData = [];

// Deprecated variables removed

// 全局分页状态管理
const paginationState = {
    inventory: { page: 1, pageSize: 10, total: 0 },
    stock: { page: 1, pageSize: 10, total: 0 },
    logs: { page: 1, pageSize: 10, total: 0 },
    suppliers: { page: 1, pageSize: 10, total: 0 },
    companies: { page: 1, pageSize: 10, total: 0 },
    customers: { page: 1, pageSize: 10, total: 0 },
    bills: { page: 1, pageSize: 10, total: 0 }
};

// 存储 React Roots 以支持多次渲染
window.paginationRoots = {};

// 分页控件渲染函数 (Ant Design 版)
function renderPaginationControl(containerId, stateKey, onPageChange) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // 检查 Ant Design 依赖
    if (!window.antd || !window.React || !window.ReactDOM) {
        console.warn('Ant Design dependencies not loaded, skipping pagination render.');
        return;
    }

    const { Pagination, ConfigProvider, theme } = window.antd;
    const React = window.React;
    const ReactDOM = window.ReactDOM;
    const state = paginationState[stateKey];
    
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
        if (typeof onPageChange === 'function') {
            onPageChange();
        }
    };

    // 使用 ConfigProvider 配置中文文案（简易版，不依赖外部 locale 文件）
    // 注意：完整的中文支持通常需要引入 antd/locale/zh_CN，这里通过自定义 showTotal 等属性实现部分汉化
    const App = React.createElement(ConfigProvider, {
            theme: {
                algorithm: theme.defaultAlgorithm,
                token: {
                    colorPrimary: '#1a56db', 
                },
            },
        }, 
        React.createElement('div', { className: "flex justify-end py-4" },
            React.createElement(Pagination, {
                current: state.page,
                pageSize: state.pageSize,
                total: state.total,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                onChange: onChange,
                showTotal: (total, range) => `显示 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                // 强制英文部分尽可能通过 prop 覆盖，或者接受默认
            })
        )
    );

    root.render(App);
}

// 旧的分页辅助函数 (已废弃，保留占位防止报错)
function generatePageNumbers() { return ''; }
window.changePageSize = function() {};
window.changePage = function() {};

// 初始化库存筛选器
function initInventoryFilters() {
    const searchFilter = document.getElementById('filter-search');

    // 定义选项数据
    const companyOptions = [
        { value: '化工', label: '化工' },
        { value: '劳保', label: '劳保' }
    ];
    
    const statusOptions = [
        { value: 'normal', label: '正常' },
        { value: 'low', label: '库存不足' },
        { value: 'overstock', label: '库存过剩' },
        { value: 'out', label: '缺货' }
    ];

    // 初始化 Select 组件
    const initSelects = () => {
        // 确保依赖和数据都已就绪
        if (!window.antd || !window.React || !window.ReactDOM || !mockData.suppliers) {
            setTimeout(initSelects, 100);
            return;
        }

        const supplierOptions = mockData.suppliers.map(s => ({ value: s.id, label: s.name }));

        renderAntdSelect('filter-company-container', 'filter-company', companyOptions, '全部公司', () => {
            paginationState.inventory.page = 1;
            updateInventoryTable();
        });

        renderAntdSelect('filter-status-container', 'filter-status', statusOptions, '全部状态', () => {
             paginationState.inventory.page = 1;
             updateInventoryTable();
        });

        renderAntdSelect('filter-supplier-container', 'filter-supplier', supplierOptions, '全部供应商', () => {
             paginationState.inventory.page = 1;
             updateInventoryTable();
        });
    };
    
    // 启动初始化
    initSelects();

    // 绑定搜索框事件
    if (searchFilter) {
        const handler = () => {
            paginationState.inventory.page = 1; // 重置到第一页
            updateInventoryTable();
        };
        searchFilter.addEventListener('input', handler);
    }
}

// 初始化日志筛选器
function initLogFilters() {
    const userFilter = document.getElementById('log-filter-user');
    const searchFilter = document.getElementById('log-filter-search');

    // 操作类型选项
    const typeOptions = [
        { value: 'add', label: '新增' },
        { value: 'edit', label: '编辑' },
        { value: 'delete', label: '删除' },
        { value: 'import', label: '导入' },
        { value: 'export', label: '导出' }
    ];

    // 初始化 Select 组件
    const initSelects = () => {
        if (!window.antd || !window.React || !window.ReactDOM) {
            setTimeout(initSelects, 100);
            return;
        }

        renderAntdSelect('log-filter-type-container', 'log-filter-type', typeOptions, '全部类型', () => {
            paginationState.logs.page = 1;
            renderLogsTable();
        });
    };
    initSelects();

    const filters = [userFilter, searchFilter]; // Removed date filters from listener because they are handled by React component
    filters.forEach(filter => {
        if (filter) {
            const handler = () => {
                paginationState.logs.page = 1; // 重置到第一页
                renderLogsTable();
            };
            filter.addEventListener('input', handler);
            filter.addEventListener('change', handler);
        }
    });
}

// 初始化对账单筛选器
function initBillFilters() {
    const searchFilter = document.getElementById('bills-filter-search');

    const statusOptions = [
        { value: 'pending', label: '待核对' },
        { value: 'verified', label: '已核对' },
        { value: 'paid', label: '已付款' }
    ];

    const initSelects = () => {
        if (!window.antd || !window.React || !window.ReactDOM || !mockData.suppliers) {
            setTimeout(initSelects, 100);
            return;
        }

        const supplierOptions = mockData.suppliers.map(s => ({ value: s.name, label: s.name }));

        renderAntdSelect('bills-filter-supplier-container', 'bills-filter-supplier', supplierOptions, '全部供应商', () => {
            paginationState.bills.page = 1;
            updateBillsTable();
        });

        renderAntdSelect('bills-filter-status-container', 'bills-filter-status', statusOptions, '全部状态', () => {
            paginationState.bills.page = 1;
            updateBillsTable();
        });
    };
    initSelects();

    if (searchFilter) {
        const handler = () => {
            paginationState.bills.page = 1;
            updateBillsTable();
        };
        searchFilter.addEventListener('input', handler);
    }
}

// 更新对账单列表
function updateBillsTable() {
    const tbody = document.getElementById('bills-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    // 获取筛选条件
    const supplierFilter = document.getElementById('bills-filter-supplier') ? document.getElementById('bills-filter-supplier').value : '';
    const statusFilter = document.getElementById('bills-filter-status') ? document.getElementById('bills-filter-status').value : '';
    const dateStartFilter = document.getElementById('bills-filter-date-start') ? document.getElementById('bills-filter-date-start').value : '';
    const dateEndFilter = document.getElementById('bills-filter-date-end') ? document.getElementById('bills-filter-date-end').value : '';
    const searchFilter = document.getElementById('bills-filter-search') ? document.getElementById('bills-filter-search').value.toLowerCase().trim() : '';

    // 确保 mockData.bills 存在
    if (!mockData.bills) mockData.bills = [];
    
    // 如果没有数据，添加一些模拟数据 (仅用于演示，实际应从 loadMockData 获取)
    if (mockData.bills.length === 0) {
        mockData.bills = [
            { id: 'BILL-2023-0001', supplierName: '苹果公司', period: '2023-06-01 至 2023-06-30', amount: '¥250,000', status: 'paid', createdAt: '2023-07-05' },
            { id: 'BILL-2023-0002', supplierName: '三星电子', period: '2023-06-01 至 2023-06-30', amount: '¥180,000', status: 'verified', createdAt: '2023-07-08' },
            { id: 'BILL-2023-0003', supplierName: '华为技术', period: '2023-06-01 至 2023-06-30', amount: '¥210,000', status: 'pending', createdAt: '2023-07-10' },
            { id: 'BILL-2023-0004', supplierName: '苹果公司', period: '2023-07-01 至 2023-07-15', amount: '¥150,000', status: 'pending', createdAt: '2023-07-18' }
        ];
    }

    let filteredBills = mockData.bills.filter(bill => {
        // 供应商筛选
        if (supplierFilter && bill.supplierName !== supplierFilter) return false;
        
        // 状态筛选
        if (statusFilter && bill.status !== statusFilter) return false;

        // 日期范围筛选
        if (dateStartFilter) {
            const billDate = new Date(bill.createdAt);
            const startDate = new Date(dateStartFilter);
            if (!dateStartFilter.includes(':')) startDate.setHours(0, 0, 0, 0);
            if (billDate < startDate) return false;
        }
        if (dateEndFilter) {
            const billDate = new Date(bill.createdAt);
            const endDate = new Date(dateEndFilter);
            if (!dateEndFilter.includes(':')) endDate.setHours(23, 59, 59, 999);
            if (billDate > endDate) return false;
        }

        // 搜索筛选
        if (searchFilter) {
            const searchStr = searchFilter.toLowerCase();
            return (bill.id && bill.id.toLowerCase().includes(searchStr)) || 
                   (bill.supplierName && bill.supplierName.toLowerCase().includes(searchStr));
        }

        return true;
    });
    
    // 按创建时间倒序
    filteredBills.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    paginationState.bills.total = filteredBills.length;

    let { page, pageSize } = paginationState.bills;

    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(filteredBills.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.bills.page = totalPages;
        page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedBills = filteredBills.slice(startIndex, endIndex);

    if (paginatedBills.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">暂无对账单记录</td></tr>';
        renderPaginationControl('bills-pagination-container', 'bills', updateBillsTable);
        return;
    }

    paginatedBills.forEach(bill => {
        const formattedCreatedAt = new Date(bill.createdAt || new Date()).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour12: false
        });
        
        let statusClass = '';
        let statusText = '';
        switch(bill.status) {
            case 'paid': 
                statusClass = 'bg-green-100 text-green-800'; 
                statusText = '已付款';
                break;
            case 'verified': 
                statusClass = 'bg-blue-100 text-blue-800'; 
                statusText = '已核对';
                break;
            case 'pending': 
                statusClass = 'bg-yellow-100 text-yellow-800'; 
                statusText = '待核对';
                break;
            default:
                statusClass = 'bg-gray-100 text-gray-800';
                statusText = bill.status;
        }

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${bill.id}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${bill.supplierName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${bill.period}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${bill.amount}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">创建:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                        </span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" class="text-primary hover:text-primary-dark mr-3">查看</a>
                <a href="#" class="text-danger hover:text-danger-dark">删除</a>
            </td>
        `;
        tbody.appendChild(row);
    });

    renderPaginationControl('bills-pagination-container', 'bills', updateBillsTable);
}

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', async function() {

    console.log('DOM Content Loaded - Starting initialization');
    
    // 1. 优先绑定核心导航和交互事件，确保界面可操作
    try {
        bindNavigationEvents();
        bindMobileEvents();
        bindModalEvents();
        bindActionButtons();
        bindSettingsEvents();
    } catch (e) {
        console.error('Error binding events:', e);
    }

    // 2. 加载数据
    try {
        // 清除旧的本地存储数据（仅调试用）
        // localStorage.removeItem('stockMovementData');
        
        await loadMockData(); // 加载基础数据（商品、供应商、客户、公司）
        loadStockMovementData();
        loadLogsData();

        // 初始化筛选器（确保在数据加载后执行）
        initInventoryFilters();
        initLogFilters();
        initBillFilters();
        
        // 渲染表格
        updateInventoryTable();
        updateCompanyTable();
        updateSupplierTable();
        updateCustomerTable(); 
        updateBillsTable(); // 渲染对账单表格
        
        // 初始显示仪表盘或当前选中的部分
        const activeLink = document.querySelector('.nav-link.active');
        if (activeLink) {
            const target = activeLink.getAttribute('data-target');
            showSection(target);
        }

        // 渲染仪表盘最近活动
        renderDashboardActivity();
    } catch (e) {
        console.error('Error loading data:', e);
    }
    
    // 4. 初始化图表
    try {
        initCharts();
    } catch (e) {
        console.error('Chart initialization failed:', e);
    }
});

// Deprecated function removed

// Deprecated event listener removed

// 绑定导航事件
function bindNavigationEvents() {
    const navLinks = document.querySelectorAll('.nav-link');
    console.log('Found nav links:', navLinks.length);
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            console.log('Navigating to:', target);
            showSection(target);
            
            // 更新导航状态
            navLinks.forEach(item => item.classList.remove('active', 'bg-gray-800', 'text-white'));
            this.classList.add('active', 'bg-gray-800', 'text-white');
        });
    });

    // 进出货标签页切换
    const stockTabs = document.querySelectorAll('#stock-tabs button');
    stockTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            stockTabs.forEach(t => {
                t.classList.remove('active', 'border-primary', 'text-primary');
                t.classList.add('border-transparent');
            });
            this.classList.add('active', 'border-primary', 'text-primary');
            this.classList.remove('border-transparent');
            
            // 重置分页
            paginationState.stock.page = 1;
            
            const tabType = this.getAttribute('data-tab');
            renderStockMovementTable(tabType);
        });
    });
    
    // 下拉菜单交互
    const navDropdowns = document.querySelectorAll('.nav-dropdown > a');
    navDropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', function(e) {
            e.preventDefault();
            const submenu = this.nextElementSibling;
            const icon = this.querySelector('.fa-chevron-down');
            if (submenu.classList.contains('hidden')) {
                submenu.classList.remove('hidden');
                icon.style.transform = 'rotate(180deg)';
            } else {
                submenu.classList.add('hidden');
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
}

// 绑定移动端事件
function bindMobileEvents() {
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            showSection(target);
            mobileNavLinks.forEach(item => item.classList.remove('active', 'bg-gray-800', 'text-white'));
            this.classList.add('active', 'bg-gray-800', 'text-white');
            const mobileSidebar = document.getElementById('mobile-sidebar');
            if (mobileSidebar) mobileSidebar.classList.add('hidden');
        });
    });
    
    const mobileMenuBtn = document.getElementById('mobile-menu-button');
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function() {
            document.getElementById('mobile-sidebar').classList.remove('hidden');
        });
    }
    
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-button');
    if (sidebarToggleBtn) {
        sidebarToggleBtn.addEventListener('click', function() {
            const isDesktop = window.innerWidth >= 768;
            if (isDesktop) {
                const desktopSidebar = document.getElementById('desktop-sidebar');
                if (!desktopSidebar) return;
                desktopSidebar.style.display = desktopSidebar.style.display === 'none' ? '' : 'none';
                return;
            }
            const mobileSidebar = document.getElementById('mobile-sidebar');
            if (mobileSidebar) {
                mobileSidebar.classList.toggle('hidden');
            }
        });
    }
    
    const closeMobileMenuBtn = document.getElementById('close-mobile-menu');
    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', function() {
            document.getElementById('mobile-sidebar').classList.add('hidden');
        });
    }
    
    const userMenuBtn = document.getElementById('user-menu-button');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', function() {
            document.getElementById('user-menu').classList.toggle('hidden');
        });
    }
    
    document.addEventListener('click', function(e) {
        const userMenu = document.getElementById('user-menu');
        const userMenuButton = document.getElementById('user-menu-button');
        if (userMenu && userMenuButton && !userMenu.contains(e.target) && !userMenuButton.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });
}

// 绑定模态框事件
function bindModalEvents() {
    const modal = document.getElementById('modal');
    const closeModal = document.getElementById('close-modal');
    const modalCancel = document.getElementById('modal-cancel');
    
    if (closeModal && modal) {
        closeModal.addEventListener('click', function() {
            modal.classList.add('hidden');
        });
    }
    
    if (modalCancel && modal) {
        modalCancel.addEventListener('click', function() {
            modal.classList.add('hidden');
        });
    }
    
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
}

// 绑定操作按钮事件
function bindActionButtons() {
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', showAddProductModal);
    }
    
    const addCustomerBtn = document.getElementById('add-customer-btn');
    if (addCustomerBtn) {
        addCustomerBtn.addEventListener('click', showAddCustomerModal);
    }

    const addCompanyBtn = document.getElementById('add-company-btn');
    if (addCompanyBtn) {
        addCompanyBtn.addEventListener('click', showAddCompanyModal);
    }
    
    const addInboundBtn = document.getElementById('add-inbound-btn');
    if (addInboundBtn) {
        addInboundBtn.addEventListener('click', showAddInboundModal);
    }
    
    const addOutboundBtn = document.getElementById('add-outbound-btn');
    if (addOutboundBtn) {
        addOutboundBtn.addEventListener('click', function() {
            showSection('sales-order');
            if (typeof initSalesOrder === 'function') {
                initSalesOrder();
            }
        });
    }
}

// 显示指定部分
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    const sections = document.querySelectorAll('.page-section');
    sections.forEach(section => {
        section.classList.add('hidden');
    });
    
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        
        // 如果是日志页面，渲染日志表格
        if (sectionId === 'logs') {
            renderLogsTable();
        }
        // 如果是进出货管理页面，渲染进出货记录表格
        else if (sectionId === 'stock-movement') {
            renderStockMovementTable('all');
        }
    } else {
        console.error('Target section not found:', sectionId);
    }
}

// 初始化图表
function initCharts() {
    if (typeof Chart === 'undefined') {
        console.error('Chart.js is not loaded');
        return;
    }

    // 库存价值趋势图
    const inventoryValueCtx = document.getElementById('inventoryValueChart');
    if (inventoryValueCtx) {
        new Chart(inventoryValueCtx, {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
                datasets: [{
                    label: '库存价值（万元）',
                    data: [100, 110, 115, 105, 120, 125, 130],
                    borderColor: '#1a56db',
                    backgroundColor: 'rgba(26, 86, 219, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // 库存分类分布图
    const inventoryCategoryCtx = document.getElementById('inventoryCategoryChart');
    if (inventoryCategoryCtx) {
        new Chart(inventoryCategoryCtx, {
            type: 'doughnut',
            data: {
                labels: ['电子产品', '服装', '家具', '图书'],
                datasets: [{
                    data: [65, 15, 10, 10],
                    backgroundColor: [
                        '#1a56db',
                        '#10b981',
                        '#f59e0b',
                        '#ef4444'
                    ],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                },
                cutout: '70%'
            }
        });
    }
    
    // 库存周转率趋势图
    const inventoryTurnoverCtx = document.getElementById('inventoryTurnoverChart');
    if (inventoryTurnoverCtx) {
        new Chart(inventoryTurnoverCtx, {
            type: 'line',
            data: {
                labels: ['1月', '2月', '3月', '4月', '5月', '6月', '7月'],
                datasets: [{
                    label: '库存周转率',
                    data: [3.2, 3.5, 3.8, 3.6, 4.0, 4.2, 4.5],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    tension: 0.3,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
    
    // 库存周转率排名图
    const inventoryTurnoverRankingCtx = document.getElementById('inventoryTurnoverRankingChart');
    if (inventoryTurnoverRankingCtx) {
        new Chart(inventoryTurnoverRankingCtx, {
            type: 'bar',
            data: {
                labels: ['MacBook Air', 'Apple Watch', 'iPhone', 'AirPods', 'iPad'],
                datasets: [{
                    label: '库存周转率',
                    data: [4.0, 4.0, 2.0, 2.0, 0.0],
                    backgroundColor: [
                        '#10b981',
                        '#10b981',
                        '#3b82f6',
                        '#3b82f6',
                        '#ef4444'
                    ],
                    borderWidth: 0,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            drawBorder: false
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }
}

// 显示模态框
function showModal(title, content, confirmCallback) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-content').innerHTML = content;
    document.getElementById('modal').classList.remove('hidden');
    
    // 设置确认按钮回调
    const confirmBtn = document.getElementById('modal-confirm');
    // Remove old event listener by cloning node or just setting onclick (simpler for now)
    confirmBtn.onclick = function() {
        if (typeof confirmCallback === 'function') {
            const result = confirmCallback();
            if (result === false) return; // 如果回调返回false，则阻止关闭
        }
        document.getElementById('modal').classList.add('hidden');
    };
}

// 显示新增商品模态框
function showAddProductModal() {
    // 商品分类选项
    const categories = ['电子产品', '服装', '家具', '图书'];
    
    // 构建表单内容
    const formContent = `
        <form id="add-product-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商品名称 <span class="text-danger">*</span></label>
                <input type="text" name="name" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">分类 <span class="text-danger">*</span></label>
                <div id="modal-category-container" class="w-full"></div>
                <input type="hidden" name="category" id="modal-category-input" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">数量 <span class="text-danger">*</span></label>
                <input type="number" name="quantity" min="1" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">成本价 <span class="text-danger">*</span></label>
                <input type="number" name="costPrice" required min="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">供应商 <span class="text-danger">*</span></label>
                <div id="modal-supplier-container" class="w-full"></div>
                <input type="hidden" name="supplierId" id="modal-supplier-input" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea name="notes" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>
            </div>
        </form>
    `;
    
    // 显示模态框
    showModal('新增商品', formContent, function() {
        // 提交表单
        const form = document.getElementById('add-product-form');
        const formData = new FormData(form);
        
        // 验证必填项
        if (!formData.get('name')) { alert('请输入商品名称'); return false; }
        if (!formData.get('category')) { alert('请选择分类'); return false; }
        if (!formData.get('quantity')) { alert('请输入数量'); return false; }
        if (!formData.get('costPrice')) { alert('请输入成本价'); return false; }
        if (!formData.get('supplierId')) { alert('请选择供应商'); return false; }

        // 构建商品对象
        const productData = {
            name: formData.get('name'),
            category: formData.get('category'),
            quantity: parseInt(formData.get('quantity')),
            costPrice: parseFloat(formData.get('costPrice')),
            supplierId: formData.get('supplierId'),
            notes: formData.get('notes')
        };
        
        // 添加商品
        addProduct(productData);
    });

    // 渲染 Antd Select 组件
    const categoryOptions = categories.map(c => ({ value: c, label: c }));
    renderAntdSelect('modal-category-container', 'modal-category-input', categoryOptions, '请选择分类');

    const supplierOptions = mockData.suppliers.map(s => ({ value: s.id, label: s.name }));
    renderAntdSelect('modal-supplier-container', 'modal-supplier-input', supplierOptions, '请选择供应商');
}

// 添加商品
function addProduct(productData) {
    // 检查是否已存在相同商品
    const existingProduct = mockData.products.find(p => p.name === productData.name && p.supplierId === productData.supplierId);
    
    if (existingProduct) {
        // 如果存在相同商品，合并数据
        const oldQuantity = existingProduct.stockQuantity;
        existingProduct.stockQuantity += productData.quantity;
        existingProduct.updatedAt = getLocalISOString();
        
        // 显示成功消息
        alert(`商品 "${productData.name}" 已存在，已将数量合并。当前库存：${existingProduct.stockQuantity}`);
        
        // 添加日志记录
        addLog('edit', 'product', productData.name, `合并库存，原数量：${oldQuantity}，新增数量：${productData.quantity}，当前数量：${existingProduct.stockQuantity}`);
    } else {
        // 如果不存在相同商品，创建新商品
        const newProduct = {
            id: 'P' + String(mockData.products.length + 1).padStart(3, '0'),
            name: productData.name,
            category: productData.category,
            unit: '个',
            costPrice: productData.costPrice,
            retailPrice: productData.costPrice * 1.2, // 零售价默认为成本价的1.2倍
            stockQuantity: productData.quantity,
            minStock: 10, // 默认最小库存
            maxStock: 100, // 默认最大库存
            supplierId: productData.supplierId,
            createdAt: getLocalISOString(),
            updatedAt: getLocalISOString()
        };
        
        // 添加到商品列表
        mockData.products.push(newProduct);
        
        // 显示成功消息
        alert(`商品 "${productData.name}" 已成功添加，库存数量：${productData.quantity}`);
        
        // 添加日志记录
        addLog('add', 'product', productData.name, `新增商品，数量：${productData.quantity}，成本价：${productData.costPrice}`);
    }
    
    saveMockData(); // 保存数据
    
    // 更新库存列表
    updateInventoryTable();
}

// 更新库存列表
function updateInventoryTable() {
    // 获取表格 tbody 元素
    const tbody = document.querySelector('#inventory tbody');
    if (!tbody) return;
    
    // 获取筛选条件
    const companyFilterEl = document.getElementById('filter-company');
    const companyFilter = companyFilterEl ? companyFilterEl.value : '';
    
    const statusFilterEl = document.getElementById('filter-status');
    const statusFilter = statusFilterEl ? statusFilterEl.value : '';
    
    const supplierFilterEl = document.getElementById('filter-supplier');
    const supplierFilter = supplierFilterEl ? supplierFilterEl.value : '';
    
    const searchFilterEl = document.getElementById('filter-search');
    const searchFilter = searchFilterEl ? searchFilterEl.value.toLowerCase() : '';

    // 清空表格内容
    tbody.innerHTML = '';
    
    // 过滤数据
    let filteredProducts = mockData.products;

    // 按更新时间倒序排列
    filteredProducts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    if (companyFilter) {
        // 假设商品数据中有 company 字段，或者根据某种规则判断公司
        // 这里暂时假设没有 company 字段，实际应用中需要确认数据结构
        // 如果没有，可以暂不处理或添加模拟字段
        // 为了演示，假设 products 中没有 company 字段，这里先注释掉或根据实际情况调整
        // filteredProducts = filteredProducts.filter(p => p.company === companyFilter);
        // 如果要完全实现，需要在 mockData.products 中添加 company 属性
    }

    if (statusFilter) {
        filteredProducts = filteredProducts.filter(product => {
            if (statusFilter === 'normal') return product.stockQuantity >= product.minStock && product.stockQuantity <= product.maxStock && product.stockQuantity > 0;
            if (statusFilter === 'low') return product.stockQuantity < product.minStock && product.stockQuantity > 0;
            if (statusFilter === 'overstock') return product.stockQuantity > product.maxStock;
            if (statusFilter === 'out') return product.stockQuantity === 0;
            return true;
        });
    }

    if (supplierFilter) {
        filteredProducts = filteredProducts.filter(p => p.supplierId === supplierFilter);
    }

    if (searchFilter) {
        filteredProducts = filteredProducts.filter(p => 
            p.name.toLowerCase().includes(searchFilter) || 
            p.id.toLowerCase().includes(searchFilter)
        );
    }

    // 分页逻辑
    paginationState.inventory.total = filteredProducts.length;
    let { page, pageSize } = paginationState.inventory;
    
    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(filteredProducts.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.inventory.page = totalPages;
        page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

    if (paginatedProducts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">没有找到匹配的商品</td></tr>';
        renderPaginationControl('inventory-pagination-container', 'inventory', updateInventoryTable);
        return;
    }

    // 根据 paginatedProducts 重新渲染表格
    paginatedProducts.forEach(product => {
        // 获取供应商名称
        const supplier = mockData.suppliers.find(s => s.id === product.supplierId);
        const supplierName = supplier ? supplier.name : '未知供应商';
        
        // 计算库存价值
        const costPriceDisplay = (product.costPrice !== null && product.costPrice !== undefined) ? `¥${product.costPrice.toLocaleString()}` : '-';
        const stockValue = (product.costPrice || 0) * product.stockQuantity;
        
        // 确定库存状态
        let statusClass = 'bg-green-100 text-green-800';
        let statusText = '正常';
        
        if (product.stockQuantity === 0) {
            statusClass = 'bg-red-100 text-red-800';
            statusText = '缺货';
        } else if (product.stockQuantity < product.minStock) {
            statusClass = 'bg-yellow-100 text-yellow-800';
            statusText = '库存不足';
        } else if (product.stockQuantity > product.maxStock) {
            statusClass = 'bg-blue-100 text-blue-800';
            statusText = '库存过剩';
        }
        
        // 格式化时间
        const createdAt = new Date(product.createdAt || new Date());
        const updatedAt = new Date(product.updatedAt || new Date());

        const formattedCreatedAt = createdAt.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        
        const formattedUpdatedAt = updatedAt.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        
        // 创建表格行
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap overflow-hidden">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                        <i class="fa fa-${getProductIcon(product.category)} text-gray-500 text-xl"></i>
                    </div>
                    <div class="ml-4 overflow-hidden">
                        <div class="text-sm font-medium text-gray-900 truncate" title="${product.name}">${product.name}</div>
                        <div class="text-sm text-gray-500 truncate">SKU: ${product.id}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title="${product.category}">${product.category}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.stockQuantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${costPriceDisplay}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">¥${stockValue.toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500 truncate" title="${supplierName}">${supplierName}</td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2 w-16 text-right flex-shrink-0">创建时间:</span>
                        <span class="flex items-center overflow-hidden">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 flex-shrink-0">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">${formattedCreatedAt}</span>
                        </span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2 w-16 text-right flex-shrink-0">更新时间:</span>
                        <span class="flex items-center overflow-hidden">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2 flex-shrink-0">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full truncate">${formattedUpdatedAt}</span>
                        </span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" class="text-blue-600 hover:text-blue-900 mr-3">查看</a><a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>
                <a href="#" class="text-danger hover:text-danger-dark">删除</a>
            </td>
        `;
        
        // 添加到表格
        tbody.appendChild(row);
    });

    // 渲染分页控件
    renderPaginationControl('inventory-pagination-container', 'inventory', updateInventoryTable);
}

// 显示新增公司模态框
function showAddCompanyModal() {
    const content = `
        <form id="add-company-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">公司名称 <span class="text-danger">*</span></label>
                <input type="text" name="name" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系人 <span class="text-danger">*</span></label>
                <input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系电话 <span class="text-danger">*</span></label>
                <input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="请输入国内手机号或座机号">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">公司地址 <span class="text-danger">*</span></label>
                <input type="text" name="address" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">电子邮箱</label>
                <input type="email" name="email" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
        </form>
    `;

    showModal('新增公司', content, function() {
        const form = document.getElementById('add-company-form');
        const formData = new FormData(form);
        const name = formData.get('name').trim();
        const contactPerson = formData.get('contactPerson').trim();
        const contactPhone = formData.get('contactPhone').trim();
        const address = formData.get('address').trim();
        const email = formData.get('email').trim();
        
        // Required field validation
        if (!name) { alert('请输入公司名称'); return false; }
        if (!contactPerson) { alert('请输入联系人'); return false; }
        if (!contactPhone) { alert('请输入联系电话'); return false; }
        if (!address) { alert('请输入公司地址'); return false; }
        
        // Domestic phone validation
        const phoneRegex = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/;
        if (!phoneRegex.test(contactPhone)) {
            alert('请输入有效的国内联系电话（手机号或座机号）');
            return false;
        }
        
        // Create new company object
        const newCompany = {
            id: 'CO' + String(mockData.companies.length + 1).padStart(3, '0'),
            name: name,
            contactPerson: contactPerson,
            contactPhone: contactPhone,
            address: address,
            email: email || '-',
            status: 'active',
            createdAt: getLocalISOString(),
            updatedAt: getLocalISOString()
        };
        
        // Update mock data and table
        mockData.companies.push(newCompany);
        saveMockData(); // 保存数据
        addLog('add', 'company', name, `新增公司，联系人：${contactPerson}`);
        updateCompanyTable();
        alert('公司添加成功');
        return true;
    });
}

// 更新公司列表表格
function updateCompanyTable() {
    const tbody = document.querySelector('#companies tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    
    // 按更新时间倒序排列
    const sortedCompanies = [...mockData.companies].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    
    // 分页逻辑
    paginationState.companies.total = sortedCompanies.length;
    let { page, pageSize } = paginationState.companies;

    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(sortedCompanies.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.companies.page = totalPages;
        page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCompanies = sortedCompanies.slice(startIndex, endIndex);

    if (paginatedCompanies.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">暂无公司记录</td></tr>';
        renderPaginationControl('company-pagination-container', 'companies', updateCompanyTable);
        return;
    }
    
    paginatedCompanies.forEach(company => {
        const formattedCreatedAt = new Date(company.createdAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        const formattedUpdatedAt = new Date(company.updatedAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${company.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${company.contactPerson}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${company.contactPhone}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${company.address}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">${company.status}</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">创建:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                        </span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">更新:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                        </span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>
                <a href="#" class="text-danger hover:text-danger-dark">删除</a>
            </td>
        `;
        tbody.appendChild(row);
    });

    // 渲染分页控件
    renderPaginationControl('company-pagination-container', 'companies', updateCompanyTable);
}

// 显示新增供应商模态框
function showAddSupplierModal() {
    const content = `
        <form id="add-supplier-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">供应商名称 <span class="text-danger">*</span></label>
                <input type="text" name="name" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系人 <span class="text-danger">*</span></label>
                <input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系电话 <span class="text-danger">*</span></label>
                <input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">电子邮箱</label>
                <input type="email" name="email" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">付款条件</label>
                <div id="add-supplier-payment-container" class="w-full"></div>
                <input type="hidden" name="paymentTerms" id="add-supplier-payment-input">
            </div>
        </form>
    `;

    showModal('新增供应商', content, function() {
        const form = document.getElementById('add-supplier-form');
        const formData = new FormData(form);
        const name = formData.get('name').trim();
        const contactPerson = formData.get('contactPerson').trim();
        const contactPhone = formData.get('contactPhone').trim();
        const email = formData.get('email').trim();
        const paymentTerms = formData.get('paymentTerms');
        
        if (!name) { alert('请输入供应商名称'); return false; }
        if (!contactPerson) { alert('请输入联系人'); return false; }
        if (!contactPhone) { alert('请输入联系电话'); return false; }
        
        const newSupplier = {
            id: 'S' + String(mockData.suppliers.length + 1).padStart(3, '0'),
            name: name,
            contactPerson: contactPerson,
            contactPhone: contactPhone,
            email: email || '-',
            paymentTerms: paymentTerms,
            status: 'active',
            createdAt: getLocalISOString(),
            updatedAt: getLocalISOString()
        };
        
        mockData.suppliers.push(newSupplier);
        saveMockData();
        addLog('add', 'supplier', name, `新增供应商，联系人：${contactPerson}`);
        updateSupplierTable();
        alert('供应商添加成功');
        return true;
    });

    const paymentOptions = [
        { value: 'Net 30', label: 'Net 30' },
        { value: 'Net 45', label: 'Net 45' },
        { value: 'Net 60', label: 'Net 60' },
        { value: 'COD', label: '货到付款' }
    ];
    renderAntdSelect('add-supplier-payment-container', 'add-supplier-payment-input', paymentOptions, '请选择付款条件');
}

// 显示新增进货模态框
function showAddInboundModal() {
    // 使用 Ant Design Select 组件替代原生实现
    const content = `
        <form id="add-inbound-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商品 <span class="text-danger">*</span></label>
                <div id="inbound-product-select-container" class="w-full"></div>
                <input type="hidden" name="productId" id="inbound-product-id" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">数量 <span class="text-danger">*</span></label>
                <input type="number" name="quantity" min="1" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">进价</label>
                <input type="number" name="costPrice" min="0" step="0.01" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="未填写则使用默认进价">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">供应商 <span class="text-danger">*</span></label>
                <div id="inbound-supplier-select-container" class="w-full"></div>
                <input type="hidden" name="supplierId" id="inbound-supplier-id" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea name="remark" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>
            </div>
        </form>
    `;

    showModal('新增进货', content, function() {
        const form = document.getElementById('add-inbound-form');
        const formData = new FormData(form);
        
        // 获取 Select 组件设置的 hidden input 值
        // 注意：如果是新增的项，值为输入的文本；如果是选择的项，值为 ID
        const rawProductId = document.getElementById('inbound-product-id').value;
        const rawSupplierId = document.getElementById('inbound-supplier-id').value;
        
        const quantityStr = formData.get('quantity');
        const costPriceStr = formData.get('costPrice');
        
        // 必填校验
        if (!rawProductId) {
            alert('请选择或输入商品（必填）');
            return false;
        }
        if (!quantityStr) {
            alert('请输入数量（必填）');
            return false;
        }
        if (!rawSupplierId) {
            alert('请选择或输入供应商（必填）');
            return false;
        }

        const quantity = parseInt(quantityStr);
        if (isNaN(quantity) || quantity <= 0) {
            alert('请输入有效的数量');
            return false;
        }
        
        const costPriceInput = costPriceStr ? parseFloat(costPriceStr) : null;
        if (costPriceStr && (isNaN(costPriceInput) || costPriceInput < 0)) {
            alert('请输入有效的进价');
            return false;
        }

        // --- 1. 处理供应商逻辑 ---
        let finalSupplierId = null;
        let finalSupplierName = '';

        // 尝试按 ID 查找
        let supplier = mockData.suppliers.find(s => s.id === rawSupplierId);
        
        if (supplier) {
            // 找到了现有供应商
            finalSupplierId = supplier.id;
            finalSupplierName = supplier.name;
        } else {
            // 可能是输入了名称，尝试按名称查找
            supplier = mockData.suppliers.find(s => s.name === rawSupplierId);
            if (supplier) {
                finalSupplierId = supplier.id;
                finalSupplierName = supplier.name;
            } else {
                // 完全是新的供应商，创建它
                const newSupplierId = 'S' + String(mockData.suppliers.length + 1).padStart(3, '0');
                const newSupplier = {
                    id: newSupplierId,
                    name: rawSupplierId, // 使用输入值作为名称
                    contactPerson: '-',
                    contactPhone: '-',
                    email: '-',
                    address: '-',
                    paymentTerms: 'Net 30',
                    creditLimit: 0,
                    status: 'active',
                    createdAt: getLocalISOString(),
                    updatedAt: getLocalISOString()
                };
                mockData.suppliers.push(newSupplier);
                saveMockData(); // 保存数据
                finalSupplierId = newSupplierId;
                finalSupplierName = rawSupplierId;
                
                addLog('add', 'supplier', finalSupplierName, '自动创建新供应商');
                
                // 刷新供应商筛选器（如果存在）
                const filterSupplier = document.getElementById('filter-supplier');
                if (filterSupplier) {
                    const option = document.createElement('option');
                    option.value = finalSupplierId;
                    option.textContent = finalSupplierName;
                    filterSupplier.appendChild(option);
                }
            }
        }

        // --- 2. 处理商品逻辑 ---
        let finalProduct = null;
        
        // 尝试按 ID 查找
        finalProduct = mockData.products.find(p => p.id === rawProductId);
        
        if (!finalProduct) {
             // 尝试按名称查找
             finalProduct = mockData.products.find(p => p.name === rawProductId);
             
             if (!finalProduct) {
                 // 创建新商品
                 const newProductId = 'P' + String(mockData.products.length + 1).padStart(3, '0');
                 finalProduct = {
                    id: newProductId,
                    name: rawProductId, // 使用输入值作为名称
                    category: '未分类',
                    unit: '个',
                    costPrice: costPriceInput !== null ? costPriceInput : null,
                    retailPrice: costPriceInput !== null ? costPriceInput * 1.2 : 0,
                    stockQuantity: 0,
                    minStock: 10,
                    maxStock: 100,
                    supplierId: finalSupplierId, // 关联到确定的供应商
                    createdAt: getLocalISOString(),
                    updatedAt: getLocalISOString()
                 };
                 mockData.products.push(finalProduct);
                 saveMockData(); // 保存数据
                 addLog('add', 'product', finalProduct.name, '自动创建新商品');
             }
        }

        if (!finalProduct) {
             alert('无法处理商品信息，请重试');
             return false;
        }

        // --- 3. 更新库存与记录 ---
        finalProduct.stockQuantity += quantity;
        finalProduct.updatedAt = getLocalISOString();
        saveMockData(); // 保存数据
        
        // 确定本次进货记录的进价信息
        let recordPrice = null;
        let recordPriceType = 'none';

        if (costPriceInput !== null) {
            recordPrice = costPriceInput;
            recordPriceType = 'custom';
        } else {
            // 没有输入进价
            if (finalProduct.costPrice !== null && finalProduct.costPrice !== undefined) {
                recordPrice = finalProduct.costPrice;
                recordPriceType = 'default';
            } else {
                recordPrice = null;
                recordPriceType = 'none';
            }
        }

        const remarkValue = (formData.get('remark') || '').trim();
        
        // 添加进货记录
        const record = {
            id: 'SM' + Date.now(),
            type: 'inbound',
            productId: finalProduct.id,
            productName: finalProduct.name,
            quantity: quantity,
            unit: finalProduct.unit,
            supplierId: finalSupplierId,
            supplierName: finalSupplierName,
            price: recordPrice,
            priceType: recordPriceType,
            operator: currentUser.name,
            remark: remarkValue || '-', 
            createdAt: new Date(),
            updatedAt: new Date()
        };
        stockMovementData.unshift(record);
        localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
        
        // 添加日志
        addLog('add', 'stock_movement', finalProduct.name, `进货 ${quantity} ${finalProduct.unit}`);
        
        // 刷新表格
        const activeTab = document.querySelector('#stock-tabs .active');
        if (activeTab) {
            renderStockMovementTable(activeTab.getAttribute('data-tab'));
        }
        updateInventoryTable();
        
        // 刷新供应商表格
        updateSupplierTable();
        
        renderDashboardActivity(); // 更新仪表盘最近活动

        alert(`进货记录添加成功`);
    });

    // --- 初始化 Ant Design Select 组件 ---

    // 1. 准备数据
    const productOptions = mockData.products.map(p => ({ 
        value: p.id, 
        label: p.name 
    }));
    
    const supplierOptions = mockData.suppliers.map(s => ({ 
        value: s.id, 
        label: s.name 
    }));

    const buildNoDataNode = () => {
        if (!window.React) return 'No data';
        return window.React.createElement(
            'div',
            {
                style: {
                    padding: '8px 12px',
                    color: 'rgba(0, 0, 0, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }
            },
            window.React.createElement('i', { className: 'fa fa-inbox', style: { fontSize: '12px' } }),
            window.React.createElement('span', null, 'No data')
        );
    };

    // 2. 渲染供应商选择器 (封装以便重用)
    const renderSupplierSelect = (defaultValue = undefined) => {
        renderAntdSelect('inbound-supplier-select-container', 'inbound-supplier-id', supplierOptions, {
            placeholder: '请选择或搜索供应商...',
            mode: 'tags',
            controlSearchValue: true,
            keepSearchTextOnBlur: true,
            enableCreateOption: true,
            notFoundContent: buildNoDataNode(),
            defaultValue: defaultValue
        });
    };
    renderSupplierSelect();

    // 3. 渲染商品选择器
    renderAntdSelect('inbound-product-select-container', 'inbound-product-id', productOptions, {
        placeholder: '请选择或搜索商品...',
        mode: 'tags',
        controlSearchValue: true,
        keepSearchTextOnBlur: true,
        enableCreateOption: true,
        notFoundContent: buildNoDataNode()
    }, (value) => {
        // 当商品改变时，自动关联供应商
        // value 可能是 ID 或 新输入的名称
        const product = mockData.products.find(p => p.id === value);
        if (product && product.supplierId) {
            // 如果选中了现有商品且该商品有供应商，自动选中该供应商
            // 通过重新渲染组件并设置 defaultValue 来实现
            renderSupplierSelect(product.supplierId);
            
            // 同时更新 hidden input 的值，因为 defaultValue 只是视觉上的初始值
            // renderAntdSelect 内部的 App 初始化时会触发 onChange 吗？通常不会。
            // 所以我们需要手动更新 hidden input
            const supplierInput = document.getElementById('inbound-supplier-id');
            if (supplierInput) {
                supplierInput.value = product.supplierId;
            }
        }
    });
}

// 显示新增出货模态框
function showAddOutboundModal() {
    // 使用 Ant Design Select 组件替代原生实现
    const content = `
        <form id="add-outbound-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商品 <span class="text-danger">*</span></label>
                <div id="outbound-product-select-container" class="w-full"></div>
                <input type="hidden" name="productId" id="outbound-product-id" required>
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">数量 <span class="text-danger">*</span></label>
                <input type="number" name="quantity" min="1" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea name="remark" rows="3" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>
            </div>
        </form>
    `;

    showModal('新增出货', content, function() {
        const form = document.getElementById('add-outbound-form');
        const formData = new FormData(form);
        const productId = document.getElementById('outbound-product-id').value;
        const quantityStr = formData.get('quantity');

        // 必填校验
        if (!productId) {
            alert('请选择商品（必填）');
            return false;
        }
        if (!quantityStr) {
            alert('请输入数量（必填）');
            return false;
        }

        const product = mockData.products.find(p => p.id === productId);
        
        if (product) {
            const quantity = parseInt(quantityStr);
            if (isNaN(quantity) || quantity <= 0) {
                alert('请输入有效的数量');
                return false;
            }
            
            if (product.stockQuantity < quantity) {
                alert(`库存不足！当前库存：${product.stockQuantity}`);
                return false; // 不关闭模态框
            }
            
            // 更新库存
            product.stockQuantity -= quantity;
            product.updatedAt = getLocalISOString();
            saveMockData(); // 保存数据
            
            // 添加出货记录
            const record = {
                id: 'SM' + Date.now(),
                type: 'outbound',
                productId: product.id,
                productName: product.name,
                quantity: quantity,
                unit: product.unit,
                operator: currentUser.name,
                remark: formData.get('remark') || '出货出库',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stockMovementData.unshift(record);
            localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
            
            // 添加日志
            addLog('add', 'stock_movement', product.name, `出货 ${quantity} ${product.unit}`);
            
            // 刷新表格
            const activeTab = document.querySelector('#stock-tabs .active');
            if (activeTab) {
                renderStockMovementTable(activeTab.getAttribute('data-tab'));
            }
            updateInventoryTable();
            renderDashboardActivity(); // 更新仪表盘最近活动
            
            alert('出货记录添加成功');
            return true;
        } else {
             alert('商品无效，请重新选择');
             return false;
        }
    });

    // 初始化 Ant Design Select
    const productOptions = mockData.products.map(p => ({ 
        value: p.id, 
        label: `${p.name} (库存: ${p.stockQuantity})` 
    }));

    renderAntdSelect('outbound-product-select-container', 'outbound-product-id', productOptions, '请选择或搜索商品...');
}

// 显示新增客户模态框
function showAddCustomerModal() {
    const content = `
        <form id="add-customer-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">客户名称 <span class="text-danger">*</span></label>
                <input type="text" name="name" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系人 <span class="text-danger">*</span></label>
                <input type="text" name="contactPerson" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">联系电话 <span class="text-danger">*</span></label>
                <input type="tel" name="contactPhone" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent" placeholder="请输入国内手机号或座机号">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">客户地址 <span class="text-danger">*</span></label>
                <input type="text" name="address" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">电子邮箱</label>
                <input type="email" name="email" class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">付款条件 <span class="text-danger">*</span></label>
                <div id="add-customer-payment-container" class="w-full"></div>
                <input type="hidden" name="paymentTerms" id="add-customer-payment-input" required>
            </div>
        </form>
    `;

    showModal('新增客户', content, function() {
        const form = document.getElementById('add-customer-form');
        const formData = new FormData(form);
        
        const name = formData.get('name').trim();
        const contactPerson = formData.get('contactPerson').trim();
        const contactPhone = formData.get('contactPhone').trim();
        const address = formData.get('address').trim();
        const email = formData.get('email').trim();
        const paymentTerms = document.getElementById('add-customer-payment-input').value; // Get from hidden input

        // 非空校验
        if (!name) {
            alert('请输入客户名称');
            return false;
        }
        if (!contactPerson) {
            alert('请输入联系人');
            return false;
        }
        if (!contactPhone) {
            alert('请输入联系电话');
            return false;
        }
        if (!address) {
            alert('请输入客户地址');
            return false;
        }

        // 国内电话号码校验 (手机号或带区号的座机)
        // 手机号: 1开头，11位数字
        // 座机: 区号3-4位 - 电话7-8位 (例如: 010-12345678, 021-12345678, 0755-12345678)
        const phoneRegex = /^1[3-9]\d{9}$|^0\d{2,3}-?\d{7,8}$/;
        if (!phoneRegex.test(contactPhone)) {
            alert('请输入有效的国内联系电话（手机号或座机号）');
            return false;
        }

        // 创建新客户对象
        const newCustomer = {
            id: 'C' + String(mockData.customers.length + 1).padStart(3, '0'),
            name: name,
            contactPerson: contactPerson,
            contactPhone: contactPhone,
            address: address, // 新增地址字段
            email: email || '-',
            paymentTerms: paymentTerms,
            creditLimit: 0, // 默认信用额度
            status: 'active',
            createdAt: getLocalISOString(),
            updatedAt: getLocalISOString()
        };

        // 添加到模拟数据
        mockData.customers.push(newCustomer);
        saveMockData(); // 保存数据
        
        // 记录日志
        addLog('add', 'customer', name, `新增客户，联系人：${contactPerson}`);
        
        // 刷新客户表格 (如果有的话，这里需要实现updateCustomerTable函数，或者简单地刷新页面)
        // 这里为了简单，我们假设需要刷新客户管理部分的表格。
        // 由于原代码中客户表格是静态HTML，我们需要实现一个渲染函数或者直接刷新页面。
        // 为了演示效果，我们可以手动将新行添加到表格中。
        updateCustomerTable(); 

        alert('客户添加成功');
        return true;
    });

    // Render Antd Select for Payment Terms
    const paymentOptions = [
        { value: 'Net 30', label: 'Net 30' },
        { value: 'Net 45', label: 'Net 45' },
        { value: 'Net 60', label: 'Net 60' },
        { value: 'COD', label: '货到付款' }
    ];
    renderAntdSelect('add-customer-payment-container', 'add-customer-payment-input', paymentOptions, 'Net 30');
}

// 更新客户列表表格
function updateCustomerTable() {
    const tbody = document.querySelector('#customers tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // 清空现有内容

    // 按更新时间倒序排列
    const sortedCustomers = [...mockData.customers].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // 分页逻辑
    paginationState.customers.total = sortedCustomers.length;
    let { page, pageSize } = paginationState.customers;

    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(sortedCustomers.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.customers.page = totalPages;
        page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedCustomers = sortedCustomers.slice(startIndex, endIndex);

    if (paginatedCustomers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="px-6 py-4 text-center text-gray-500">暂无客户记录</td></tr>';
        renderPaginationControl('customer-pagination-container', 'customers', updateCustomerTable);
        return;
    }

    paginatedCustomers.forEach(customer => {
        const formattedCreatedAt = new Date(customer.createdAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        const formattedUpdatedAt = new Date(customer.updatedAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${customer.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${customer.contactPerson}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${customer.contactPhone}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${customer.address || '-'}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${customer.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${customer.paymentTerms}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">活跃</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">创建:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                        </span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">更新:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                        </span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>
                <a href="#" class="text-danger hover:text-danger-dark">删除</a>
            </td>
        `;
        tbody.appendChild(row);
    });

    // 渲染分页控件
    renderPaginationControl('customer-pagination-container', 'customers', updateCustomerTable);
}

// 更新供应商列表表格
function updateSupplierTable() {
    const tbody = document.querySelector('#suppliers tbody');
    if (!tbody) return;

    tbody.innerHTML = ''; // 清空现有内容

    // 按更新时间倒序排列
    const sortedSuppliers = [...mockData.suppliers].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // 分页逻辑
    paginationState.suppliers.total = sortedSuppliers.length;
    let { page, pageSize } = paginationState.suppliers;

    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(sortedSuppliers.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.suppliers.page = totalPages;
        page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedSuppliers = sortedSuppliers.slice(startIndex, endIndex);

    if (paginatedSuppliers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="px-6 py-4 text-center text-gray-500">暂无供应商记录</td></tr>';
        renderPaginationControl('suppliers-pagination-container', 'suppliers', updateSupplierTable);
        return;
    }

    paginatedSuppliers.forEach(supplier => {
        const formattedCreatedAt = new Date(supplier.createdAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        const formattedUpdatedAt = new Date(supplier.updatedAt).toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">${supplier.name}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supplier.contactPerson}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supplier.contactPhone}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supplier.email}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supplier.paymentTerms}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">活跃</span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">创建:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                        </span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">更新:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                        </span>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <a href="#" class="text-primary hover:text-primary-dark mr-3">编辑</a>
                <a href="#" class="text-danger hover:text-danger-dark">删除</a>
            </td>
        `;
        tbody.appendChild(row);
    });

    // 渲染分页控件
    renderPaginationControl('suppliers-pagination-container', 'suppliers', updateSupplierTable);
}

// 根据商品分类获取图标
function getProductIcon(category) {
    switch (category) {
        case '电子产品':
            return 'mobile';
        case '服装':
            return 'shopping-bag';
        case '家具':
            return 'cube';
        case '图书':
            return 'book';
        default:
            return 'cube';
    }
}

// 添加日志记录
function addLog(actionType, objectType, objectName, details) {
    const log = {
        id: 'LOG' + Date.now(),
        timestamp: new Date(),
        userId: currentUser.id,
        userName: currentUser.name,
        actionType: actionType, // add, edit, delete, view, import, export
        objectType: objectType, // product, supplier, customer, company, bill
        objectName: objectName,
        details: details,
        ipAddress: clientIP
    };
    
    logsData.unshift(log); // 添加到数组开头
    localStorage.setItem('logsData', JSON.stringify(logsData)); // 保存到本地存储
    
    // 如果当前在日志页面，更新日志表格
    const logsSection = document.querySelector('#logs');
    if (logsSection && !logsSection.classList.contains('hidden')) {
        renderLogsTable();
    }
}

// 渲染日志表格
function renderLogsTable() {
    const logsTableBody = document.getElementById('logs-table-body');
    if (!logsTableBody) return;
    
    logsTableBody.innerHTML = '';
    
    // 获取筛选条件
    const typeFilter = document.getElementById('log-filter-type') ? document.getElementById('log-filter-type').value : '';
    const userFilter = document.getElementById('log-filter-user') ? document.getElementById('log-filter-user').value.toLowerCase().trim() : '';
    const dateStartFilter = document.getElementById('log-filter-date-start') ? document.getElementById('log-filter-date-start').value : '';
    const dateEndFilter = document.getElementById('log-filter-date-end') ? document.getElementById('log-filter-date-end').value : '';
    const searchFilter = document.getElementById('log-filter-search') ? document.getElementById('log-filter-search').value.toLowerCase().trim() : '';

    // 过滤数据
    let filteredLogs = logsData.filter(log => {
        // 类型筛选
        if (typeFilter && log.actionType !== typeFilter) return false;
        
        // 操作人筛选 (模糊匹配)
        if (userFilter && !log.userName.toLowerCase().includes(userFilter)) return false;
        
        // 日期范围筛选
        if (dateStartFilter) {
            const logDate = new Date(log.timestamp);
            const startDate = new Date(dateStartFilter);
            // Check if dateStartFilter includes time (contains ':')
            if (!dateStartFilter.includes(':')) {
                startDate.setHours(0, 0, 0, 0); 
            }
            if (logDate < startDate) return false;
        }
        if (dateEndFilter) {
            const logDate = new Date(log.timestamp);
            const endDate = new Date(dateEndFilter);
            // Check if dateEndFilter includes time
            if (!dateEndFilter.includes(':')) {
                endDate.setHours(23, 59, 59, 999);
            }
            if (logDate > endDate) return false;
        }
        
        // 搜索筛选 (仅操作对象)
        if (searchFilter && !log.objectName.toLowerCase().includes(searchFilter)) return false;
        
        return true;
    });

    // 按时间倒序排列
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // 分页逻辑
    paginationState.logs.total = filteredLogs.length;
    let { page, pageSize } = paginationState.logs;

    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(filteredLogs.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.logs.page = totalPages;
        page = totalPages;
    }

    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

    if (paginatedLogs.length === 0) {
        logsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">没有找到匹配的日志记录</td>
            </tr>
        `;
        renderPaginationControl('logs-pagination-container', 'logs', renderLogsTable);
        return;
    }
    
    paginatedLogs.forEach(log => {
        const formattedTime = new Date(log.timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        let actionTypeText = '';
        let actionTypeClass = '';
        
        switch (log.actionType) {
            case 'add':
                actionTypeText = '新增';
                actionTypeClass = 'bg-green-100 text-green-800';
                break;
            case 'edit':
                actionTypeText = '编辑';
                actionTypeClass = 'bg-blue-100 text-blue-800';
                break;
            case 'delete':
                actionTypeText = '删除';
                actionTypeClass = 'bg-red-100 text-red-800';
                break;
            case 'import':
                actionTypeText = '导入';
                actionTypeClass = 'bg-yellow-100 text-yellow-800';
                break;
            case 'export':
                actionTypeText = '导出';
                actionTypeClass = 'bg-purple-100 text-purple-800';
                break;
            default:
                actionTypeText = log.actionType;
                actionTypeClass = 'bg-gray-100 text-gray-800';
        }
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedTime}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                <div class="flex items-center">
                    <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(log.userName)}</span>
                    ${log.userName}
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${actionTypeClass}">${actionTypeText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${log.objectName}</td>
            <td class="px-6 py-4 text-sm text-gray-500">${log.details}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${log.ipAddress}</td>
        `;
        
        logsTableBody.appendChild(row);
    });

    // 渲染分页控件
    renderPaginationControl('logs-pagination-container', 'logs', renderLogsTable);
}

// 从本地存储加载基础数据
async function loadMockData() {
    try {
        // 尝试加载分散的数据文件
        const tables = ['products', 'suppliers', 'customers', 'companies', 'bills', 'deliveryNotes', 'stockMovements', 'logs'];
        const loadPromises = tables.map(table => 
            fetch(`data/${table}.json`).then(res => res.ok ? res.json() : [])
        );
        
        const results = await Promise.all(loadPromises);
        
        // 组装数据
        defaultMockData = {
            products: results[0] || [],
            suppliers: results[1] || [],
            customers: results[2] || [],
            companies: results[3] || [],
            bills: results[4] || [],
            deliveryNotes: results[5] || []
        };
        
        // 特殊处理独立变量
        // 注意：这里仅当本地存储没有数据时才使用这些作为默认值
        // stockMovementData = results[6] || [];
        // logsData = results[7] || [];
        
        console.log('Loaded split data files');
        
    } catch (e) {
        console.warn('Failed to load split data files, trying fallback to data.json or localStorage', e);
        try {
            // 1. 尝试从 data.json 加载默认数据
            const response = await fetch('data.json');
            if (response.ok) {
                const combinedData = await response.json();
                defaultMockData = combinedData;
                // stockMovementData = combinedData.stockMovements || [];
                // logsData = combinedData.logs || [];
                console.log('Loaded default data from data.json');
            } else {
                defaultMockData = { products: [], suppliers: [], customers: [], companies: [] };
            }
        } catch (innerE) {
            console.error('Error fetching data.json:', innerE);
            defaultMockData = { products: [], suppliers: [], customers: [], companies: [] };
        }
    }

    // 本地存储覆盖（如果存在）
    const savedData = localStorage.getItem('mockData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            // 确保 mockData 的每个属性都存在，避免 undefined
            mockData = {
                products: parsedData.products || defaultMockData.products || [],
                suppliers: parsedData.suppliers || defaultMockData.suppliers || [],
                customers: parsedData.customers || defaultMockData.customers || [],
                companies: parsedData.companies || defaultMockData.companies || []
            };
            console.log('Merged localStorage data');
        } catch (e) {
            console.error('Failed to parse localStorage data, keeping default data:', e);
            // 如果解析失败，不要直接覆盖保存，而是保留 defaultMockData，但提示用户
            mockData = JSON.parse(JSON.stringify(defaultMockData));
            alert('警告：本地数据解析失败，已加载默认数据。如果这是非预期的情况，请联系管理员。');
        }
    } else {
        console.log('No localStorage data found, using default data');
        mockData = JSON.parse(JSON.stringify(defaultMockData));
        // 这里不立即保存，等到用户有操作时再保存，或者确认数据加载完整后再保存
        // saveMockData(); 
    }
    
    // 确保 mockData 结构完整
    if (!mockData.products) mockData.products = [];
    if (!mockData.suppliers) mockData.suppliers = [];
    if (!mockData.customers) mockData.customers = [];
    if (!mockData.companies) mockData.companies = [];
    if (!mockData.bills) mockData.bills = [];
}

// 保存基础数据到本地存储和后端API（如果可用）
async function saveMockData() {
    // 安全检查：如果 mockData 为空或结构不完整，不保存，防止覆盖有效数据
    if (!mockData || !Array.isArray(mockData.products)) {
        console.error('Security check failed: mockData is incomplete, aborting save.');
        return;
    }

    // 1. 保存到 LocalStorage (总是执行，作为离线/静态托管的后备)
    try {
        // 先备份旧数据（可选，防止意外覆盖）
        const oldData = localStorage.getItem('mockData');
        if (oldData) localStorage.setItem('mockData_backup', oldData);
        
        localStorage.setItem('mockData', JSON.stringify(mockData));
        console.log('Saved mock data to localStorage');
    } catch (e) {
        console.error('Failed to save mock data to localStorage', e);
        if (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014) {
             alert('保存失败：浏览器存储空间已满。请导出数据备份，并清理浏览器缓存。');
        }
    }

    // 2. 尝试保存到后端文件 (仅在本地开发服务器环境生效)
    try {
        const promises = [];
        
        // 映射表名到数据源
        const dataMap = {
            'products': mockData.products,
            'suppliers': mockData.suppliers,
            'customers': mockData.customers,
            'companies': mockData.companies,
            'bills': defaultMockData.bills || [], 
            'deliveryNotes': defaultMockData.deliveryNotes || [],
            'stockMovements': stockMovementData,
            'logs': logsData
        };

        for (const [table, data] of Object.entries(dataMap)) {
            promises.push(
                fetch(`/api/save/${table}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                }).then(res => {
                    if (!res.ok) throw new Error(`Failed to save ${table}: ${res.statusText}`);
                })
            );
        }

        await Promise.all(promises);
        console.log('Successfully synced all data to separate files');

    } catch (e) {
        // 网络错误通常意味着没有后端服务（纯静态环境），忽略
        console.log('Running in static mode (no backend API detected) or partial save failed:', e);
    }
}

// 从本地存储加载进出货记录数据
function loadStockMovementData() {
    const savedData = localStorage.getItem('stockMovementData');
    if (savedData) {
        stockMovementData = JSON.parse(savedData);
        // 转换时间字符串为Date对象
        stockMovementData.forEach(record => {
            record.createdAt = new Date(record.createdAt);
            record.updatedAt = new Date(record.updatedAt);
        });
    } else {
        // 添加一些示例记录
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        stockMovementData = [
            {
                id: 'SM001',
                type: 'inbound', // inbound: 进货, outbound: 出货
                productId: 'P001',
                productName: 'iPhone 13 Pro',
                quantity: 50,
                unit: '个',
                operator: '张三',
                remark: '采购入库',
                createdAt: now,
                updatedAt: now
            },
            {
                id: 'SM002',
                type: 'outbound',
                productId: 'P002',
                productName: 'MacBook Pro',
                quantity: 15,
                unit: '个',
                operator: '张三',
                remark: '客户订单#20240721-001',
                createdAt: yesterday,
                updatedAt: yesterday
            },
            {
                id: 'SM003',
                type: 'inbound',
                productId: 'P003',
                productName: 'AirPods Pro',
                quantity: 100,
                unit: '个',
                operator: '李四',
                remark: '采购入库',
                createdAt: yesterday,
                updatedAt: yesterday
            }
        ];
        localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
    }
}



// 删除进出货记录并回滚库存
async function deleteStockMovement(recordId) {
    const ok = await window.showAntdConfirm({
        title: '删除记录',
        content: '确定要删除这条记录吗？这将自动回滚对应的库存数量。'
    });
    if (!ok) return;

    const recordIndex = stockMovementData.findIndex(r => r.id === recordId);
    if (recordIndex === -1) {
        alert('记录未找到，可能已被删除');
        return;
    }

    const record = stockMovementData[recordIndex];
    const product = mockData.products.find(p => p.id === record.productId);

    if (product) {
        // 回滚库存逻辑
        if (record.type === 'inbound') {
            // 如果是进货记录，删除时应减少库存
            if (product.stockQuantity < record.quantity) {
                const ok2 = await window.showAntdConfirm({
                    title: '警告',
                    content: `删除此进货记录会导致库存变为负数（当前库存 ${product.stockQuantity}，需扣减 ${record.quantity}）。是否继续？`,
                    okText: '继续',
                    cancelText: '取消'
                });
                if (!ok2) return;
            }
            product.stockQuantity -= record.quantity;
            product.updatedAt = getLocalISOString();
        } else if (record.type === 'outbound') {
            // 如果是出货记录，删除时应增加库存
            product.stockQuantity += record.quantity;
            product.updatedAt = getLocalISOString();
        }
        
        // 保存基础数据（库存更新）
        saveMockData();
    } else {
        alert('警告：关联的商品已不存在，库存将不会回滚，仅删除记录。');
    }

    // 删除记录
    stockMovementData.splice(recordIndex, 1);
    localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));

    // 添加日志
    addLog('delete', 'stock_movement', record.productName, `删除${record.type === 'inbound' ? '进货' : '出货'}记录，回滚数量：${record.quantity}`);

    // 刷新界面
    const activeTab = document.querySelector('#stock-tabs .active');
    if (activeTab) {
        renderStockMovementTable(activeTab.getAttribute('data-tab'));
    } else {
        renderStockMovementTable('all');
    }
    updateInventoryTable();
    alert('记录已删除，库存已回滚');
}

// 渲染仪表盘最近活动
function renderDashboardActivity() {
    const tbody = document.querySelector('#dashboard-activity-table tbody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // 获取最新的5条记录
    const recentActivity = stockMovementData.slice(0, 5);
    
    if (recentActivity.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">暂无活动记录</td></tr>';
        return;
    }
    
    recentActivity.forEach(record => {
        const typeText = record.type === 'inbound' ? '入库' : '出库';
        const typeClass = record.type === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
        
        const formattedTime = new Date(record.createdAt).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.productName}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.quantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.operator}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formattedTime}</td>
        `;
        tbody.appendChild(row);
    });
}

// 渲染进出货记录表格
// 获取操作人员名称的首字母
function getInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

function renderStockMovementTable(filter) {
    // 如果没有提供filter，尝试从当前激活的标签页获取
    if (!filter) {
        const activeTab = document.querySelector('#stock-tabs button.active');
        filter = activeTab ? activeTab.getAttribute('data-tab') : 'all';
    }

    const tableBody = document.getElementById('stock-movement-table-body');
    if (!tableBody) return;
    const tableHead = document.getElementById('stock-movement-table-head');
    
    tableBody.innerHTML = '';
    
    // 根据筛选条件过滤数据
    let filteredData = stockMovementData;
    if (filter === 'inbound') {
        filteredData = stockMovementData.filter(record => record.type === 'inbound');
    } else if (filter === 'outbound') {
        filteredData = stockMovementData.filter(record => record.type === 'outbound');
    }

    if (tableHead) {
        if (filter === 'inbound') {
            tableHead.innerHTML = `
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量变动</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">进价</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">供应商</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            `;
        } else {
            tableHead.innerHTML = `
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量变动</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
            `;
        }
    }
    
    // 按时间倒序排列 (使用 updatedAt)
    filteredData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    // 分页逻辑
    paginationState.stock.total = filteredData.length;
    let { page, pageSize } = paginationState.stock;
    
    // 如果当前页超出了总页数，且总页数大于0，则重置为最后一页
    const totalPages = Math.ceil(filteredData.length / pageSize);
    if (page > totalPages && totalPages > 0) {
        paginationState.stock.page = totalPages;
        page = totalPages;
    }
    
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    
    if (paginatedData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">暂无记录</td>
            </tr>
        `;
        renderPaginationControl('stock-pagination-container', 'stock', renderStockMovementTable);
        return;
    }
    
    const supplierMap = new Map(mockData.suppliers.map(supplier => [supplier.id, supplier.name]));
    const productMap = new Map(mockData.products.map(product => [product.id, product]));
    
    paginatedData.forEach(record => {
        const typeText = record.type === 'inbound' ? '入库' : '出库';
        const typeClass = record.type === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
        const quantityClass = record.type === 'inbound' ? 'text-green-600' : 'text-blue-600';
        const quantitySign = record.type === 'inbound' ? '+' : '-';
        const product = productMap.get(record.productId);
        // 优先使用当前商品的实时名称，如果商品已删除则使用记录中的名称快照
        const displayProductName = product ? product.name : (record.productName || '未知商品');
        const supplierName = record.supplierName || (product ? supplierMap.get(product.supplierId) : '') || '-';
        
        const createdAt = new Date(record.createdAt);
        const updatedAt = new Date(record.updatedAt);
        
        const formattedCreatedAt = createdAt.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const formattedUpdatedAt = updatedAt.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
        
        const row = document.createElement('tr');
        if (filter === 'inbound') {
            // 处理进价显示
            let priceHtml = '<span class="text-gray-400">-</span>';
            if (record.price !== null && record.price !== undefined) {
                const priceClass = record.priceType === 'custom' ? 'text-gray-900' : 'text-gray-500';
                priceHtml = `<span class="${priceClass}">¥${parseFloat(record.price).toLocaleString()}</span>`;
            }

            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${displayProductName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${record.unit}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${priceHtml}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supplierName}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${record.remark || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                            <span class="flex items-center">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(record.operator)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                            <span class="flex items-center">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(record.operator)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-primary hover:text-primary-dark mr-3">
                        查看
                    </button>
                    <button class="text-yellow-600 hover:text-yellow-800 mr-3">
                        编辑
                    </button>
                    <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">
                        删除
                    </button>
                </td>
            `;
        } else {
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${displayProductName}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${record.unit}</td>
                <td class="px-6 py-4 text-sm text-gray-500">${record.remark || '-'}</td>
                <td class="px-6 py-4 text-sm text-gray-500">
                    <div class="space-y-1">
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                            <span class="flex items-center">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(record.operator)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                            </span>
                        </div>
                        <div class="flex items-center">
                            <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                            <span class="flex items-center">
                                <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(record.operator)}</span>
                                <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                            </span>
                        </div>
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="text-primary hover:text-primary-dark mr-3">
                        查看
                    </button>
                    <button class="text-yellow-600 hover:text-yellow-800 mr-3">
                        编辑
                    </button>
                    <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">
                        删除
                    </button>
                </td>
            `;
        }
        
        tableBody.appendChild(row);
    });

    // 渲染分页控件
    renderPaginationControl('stock-pagination-container', 'stock', renderStockMovementTable);
}

// 添加进货记录
function addInboundRecord(recordData) {
    const product = mockData.products.find(p => p.id === recordData.productId);
    if (!product) {
        alert('商品不存在！');
        return;
    }
    const supplier = mockData.suppliers.find(s => s.id === product.supplierId);
    
    // 创建进货记录
    const now = new Date();
    const newRecord = {
        id: 'SM' + String(stockMovementData.length + 1).padStart(3, '0'),
        type: 'inbound',
        productId: recordData.productId,
        productName: product.name,
        quantity: recordData.quantity,
        unit: product.unit,
        supplierId: product.supplierId,
        supplierName: supplier ? supplier.name : '-',
        operator: currentUser.name,
        remark: (recordData.remark || '').trim(),
        createdAt: now,
        updatedAt: now
    };
    
    stockMovementData.unshift(newRecord);
    localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
    
    // 更新库存
    product.stockQuantity += recordData.quantity;
    product.updatedAt = getLocalISOString();
    saveMockData(); // 保存最新的库存数据
    
    updateInventoryTable();
    renderStockMovementTable('all');
    renderDashboardActivity(); // 更新仪表盘最近活动
    addLog('add', 'inventory', product.name, `进货入库，数量：${recordData.quantity}`);
}

// 从本地存储加载日志数据
function loadLogsData() {
    const savedLogs = localStorage.getItem('logsData');
    if (savedLogs) {
        logsData = JSON.parse(savedLogs);
        // 转换时间字符串为Date对象
        logsData.forEach(log => {
            log.timestamp = new Date(log.timestamp);
        });
    } else {
        // 添加一些示例日志
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        
        logsData = [
            {
                id: 'LOG1',
                timestamp: now,
                userId: 'U001',
                userName: '张三',
                actionType: 'add',
                objectType: 'product',
                objectName: 'iPhone 13 Pro',
                details: '新增商品，数量：50，成本价：6999',
                ipAddress: '192.168.1.100'
            },
            {
                id: 'LOG2',
                timestamp: yesterday,
                userId: 'U002',
                userName: '李四',
                actionType: 'edit',
                objectType: 'supplier',
                objectName: '苹果公司',
                details: '更新供应商联系方式',
                ipAddress: '192.168.1.101'
            },
            {
                id: 'LOG3',
                timestamp: yesterday,
                userId: 'U001',
                userName: '张三',
                actionType: 'edit',
                objectType: 'inventory',
                objectName: 'MacBook Pro',
                details: '入库操作，原数量：20，新数量：35',
                ipAddress: '192.168.1.100'
            },
            {
                id: 'LOG4',
                timestamp: yesterday,
                userId: 'U003',
                userName: '王五',
                actionType: 'delete',
                objectType: 'product',
                objectName: '旧款iPad',
                details: '删除商品',
                ipAddress: '192.168.1.102'
            }
        ];
        localStorage.setItem('logsData', JSON.stringify(logsData));
    }
}

// 导出所有数据
function exportAllData() {
    const data = {
        mockData: mockData,
        stockMovementData: stockMovementData,
        logsData: logsData,
        exportTime: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `inventory_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    addLog('export', 'system', '数据备份', '导出系统全部数据');
}

// 导入数据
function importData(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            
            if (data.mockData) {
                mockData = data.mockData;
                localStorage.setItem('mockData', JSON.stringify(mockData));
            }
            
            if (data.stockMovementData) {
                stockMovementData = data.stockMovementData;
                localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
            }
            
            if (data.logsData) {
                logsData = data.logsData;
                localStorage.setItem('logsData', JSON.stringify(logsData));
            }
            
            alert('数据导入成功！页面将刷新以应用更改。');
            addLog('import', 'system', '数据恢复', '从备份文件导入数据');
            location.reload();
            
        } catch (error) {
            console.error('Import failed:', error);
            alert('导入失败：文件格式不正确或已损坏。');
        }
    };
    reader.readAsText(file);
}

// 绑定设置页面的事件
function bindSettingsEvents() {
    // 标签页切换
    const settingsTabs = document.querySelectorAll('#settings-tabs button');
    settingsTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有 active 类
            settingsTabs.forEach(t => {
                t.classList.remove('border-primary', 'text-primary');
                t.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            });
            // 添加 active 类到当前 tab
            this.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300');
            this.classList.add('border-primary', 'text-primary');
            
            // 隐藏所有内容区域
            const contents = document.querySelectorAll('.settings-content');
            contents.forEach(content => content.classList.add('hidden'));
            
            // 显示目标内容区域
            const targetId = this.getAttribute('data-target');
            document.getElementById(targetId).classList.remove('hidden');
        });
    });

    // 导出按钮
    const exportBtn = document.getElementById('export-data-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportAllData);
    }

    // 导入按钮
    const importBtn = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-data-input');
    if (importBtn && importInput) {
        importBtn.addEventListener('click', () => importInput.click());
        importInput.addEventListener('change', async (e) => {
            if (e.target.files.length > 0) {
                const ok = await window.showAntdConfirm({
                    title: '导入数据',
                    content: '导入数据将覆盖当前所有数据，确定要继续吗？',
                    okText: '继续',
                    cancelText: '取消'
                });
                if (ok) {
                    importData(e.target.files[0]);
                }
                e.target.value = ''; // 重置 input
            }
        });
    }
}
