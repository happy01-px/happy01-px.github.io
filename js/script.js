﻿﻿﻿﻿﻿﻿﻿﻿// 当前登录用户
const currentUser = {
    id: 'U001',
    name: '张三',
    role: 'admin'
};

// 获取客户端IP地址（模拟）
const clientIP = '192.168.1.100';

// 模拟数据
const mockData = {
    products: [
        {
            id: 'P001',
            name: 'iPhone 13 Pro',
            category: '电子产品',
            unit: '个',
            costPrice: 6999,
            retailPrice: 7999,
            stockQuantity: 125,
            minStock: 50,
            maxStock: 200,
            supplierId: 'S001',
            createdAt: '2023-01-15',
            updatedAt: '2023-07-15'
        },
        {
            id: 'P002',
            name: 'MacBook Air M2',
            category: '电子产品',
            unit: '个',
            costPrice: 8499,
            retailPrice: 9499,
            stockQuantity: 35,
            minStock: 40,
            maxStock: 100,
            supplierId: 'S001',
            createdAt: '2023-02-10',
            updatedAt: '2023-07-10'
        },
        {
            id: 'P003',
            name: 'iPad Pro',
            category: '电子产品',
            unit: '个',
            costPrice: 6799,
            retailPrice: 7799,
            stockQuantity: 0,
            minStock: 30,
            maxStock: 100,
            supplierId: 'S001',
            createdAt: '2023-03-05',
            updatedAt: '2023-07-05'
        },
        {
            id: 'P004',
            name: 'AirPods Pro',
            category: '电子产品',
            unit: '个',
            costPrice: 1799,
            retailPrice: 1999,
            stockQuantity: 210,
            minStock: 50,
            maxStock: 200,
            supplierId: 'S001',
            createdAt: '2023-04-20',
            updatedAt: '2023-07-20'
        },
        {
            id: 'P005',
            name: 'Apple Watch',
            category: '电子产品',
            unit: '个',
            costPrice: 3199,
            retailPrice: 3499,
            stockQuantity: 75,
            minStock: 30,
            maxStock: 100,
            supplierId: 'S001',
            createdAt: '2023-05-15',
            updatedAt: '2023-07-15'
        }
    ],
    suppliers: [
        {
            id: 'S001',
            name: '苹果公司',
            contactPerson: '张经理',
            contactPhone: '13800138000',
            email: 'zhang@apple.com',
            address: '上海市浦东新区张江高科技园区',
            paymentTerms: 'Net 30',
            creditLimit: 1000000,
            status: 'active',
            createdAt: '2023-01-01',
            updatedAt: '2023-06-01'
        },
        {
            id: 'S002',
            name: '三星电子',
            contactPerson: '李经理',
            contactPhone: '13900139000',
            email: 'li@samsung.com',
            address: '北京市朝阳区三星大厦',
            paymentTerms: 'Net 45',
            creditLimit: 800000,
            status: 'active',
            createdAt: '2023-02-01',
            updatedAt: '2023-06-01'
        },
        {
            id: 'S003',
            name: '华为技术',
            contactPerson: '王经理',
            contactPhone: '13700137000',
            email: 'wang@huawei.com',
            address: '深圳市南山区华为总部',
            paymentTerms: 'Net 60',
            creditLimit: 900000,
            status: 'active',
            createdAt: '2023-03-01',
            updatedAt: '2023-06-01'
        }
    ],
    customers: [
        {
            id: 'C001',
            name: '京东商城',
            contactPerson: '赵经理',
            contactPhone: '13600136000',
            email: 'zhao@jd.com',
            address: '北京市朝阳区京东总部',
            paymentTerms: 'Net 30',
            creditLimit: 1500000,
            status: 'active',
            createdAt: '2023-01-05',
            updatedAt: '2023-06-05'
        },
        {
            id: 'C002',
            name: '天猫商城',
            contactPerson: '钱经理',
            contactPhone: '13500135000',
            email: 'qian@tmall.com',
            address: '杭州市余杭区阿里巴巴西溪园区',
            paymentTerms: 'Net 45',
            creditLimit: 1200000,
            status: 'active',
            createdAt: '2023-02-05',
            updatedAt: '2023-06-05'
        },
        {
            id: 'C003',
            name: '苏宁易购',
            contactPerson: '孙经理',
            contactPhone: '13400134000',
            email: 'sun@suning.com',
            address: '南京市玄武区苏宁总部',
            paymentTerms: 'Net 60',
            creditLimit: 1000000,
            status: 'active',
            createdAt: '2023-03-05',
            updatedAt: '2023-06-05'
        }
    ],
    bills: [
        {
            id: 'B001',
            type: 'supplier',
            relatedId: 'S001',
            periodStart: '2023-06-01',
            periodEnd: '2023-06-30',
            billAmount: 250000,
            paymentStatus: 'paid',
            paymentDate: '2023-07-10',
            paymentMethod: '银行转账',
            notes: '六月货款',
            status: 'paid',
            createdAt: '2023-07-05',
            updatedAt: '2023-07-10'
        },
        {
            id: 'B002',
            type: 'supplier',
            relatedId: 'S002',
            periodStart: '2023-06-01',
            periodEnd: '2023-06-30',
            billAmount: 180000,
            paymentStatus: 'pending',
            paymentDate: null,
            paymentMethod: null,
            notes: '六月货款',
            status: 'verified',
            createdAt: '2023-07-08',
            updatedAt: '2023-07-08'
        },
        {
            id: 'B003',
            type: 'supplier',
            relatedId: 'S003',
            periodStart: '2023-06-01',
            periodEnd: '2023-06-30',
            billAmount: 210000,
            paymentStatus: 'pending',
            paymentDate: null,
            paymentMethod: null,
            notes: '六月货款',
            status: 'pending',
            createdAt: '2023-07-10',
            updatedAt: '2023-07-10'
        },
        {
            id: 'B004',
            type: 'supplier',
            relatedId: 'S001',
            periodStart: '2023-07-01',
            periodEnd: '2023-07-15',
            billAmount: 150000,
            paymentStatus: 'pending',
            paymentDate: null,
            paymentMethod: null,
            notes: '七月上半月货款',
            status: 'pending',
            createdAt: '2023-07-18',
            updatedAt: '2023-07-18'
        }
    ],
    deliveryNotes: [
        {
            id: 'D001',
            supplierId: 'S001',
            orderId: 'O001',
            deliveryDate: '2023-07-15',
            expectedDate: '2023-07-15',
            status: 'received',
            totalAmount: 150000,
            notes: 'iPhone 13 Pro 50台',
            createdAt: '2023-07-14',
            updatedAt: '2023-07-15',
            details: [
                {
                    id: 'DD001',
                    deliveryId: 'D001',
                    productId: 'P001',
                    quantity: 50,
                    unitPrice: 6999,
                    totalAmount: 349950,
                    receivedQuantity: 50,
                    notes: '',
                    status: 'received'
                }
            ]
        },
        {
            id: 'D002',
            supplierId: 'S002',
            orderId: 'O002',
            deliveryDate: '2023-07-18',
            expectedDate: '2023-07-18',
            status: 'partial',
            totalAmount: 120000,
            notes: 'Samsung Galaxy S23 20台',
            createdAt: '2023-07-17',
            updatedAt: '2023-07-18',
            details: [
                {
                    id: 'DD002',
                    deliveryId: 'D002',
                    productId: 'P006',
                    quantity: 20,
                    unitPrice: 5999,
                    totalAmount: 119980,
                    receivedQuantity: 15,
                    notes: '5台有瑕疵，待退货',
                    status: 'partial'
                }
            ]
        },
        {
            id: 'D003',
            supplierId: 'S003',
            orderId: 'O003',
            deliveryDate: '2023-07-20',
            expectedDate: '2023-07-20',
            status: 'pending',
            totalAmount: 180000,
            notes: 'Huawei Mate 50 Pro 30台',
            createdAt: '2023-07-19',
            updatedAt: '2023-07-19',
            details: [
                {
                    id: 'DD003',
                    deliveryId: 'D003',
                    productId: 'P007',
                    quantity: 30,
                    unitPrice: 5999,
                    totalAmount: 179970,
                    receivedQuantity: 0,
                    notes: '',
                    status: 'pending'
                }
            ]
        }
    ]
};

