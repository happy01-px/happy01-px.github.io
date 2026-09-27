const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  createWindow,
  flushAsyncTasks,
  loadScripts,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createResponse(ok, payload) {
  return {
    ok,
    status: ok ? 200 : 500,
    statusText: ok ? "OK" : "ERROR",
    json: async () => payload,
  };
}

function createSplitTableMap(fixture) {
  return {
    "data/products.json": fixture.mockData.products,
    "data/suppliers.json": fixture.mockData.suppliers,
    "data/customers.json": fixture.mockData.customers,
    "data/customerProductPrices.json":
      fixture.mockData.customerProductPrices || [],
    "data/companies.json": fixture.mockData.companies,
    "data/warehouses.json": fixture.mockData.warehouses,
    "data/bills.json": fixture.mockData.bills,
    "data/deliveryNotes.json": fixture.mockData.deliveryNotes,
    "data/stockMovements.json": fixture.stockMovementData,
    "data/logs.json": fixture.logsData,
  };
}

function loadDataStoreScripts(window) {
  loadScripts(window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/inventory-core.js",
    "js/modules/data-schema.js",
    "js/modules/data-store.js",
  ]);
}

function installSplitDataFetch(window, fixture, apiHandler) {
  let revision = 0;
  const tableMap = createSplitTableMap(fixture);

  window.fetch = async (url, options) => {
    if (url === "/api/data-all") {
      return createResponse(true, {
        formatVersion: window.AppDataSchema.DATA_FORMAT_VERSION,
        revision,
        updatedAt: null,
        dataset: {
          ...fixture.mockData,
          products: fixture.mockData.products.map((product) => {
            const persistedProduct = { ...product };
            delete persistedProduct.stockQuantity;
            return persistedProduct;
          }),
          stockMovements: fixture.stockMovementData,
          logs: fixture.logsData,
        },
      });
    }

    if (Object.prototype.hasOwnProperty.call(tableMap, url)) {
      return createResponse(true, tableMap[url]);
    }

    if (url === "/api/transactions") {
      if (typeof apiHandler === "function") {
        const customResponse = await apiHandler(url, options);
        if (customResponse?.ok && typeof customResponse.json !== "function") {
          revision += 1;
          return {
            ...customResponse,
            json: async () => ({ success: true, revision }),
          };
        }
        return customResponse;
      }

      revision += 1;
      return createResponse(true, { success: true, revision });
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  };
}

function installStaticSplitDataFetch(window, fixture) {
  const tableMap = createSplitTableMap(fixture);
  window.fetch = async (url) => {
    if (url === "/api/data-all") {
      throw new Error("Dataset API unavailable on static hosting");
    }
    if (Object.prototype.hasOwnProperty.call(tableMap, url)) {
      return createResponse(true, tableMap[url]);
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  };
}

test("loadMockData uses the versioned dataset snapshot as authoritative", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);

  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  assert.equal(
    harness.window.mockData.products.length,
    fixture.mockData.products.length,
  );
  assert.equal(harness.window.mockData.products[0].name, "Widget");
  assert.equal(
    harness.window.stockMovementData.length,
    fixture.stockMovementData.length,
  );
  assert.equal(harness.window.logsData.length, fixture.logsData.length);
  assert.equal(harness.window.getDataPersistenceMode(), "remote");
  assert.equal(harness.window.getDataPersistenceSource(), "dataset-snapshot");
  assert.equal(harness.window.getDataRevision(), 0);

  harness.close();
});

test("loadMockData preserves memory and reports a load error when split files are unavailable", async () => {
  const harness = createWindow();

  loadDataStoreScripts(harness.window);

  harness.window.fetch = async () => {
    throw new Error("Offline");
  };

  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  assert.equal(harness.window.mockData.products.length, 0);
  assert.equal(harness.window.mockData.suppliers.length, 0);
  assert.equal(harness.window.stockMovementData.length, 0);
  assert.equal(harness.window.logsData.length, 0);
  assert.equal(harness.window.getDataPersistenceMode(), "memory");
  assert.equal(harness.window.getDataPersistenceSource(), "load-error");
  assert.match(harness.alerts.at(-1), /数据文件读取失败/);

  harness.close();
});

