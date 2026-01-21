// 销售单相关逻辑

// 销售单状态
let currentSalesOrder = {
    items: []
};

// 初始化销售单
function initSalesOrder() {
    // 生成单号
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const randomNum = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    document.getElementById('sales-order-no').textContent = `XS${dateStr}${randomNum}`;
    
    // 清空现有数据
    currentSalesOrder.items = [];
    renderSalesOrderTable();
    
    // 添加默认行
    addSalesOrderRow();
}

// 添加销售单行
function addSalesOrderRow() {
    const rowId = Date.now();
    currentSalesOrder.items.push({
        id: rowId,
        productId: '',
        quantity: 1,
        price: 0,
        deliveryQty: 1,
        warehouse: '总仓库',
        remark: ''
    });
    renderSalesOrderTable();
}

// 移除销售单行
function removeSalesOrderRow(id) {
    currentSalesOrder.items = currentSalesOrder.items.filter(item => item.id !== id);
    renderSalesOrderTable();
}

// 渲染销售单表格
function renderSalesOrderTable() {
    const tbody = document.getElementById('sales-order-table-body');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // 构建商品选项
    let productOptions = '<option value="">请选择产品</option>';
    mockData.products.forEach(p => {
        productOptions += `<option value="${p.id}">${p.name}</option>`;
    });
    
    currentSalesOrder.items.forEach((item, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-3 py-2 text-center">${index + 1}</td>
            <td class="px-3 py-2">
                <select class="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary" 
                    onchange="updateSalesOrderItem(${item.id}, 'productId', this.value)">
                    ${productOptions.replace(`value="${item.productId}"`, `value="${item.productId}" selected`)}
                </select>
            </td>
            <td class="px-3 py-2 text-gray-500" id="barcode-${item.id}">-</td>
            <td class="px-3 py-2 text-gray-500" id="spec-${item.id}">-</td>
            <td class="px-3 py-2 text-gray-500" id="stock-${item.id}">0</td>
            <td class="px-3 py-2">
                <input type="number" value="${item.quantity}" min="1" 
                    class="w-20 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                    onchange="updateSalesOrderItem(${item.id}, 'quantity', this.value)">
            </td>
            <td class="px-3 py-2">
                <input type="number" value="${item.price}" min="0" step="0.01" 
                    class="w-24 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                    onchange="updateSalesOrderItem(${item.id}, 'price', this.value)">
            </td>
            <td class="px-3 py-2 text-gray-800 font-medium" id="amount-${item.id}">
                ${(item.quantity * item.price).toFixed(2)}
            </td>
            <td class="px-3 py-2">
                <input type="number" value="${item.deliveryQty}" min="0" 
                    class="w-20 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                    onchange="updateSalesOrderItem(${item.id}, 'deliveryQty', this.value)">
            </td>
            <td class="px-3 py-2">
                <select class="w-24 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                    onchange="updateSalesOrderItem(${item.id}, 'warehouse', this.value)">
                    <option value="总仓库" ${item.warehouse === '总仓库' ? 'selected' : ''}>总仓库</option>
                </select>
            </td>
            <td class="px-3 py-2">
                <input type="text" value="${item.remark}" 
                    class="w-full border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-primary"
                    onchange="updateSalesOrderItem(${item.id}, 'remark', this.value)">
            </td>
            <td class="px-3 py-2 text-center">
                <button class="text-red-500 hover:text-red-700" onclick="removeSalesOrderRow(${item.id})">
                    <i class="fa fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
        
        // 如果有选中的商品，更新相关信息
        if (item.productId) {
            updateRowInfo(item.id, item.productId);
        }
    });
    
    calculateSalesOrderTotal();
}