// 进出货记录数据
let stockMovementData = [];

// 日志数据
let logsData = [];

// 页面加载完成后执行
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM Content Loaded');
    
    // 清除旧的本地存储数据，强制重新加载示例数据
    // localStorage.removeItem('stockMovementData');
    
    // 加载数据
    try {
        loadStockMovementData();
        loadLogsData();
        updateInventoryTable();
    } catch (e) {
        console.error('Error loading data:', e);
    }
    
    // 初始化图表
    try {
        initCharts();
    } catch (e) {
        console.error('Chart initialization failed:', e);
    }
    
    // 绑定新增商品按钮事件
    const addProductBtn = document.getElementById('add-product-btn');
    if (addProductBtn) {
        addProductBtn.addEventListener('click', function() {
            showAddProductModal();
        });
    }
    
    // 绑定进出货按钮事件
    const addInboundBtn = document.getElementById('add-inbound-btn');
    if (addInboundBtn) {
        addInboundBtn.addEventListener('click', function() {
            showAddInboundModal();
        });
    }
    
    const addOutboundBtn = document.getElementById('add-outbound-btn');
    if (addOutboundBtn) {
        addOutboundBtn.addEventListener('click', function() {
            showAddOutboundModal();
        });
    }
    
    // 绑定进出货标签页切换事件
    const stockTabs = document.querySelectorAll('#stock-tabs button');
    stockTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // 移除所有标签页的激活状态
            stockTabs.forEach(t => {
                t.classList.remove('active', 'border-primary', 'text-primary');
                t.classList.add('border-transparent');
            });
            
            // 激活当前标签页
            this.classList.add('active', 'border-primary', 'text-primary');
            this.classList.remove('border-transparent');
            
            // 渲染对应的数据
            const tabType = this.getAttribute('data-tab');
            renderStockMovementTable(tabType);
        });
    });

    // 导航切换
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
    
    // 下拉菜单交互
    const navDropdowns = document.querySelectorAll('.nav-dropdown > a');
    navDropdowns.forEach(dropdown => {
        dropdown.addEventListener('click', function(e) {
            e.preventDefault();
            const submenu = this.nextElementSibling;
            const icon = this.querySelector('.fa-chevron-down');
            
            // 切换子菜单显示状态
            if (submenu.classList.contains('hidden')) {
                submenu.classList.remove('hidden');
                icon.style.transform = 'rotate(180deg)';
            } else {
                submenu.classList.add('hidden');
                icon.style.transform = 'rotate(0deg)';
            }
        });
    });
    
    // 移动端导航切换
    const mobileNavLinks = document.querySelectorAll('.mobile-nav-link');
    mobileNavLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const target = this.getAttribute('data-target');
            showSection(target);
            
            // 更新导航状态
            mobileNavLinks.forEach(item => item.classList.remove('active', 'bg-gray-800', 'text-white'));
            this.classList.add('active', 'bg-gray-800', 'text-white');
            
            // 关闭移动端侧边栏
            const mobileSidebar = document.getElementById('mobile-sidebar');
            if (mobileSidebar) mobileSidebar.classList.add('hidden');
        });
    });
    
    // 移动端菜单按钮
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
    
    // 关闭移动端菜单按钮
    const closeMobileMenuBtn = document.getElementById('close-mobile-menu');
    if (closeMobileMenuBtn) {
        closeMobileMenuBtn.addEventListener('click', function() {
            document.getElementById('mobile-sidebar').classList.add('hidden');
        });
    }
    
    // 用户菜单按钮
    const userMenuBtn = document.getElementById('user-menu-button');
    if (userMenuBtn) {
        userMenuBtn.addEventListener('click', function() {
            document.getElementById('user-menu').classList.toggle('hidden');
        });
    }
    
    // 点击页面其他地方关闭用户菜单
    document.addEventListener('click', function(e) {
        const userMenu = document.getElementById('user-menu');
        const userMenuButton = document.getElementById('user-menu-button');
        if (userMenu && userMenuButton && !userMenu.contains(e.target) && !userMenuButton.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });
    
    // 模态框控制
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
    
    // 点击模态框外部关闭
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.add('hidden');
            }
        });
    }
});

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
            confirmCallback();
        }
        document.getElementById('modal').classList.add('hidden');
    };
}