test("static hosting persists inventory changes in browser storage", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();

  loadDataStoreScripts(harness.window);
  installStaticSplitDataFetch(harness.window, fixture);
  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  assert.equal(harness.window.getDataPersistenceMode(), "local");
  assert.equal(harness.window.getDataPersistenceSource(), "static-split-files");

  const product = {
    ...harness.window.mockData.products[0],
    id: "P999",
    name: "Browser Stored Product",
    stockQuantity: 1,
  };
  harness.window.mockData.products.push(product);
  harness.window.stockMovementData.unshift({
    ...harness.window.stockMovementData[0],
    id: "SM999",
    productId: product.id,
    productName: product.name,
    quantity: 1,
    batchNo: "",
  });

  assert.equal(await harness.window.saveMockData(), true);
  const rawSnapshot = harness.window.localStorage.getItem(
    "inventory-system.dataset.v4",
  );
  const snapshot = JSON.parse(rawSnapshot);
  assert.equal(snapshot.revision, 1);
  assert.equal(
    snapshot.dataset.products.some((record) => record.id === "P999"),
    true,
  );
  assert.equal(
    snapshot.dataset.products.every(
      (record) => !Object.hasOwn(record, "stockQuantity"),
    ),
    true,
  );

  const reloadHarness = createWindow();
  loadDataStoreScripts(reloadHarness.window);
  reloadHarness.window.localStorage.setItem(
    "inventory-system.dataset.v4",
    rawSnapshot,
  );
  reloadHarness.window.fetch = async () => {
    throw new Error("Network unavailable");
  };
  await reloadHarness.window.loadMockData();
  reloadHarness.window.loadStockMovementData();
  assert.equal(
    reloadHarness.window.getDataPersistenceSource(),
    "local-storage",
  );
  assert.equal(
    reloadHarness.window.mockData.products.find(
      (record) => record.id === "P999",
    ).stockQuantity,
    1,
  );

  reloadHarness.close();
  harness.close();
});

test("saveMockData syncs all tables through the api when remote persistence is active", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  const calls = [];
  /** @type {any} */
  let savedPayload;

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture, async (url, options) => {
    calls.push(url);
    savedPayload = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
    };
  });

  await harness.window.loadMockData();
  applyFixtureState(harness.window, fixture);
  harness.window.mockData.products[0].name = "Updated Widget";
  await harness.window.saveMockData();

  assert.deepEqual(calls, ["/api/transactions"]);
  assert.equal(
    savedPayload.changes.products.upsert.every(
      (product) => !Object.hasOwn(product, "stockQuantity"),
    ),
    true,
  );
  assert.equal(savedPayload.changes.products.upsert[0].name, "Updated Widget");
  assert.equal(Object.hasOwn(savedPayload.changes, "suppliers"), false);

  harness.close();
});

test("saveMockData falls back to the legacy atomic endpoint when the transaction route is missing", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  const calls = [];
  /** @type {any} */
  let savedPayload;

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);
  await harness.window.loadMockData();
  applyFixtureState(harness.window, fixture);
  harness.window.mockData.products[0].name = "Legacy Server Widget";

  harness.window.fetch = async (url, options) => {
    calls.push(url);
    if (url === "/api/transactions") {
      return {
        ok: false,
        status: 404,
        statusText: "Not Found",
        json: async () => {
          throw new Error("No JSON response body");
        },
      };
    }
    if (url === "/api/save-all") {
      savedPayload = JSON.parse(options.body);
      return createResponse(true, { success: true, revision: 1 });
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  };

  const saved = await harness.window.saveMockData();

  assert.equal(saved, true);
  assert.deepEqual(calls, ["/api/transactions", "/api/save-all"]);
  assert.equal(savedPayload.expectedRevision, 0);
  assert.equal(savedPayload.dataset.products[0].name, "Legacy Server Widget");
  assert.equal(
    savedPayload.dataset.products.every(
      (product) => !Object.hasOwn(product, "stockQuantity"),
    ),
    true,
  );
  assert.equal(harness.window.getDataRevision(), 1);

  harness.close();
});

