(function initStockModule(global) {
    function formatDateTime(value) {
        return new Date(value).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });
    }

    function createSelectNoDataNode() {
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
    }

    function refreshActiveStockTable() {
        const activeTab = document.querySelector('#stock-tabs .active');
        if (activeTab) {
            renderStockMovementTable(activeTab.getAttribute('data-tab'));
        } else {
            renderStockMovementTable('all');
        }
    }

    function syncSupplierFilterOption(supplierId, supplierName) {
        const filterSupplier = document.getElementById('filter-supplier');
        if (!filterSupplier) return;

        const existingOption = Array.from(filterSupplier.options).find(option => option.value === supplierId);
        if (!existingOption) {
            const option = document.createElement('option');
            option.value = supplierId;
            option.textContent = supplierName;
            filterSupplier.appendChild(option);
        }
    }

    async function deleteStockMovement(recordId) {
        const ok = await window.showAntdConfirm({
            title: '删除记录',
            content: '确定要删除这条记录吗？这将自动回滚对应的库存数量。'
        });
        if (!ok) return;

        const recordIndex = stockMovementData.findIndex(record => record.id === recordId);
        if (recordIndex === -1) {
            alert('记录未找到，可能已被删除');
            return;
        }

        const record = stockMovementData[recordIndex];
        const product = mockData.products.find(item => item.id === record.productId);

        if (product) {
            if (record.type === 'inbound') {
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
                product.stockQuantity += record.quantity;
                product.updatedAt = getLocalISOString();
            }

            saveMockData();
        } else {
            alert('警告：关联的商品已不存在，库存将不会回滚，仅删除记录。');
        }

        stockMovementData.splice(recordIndex, 1);
        localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));

        addLog('delete', 'stock_movement', record.productName, `删除${record.type === 'inbound' ? '进货' : '出货'}记录，回滚数量：${record.quantity}`);

        refreshActiveStockTable();
        updateInventoryTable();
        alert('记录已删除，库存已回滚');
    }

    function renderDashboardActivity() {
        const tbody = document.querySelector('#dashboard-activity-table tbody');
        if (!tbody) return;

        tbody.innerHTML = '';

        const recentActivity = stockMovementData.slice(0, 5);
        if (recentActivity.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-sm text-gray-500">暂无活动记录</td></tr>';
            return;
        }

        recentActivity.forEach(record => {
            const typeText = record.type === 'inbound' ? '入库' : '出库';
            const typeClass = record.type === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
            const safeProductName = escapeHTML(record.productName || '未知商品');
            const safeOperator = escapeHTML(record.operator || '-');

            const row = document.createElement('tr');
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeProductName}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${record.quantity}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeOperator}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${formatDateTime(record.createdAt)}</td>
            `;
            tbody.appendChild(row);
        });
    }

    function getInitial(name) {
        if (!name) return '?';
        return name.charAt(0).toUpperCase();
    }

    function formatStockCurrency(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '-';
        return `RMB ${amount.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function buildCreatedUpdatedMarkup(record, operatorName) {
        const formattedCreatedAt = formatDateTime(record.createdAt);
        const formattedUpdatedAt = formatDateTime(record.updatedAt);
        const initial = escapeHTML(getInitial(operatorName || record.operator || currentUser.name));

        return `
            <div class="space-y-1">
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                    </span>
                </div>
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                    </span>
                </div>
            </div>
        `;
    }

    function isSalesDeliveryNote(note) {
        return Boolean(note) && (note.type === 'sales' || note.customerId || note.customerNo);
    }

    function getSalesDeliveryNotes() {
        return (mockData.deliveryNotes || []).filter(isSalesDeliveryNote);
    }

    function buildDeliveryNoteProductsMarkup(note) {
        const details = Array.isArray(note.details) ? note.details : [];
        if (details.length === 0) {
            return '<span class="text-sm text-gray-400">-</span>';
        }

        return details.map(detail => {
            const safeName = escapeHTML(detail.productName || '-');
            const safeQuantity = escapeHTML(String(detail.quantity ?? ''));
            const safeUnit = escapeHTML(detail.unit || '');
            const quantityText = safeQuantity ? ` × ${safeQuantity}${safeUnit ? ` ${safeUnit}` : ''}` : '';
            return `
                <div class="text-sm text-gray-900">
                    <span>${safeName}</span>
                    <span class="text-xs text-gray-500">${quantityText}</span>
                </div>
            `;
        }).join('');
    }

    function getDeliveryNoteRemark(note) {
        const rawNotes = String(note.notes || '').trim();
        if (rawNotes) {
            return escapeHTML(rawNotes);
        }
        if (note.orderNo) {
            return `销售单号：${escapeHTML(note.orderNo)}`;
        }
        if (note.customerNo) {
            return `客户NO：${escapeHTML(note.customerNo)}`;
        }
        return '-';
    }

    function configureDeliveryNoteReadonlyModal() {
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
        const modalPanel = document.getElementById('modal-panel');
        const modalContent = document.getElementById('modal-content');

        if (modalPanel) {
            modalPanel.className = 'bg-white rounded-lg shadow-xl w-full mx-4';
            modalPanel.style.maxWidth = '1600px';
            modalPanel.style.width = 'calc(100vw - 1.5rem)';
        }

        if (modalContent) {
            modalContent.className = 'p-2 md:p-3 max-h-[82vh] overflow-y-auto overflow-x-hidden';
        }

        if (confirmBtn) {
            confirmBtn.textContent = '关闭';
        }

        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
        }
    }

    function showViewDeliveryNoteModal(noteId) {
        const note = getSalesDeliveryNotes().find(item => item.id === noteId);
        if (!note) {
            alert('送货单未找到，可能已被删除。');
            return;
        }

        const previewPayload = {
            companyName: note.companyName,
            issueDate: note.issueDate || note.deliveryDate || note.createdAt,
            companyAddress: note.companyAddress,
            companyPhone: note.companyPhone,
            companyContact: note.companyContact,
            customerName: note.customerName,
            customerAddress: note.customerAddress,
            customerContact: note.customerContact,
            customerPhone: note.customerPhone,
            paymentTerms: note.paymentTerms,
            customerNo: note.customerNo
        };

        const previewItems = (note.details || []).map(detail => ({
            productName: detail.productName,
            spec: detail.spec,
            unit: detail.unit,
            deliveryQty: detail.quantity,
            price: detail.unitPrice,
            remark: detail.notes || ''
        }));

        const previewMarkup = typeof window.buildSalesOrderPreviewMarkup === 'function'
            ? window.buildSalesOrderPreviewMarkup(previewPayload, previewItems, Number(note.totalAmount) || 0)
                .replace(/mx-auto min-w-\[1220px\] max-w-\[1220px\]/, 'mx-auto w-full max-w-[1480px]')
            : '';

        const content = previewMarkup
            ? `
                <div class="bg-gray-50 rounded-xl border border-gray-100 p-2 md:p-3">
                    ${previewMarkup}
                </div>
            `
            : `
                <div class="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                    <div class="text-lg font-semibold text-gray-900">${escapeHTML(note.companyName || '送货单')}</div>
                    <div class="text-sm text-gray-500">客户：${escapeHTML(note.customerName || '-')}</div>
                    <div class="text-sm text-gray-500">送货金额：${escapeHTML(formatStockCurrency(note.totalAmount))}</div>
                </div>
            `;

        showModal('查看送货单', content);
        configureDeliveryNoteReadonlyModal();
    }

    function renderStockMovementTable(filter) {
        if (!filter) {
            const activeTab = document.querySelector('#stock-tabs button.active');
            filter = activeTab ? activeTab.getAttribute('data-tab') : 'all';
        }

        const tableBody = document.getElementById('stock-movement-table-body');
        if (!tableBody) return;
        const tableHead = document.getElementById('stock-movement-table-head');

        tableBody.innerHTML = '';

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

        filteredData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        paginationState.stock.total = filteredData.length;
        let { page, pageSize } = paginationState.stock;

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
            const displayProductName = product ? product.name : (record.productName || '未知商品');
            const supplierName = record.supplierName || (product ? supplierMap.get(product.supplierId) : '') || '-';
            const safeProductName = escapeHTML(displayProductName);
            const safeSupplierName = escapeHTML(supplierName);
            const safeRemark = escapeHTML(record.remark || '-');
            const safeUnit = escapeHTML(record.unit || '');
            const formattedCreatedAt = formatDateTime(record.createdAt);
            const formattedUpdatedAt = formatDateTime(record.updatedAt);

            const row = document.createElement('tr');
            if (filter === 'inbound') {
                let priceHtml = '<span class="text-gray-400">-</span>';
                if (record.price !== null && record.price !== undefined) {
                    const priceClass = record.priceType === 'custom' ? 'text-gray-900' : 'text-gray-500';
                    priceHtml = `<span class="${priceClass}">¥${parseFloat(record.price).toLocaleString()}</span>`;
                }

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeProductName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${priceHtml}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeSupplierName}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}</td>
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
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeProductName}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}</td>
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

        renderPaginationControl('stock-pagination-container', 'stock', renderStockMovementTable);
    }

    function formatStockCurrency(value) {
        const amount = Number(value);
        if (!Number.isFinite(amount)) return '-';
        return `¥${amount.toLocaleString('zh-CN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        })}`;
    }

    function buildCreatedUpdatedMarkup(record, operatorName) {
        const formattedCreatedAt = formatDateTime(record.createdAt);
        const formattedUpdatedAt = formatDateTime(record.updatedAt);
        const initial = escapeHTML(getInitial(operatorName || record.operator || currentUser.name));

        return `
            <div class="space-y-1">
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                    </span>
                </div>
                <div class="flex items-center">
                    <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                    <span class="flex items-center">
                        <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${initial}</span>
                        <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
                    </span>
                </div>
            </div>
        `;
    }

    function buildDeliveryNoteProductsMarkup(note) {
        const details = Array.isArray(note.details) ? note.details : [];
        if (details.length === 0) {
            return '<span class="text-sm text-gray-400">-</span>';
        }

        return details.map(detail => {
            const safeName = escapeHTML(detail.productName || '-');
            const safeQuantity = escapeHTML(String(detail.quantity ?? ''));
            const safeUnit = escapeHTML(detail.unit || '');
            const quantityText = safeQuantity ? ` x ${safeQuantity}${safeUnit ? ` ${safeUnit}` : ''}` : '';
            return `
                <div class="text-sm text-gray-900">
                    <span>${safeName}</span>
                    <span class="text-xs text-gray-500">${quantityText}</span>
                </div>
            `;
        }).join('');
    }

    function getDeliveryNoteRemark(note) {
        const rawNotes = String(note.notes || '').trim();
        if (rawNotes) {
            return escapeHTML(rawNotes);
        }
        if (note.orderNo) {
            return `销售单号：${escapeHTML(note.orderNo)}`;
        }
        if (note.customerNo) {
            return `客户NO：${escapeHTML(note.customerNo)}`;
        }
        return '-';
    }

    function configureDeliveryNoteReadonlyModal() {
        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
        const modalPanel = document.getElementById('modal-panel');
        const modalContent = document.getElementById('modal-content');

        if (modalPanel) {
            modalPanel.className = 'bg-white rounded-lg shadow-xl w-full mx-4';
            modalPanel.style.maxWidth = '1600px';
            modalPanel.style.width = 'calc(100vw - 1.5rem)';
        }

        if (modalContent) {
            modalContent.className = 'p-2 md:p-3 max-h-[82vh] overflow-y-auto overflow-x-hidden';
        }

        if (confirmBtn) {
            confirmBtn.textContent = '关闭';
        }

        if (cancelBtn) {
            cancelBtn.classList.add('hidden');
        }
    }

    function showViewDeliveryNoteModal(noteId) {
        const note = getSalesDeliveryNotes().find(item => item.id === noteId);
        if (!note) {
            alert('送货单未找到，可能已被删除。');
            return;
        }

        const previewPayload = {
            companyName: note.companyName,
            issueDate: note.issueDate || note.deliveryDate || note.createdAt,
            companyAddress: note.companyAddress,
            companyPhone: note.companyPhone,
            companyContact: note.companyContact,
            customerName: note.customerName,
            customerAddress: note.customerAddress,
            customerContact: note.customerContact,
            customerPhone: note.customerPhone,
            paymentTerms: note.paymentTerms,
            customerNo: note.customerNo
        };

        const previewItems = (note.details || []).map(detail => ({
            productName: detail.productName,
            spec: detail.spec,
            unit: detail.unit,
            deliveryQty: detail.quantity,
            price: detail.unitPrice,
            remark: detail.notes || ''
        }));

        const previewMarkup = typeof window.buildSalesOrderPreviewMarkup === 'function'
            ? window.buildSalesOrderPreviewMarkup(previewPayload, previewItems, Number(note.totalAmount) || 0)
                .replace(/mx-auto min-w-\[1220px\] max-w-\[1220px\]/, 'mx-auto w-full max-w-[1480px]')
            : '';

        const content = previewMarkup
            ? `
                <div class="bg-gray-50 rounded-xl border border-gray-100 p-2 md:p-3">
                    ${previewMarkup}
                </div>
            `
            : `
                <div class="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
                    <div class="text-lg font-semibold text-gray-900">${escapeHTML(note.companyName || '送货单')}</div>
                    <div class="text-sm text-gray-500">客户：${escapeHTML(note.customerName || '-')}</div>
                    <div class="text-sm text-gray-500">送货金额：${escapeHTML(formatStockCurrency(note.totalAmount))}</div>
                </div>
            `;

        showModal('查看送货单', content);
        configureDeliveryNoteReadonlyModal();
    }

    function renderStockMovementTable(filter) {
        if (!filter) {
            const activeTab = document.querySelector('#stock-tabs button.active');
            filter = activeTab ? activeTab.getAttribute('data-tab') : 'all';
        }

        const tableBody = document.getElementById('stock-movement-table-body');
        if (!tableBody) return;
        const tableHead = document.getElementById('stock-movement-table-head');

        tableBody.innerHTML = '';

        let filteredData = stockMovementData.slice();
        let emptyColspan = 6;

        if (filter === 'inbound') {
            filteredData = stockMovementData.filter(record => record.type === 'inbound');
            emptyColspan = 7;
        } else if (filter === 'outbound') {
            filteredData = stockMovementData.filter(record => record.type === 'outbound');
            emptyColspan = 8;
        } else if (filter === 'delivery-note') {
            filteredData = getSalesDeliveryNotes();
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
            } else if (filter === 'outbound') {
                tableHead.innerHTML = `
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名称</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">客户</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作类型</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">出货公司</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">数量变动</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">备注</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">创建与更新</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                `;
            } else if (filter === 'delivery-note') {
                tableHead.innerHTML = `
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">送货公司</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">送货商品</th>
                    <th class="px-6 py-3 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">送货价值</th>
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

        filteredData.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        paginationState.stock.total = filteredData.length;
        let { page, pageSize } = paginationState.stock;

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
                    <td colspan="${emptyColspan}" class="px-6 py-4 text-center text-sm text-gray-500">暂无记录</td>
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
            const displayProductName = product ? product.name : (record.productName || '未知商品');
            const supplierName = record.supplierName || (product ? supplierMap.get(product.supplierId) : '') || '-';
            const safeProductName = escapeHTML(displayProductName);
            const safeSupplierName = escapeHTML(supplierName);
            const safeRemark = escapeHTML(record.remark || '-');
            const safeUnit = escapeHTML(record.unit || '');
            const createdUpdatedMarkup = buildCreatedUpdatedMarkup(record, record.operator);

            const row = document.createElement('tr');
            if (filter === 'delivery-note') {
                const safeCompanyName = escapeHTML(record.companyName || '-');
                const safeDeliveryAmount = escapeHTML(formatStockCurrency(record.totalAmount));
                const deliveryCreatedUpdatedMarkup = buildCreatedUpdatedMarkup(record, record.companyContact || record.customerContact || currentUser.name);

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeCompanyName}</td>
                    <td class="px-6 py-4 text-sm text-gray-900">
                        <div class="space-y-1">${buildDeliveryNoteProductsMarkup(record)}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">${safeDeliveryAmount}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${getDeliveryNoteRemark(record)}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${deliveryCreatedUpdatedMarkup}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-primary hover:text-primary-dark" onclick="showViewDeliveryNoteModal('${record.id}')">
                            查看
                        </button>
                    </td>
                `;
            } else if (filter === 'inbound') {
                let priceHtml = '<span class="text-gray-400">-</span>';
                if (record.price !== null && record.price !== undefined) {
                    const priceClass = record.priceType === 'custom' ? 'text-gray-900' : 'text-gray-500';
                    priceHtml = `<span class="${priceClass}">¥${parseFloat(record.price).toLocaleString()}</span>`;
                }

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeProductName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm">${priceHtml}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeSupplierName}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${createdUpdatedMarkup}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-primary hover:text-primary-dark mr-3">查看</button>
                        <button class="text-yellow-600 hover:text-yellow-800 mr-3">编辑</button>
                        <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">删除</button>
                    </td>
                `;
            } else if (filter === 'outbound') {
                const safeCustomerName = escapeHTML(record.customerName || '-');
                const safeCompanyName = escapeHTML(record.companyName || '-');

                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeProductName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeCustomerName}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${safeCompanyName}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${createdUpdatedMarkup}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-primary hover:text-primary-dark mr-3">查看</button>
                        <button class="text-yellow-600 hover:text-yellow-800 mr-3">编辑</button>
                        <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">删除</button>
                    </td>
                `;
            } else {
                row.innerHTML = `
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${safeProductName}</td>
                    <td class="px-6 py-4 whitespace-nowrap">
                        <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${typeClass}">${typeText}</span>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium ${quantityClass}">${quantitySign}${record.quantity} ${safeUnit}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${safeRemark}</td>
                    <td class="px-6 py-4 text-sm text-gray-500">${createdUpdatedMarkup}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button class="text-primary hover:text-primary-dark mr-3">查看</button>
                        <button class="text-yellow-600 hover:text-yellow-800 mr-3">编辑</button>
                        <button class="text-red-600 hover:text-red-800" onclick="deleteStockMovement('${record.id}')">删除</button>
                    </td>
                `;
            }

            tableBody.appendChild(row);
        });

        renderPaginationControl('stock-pagination-container', 'stock', renderStockMovementTable);
    }

    function addInboundRecord(recordData) {
        const product = mockData.products.find(item => item.id === recordData.productId);
        if (!product) {
            alert('商品不存在！');
            return;
        }

        const supplier = mockData.suppliers.find(item => item.id === product.supplierId);
        const now = new Date();
        const newRecord = {
            id: createRuntimeId('SM'),
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

        product.stockQuantity += recordData.quantity;
        product.updatedAt = getLocalISOString();
        saveMockData();

        updateInventoryTable();
        renderStockMovementTable('all');
        renderDashboardActivity();
        addLog('add', 'inventory', product.name, `进货入库，数量：${recordData.quantity}`);
    }

    function showAddInboundModal() {
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

        showModal('新增进货', content, function onConfirm() {
            const form = document.getElementById('add-inbound-form');
            const formData = new FormData(form);
            const rawProductId = document.getElementById('inbound-product-id').value;
            const rawSupplierId = document.getElementById('inbound-supplier-id').value;
            const quantityStr = formData.get('quantity');
            const costPriceStr = formData.get('costPrice');

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

            const quantity = parseInt(quantityStr, 10);
            if (Number.isNaN(quantity) || quantity <= 0) {
                alert('请输入有效的数量');
                return false;
            }

            const costPriceInput = costPriceStr ? parseFloat(costPriceStr) : null;
            if (costPriceStr && (Number.isNaN(costPriceInput) || costPriceInput < 0)) {
                alert('请输入有效的进价');
                return false;
            }

            let finalSupplierId = null;
            let finalSupplierName = '';

            let supplier = mockData.suppliers.find(item => item.id === rawSupplierId);
            if (supplier) {
                finalSupplierId = supplier.id;
                finalSupplierName = supplier.name;
            } else {
                supplier = mockData.suppliers.find(item => item.name === rawSupplierId);
                if (supplier) {
                    finalSupplierId = supplier.id;
                    finalSupplierName = supplier.name;
                } else {
                    const newSupplierId = createSequentialId(mockData.suppliers, 'S');
                    const newSupplier = {
                        id: newSupplierId,
                        name: rawSupplierId,
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
                    saveMockData();
                    finalSupplierId = newSupplierId;
                    finalSupplierName = rawSupplierId;

                    addLog('add', 'supplier', finalSupplierName, '自动创建新供应商');
                    syncSupplierFilterOption(finalSupplierId, finalSupplierName);
                }
            }

            let finalProduct = mockData.products.find(item => item.id === rawProductId);
            if (!finalProduct) {
                finalProduct = mockData.products.find(item => item.name === rawProductId);
                if (!finalProduct) {
                    const newProductId = createSequentialId(mockData.products, 'P');
                    finalProduct = {
                        id: newProductId,
                        name: rawProductId,
                        category: '未分类',
                        unit: '个',
                        costPrice: costPriceInput !== null ? costPriceInput : null,
                        retailPrice: costPriceInput !== null ? costPriceInput * 1.2 : 0,
                        stockQuantity: 0,
                        minStock: 10,
                        maxStock: 100,
                        supplierId: finalSupplierId,
                        createdAt: getLocalISOString(),
                        updatedAt: getLocalISOString()
                    };
                    mockData.products.push(finalProduct);
                    saveMockData();
                    addLog('add', 'product', finalProduct.name, '自动创建新商品');
                }
            }

            if (!finalProduct) {
                alert('无法处理商品信息，请重试');
                return false;
            }

            finalProduct.stockQuantity += quantity;
            finalProduct.updatedAt = getLocalISOString();
            saveMockData();

            let recordPrice = null;
            let recordPriceType = 'none';
            if (costPriceInput !== null) {
                recordPrice = costPriceInput;
                recordPriceType = 'custom';
            } else if (finalProduct.costPrice !== null && finalProduct.costPrice !== undefined) {
                recordPrice = finalProduct.costPrice;
                recordPriceType = 'default';
            }

            const remarkValue = (formData.get('remark') || '').trim();
            const record = {
                id: createRuntimeId('SM'),
                type: 'inbound',
                productId: finalProduct.id,
                productName: finalProduct.name,
                quantity,
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

            addLog('add', 'stock_movement', finalProduct.name, `进货 ${quantity} ${finalProduct.unit}`);
            refreshActiveStockTable();
            updateInventoryTable();
            updateSupplierTable();
            renderDashboardActivity();

            alert('进货记录添加成功');
            return true;
        });

        const productOptions = mockData.products.map(product => ({
            value: product.id,
            label: product.name
        }));
        const supplierOptions = mockData.suppliers.map(supplier => ({
            value: supplier.id,
            label: supplier.name
        }));

        const renderSupplierSelect = defaultValue => {
            renderAntdSelect('inbound-supplier-select-container', 'inbound-supplier-id', supplierOptions, {
                placeholder: '请选择或搜索供应商...',
                mode: 'tags',
                controlSearchValue: true,
                keepSearchTextOnBlur: true,
                enableCreateOption: true,
                notFoundContent: createSelectNoDataNode(),
                defaultValue
            });
        };

        renderSupplierSelect();

        renderAntdSelect('inbound-product-select-container', 'inbound-product-id', productOptions, {
            placeholder: '请选择或搜索商品...',
            mode: 'tags',
            controlSearchValue: true,
            keepSearchTextOnBlur: true,
            enableCreateOption: true,
            notFoundContent: createSelectNoDataNode()
        }, value => {
            const product = mockData.products.find(item => item.id === value);
            if (product && product.supplierId) {
                renderSupplierSelect(product.supplierId);
                const supplierInput = document.getElementById('inbound-supplier-id');
                if (supplierInput) {
                    supplierInput.value = product.supplierId;
                }
            }
        });
    }

    function showAddOutboundModal() {
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

        showModal('新增出货', content, function onConfirm() {
            const form = document.getElementById('add-outbound-form');
            const formData = new FormData(form);
            const productId = document.getElementById('outbound-product-id').value;
            const quantityStr = formData.get('quantity');

            if (!productId) {
                alert('请选择商品（必填）');
                return false;
            }
            if (!quantityStr) {
                alert('请输入数量（必填）');
                return false;
            }

            const product = mockData.products.find(item => item.id === productId);
            if (!product) {
                alert('商品无效，请重新选择');
                return false;
            }

            const quantity = parseInt(quantityStr, 10);
            if (Number.isNaN(quantity) || quantity <= 0) {
                alert('请输入有效的数量');
                return false;
            }

            if (product.stockQuantity < quantity) {
                alert(`库存不足！当前库存：${product.stockQuantity}`);
                return false;
            }

            product.stockQuantity -= quantity;
            product.updatedAt = getLocalISOString();
            saveMockData();

            const record = {
                id: createRuntimeId('SM'),
                type: 'outbound',
                productId: product.id,
                productName: product.name,
                quantity,
                unit: product.unit,
                operator: currentUser.name,
                remark: formData.get('remark') || '出货出库',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stockMovementData.unshift(record);
            localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));

            addLog('add', 'stock_movement', product.name, `出货 ${quantity} ${product.unit}`);
            refreshActiveStockTable();
            updateInventoryTable();
            renderDashboardActivity();

            alert('出货记录添加成功');
            return true;
        });

        const productOptions = mockData.products.map(product => ({
            value: product.id,
            label: `${product.name} (库存: ${product.stockQuantity})`
        }));
        renderAntdSelect('outbound-product-select-container', 'outbound-product-id', productOptions, '请选择或搜索商品...');
    }

    global.deleteStockMovement = deleteStockMovement;
    global.renderDashboardActivity = renderDashboardActivity;
    global.getInitial = getInitial;
    global.renderStockMovementTable = renderStockMovementTable;
    global.showViewDeliveryNoteModal = showViewDeliveryNoteModal;
    global.addInboundRecord = addInboundRecord;
    function showAddInboundModal() {
        const buildEditableFieldCard = (labelMarkup, fieldMarkup, extraClasses = '') => {
            const className = extraClasses ? ` ${extraClasses}` : '';
            return `
                <div class="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5${className}">
                    <label class="block text-xs font-semibold text-gray-500 mb-1.5">${labelMarkup}</label>
                    ${fieldMarkup}
                </div>
            `;
        };

        const buildFormIntroCard = (iconClass, title, description) => `
            <div class="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
                <div class="flex items-start gap-3">
                    <div class="flex-shrink-0 h-10 w-10 rounded-xl bg-white border border-blue-100 flex items-center justify-center">
                        <i class="fa fa-${iconClass} text-blue-600 text-lg"></i>
                    </div>
                    <div class="min-w-0">
                        <div class="text-base font-semibold text-gray-900">${escapeHTML(title)}</div>
                        <div class="text-sm text-gray-600 mt-0.5">${escapeHTML(description)}</div>
                    </div>
                </div>
            </div>
        `;

        const content = `
            <form id="add-inbound-form" class="space-y-2.5">
                ${buildFormIntroCard('truck', '新增进货', '填写基础信息后即可创建进货记录，系统会同步写入库存。')}
                <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                    ${buildEditableFieldCard(
                        '商品名称 <span class="text-danger">*</span>',
                        '<div id="inbound-product-select-container" class="w-full"></div><input type="hidden" name="name" id="inbound-product-name-input" required><input type="hidden" id="inbound-product-choice-input">',
                        'xl:col-span-2'
                    )}
                    ${buildEditableFieldCard(
                        '分类 <span class="text-danger">*</span>',
                        '<div id="inbound-category-select-container" class="w-full"></div><input type="hidden" name="category" id="inbound-category-input" required>'
                    )}
                    ${buildEditableFieldCard(
                        '当前入库数量 <span class="text-danger">*</span>',
                        '<input type="number" name="quantity" min="1" required class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">'
                    )}
                    ${buildEditableFieldCard(
                        '成本单价 <span class="text-danger">*</span>',
                        '<input type="number" name="costPrice" required min="0" step="0.01" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">'
                    )}
                    ${buildEditableFieldCard(
                        '销售单价 <span class="text-danger">*</span>',
                        '<input type="number" name="retailPrice" required min="0" step="0.01" class="w-full border border-gray-300 rounded-md bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">'
                    )}
                    ${buildEditableFieldCard(
                        '供应商 <span class="text-danger">*</span>',
                        '<div id="inbound-supplier-select-container" class="w-full"></div><input type="hidden" name="supplierId" id="inbound-supplier-id" required>',
                        'xl:col-span-3'
                    )}
                    ${buildEditableFieldCard(
                        '备注',
                        '<textarea name="remark" rows="2" class="w-full border border-gray-300 rounded-md bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"></textarea>',
                        'md:col-span-2 xl:col-span-3'
                    )}
                </div>
                <p class="text-xs text-gray-500">搜索到已有商品后，会自动带出分类、供应商、成本单价和销售单价；新商品则按你当前填写的数据创建并记录本次进货。</p>
            </form>
        `;

        const productOptions = [...mockData.products]
            .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0))
            .map(product => ({
                value: product.id,
                label: product.name
            }));
        const categoryOptions = Array.from(new Set([
            '电子产品',
            '服装',
            '家具',
            '图书',
            ...mockData.products.map(product => String(product.category || '').trim()).filter(Boolean)
        ])).map(category => ({ value: category, label: category }));
        const supplierOptions = mockData.suppliers.map(supplier => ({
            value: supplier.id,
            label: supplier.name
        }));
        let lastLoadedProductId = '';

        showModal('新增进货', content, function onConfirm() {
            const form = document.getElementById('add-inbound-form');
            const formData = new FormData(form);
            const selectedProductValue = String(document.getElementById('inbound-product-choice-input')?.value || '').trim();
            const productName = String(formData.get('name') || '').trim();
            const category = String(formData.get('category') || '').trim();
            const supplierId = String(formData.get('supplierId') || '').trim();
            const quantityStr = String(formData.get('quantity') || '').trim();
            const costPriceStr = String(formData.get('costPrice') || '').trim();
            const retailPriceStr = String(formData.get('retailPrice') || '').trim();

            if (!productName) { alert('请输入商品名称'); return false; }
            if (!category) { alert('请选择分类'); return false; }
            if (!quantityStr) { alert('请输入数量'); return false; }
            if (!costPriceStr) { alert('请输入成本单价'); return false; }
            if (!retailPriceStr) { alert('请输入销售单价'); return false; }
            if (!supplierId) { alert('请选择供应商'); return false; }

            const quantity = parseInt(quantityStr, 10);
            if (Number.isNaN(quantity) || quantity <= 0) {
                alert('请输入有效的数量');
                return false;
            }

            const costPrice = parseFloat(costPriceStr);
            if (Number.isNaN(costPrice) || costPrice < 0) {
                alert('请输入有效的成本单价');
                return false;
            }

            const retailPrice = parseFloat(retailPriceStr);
            if (Number.isNaN(retailPrice) || retailPrice < 0) {
                alert('请输入有效的销售单价');
                return false;
            }

            const supplier = mockData.suppliers.find(item => item.id === supplierId);
            if (!supplier) {
                alert('供应商无效，请重新选择');
                return false;
            }

            const now = getLocalISOString();
            let finalProduct =
                mockData.products.find(item => item.id === selectedProductValue) ||
                mockData.products.find(item => item.name === productName);

            if (!finalProduct) {
                finalProduct = {
                    id: createSequentialId(mockData.products, 'P'),
                    name: productName,
                    category,
                    unit: '个',
                    costPrice,
                    retailPrice,
                    stockQuantity: 0,
                    minStock: 10,
                    maxStock: 100,
                    supplierId,
                    createdAt: now,
                    updatedAt: now
                };
                mockData.products.push(finalProduct);
                addLog('add', 'product', finalProduct.name, '自动创建新商品');
            } else {
                finalProduct.name = productName;
                finalProduct.category = category;
                finalProduct.costPrice = costPrice;
                finalProduct.retailPrice = retailPrice;
                finalProduct.supplierId = supplierId;
                finalProduct.updatedAt = now;
            }

            finalProduct.stockQuantity = Number(finalProduct.stockQuantity || 0) + quantity;
            finalProduct.updatedAt = now;
            saveMockData();

            const remarkValue = String(formData.get('remark') || '').trim();
            const record = {
                id: createRuntimeId('SM'),
                type: 'inbound',
                productId: finalProduct.id,
                productName: finalProduct.name,
                quantity,
                unit: finalProduct.unit || '个',
                supplierId: supplier.id,
                supplierName: supplier.name,
                price: costPrice,
                priceType: 'custom',
                operator: currentUser.name,
                remark: remarkValue || '-',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stockMovementData.unshift(record);
            localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));

            addLog('add', 'stock_movement', finalProduct.name, `进货 ${quantity} ${finalProduct.unit || '个'}`);
            refreshActiveStockTable();
            updateInventoryTable();
            updateSupplierTable();
            renderDashboardActivity();

            alert('进货记录添加成功');
            return true;
        });

        const confirmBtn = document.getElementById('modal-confirm');
        const cancelBtn = document.getElementById('modal-cancel');
        const modalPanel = document.getElementById('modal-panel');
        const modalContent = document.getElementById('modal-content');

        if (modalPanel) {
            modalPanel.className = 'bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4';
        }

        if (modalContent) {
            modalContent.className = 'p-2.5 md:p-3';
        }

        if (confirmBtn) {
            confirmBtn.textContent = '创建';
        }

        if (cancelBtn) {
            cancelBtn.classList.remove('hidden');
            cancelBtn.textContent = '取消';
        }

        const setHiddenValue = (inputId, value) => {
            const input = document.getElementById(inputId);
            if (input) {
                input.value = value || '';
            }
        };

        const setInputValue = (selector, value) => {
            const input = document.querySelector(selector);
            if (input) {
                input.value = value ?? '';
            }
        };

        const renderCategorySelect = (value = '') => {
            renderAntdSelect('inbound-category-select-container', 'inbound-category-input', categoryOptions, {
                placeholder: '请选择分类',
                value: value || undefined
            });
            setHiddenValue('inbound-category-input', value);
        };

        const renderSupplierSelect = (value = '') => {
            renderAntdSelect('inbound-supplier-select-container', 'inbound-supplier-id', supplierOptions, {
                placeholder: '请选择供应商',
                value: value || undefined
            });
            setHiddenValue('inbound-supplier-id', value);
        };

        const clearAutofillFields = () => {
            renderCategorySelect();
            renderSupplierSelect();
            setInputValue('#add-inbound-form input[name="costPrice"]', '');
            setInputValue('#add-inbound-form input[name="retailPrice"]', '');
        };

        const applyProductDefaults = product => {
            if (!product) return;
            renderCategorySelect(product.category || '');
            renderSupplierSelect(product.supplierId || '');
            setInputValue('#add-inbound-form input[name="costPrice"]', product.costPrice ?? '');
            setInputValue('#add-inbound-form input[name="retailPrice"]', product.retailPrice ?? '');
        };

        renderAntdSelect('inbound-product-select-container', 'inbound-product-choice-input', productOptions, {
            placeholder: '请输入或搜索商品名称...',
            mode: 'tags',
            virtual: false,
            popupClassName: 'product-name-select-dropdown',
            controlSearchValue: true,
            keepSearchTextOnBlur: true,
            enableCreateOption: true,
            createOptionLabel: text => `添加 ${text}`,
            listHeight: 160,
            dropdownStyle: { maxHeight: 176, overflow: 'hidden' }
        }, value => {
            const hiddenNameInput = document.getElementById('inbound-product-name-input');
            const selectedValue = String(value ?? '').trim();
            const matchedProduct = mockData.products.find(item => item.id === selectedValue);

            if (!hiddenNameInput) return;

            if (!selectedValue) {
                hiddenNameInput.value = '';
                lastLoadedProductId = '';
                clearAutofillFields();
                return;
            }

            if (matchedProduct) {
                hiddenNameInput.value = matchedProduct.name || '';
                lastLoadedProductId = matchedProduct.id;
                applyProductDefaults(matchedProduct);
                return;
            }

            hiddenNameInput.value = selectedValue;
            if (lastLoadedProductId) {
                clearAutofillFields();
            }
            lastLoadedProductId = '';
        });

        renderCategorySelect();
        renderSupplierSelect();
    }

    global.showAddInboundModal = showAddInboundModal;
    global.showAddOutboundModal = showAddOutboundModal;

    global.AppStockModule = Object.freeze({
        deleteStockMovement,
        renderDashboardActivity,
        getInitial,
        renderStockMovementTable,
        addInboundRecord,
        showAddInboundModal,
        showAddOutboundModal
    });
})(window);
