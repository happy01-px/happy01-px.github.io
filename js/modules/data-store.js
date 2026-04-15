(function initDataStore(global) {
    function createFallbackStockMovementData() {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        return [
            {
                id: 'SM001',
                type: 'inbound',
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
    }

    function createFallbackLogsData() {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        return [
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
    }

    async function loadMockData() {
        try {
            const tables = ['products', 'suppliers', 'customers', 'companies', 'bills', 'deliveryNotes', 'stockMovements', 'logs'];
            const loadPromises = tables.map(table =>
                fetch(`data/${table}.json`).then(response => response.ok ? response.json() : [])
            );

            const results = await Promise.all(loadPromises);

            defaultMockData = normalizeMockData({
                products: results[0] || [],
                suppliers: results[1] || [],
                customers: results[2] || [],
                companies: results[3] || [],
                bills: results[4] || [],
                deliveryNotes: results[5] || []
            });
            defaultStockMovementData = normalizeList(results[6]);
            defaultLogsData = normalizeList(results[7]);

            console.log('Loaded split data files');
        } catch (error) {
            console.warn('Failed to load split data files, trying fallback to data.json or localStorage', error);
            try {
                const response = await fetch('data.json');
                if (response.ok) {
                    const combinedData = await response.json();
                    defaultMockData = normalizeMockData(combinedData);
                    defaultStockMovementData = normalizeList(combinedData.stockMovements);
                    defaultLogsData = normalizeList(combinedData.logs);
                    console.log('Loaded default data from data.json');
                } else {
                    defaultMockData = normalizeMockData();
                    defaultStockMovementData = [];
                    defaultLogsData = [];
                }
            } catch (innerError) {
                console.error('Error fetching data.json:', innerError);
                defaultMockData = normalizeMockData();
                defaultStockMovementData = [];
                defaultLogsData = [];
            }
        }

        defaultMockData = normalizeMockData(defaultMockData);

        const savedData = localStorage.getItem('mockData');
        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);
                mockData = normalizeMockData({ ...defaultMockData, ...parsedData });
                console.log('Merged localStorage data');
            } catch (error) {
                console.error('Failed to parse localStorage data, keeping default data:', error);
                mockData = deepClone(defaultMockData);
                alert('警告：本地数据解析失败，已加载默认数据。如果这是非预期的情况，请联系管理员。');
            }
        } else {
            console.log('No localStorage data found, using default data');
            mockData = deepClone(defaultMockData);
        }

        if (!mockData.products) mockData.products = [];
        if (!mockData.suppliers) mockData.suppliers = [];
        if (!mockData.customers) mockData.customers = [];
        if (!mockData.companies) mockData.companies = [];
        if (!mockData.bills) mockData.bills = [];
        if (!mockData.deliveryNotes) mockData.deliveryNotes = [];
    }

    async function saveMockData() {
        mockData = normalizeMockData(mockData);

        if (!mockData || !Array.isArray(mockData.products)) {
            console.error('Security check failed: mockData is incomplete, aborting save.');
            return;
        }

        try {
            const oldData = localStorage.getItem('mockData');
            if (oldData) localStorage.setItem('mockData_backup', oldData);

            localStorage.setItem('mockData', JSON.stringify(mockData));
            console.log('Saved mock data to localStorage');
        } catch (error) {
            console.error('Failed to save mock data to localStorage', error);
            if (error.name === 'QuotaExceededError' || error.code === 22 || error.code === 1014) {
                alert('保存失败：浏览器存储空间已满。请导出数据备份，并清理浏览器缓存。');
            }
        }

        try {
            const promises = [];
            const dataMap = {
                products: mockData.products,
                suppliers: mockData.suppliers,
                customers: mockData.customers,
                companies: mockData.companies,
                bills: mockData.bills,
                deliveryNotes: mockData.deliveryNotes,
                stockMovements: stockMovementData,
                logs: logsData
            };

            for (const [table, data] of Object.entries(dataMap)) {
                promises.push(
                    fetch(`/api/save/${table}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data)
                    }).then(response => {
                        if (!response.ok) throw new Error(`Failed to save ${table}: ${response.statusText}`);
                    })
                );
            }

            await Promise.all(promises);
            console.log('Successfully synced all data to separate files');
        } catch (error) {
            console.log('Running in static mode (no backend API detected) or partial save failed:', error);
        }
    }

    function loadStockMovementData() {
        const savedData = localStorage.getItem('stockMovementData');
        if (savedData) {
            try {
                stockMovementData = restoreStockMovementDates(JSON.parse(savedData));
            } catch (error) {
                console.error('Failed to parse stock movement data from localStorage:', error);
                stockMovementData = restoreStockMovementDates(defaultStockMovementData);
            }
        } else if (defaultStockMovementData.length > 0) {
            stockMovementData = restoreStockMovementDates(deepClone(defaultStockMovementData));
        } else {
            stockMovementData = createFallbackStockMovementData();
            localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
        }
    }

    function loadLogsData() {
        const savedLogs = localStorage.getItem('logsData');
        if (savedLogs) {
            try {
                logsData = restoreLogDates(JSON.parse(savedLogs));
            } catch (error) {
                console.error('Failed to parse logs data from localStorage:', error);
                logsData = restoreLogDates(defaultLogsData);
            }
        } else if (defaultLogsData.length > 0) {
            logsData = restoreLogDates(deepClone(defaultLogsData));
        } else {
            logsData = createFallbackLogsData();
            localStorage.setItem('logsData', JSON.stringify(logsData));
        }
    }

    function exportAllData() {
        mockData = normalizeMockData(mockData);

        const data = {
            mockData,
            stockMovementData,
            logsData,
            exportTime: new Date().toISOString()
        };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `inventory_backup_${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);

        if (typeof global.addLog === 'function') {
            global.addLog('export', 'system', '数据备份', '导出系统全部数据');
        }
    }

    function importData(file) {
        const reader = new FileReader();
        reader.onload = async function onLoad(event) {
            try {
                const data = JSON.parse(event.target.result);

                if (data.mockData) {
                    mockData = normalizeMockData(data.mockData);
                    defaultMockData = deepClone(mockData);
                }

                if (data.stockMovementData) {
                    stockMovementData = restoreStockMovementDates(data.stockMovementData);
                    localStorage.setItem('stockMovementData', JSON.stringify(stockMovementData));
                }

                if (data.logsData) {
                    logsData = restoreLogDates(data.logsData);
                }

                localStorage.setItem('logsData', JSON.stringify(logsData));

                if (typeof global.addLog === 'function') {
                    global.addLog('import', 'system', '数据恢复', '从备份文件导入数据');
                }

                await saveMockData();

                alert('数据导入成功！页面将刷新以应用更改。');
                location.reload();
            } catch (error) {
                console.error('Import failed:', error);
                alert('导入失败：文件格式不正确或已损坏。');
            }
        };
        reader.readAsText(file);
    }

    global.loadMockData = loadMockData;
    global.saveMockData = saveMockData;
    global.loadStockMovementData = loadStockMovementData;
    global.loadLogsData = loadLogsData;
    global.exportAllData = exportAllData;
    global.importData = importData;

    global.AppDataStore = Object.freeze({
        loadMockData,
        saveMockData,
        loadStockMovementData,
        loadLogsData,
        exportAllData,
        importData
    });
})(window);