test("saveMockData returns false and alerts when the remote save fails", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  let requestCount = 0;

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);

  await harness.window.loadMockData();
  applyFixtureState(harness.window, fixture);

  harness.window.fetch = async (url) => {
    requestCount += 1;
    throw new Error(`API unavailable: ${url}`);
  };

  const saved = await harness.window.saveMockData();

  assert.equal(saved, false);
  assert.equal(requestCount, 1);
  assert.equal(harness.window.getDataPersistenceMode(), "remote");
  assert.equal(harness.window.getDataPersistenceSource(), "dataset-snapshot");
  assert.ok(harness.alerts.length > 0);

  harness.close();
});

test("saveMockData reports revision conflicts instead of overwriting newer data", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);
  await harness.window.loadMockData();
  applyFixtureState(harness.window, fixture);

  harness.window.fetch = async (url) => {
    assert.equal(url, "/api/transactions");
    return {
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: async () => ({
        success: false,
        error: "Dataset revision conflict",
        currentRevision: 2,
      }),
    };
  };

  const saved = await harness.window.saveMockData();
  assert.equal(saved, false);
  assert.match(harness.alerts.at(-1), /其他窗口更新/);

  harness.close();
});

test("clearAllSystemData empties every persisted table", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  const savedTables = new Map();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture, async (url, options) => {
    savedTables.set(url, JSON.parse(options.body));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
    };
  });

  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  const cleared = await harness.window.clearAllSystemData();

  assert.equal(cleared, true);
  assert.equal(harness.window.mockData.products.length, 0);
  assert.equal(harness.window.mockData.suppliers.length, 0);
  assert.equal(harness.window.mockData.customers.length, 0);
  assert.equal(harness.window.mockData.companies.length, 0);
  assert.equal(harness.window.mockData.warehouses.length, 1);
  assert.equal(harness.window.mockData.bills.length, 0);
  assert.equal(harness.window.mockData.deliveryNotes.length, 0);
  assert.equal(harness.window.stockMovementData.length, 0);
  assert.equal(harness.window.logsData.length, 0);
  assert.deepEqual(Array.from(savedTables.keys()), ["/api/transactions"]);
  Object.entries(savedTables.get("/api/transactions").changes)
    .filter(([tableName]) => tableName !== "warehouses")
    .forEach(([, tableChanges]) => {
      assert.ok(tableChanges.delete.length > 0);
    });

  harness.close();
});

test("seedTestData writes the preset records and logs without duplicates", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  const savedTables = new Map();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture, async (url, options) => {
    savedTables.set(url, JSON.parse(options.body));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
    };
  });

  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  const initialLogCount = harness.window.logsData.length;
  const firstResult = await harness.window.seedTestData();

  assert.equal(firstResult.success, true);
  assert.equal(firstResult.persisted, true);
  assert.equal(firstResult.createdCount, 4);
  assert.equal(firstResult.logCount, 4);
  assert.equal(
    harness.window.mockData.companies.find((item) => item.name === "化工")
      .contactPerson,
    "雪王",
  );
  assert.equal(
    harness.window.mockData.companies.find((item) => item.name === "劳保")
      .address,
    "虎门",
  );
  assert.equal(
    harness.window.mockData.suppliers.find((item) => item.name === "供应商")
      .contactPhone,
    "未提供",
  );

  const customer = harness.window.mockData.customers.find(
    (item) => item.name === "客户",
  );
  assert.equal(customer.id, "KH");
  assert.equal(customer.address, "深圳");
  assert.equal(customer.paymentTerms, "Net 30");
  assert.equal(customer.hasTaxRate, false);
  assert.equal(customer.taxRateCoefficient, null);
  assert.equal(harness.window.logsData.length, initialLogCount + 4);
  assert.deepEqual(
    Array.from(harness.window.logsData.slice(0, 4), (item) => item.objectName),
    ["化工", "劳保", "供应商", "客户"],
  );
  assert.ok(
    savedTables.get("/api/transactions").changes.logs.upsert.length >= 4,
  );

  const lengthsAfterFirstWrite = {
    companies: harness.window.mockData.companies.length,
    suppliers: harness.window.mockData.suppliers.length,
    customers: harness.window.mockData.customers.length,
    logs: harness.window.logsData.length,
  };
  const secondResult = await harness.window.seedTestData();

  assert.equal(secondResult.createdCount, 0);
  assert.equal(secondResult.logCount, 0);
  assert.deepEqual(
    {
      companies: harness.window.mockData.companies.length,
      suppliers: harness.window.mockData.suppliers.length,
      customers: harness.window.mockData.customers.length,
      logs: harness.window.logsData.length,
    },
    lengthsAfterFirstWrite,
  );

  harness.close();
});

