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
      console.warn(
        "Failed to load split data files, using in-memory fallback.",
        error,
      );
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
    const dataset = normalizeDataset(
      options.dataset || createRuntimeDatasetSnapshot(),
    );
    const tables =
      Array.isArray(options.tables) && options.tables.length > 0
        ? options.tables
        : REMOTE_TABLES;

    if (storeState.mode !== STORAGE_MODES.remote) {
      console.warn(
        "Data persistence backend is unavailable; changes remain in memory only.",
      );
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
      console.error(
        "Security check failed: mockData is incomplete, aborting save.",
      );
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

  async function clearAllSystemData() {
    const previousDataset = createRuntimeDatasetSnapshot();
    const emptyDataset = createEmptyDataset();

    mockData = normalizeMockData(emptyDataset);
    stockMovementData = [];
    logsData = [];

    try {
      const persisted = await persistDataset({
        dataset: emptyDataset,
      });

      applyDefaultDataset(emptyDataset);
      return persisted;
    } catch (error) {
      console.error("Failed to clear all system data.", error);

      if (storeState.mode === STORAGE_MODES.remote) {
        try {
          await saveRemoteTables(previousDataset);
        } catch (rollbackError) {
          console.error(
            "Failed to restore dataset after clear failure.",
            rollbackError,
          );
        }
      }

      mockData = normalizeMockData(previousDataset);
      stockMovementData = restoreStockMovementDates(
        previousDataset.stockMovements,
      );
      logsData = restoreLogDates(previousDataset.logs);
      applyDefaultDataset(previousDataset);

      alert("清空失败：无法写入数据目录，已保留原数据。");
      return false;
    }
  }

  function loadStockMovementData() {
    stockMovementData = restoreStockMovementDates(
      deepClone(defaultStockMovementData),
    );
  }

  function loadLogsData() {
    logsData = restoreLogDates(deepClone(defaultLogsData));
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
  global.clearAllSystemData = clearAllSystemData;
  global.exportAllData = exportAllData;
  global.importData = importData;
  global.getDataPersistenceMode = getDataPersistenceMode;
  global.getDataPersistenceSource = getDataPersistenceSource;

  global.AppDataStore = Object.freeze({
    loadMockData,
    saveMockData,
    clearAllSystemData,
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