// 显示新增商品模态框
function showAddProductModal() {
    // 构建供应商选项
    let supplierOptions = '<option value="">请选择供应商</option>';
    mockData.suppliers.forEach(supplier => {
        supplierOptions += `<option value="${supplier.id}">${supplier.name}</option>`;
    });
    
    // 商品分类选项
    const categories = ['电子产品', '服装', '家具', '图书'];
    let categoryOptions = '<option value="">请选择分类</option>';
    categories.forEach(category => {
        categoryOptions += `<option value="${category}">${category}</option>`;
    });
    
    // 构建表单内容
    const formContent = `
        <form id="add-product-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商品名称 <span class="text-danger">*</span></label>
                <input type="text" name="name" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
            </div>
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">分类 <span class="text-danger">*</span></label>
                <select name="category" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    ${categoryOptions}
                </select>
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
                <select name="supplierId" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    ${supplierOptions}
                </select>
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
}

// 添加商品
function addProduct(productData) {
    // 检查是否已存在相同商品
    const existingProduct = mockData.products.find(p => p.name === productData.name && p.supplierId === productData.supplierId);
    
    if (existingProduct) {
        // 如果存在相同商品，合并数据
        const oldQuantity = existingProduct.stockQuantity;
        existingProduct.stockQuantity += productData.quantity;
        existingProduct.updatedAt = new Date().toISOString().split('T')[0];
        
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
            createdAt: new Date().toISOString().split('T')[0],
            updatedAt: new Date().toISOString().split('T')[0]
        };
        
        // 添加到商品列表
        mockData.products.push(newProduct);
        
        // 显示成功消息
        alert(`商品 "${productData.name}" 已成功添加，库存数量：${productData.quantity}`);
        
        // 添加日志记录
        addLog('add', 'product', productData.name, `新增商品，数量：${productData.quantity}，成本价：${productData.costPrice}`);
    }
    
    // 更新库存列表
    updateInventoryTable();
}

// 更新库存列表
function updateInventoryTable() {
    // 获取表格 tbody 元素
    const tbody = document.querySelector('#inventory tbody');
    if (!tbody) return;
    
    // 清空表格内容
    tbody.innerHTML = '';
    
    // 根据 mockData.products 重新渲染表格
    mockData.products.forEach(product => {
        // 获取供应商名称
        const supplier = mockData.suppliers.find(s => s.id === product.supplierId);
        const supplierName = supplier ? supplier.name : '未知供应商';
        
        // 计算库存价值
        const stockValue = product.stockQuantity * product.costPrice;
        
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
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        
        const formattedUpdatedAt = updatedAt.toLocaleString('zh-CN', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
        
        // 创建表格行
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                    <div class="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-md flex items-center justify-center">
                        <i class="fa fa-${getProductIcon(product.category)} text-gray-500 text-xl"></i>
                    </div>
                    <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">${product.name}</div>
                        <div class="text-sm text-gray-500">SKU: ${product.id}</div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.category}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${product.stockQuantity}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">¥${product.costPrice.toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">¥${stockValue.toLocaleString()}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusClass}">${statusText}</span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${supplierName}</td>
            <td class="px-6 py-4 text-sm text-gray-500">
                <div class="space-y-1">
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">创建时间:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedCreatedAt}</span>
                        </span>
                    </div>
                    <div class="flex items-center">
                        <span class="text-xs text-gray-500 mr-2">更新时间:</span>
                        <span class="flex items-center">
                            <span class="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center mr-2">${getInitial(currentUser.name)}</span>
                            <span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">${formattedUpdatedAt}</span>
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
}

// 显示新增进货模态框
function showAddInboundModal() {
    // 商品选项
    let productOptions = '<option value="">请选择商品</option>';
    mockData.products.forEach(p => {
        productOptions += `<option value="${p.id}">${p.name} (当前库存: ${p.stockQuantity})</option>`;
    });

    const content = `
        <form id="add-inbound-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商品 <span class="text-danger">*</span></label>
                <select name="productId" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    ${productOptions}
                </select>
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

    showModal('新增进货', content, function() {
        const form = document.getElementById('add-inbound-form');
        const formData = new FormData(form);
        const productId = formData.get('productId');
        const product = mockData.products.find(p => p.id === productId);
        
        if (product) {
            const quantity = parseInt(formData.get('quantity'));
            // 更新库存
            product.stockQuantity += quantity;
            product.updatedAt = new Date().toISOString().split('T')[0];
            
            // 添加进货记录
            const record = {
                id: 'SM' + Date.now(),
                type: 'inbound',
                productId: product.id,
                productName: product.name,
                quantity: quantity,
                unit: product.unit,
                operator: currentUser.name,
                remark: formData.get('remark') || '进货入库',
                createdAt: new Date(),
                updatedAt: new Date()
            };
            stockMovementData.unshift(record);
            localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
            
            // 添加日志
            addLog('add', 'stock_movement', product.name, `进货 ${quantity} ${product.unit}`);
            
            // 刷新表格
            const activeTab = document.querySelector('#stock-tabs .active');
            if (activeTab) {
                renderStockMovementTable(activeTab.getAttribute('data-tab'));
            }
            updateInventoryTable();
            
            alert('进货记录添加成功');
        }
    });
}