test("importData updates in-memory state and persists imported tables when remote storage is available", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  const saveCalls = [];

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture, async (url) => {
    saveCalls.push(url);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
    };
  });

  await harness.window.loadMockData();

  const backupFile = new harness.window.File(
    [
      JSON.stringify({
        mockData: {
          ...fixture.mockData,
          products: fixture.mockData.products.map((product, index) =>
            index === 0 ? { ...product, name: "Recovered Widget" } : product,
          ),
        },
        stockMovementData: fixture.stockMovementData,
        logsData: fixture.logsData,
      }),
    ],
    "backup.json",
    { type: "application/json" },
  );

  harness.window.importData(backupFile);
  await flushAsyncTasks(6);
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(harness.window.mockData.products[0].name, "Recovered Widget");
  assert.deepEqual(saveCalls, ["/api/transactions"]);
  assert.ok(harness.alerts.length > 0);

  harness.close();
});

test("importData rejects incomplete backups without changing runtime data", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);
  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  const invalidBackup = new harness.window.File(
    [JSON.stringify({ formatVersion: 1, mockData: { products: [] } })],
    "invalid-backup.json",
    { type: "application/json" },
  );

  harness.window.importData(invalidBackup);
  await flushAsyncTasks(6);

  assert.equal(harness.window.mockData.products[0].name, "Widget");
  assert.match(harness.alerts.at(-1), /导入失败/);

  harness.close();
});

test("importData rejects broken cross-table references", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);
  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  const brokenFixture = createFixtureData();
  brokenFixture.mockData.products[0].supplierId = "MISSING-SUPPLIER";
  const invalidBackup = new harness.window.File(
    [
      JSON.stringify({
        formatVersion: 2,
        mockData: brokenFixture.mockData,
        stockMovementData: brokenFixture.stockMovementData,
        logsData: brokenFixture.logsData,
      }),
    ],
    "broken-reference.json",
    { type: "application/json" },
  );

  harness.window.importData(invalidBackup);
  await flushAsyncTasks(6);

  assert.equal(harness.window.mockData.products[0].supplierId, "S001");
  assert.match(harness.alerts.at(-1), /missing supplier/);

  harness.close();
});

test("importData restores previous data when persistence fails", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture);
  await harness.window.loadMockData();
  harness.window.loadStockMovementData();
  harness.window.loadLogsData();

  harness.window.fetch = async (url) => {
    if (url === "/api/transactions") {
      return createResponse(false, {});
    }
    throw new Error(`Unexpected fetch url: ${url}`);
  };

  const changedFixture = createFixtureData();
  changedFixture.mockData.products[0].name = "Should Roll Back";
  const backup = new harness.window.File(
    [
      JSON.stringify({
        formatVersion: 1,
        mockData: changedFixture.mockData,
        stockMovementData: changedFixture.stockMovementData,
        logsData: changedFixture.logsData,
      }),
    ],
    "failing-backup.json",
    { type: "application/json" },
  );

  harness.window.importData(backup);
  await flushAsyncTasks(8);

  assert.equal(harness.window.mockData.products[0].name, "Widget");
  assert.match(harness.alerts.at(-1), /原数据已恢复/);

  harness.close();
});