// 更新行数据
function updateSalesOrderItem(id, field, value) {
    const item = currentSalesOrder.items.find(i => i.id === id);
    if (!item) return;
    
    if (field === 'quantity' || field === 'deliveryQty') {
        value = parseInt(value) || 0;
    } else if (field === 'price') {
        value = parseFloat(value) || 0;
    }
    
    item[field] = value;
    
    if (field === 'productId') {
        updateRowInfo(id, value);
        // 自动设置单价
        const product = mockData.products.find(p => p.id === value);
        if (product) {
            item.price = product.retailPrice || 0;
            // 重新渲染该行价格输入框
            renderSalesOrderTable();
            return;
        }
    }
    
    if (field === 'quantity' || field === 'price') {
        const amountEl = document.getElementById(`amount-${id}`);
        if (amountEl) {
            amountEl.textContent = (item.quantity * item.price).toFixed(2);
        }
        calculateSalesOrderTotal();
    }
}

// 更新行显示的商品信息
function updateRowInfo(rowId, productId) {
    const product = mockData.products.find(p => p.id === productId);
    if (!product) return;
    
    const barcodeEl = document.getElementById(`barcode-${rowId}`);
    const specEl = document.getElementById(`spec-${rowId}`);
    const stockEl = document.getElementById(`stock-${rowId}`);
    
    if (barcodeEl) barcodeEl.textContent = product.id; // 暂时用ID作为条码
    if (specEl) specEl.textContent = product.unit; // 暂时用单位作为规格
    if (stockEl) stockEl.textContent = product.stockQuantity;
}

// 计算总计
function calculateSalesOrderTotal() {
    let totalQty = 0;
    let totalAmount = 0;
    let totalDeliveryQty = 0;
    
    currentSalesOrder.items.forEach(item => {
        totalQty += item.quantity;
        totalAmount += item.quantity * item.price;
        totalDeliveryQty += item.deliveryQty;
    });
    
    document.getElementById('total-qty').textContent = totalQty;
    document.getElementById('total-amount').textContent = totalAmount.toFixed(2);
    document.getElementById('total-delivery-qty').textContent = totalDeliveryQty;
    
    document.getElementById('order-total-amount').textContent = totalAmount.toFixed(2);
    document.getElementById('contract-amount').textContent = totalAmount.toFixed(2);
    
    // 更新收款信息
    document.getElementById('delivered-amount').textContent = totalAmount.toFixed(2); // 假设已送货金额等于总金额
    document.getElementById('unreceived-amount').textContent = totalAmount.toFixed(2);
}

// 提交销售单
function submitSalesOrder() {
    if (currentSalesOrder.items.length === 0) {
        alert('请添加商品！');
        return;
    }
    
    const validItems = currentSalesOrder.items.filter(item => item.productId && item.quantity > 0);
    if (validItems.length === 0) {
        alert('请选择有效的商品并填写数量！');
        return;
    }
    
    // 检查库存
    for (const item of validItems) {
        const product = mockData.products.find(p => p.id === item.productId);
        if (product && product.stockQuantity < item.quantity) {
            alert(`商品 ${product.name} 库存不足！当前库存：${product.stockQuantity}`);
            return;
        }
    }
    
    // 处理出库
    validItems.forEach(item => {
        const product = mockData.products.find(p => p.id === item.productId);
        if (product) {
            // 更新库存
            product.stockQuantity -= item.quantity;
            product.updatedAt = new Date().toISOString().split('T')[0];
            
            // 添加出货记录
            const record = {
                id: 'SM' + Date.now() + Math.floor(Math.random() * 1000),
                type: 'outbound',
                productId: product.id,
                productName: product.name,
                quantity: item.quantity,
                unit: product.unit,
                operator: currentUser.name,
                remark: item.remark || `销售出库 - ${document.getElementById('sales-order-no').textContent}`,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stockMovementData.unshift(record);
            
            // 添加日志
            addLog('add', 'stock_movement', product.name, `销售出库 ${item.quantity} ${product.unit}`);
        }
    });
    
    localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
    updateInventoryTable();
    
    alert('销售单提交成功！');
    showSection('stock-movement');
    renderStockMovementTable('all');
}

// 取消销售单
function cancelSalesOrder() {
    if (confirm('确定要取消当前销售单吗？所有未保存的数据将丢失。')) {
        showSection('stock-movement');
    }
}
