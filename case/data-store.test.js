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

function loadDataStoreScripts(window) {
  loadScripts(window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/data-store.js",
  ]);
}

function installSplitDataFetch(window, fixture, apiHandler) {
  const tableMap = {
    "data/products.json": fixture.mockData.products,
    "data/suppliers.json": fixture.mockData.suppliers,
    "data/customers.json": fixture.mockData.customers,
    "data/companies.json": fixture.mockData.companies,
    "data/bills.json": fixture.mockData.bills,
    "data/deliveryNotes.json": fixture.mockData.deliveryNotes,
    "data/stockMovements.json": fixture.stockMovementData,
    "data/logs.json": fixture.logsData,
  };

  window.fetch = async (url) => {
    if (Object.prototype.hasOwnProperty.call(tableMap, url)) {
      return createResponse(true, tableMap[url]);
    }

    if (String(url).startsWith("/api/save/")) {
      if (typeof apiHandler === "function") {
        return apiHandler(url);
      }

      return {
        ok: true,
        status: 200,
        statusText: "OK",
      };
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  };
}

test("loadMockData uses split files as the authoritative source", async () => {
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
  assert.equal(harness.window.getDataPersistenceSource(), "split-files");

  harness.close();
});

test("loadMockData falls back to in-memory defaults when split files are unavailable", async () => {
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
  assert.equal(harness.window.stockMovementData.length, 3);
  assert.equal(harness.window.logsData.length, 4);
  assert.equal(harness.window.getDataPersistenceMode(), "memory");
  assert.equal(harness.window.getDataPersistenceSource(), "fallback");

  harness.close();
});

test("saveMockData syncs all tables through the api when remote persistence is active", async () => {
  const harness = createWindow();
  const fixture = createFixtureData();
  const calls = [];

  loadDataStoreScripts(harness.window);
  installSplitDataFetch(harness.window, fixture, async (url) => {
    calls.push(url);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
    };
  });

  await harness.window.loadMockData();
  applyFixtureState(harness.window, fixture);
  await harness.window.saveMockData();

  assert.deepEqual(calls, [
    "/api/save/products",
    "/api/save/suppliers",
    "/api/save/customers",
    "/api/save/companies",
    "/api/save/bills",
    "/api/save/deliveryNotes",
    "/api/save/stockMovements",
    "/api/save/logs",
  ]);

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
  assert.equal(harness.window.getDataPersistenceSource(), "split-files");
  assert.ok(harness.alerts.length > 0);

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
          products: [
            {
              ...fixture.mockData.products[0],
              name: "Recovered Widget",
            },
          ],
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
  assert.deepEqual(saveCalls, [
    "/api/save/products",
    "/api/save/suppliers",
    "/api/save/customers",
    "/api/save/companies",
    "/api/save/bills",
    "/api/save/deliveryNotes",
    "/api/save/stockMovements",
    "/api/save/logs",
  ]);
  assert.ok(harness.alerts.length > 0);

  harness.close();
});
