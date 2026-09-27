(function initDataStore(global) {
  const STORAGE_MODES = Object.freeze({
    remote: "remote",
    local: "local",
    memory: "memory",
  });
  const LOCAL_STORAGE_KEY = "inventory-system.dataset.v4";

  const REMOTE_TABLES = Object.freeze([
    "products",
    "suppliers",
    "customers",
    "customerProductPrices",
    "companies",
    "warehouses",
    "bills",
    "deliveryNotes",
    "stockMovements",
    "logs",
  ]);

  const storeState = global.AppDataStoreState || {
    mode: STORAGE_MODES.memory,
    source: "fallback",
    revision: 0,
    lastSyncedDataset: null,
  };

  global.AppDataStoreState = storeState;

  function createEmptyDataset() {
    return {
      products: [],
      suppliers: [],
      customers: [],
      customerProductPrices: [],
      companies: [],
      warehouses: [deepClone(global.AppDataSchema.DEFAULT_WAREHOUSE)],
      bills: [],
      deliveryNotes: [],
      stockMovements: [],
      logs: [],
    };
  }

  function normalizeDataset(data = {}) {
    const normalized = {
      ...createEmptyDataset(),
      ...normalizeMockData(data),
      stockMovements: normalizeList(data.stockMovements),
      logs: normalizeList(data.logs),
    };
    normalized.products = global.InventoryCore.hydrateProductStock(
      normalized.products,
      normalized.stockMovements,
    );
    return normalized;
  }

  function createRuntimeDatasetSnapshot() {
    return normalizeDataset({
      ...normalizeMockData(mockData),
      stockMovements: normalizeList(stockMovementData),
      logs: normalizeList(logsData),
    });
  }

  function createPersistedDatasetSnapshot(sourceDataset) {
    const source = sourceDataset || createRuntimeDatasetSnapshot();
    const report = global.InventoryCore.createConsistencyReport(
      source.products,
      source.stockMovements,
    );
    const cachedProductIds = new Set(
      normalizeList(source.products)
        .filter((product) =>
          Object.prototype.hasOwnProperty.call(product, "stockQuantity"),
        )
        .map((product) => String(product.id)),
    );
    if (report.negativeLedgers.length > 0) {
      throw new Error("Stock movement ledger contains negative inventory");
    }
    const persistedMismatches = report.mismatches.filter((row) =>
      cachedProductIds.has(String(row.productId)),
    );
    if (persistedMismatches.length > 0) {
      throw new Error(
        `Runtime inventory cache is inconsistent for ${persistedMismatches.length} product(s)`,
      );
    }
    const runtimeDataset = normalizeDataset(source);
    return {
      ...runtimeDataset,
      products: global.InventoryCore.stripDerivedStock(runtimeDataset.products),
    };
  }

  function restoreRuntimeDataset(dataset) {
    const normalizedDataset = normalizeDataset(dataset);
    mockData = normalizeMockData(normalizedDataset);
    stockMovementData = restoreStockMovementDates(
      normalizedDataset.stockMovements,
    );
    logsData = restoreLogDates(normalizedDataset.logs);
  }

  function validateImportPayload(data) {
    try {
      return {
        error: null,
        migrated: global.AppDataSchema.migrateBackupPayload(data),
      };
    } catch (error) {
      return {
        error: error?.message || "备份数据校验失败",
        migrated: null,
      };
    }
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

  function getBrowserStorage() {
    try {
      return global.localStorage || null;
    } catch {
      return null;
    }
  }

  function parseLocalSnapshot(rawSnapshot) {
    if (!rawSnapshot) return null;
    const snapshot = JSON.parse(rawSnapshot);
    if (
      snapshot.formatVersion !== global.AppDataSchema.DATA_FORMAT_VERSION ||
      !Number.isInteger(snapshot.revision) ||
      snapshot.revision < 0 ||
      !snapshot.dataset
    ) {
      throw new Error("Browser dataset snapshot metadata is invalid");
    }
    const migratedDataset = global.AppDataSchema.migrateDataset(
      snapshot.dataset,
    );
    const validationError =
      global.AppDataSchema.validateDataset(migratedDataset);
    if (validationError) throw new Error(validationError);
    return { ...snapshot, dataset: migratedDataset };
  }

  function loadLocalDatasetSnapshot() {
    const storage = getBrowserStorage();
    if (!storage) return null;
    const snapshot = parseLocalSnapshot(storage.getItem(LOCAL_STORAGE_KEY));
    if (!snapshot) return null;
    storeState.revision = snapshot.revision;
    return normalizeDataset(snapshot.dataset);
  }

  function saveLocalDatasetSnapshot(dataset) {
    const storage = getBrowserStorage();
    if (!storage) {
      throw new Error("浏览器本地存储不可用");
    }
    let currentRevision = 0;
    try {
      currentRevision =
        parseLocalSnapshot(storage.getItem(LOCAL_STORAGE_KEY))?.revision || 0;
    } catch (error) {
      console.warn("Ignoring an invalid browser dataset snapshot.", error);
    }
    if (currentRevision !== getDataRevision()) {
      const conflict = /** @type {Error & {code?: string}} */ (
        new Error(
          `Browser dataset revision conflict: expected ${getDataRevision()}, current ${currentRevision}`,
        )
      );
      conflict.code = "REVISION_CONFLICT";
      throw conflict;
    }
    const revision = currentRevision + 1;
    storage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify({
        formatVersion: global.AppDataSchema.DATA_FORMAT_VERSION,
        revision,
        updatedAt: new Date().toISOString(),
        dataset,
      }),
    );
    storeState.revision = revision;
  }

  function getDataRevision() {
    return Number(storeState.revision) || 0;
  }

  function clonePersistedValue(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function buildTransactionChanges(previousDataset, nextDataset) {
    const changes = {};

    REMOTE_TABLES.forEach((tableName) => {
      const previousRecords = normalizeList(previousDataset?.[tableName]);
      const nextRecords = normalizeList(nextDataset?.[tableName]);
      const previousById = new Map(
        previousRecords.map((record) => [String(record.id), record]),
      );
      const nextIds = new Set(nextRecords.map((record) => String(record.id)));
      const upsert = nextRecords.filter((record) => {
        const previous = previousById.get(String(record.id));
        return !previous || JSON.stringify(previous) !== JSON.stringify(record);
      });
      const remove = previousRecords
        .map((record) => String(record.id))
        .filter((id) => !nextIds.has(id));
      const previousOrder = previousRecords
        .map((record) => String(record.id))
        .join("\u0000");
      const nextOrderIds = nextRecords.map((record) => String(record.id));
      const nextOrder = nextOrderIds.join("\u0000");

      if (upsert.length || remove.length || previousOrder !== nextOrder) {
        changes[tableName] = {
          upsert: clonePersistedValue(upsert),
          delete: remove,
          order: previousOrder === nextOrder ? undefined : nextOrderIds,
        };
      }
    });

    return changes;
  }

  async function loadDatasetSnapshot() {
    const response = await fetch("/api/data-all", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to load dataset snapshot: ${response.status}`);
    }
    const snapshot = await response.json();
    if (
      snapshot.formatVersion !== global.AppDataSchema.DATA_FORMAT_VERSION ||
      !Number.isInteger(snapshot.revision) ||
      snapshot.revision < 0
    ) {
      throw new Error("Dataset snapshot metadata is invalid");
    }
    const migratedDataset = global.AppDataSchema.migrateDataset(
      snapshot.dataset,
    );
    const validationError =
      global.AppDataSchema.validateDataset(migratedDataset);
    if (validationError) throw new Error(validationError);
    storeState.revision = snapshot.revision;
    storeState.lastSyncedDataset = clonePersistedValue(migratedDataset);
    return normalizeDataset(migratedDataset);
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

    return normalizeDataset(
      global.AppDataSchema.migrateDataset(
        Object.fromEntries(
          REMOTE_TABLES.map((tableName, index) => [tableName, results[index]]),
        ),
      ),
    );
  }

  async function resolveAuthoritativeDataset() {
    try {
      const snapshotDataset = await loadDatasetSnapshot();
      setStorageState(STORAGE_MODES.remote, "dataset-snapshot");
      return snapshotDataset;
    } catch (snapshotError) {
      console.warn(
        "Failed to load the dataset API; trying browser storage.",
        snapshotError,
      );
      try {
        const localDataset = loadLocalDatasetSnapshot();
        if (localDataset) {
          setStorageState(STORAGE_MODES.local, "local-storage");
          return localDataset;
        }
      } catch (localError) {
        console.warn(
          "Failed to load browser storage; trying static split files.",
          localError,
        );
      }
      try {
        const splitDataset = await loadSplitDataset();
        storeState.revision = 0;
        setStorageState(
          getBrowserStorage() ? STORAGE_MODES.local : STORAGE_MODES.memory,
          "static-split-files",
        );
        return splitDataset;
      } catch (splitError) {
        console.warn(
          "Failed to load split data files, preserving current in-memory data.",
          splitError,
        );
        setStorageState(STORAGE_MODES.memory, "load-error");
        alert(
          "数据文件读取失败。系统已进入不持久化的内存模式，请检查本地服务和 data 目录后再操作。",
        );
        return createRuntimeDatasetSnapshot();
      }
    }
  }

  async function saveRemoteTables(dataset) {
    const changes = buildTransactionChanges(
      storeState.lastSyncedDataset,
      dataset,
    );
    let response = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatVersion: global.AppDataSchema.DATA_FORMAT_VERSION,
        expectedRevision: getDataRevision(),
        changes,
      }),
    });

    // Older desktop/server builds predate the incremental transaction route,
    // but still expose the revision-checked atomic dataset endpoint. Keep the
    // new route as the default and only use the compatibility path when the
    // server explicitly reports that the route is unavailable.
    if (response.status === 404 || response.status === 405) {
      response = await fetch("/api/save-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formatVersion: global.AppDataSchema.DATA_FORMAT_VERSION,
          expectedRevision: getDataRevision(),
          dataset,
        }),
      });
    }

    let result;
    try {
      result = await response.json();
    } catch {
      // Preserve the HTTP status as the fallback error when no JSON body exists.
    }
    if (!response.ok) {
      const error = /** @type {Error & {code?: string}} */ (
        new Error(
          result?.error ||
            `Failed to save dataset: ${response.statusText || response.status}`,
        )
      );
      error.code =
        response.status === 409 ? "REVISION_CONFLICT" : "SAVE_FAILED";
      throw error;
    }
    if (!Number.isInteger(result?.revision)) {
      throw new Error("Save response did not include a valid revision");
    }
    storeState.revision = result.revision;
    storeState.lastSyncedDataset = clonePersistedValue(dataset);
  }

  async function persistDataset(options = {}) {
    const dataset = createPersistedDatasetSnapshot(
      options.dataset || createRuntimeDatasetSnapshot(),
    );
    const validationError = global.AppDataSchema.validateDataset(dataset);
    if (validationError) throw new Error(validationError);

    if (storeState.mode === STORAGE_MODES.local) {
      saveLocalDatasetSnapshot(dataset);
      return true;
    }

    if (storeState.mode !== STORAGE_MODES.remote) {
      console.warn(
        "Data persistence backend is unavailable; changes remain in memory only.",
      );
      return false;
    }

    await saveRemoteTables(dataset);
    return true;
  }

  async function loadMockData() {
    const dataset = await resolveAuthoritativeDataset();
    applyDefaultDataset(dataset);
    mockData = normalizeMockData(
      normalizeDataset({
        ...deepClone(defaultMockData),
        stockMovements: defaultStockMovementData,
      }),
    );

    if (!mockData.products) mockData.products = [];
    if (!mockData.suppliers) mockData.suppliers = [];
    if (!mockData.customers) mockData.customers = [];
    if (!mockData.companies) mockData.companies = [];
    if (!mockData.warehouses) mockData.warehouses = [];
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
      alert(
        error?.code === "REVISION_CONFLICT"
          ? "保存失败：数据已被其他窗口更新，请刷新页面后重试。"
          : `保存失败：${error?.message || "无法写入数据目录"}`,
      );
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

  function createSeedLog(objectType, objectName, contactPerson) {
    return {
      id: createRuntimeId("LOG"),
      timestamp: new Date(),
      userId: currentUser.id,
      userName: currentUser.name,
      actionType: "add",
      objectType,
      objectName,
      details: `新增${
        objectType === "company"
          ? "公司"
          : objectType === "supplier"
            ? "供应商"
            : "客户"
      }，联系人：${contactPerson}`,
      ipAddress: clientIP,
    };
  }

  function hasRecordWithName(records, name) {
    const normalizedName = String(name).trim().toLocaleLowerCase();
    return normalizeList(records).some(
      (record) =>
        String(record?.name || "")
          .trim()
          .toLocaleLowerCase() === normalizedName,
    );
  }

  async function seedTestData() {
    const previousDataset = createRuntimeDatasetSnapshot();
    const now = getLocalISOString();
    const createdLogs = [];
    let createdCount = 0;
    let skippedCount = 0;
    let conflictCount = 0;

    const companies = [
      {
        name: "化工",
        contactPerson: "雪王",
        contactPhone: "未提供",
        address: "东莞",
      },
      {
        name: "劳保",
        contactPerson: "孙悟空",
        contactPhone: "未提供",
        address: "虎门",
      },
    ];

    companies.forEach((company) => {
      if (hasRecordWithName(mockData.companies, company.name)) {
        skippedCount += 1;
        return;
      }

      mockData.companies.push({
        id: createSequentialId(mockData.companies, "CO"),
        ...company,
        email: "-",
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      createdLogs.push(
        createSeedLog("company", company.name, company.contactPerson),
      );
      createdCount += 1;
    });

    const supplier = {
      name: "供应商",
      contactPerson: "供应商联系人",
      contactPhone: "未提供",
    };
    if (hasRecordWithName(mockData.suppliers, supplier.name)) {
      skippedCount += 1;
    } else {
      mockData.suppliers.push({
        id: createSequentialId(mockData.suppliers, "S"),
        ...supplier,
        email: "-",
        address: "-",
        paymentTerms: "Net 30",
        creditLimit: 0,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      createdLogs.push(
        createSeedLog("supplier", supplier.name, supplier.contactPerson),
      );
      createdCount += 1;
    }

    const customer = {
      id: "KH",
      name: "客户",
      contactPerson: "客户联系人",
      contactPhone: "未提供",
      address: "深圳",
      email: "-",
      paymentTerms: "Net 30",
      hasTaxRate: false,
      taxRateCoefficient: null,
      creditLimit: 0,
      status: "active",
      createdAt: now,
      updatedAt: now,
    };
    const customerWithSameName = hasRecordWithName(
      mockData.customers,
      customer.name,
    );
    const customerWithSameId = normalizeList(mockData.customers).find(
      (record) =>
        String(record?.id || "")
          .trim()
          .toLocaleLowerCase() === customer.id.toLocaleLowerCase(),
    );

    if (customerWithSameName) {
      skippedCount += 1;
    } else if (customerWithSameId) {
      conflictCount += 1;
    } else {
      mockData.customers.push(customer);
      createdLogs.push(
        createSeedLog("customer", customer.name, customer.contactPerson),
      );
      createdCount += 1;
    }

    if (createdCount === 0) {
      return {
        success: true,
        persisted: storeState.mode === STORAGE_MODES.remote,
        createdCount,
        logCount: 0,
        skippedCount,
        conflictCount,
      };
    }

    logsData.unshift(...createdLogs);

    try {
      const persisted = await persistDataset();
      applyDefaultDataset(createRuntimeDatasetSnapshot());
      return {
        success: true,
        persisted,
        createdCount,
        logCount: createdLogs.length,
        skippedCount,
        conflictCount,
      };
    } catch (error) {
      console.error("Failed to write preset test data.", error);

      mockData = normalizeMockData(previousDataset);
      stockMovementData = restoreStockMovementDates(
        previousDataset.stockMovements,
      );
      logsData = restoreLogDates(previousDataset.logs);
      applyDefaultDataset(previousDataset);

      return {
        success: false,
        persisted: false,
        createdCount: 0,
        logCount: 0,
        skippedCount: 0,
        conflictCount: 0,
      };
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
      return await persistDataset();
    } catch (error) {
      console.error("Failed to persist stock movement data.", error);
      return false;
    }
  }

  async function persistLogsData() {
    try {
      return await persistDataset();
    } catch (error) {
      console.error("Failed to persist log data.", error);
      return false;
    }
  }

  function exportAllData(options = {}) {
    mockData = normalizeMockData(mockData);

    const data = {
      formatVersion: global.AppDataSchema.DATA_FORMAT_VERSION,
      dataset: createPersistedDatasetSnapshot(),
      persistenceMode: getDataPersistenceMode(),
      exportTime: new Date().toISOString(),
    };

    const dataStr = JSON.stringify(data, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.href = url;
    const filename = `inventory_backup_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);

    if (options?.log !== false && typeof global.addLog === "function") {
      global.addLog("export", "system", "数据备份", "导出系统全部数据");
    }

    return filename;
  }

  function importData(file) {
    const reader = new FileReader();
    reader.onload = async function onLoad(event) {
      const previousDataset = createRuntimeDatasetSnapshot();
      try {
        const data = JSON.parse(String(event.target?.result || ""));
        const validation = validateImportPayload(data);
        if (validation.error) {
          throw new Error(validation.error);
        }

        const importedDataset = normalizeDataset(validation.migrated.dataset);
        restoreRuntimeDataset(importedDataset);
        const auditLogs = global.stageAuditLogs({
          actionType: "import",
          objectType: "system",
          objectName: "数据恢复",
          details: "从备份文件导入数据",
        });

        const saved = await saveMockData();
        if (!saved) {
          restoreRuntimeDataset(previousDataset);
          applyDefaultDataset(previousDataset);
          alert("导入失败：未能保存到数据目录，原数据已恢复。");
          return;
        }

        applyDefaultDataset(createRuntimeDatasetSnapshot());
        global.finalizeStagedAuditLogs(auditLogs);

        alert("数据导入成功，页面将刷新以应用更新。");
        location.reload();
      } catch (error) {
        console.error("Import failed:", error);
        restoreRuntimeDataset(previousDataset);
        alert(`导入失败：${error.message || "文件格式不正确或已损坏。"}`);
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
  global.seedTestData = seedTestData;
  global.exportAllData = exportAllData;
  global.importData = importData;
  global.getDataPersistenceMode = getDataPersistenceMode;
  global.getDataPersistenceSource = getDataPersistenceSource;
  global.getDataRevision = getDataRevision;

  global.AppDataStore = Object.freeze({
    loadMockData,
    saveMockData,
    clearAllSystemData,
    seedTestData,
    loadStockMovementData,
    loadLogsData,
    persistStockMovementData,
    persistLogsData,
    exportAllData,
    importData,
    getDataPersistenceMode,
    getDataPersistenceSource,
    getDataRevision,
    buildTransactionChanges,
  });
})(window);
