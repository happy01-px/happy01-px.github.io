(function initDataStore(global) {
  const STORAGE_MODES = Object.freeze({
    remote: "remote",
    memory: "memory",
  });

  const REMOTE_TABLES = Object.freeze([
    "products",
    "suppliers",
    "customers",
    "companies",
    "bills",
    "deliveryNotes",
    "stockMovements",
    "logs",
  ]);

  const storeState = global.AppDataStoreState || {
    mode: STORAGE_MODES.memory,
    source: "fallback",
  };

  global.AppDataStoreState = storeState;

  function createFallbackStockMovementData() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return [
      {
        id: "SM001",
        type: "inbound",
        productId: "P001",
        productName: "iPhone 13 Pro",
        quantity: 50,
        unit: "个",
        operator: "张三",
        remark: "采购入库",
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "SM002",
        type: "outbound",
        productId: "P002",
        productName: "MacBook Pro",
        quantity: 15,
        unit: "个",
        operator: "张三",
        remark: "客户订单#20240721-001",
        createdAt: yesterday,
        updatedAt: yesterday,
      },
      {
        id: "SM003",
        type: "inbound",
        productId: "P003",
        productName: "AirPods Pro",
        quantity: 100,
        unit: "个",
        operator: "李四",
        remark: "采购入库",
        createdAt: yesterday,
        updatedAt: yesterday,
      },
    ];
  }

  function createFallbackLogsData() {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    return [
      {
        id: "LOG1",
        timestamp: now,
        userId: "U001",
        userName: "张三",
        actionType: "add",
        objectType: "product",
        objectName: "iPhone 13 Pro",
        details: "新增商品，数量：50，成本价：5999",
        ipAddress: "192.168.1.100",
      },
      {
        id: "LOG2",
        timestamp: yesterday,
        userId: "U002",
        userName: "李四",
        actionType: "edit",
        objectType: "supplier",
        objectName: "苹果公司",
        details: "更新供应商联系方式",
        ipAddress: "192.168.1.101",
      },
      {
        id: "LOG3",
        timestamp: yesterday,
        userId: "U001",
        userName: "张三",
        actionType: "edit",
        objectType: "inventory",
        objectName: "MacBook Pro",
        details: "入库操作，原数量：20，新数量：35",
        ipAddress: "192.168.1.100",
      },
      {
        id: "LOG4",
        timestamp: yesterday,
        userId: "U003",
        userName: "王五",
        actionType: "delete",
        objectType: "product",
        objectName: "旧款iPad",
        details: "删除商品",
        ipAddress: "192.168.1.102",
      },
    ];
  }

  function createEmptyDataset() {
    return {
      products: [],
      suppliers: [],
      customers: [],
      companies: [],
      bills: [],
      deliveryNotes: [],
      stockMovements: [],
      logs: [],
    };
  }

  function normalizeDataset(data = {}) {
    return {
      ...createEmptyDataset(),
      ...normalizeMockData(data),
      stockMovements: normalizeList(data.stockMovements),
      logs: normalizeList(data.logs),
    };
  }

  function createRuntimeDatasetSnapshot() {
    return normalizeDataset({
      ...normalizeMockData(mockData),
      stockMovements: normalizeList(stockMovementData),
      logs: normalizeList(logsData),
    });
  }

  function applyDefaultDataset(dataset) {
    const normalizedDataset = normalizeDataset(dataset);
    defaultMockData = normalizeMockData(normalizedDataset);
    defaultStockMovementData = normalizeList(normalizedDataset.stockMovements);
    defaultLogsData = normalizeList(normalizedDataset.logs);
  }

  function setStorageState(mode, source) {
    storeState.mode = mode;
    storeState.source = source;
    global.__appDataPersistenceMode = mode;
    global.__appDataPersistenceSource = source;
  }

  function getDataPersistenceMode() {
    return storeState.mode;
  }

  function getDataPersistenceSource() {
    return storeState.source;
  }

  async function loadSplitDataset() {
    const results = await Promise.all(
      REMOTE_TABLES.map(async (table) => {
        const response = await fetch(`data/${table}.json`);
        if (!response.ok) {
          throw new Error(`Failed to load split data table: ${table}`);
        }

        return response.json();
      }),
    );

    return normalizeDataset({
      products: results[0],
      suppliers: results[1],
      customers: results[2],
      companies: results[3],
      bills: results[4],
      deliveryNotes: results[5],
      stockMovements: results[6],
      logs: results[7],
    });
  }

  async function resolveAuthoritativeDataset() {
    try {
      const splitDataset = await loadSplitDataset();
      setStorageState(STORAGE_MODES.remote, "split-files");
      return splitDataset;
    } catch (error) {
      console.warn("Failed to load split data files, using in-memory fallback.", error);
      setStorageState(STORAGE_MODES.memory, "fallback");
      return createEmptyDataset();
    }
  }

  async function saveRemoteTables(dataset, tables = REMOTE_TABLES) {
    for (const table of tables) {
      const response = await fetch(`/api/save/${table}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataset[table]),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to save ${table}: ${response.statusText || response.status}`,
        );
      }
    }
  }

  async function persistDataset(options = {}) {
    const dataset = normalizeDataset(options.dataset || createRuntimeDatasetSnapshot());
    const tables =
      Array.isArray(options.tables) && options.tables.length > 0
        ? options.tables
        : REMOTE_TABLES;

    if (storeState.mode !== STORAGE_MODES.remote) {
      console.warn("Data persistence backend is unavailable; changes remain in memory only.");
      return false;
    }

    await saveRemoteTables(dataset, tables);
    return true;
  }

  async function loadMockData() {
    const dataset = await resolveAuthoritativeDataset();
    applyDefaultDataset(dataset);
    mockData = deepClone(defaultMockData);

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
      console.error("Security check failed: mockData is incomplete, aborting save.");
      return false;
    }

    try {
      return await persistDataset();
    } catch (error) {
      console.error("Failed to persist dataset to split files.", error);
      alert("保存失败：无法写入数据目录，请确认正在通过预览服务器运行。");
      return false;
    }
  }

  function loadStockMovementData() {
    if (defaultStockMovementData.length > 0) {
      stockMovementData = restoreStockMovementDates(deepClone(defaultStockMovementData));
      return;
    }

    stockMovementData = createFallbackStockMovementData();
  }

  function loadLogsData() {
    if (defaultLogsData.length > 0) {
      logsData = restoreLogDates(deepClone(defaultLogsData));
      return;
    }

    logsData = createFallbackLogsData();
  }

  async function persistStockMovementData() {
    try {
      return await persistDataset({
        tables: ["stockMovements"],
      });
    } catch (error) {
      console.error("Failed to persist stock movement data.", error);
      return false;
    }
  }

  async function persistLogsData() {
    try {
      return await persistDataset({
        tables: ["logs"],
      });
    } catch (error) {
      console.error("Failed to persist log data.", error);
      return false;
    }
  }

  function exportAllData() {
    mockData = normalizeMockData(mockData);

    const data = {
      mockData,
      stockMovementData,
      logsData,
      persistenceMode: getDataPersistenceMode(),
      exportTime: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inventory_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    if (typeof global.addLog === "function") {
      global.addLog("export", "system", "数据备份", "导出系统全部数据");
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
          defaultStockMovementData = normalizeList(data.stockMovementData);
        }

        if (data.logsData) {
          logsData = restoreLogDates(data.logsData);
          defaultLogsData = normalizeList(data.logsData);
        }

        const saved = await saveMockData();
        if (!saved) {
          alert("导入已加载到当前页面，但未能保存到数据目录。");
          return;
        }

        if (typeof global.addLog === "function") {
          global.addLog("import", "system", "数据恢复", "从备份文件导入数据");
        }

        alert("数据导入成功，页面将刷新以应用更新。");
        location.reload();
      } catch (error) {
        console.error("Import failed:", error);
        alert("导入失败：文件格式不正确或已损坏。");
      }
    };
    reader.readAsText(file);
  }

  global.loadMockData = loadMockData;
  global.saveMockData = saveMockData;
  global.loadStockMovementData = loadStockMovementData;
  global.loadLogsData = loadLogsData;
  global.persistStockMovementData = persistStockMovementData;
  global.persistLogsData = persistLogsData;
  global.exportAllData = exportAllData;
  global.importData = importData;
  global.getDataPersistenceMode = getDataPersistenceMode;
  global.getDataPersistenceSource = getDataPersistenceSource;

  global.AppDataStore = Object.freeze({
    loadMockData,
    saveMockData,
    loadStockMovementData,
    loadLogsData,
    persistStockMovementData,
    persistLogsData,
    exportAllData,
    importData,
    getDataPersistenceMode,
    getDataPersistenceSource,
  });
})(window);