// 显示新增出货模态框
function showAddOutboundModal() {
    // 商品选项
    let productOptions = '<option value="">请选择商品</option>';
    mockData.products.forEach(p => {
        productOptions += `<option value="${p.id}">${p.name} (当前库存: ${p.stockQuantity})</option>`;
    });

    const content = `
        <form id="add-outbound-form" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">商品 <span class="text-danger">*</span></label>
                <select name="productId" required class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent">
                    ${productOptions}
                </select>
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
        const productId = formData.get('productId');
        const product = mockData.products.find(p => p.id === productId);
        
        if (product) {
            const quantity = parseInt(formData.get('quantity'));
            
            if (product.stockQuantity < quantity) {
                alert(`库存不足！当前库存：${product.stockQuantity}`);
                return; // 不关闭模态框
            }
            
            // 更新库存
            product.stockQuantity -= quantity;
            product.updatedAt = new Date().toISOString().split('T')[0];
            
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
            
            alert('出货记录添加成功');
        }
    });
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
    
    if (logsData.length === 0) {
        logsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center text-sm text-gray-500">暂无日志记录</td>
            </tr>
        `;
        return;
    }
    
    logsData.forEach(log => {
        const formattedTime = new Date(log.timestamp).toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
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



// 渲染进出货记录表格
// 获取操作人员名称的首字母
function getInitial(name) {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
}

function renderStockMovementTable(filter = 'all') {
    const tableBody = document.getElementById('stock-movement-table-body');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // 根据筛选条件过滤数据
    let filteredData = stockMovementData;
    if (filter === 'inbound') {
        filteredData = stockMovementData.filter(record => record.type === 'inbound');
    } else if (filter === 'outbound') {
        filteredData = stockMovementData.filter(record => record.type === 'outbound');
    }
    
    if (filteredData.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="px-6 py-4 text-center text-sm text-gray-500">暂无记录</td>
            </tr>
        `;
        return;
    }
    
    // 按时间倒序排列
    filteredData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    filteredData.forEach(record => {
        const typeText = record.type === 'inbound' ? '入库' : '出库';
        const typeClass = record.type === 'inbound' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800';
        const quantityClass = record.type === 'inbound' ? 'text-green-600' : 'text-blue-600';
        const quantitySign = record.type === 'inbound' ? '+' : '-';
        
        const createdAt = new Date(record.createdAt);
        const updatedAt = new Date(record.updatedAt);
        
        const formattedCreatedAt = createdAt.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const formattedUpdatedAt = updatedAt.toLocaleString('zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${record.productName}</td>
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
                <button class="text-red-600 hover:text-red-800">
                    删除
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// 添加进货记录
function addInboundRecord(recordData) {
    const product = mockData.products.find(p => p.id === recordData.productId);
    if (!product) {
        alert('商品不存在！');
        return;
    }
    
    // 创建进货记录
    const now = new Date();
    const newRecord = {
        id: 'SM' + String(stockMovementData.length + 1).padStart(3, '0'),
        type: 'inbound',
        productId: recordData.productId,
        productName: product.name,
        quantity: recordData.quantity,
        unit: product.unit,
        operator: currentUser.name,
        remark: recordData.remark,
        createdAt: now,
        updatedAt: now
    };
    
    stockMovementData.unshift(newRecord);
    localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
    
    // 更新库存
    product.stockQuantity += recordData.quantity;
    product.updatedAt = now.toISOString().split('T')[0];
    
    updateInventoryTable();
    renderStockMovementTable('all');
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
