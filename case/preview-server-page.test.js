const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const {
  createWindow,
  dispatchDomContentLoaded,
  flushAsyncTasks,
} = require("./helpers/browser-harness");
const { startPreviewServer } = require("./helpers/server-harness");

function getAppScriptPaths(indexHtml) {
  return [...indexHtml.matchAll(/<script[^>]+src="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((src) => src.endsWith(".js") && !src.startsWith("lib/"));
}

async function loadServerScripts(window, baseUrl, scriptPaths) {
  for (const scriptPath of scriptPaths) {
    const response = await fetch(new URL(scriptPath, baseUrl));
    const source = await response.text();
    window.eval(source);
  }
}

function createServerFetch(baseUrl) {
  return async (input, init) => {
    const rawUrl = typeof input === "string" ? input : input.url;
    return fetch(new URL(String(rawUrl), `${baseUrl}/`), init);
  };
}

function readServerJson(server, relativePath) {
  return JSON.parse(
    fs.readFileSync(path.join(server.tempDir, relativePath), "utf8"),
  );
}

function writeProjectJson(projectDir, relativePath, value) {
  fs.writeFileSync(
    path.join(projectDir, relativePath),
    JSON.stringify(value, null, 2),
    "utf8",
  );
}

async function waitFor(assertion, options = {}) {
  const timeoutMs = options.timeoutMs || 4000;
  const intervalMs = options.intervalMs || 50;
  const startTime = Date.now();
  let lastError = null;

  while (Date.now() - startTime < timeoutMs) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  throw lastError || new Error("Timed out waiting for condition.");
}

async function readServerDataset(server) {
  const response = await fetch(`${server.baseUrl}/api/data-all`);
  const snapshot = await response.json();
  if (!response.ok || !snapshot.dataset) {
    throw new Error(
      snapshot.error || `Failed to read server dataset: ${response.status}`,
    );
  }
  return snapshot.dataset;
}

async function bootServerPage(server, options = {}) {
  const response = await fetch(`${server.baseUrl}/`);
  const indexHtml = await response.text();
  const harness = createWindow({
    documentHtml: indexHtml,
    loadReactRuntime: true,
    url: `${server.baseUrl}/${options.hash || ""}`,
  });

  harness.window.fetch = createServerFetch(server.baseUrl);

  if (options.hash) {
    harness.window.location.hash = options.hash;
  }

  await loadServerScripts(
    harness.window,
    server.baseUrl,
    getAppScriptPaths(indexHtml),
  );
  dispatchDomContentLoaded(harness.window);
  await flushAsyncTasks(12);

  return harness;
}

function changeField(element, value, window) {
  element.value = value;
  element.dispatchEvent(new window.Event("input", { bubbles: true }));
  element.dispatchEvent(new window.Event("change", { bubbles: true }));
}

test("preview_server-backed page boot uses the live data files served by the server", async () => {
  const serverOnlyProduct = [
    {
      id: "P777",
      name: "Server Only Product",
      category: "服务器数据",
      unit: "个",
      costPrice: 10,
      retailPrice: 12,
      stockQuantity: 3,
      minStock: 1,
      maxStock: 10,
      supplierId: "S001",
      createdAt: "2026-04-22",
      updatedAt: "2026-04-22",
    },
  ];
  const server = await startPreviewServer({
    beforeStart(tempDir) {
      writeProjectJson(
        tempDir,
        path.join("data", "products.json"),
        serverOnlyProduct,
      );
    },
  });

  try {
    const harness = await bootServerPage(server);
    const inventoryRows = harness.window.document.querySelectorAll(
      "#inventory-table-body tr",
    );

    assert.equal(inventoryRows.length, 1);
    assert.match(inventoryRows[0].textContent, /Server Only Product/);

    harness.close();
  } finally {
    await server.stop();
  }
});

test("preview_server-backed inbound flow creates and persists a product", async () => {
  const server = await startPreviewServer({
    beforeStart(tempDir) {
      writeProjectJson(tempDir, path.join("data", "products.json"), []);
      writeProjectJson(tempDir, path.join("data", "stockMovements.json"), []);
      writeProjectJson(tempDir, path.join("data", "logs.json"), []);
      writeProjectJson(tempDir, path.join("data", "bills.json"), []);
      writeProjectJson(tempDir, path.join("data", "deliveryNotes.json"), []);
      writeProjectJson(tempDir, path.join("data", "suppliers.json"), [
        {
          id: "S001",
          name: "供应商",
          contactPerson: "测试联系人",
          contactPhone: "13800138000",
          address: "测试地址",
          paymentTerms: "现结",
          creditLimit: 0,
          status: "active",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]);
    },
  });

  try {
    const harness = await bootServerPage(server, { hash: "#stock-movement" });
    const { document } = harness.window;
    harness.window.showAddInboundModal();
    await flushAsyncTasks(8);
    assert.equal(harness.window.location.hash, "#business-form-workflow");

    const pendingProductInput = document.createElement("input");
    pendingProductInput.className = "ant-select-selection-search-input";
    pendingProductInput.value = "真实保存测试商品";
    document
      .getElementById("inbound-batch-product-container-1")
      .appendChild(pendingProductInput);

    changeField(
      document.querySelector("#inbound-batch-supplier-container select"),
      "S001",
      harness.window,
    );
    changeField(
      document.querySelector('[data-inbound-row="1"] [data-field="quantity"]'),
      "1",
      harness.window,
    );
    changeField(
      document.querySelector('[data-inbound-row="1"] [data-field="costPrice"]'),
      "1",
      harness.window,
    );
    changeField(
      document.querySelector(
        '[data-inbound-row="1"] [data-field="retailPrice"]',
      ),
      "1",
      harness.window,
    );
    changeField(
      document.querySelector('[data-inbound-row="1"] [data-field="unit"]'),
      "个",
      harness.window,
    );
    changeField(
      document.querySelector('[data-inbound-row="1"] [data-field="category"]'),
      "测试分类",
      harness.window,
    );

    document.getElementById("business-form-workflow-confirm").click();
    await waitFor(async () => {
      const dataset = await readServerDataset(server);
      assert.equal(dataset.products.length, 1);
      assert.equal(dataset.stockMovements.length, 1);
    });

    const savedDataset = await readServerDataset(server);
    assert.equal(savedDataset.products[0].name, "真实保存测试商品");
    assert.equal(
      Object.hasOwn(savedDataset.products[0], "stockQuantity"),
      false,
    );
    assert.equal(savedDataset.stockMovements[0].type, "inbound");
    assert.equal(savedDataset.stockMovements[0].quantity, 1);
    assert.equal(savedDataset.stockMovements[0].batchNo, "");
    assert.equal(savedDataset.stockMovements[0].expiryDate, null);

    harness.close();
  } finally {
    await server.stop();
  }
});

test("preview_server-backed sales order flow persists one atomic SQLite transaction", async () => {
  const server = await startPreviewServer({
    beforeStart(tempDir) {
      // This integration test owns its business fixtures. The application supports
      // a deliberately empty first-run dataset, so the test must not depend on the
      // mutable sample data committed under data/.
      writeProjectJson(tempDir, path.join("data", "products.json"), [
        {
          id: "P001",
          name: "Integration Test Product",
          category: "Test",
          unit: "item",
          costPrice: 10,
          retailPrice: 15,
          stockQuantity: 20,
          minStock: 5,
          maxStock: 50,
          supplierId: "S001",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]);
      writeProjectJson(tempDir, path.join("data", "customers.json"), [
        {
          id: "C001",
          name: "Integration Test Customer",
          contactPerson: "Test Contact",
          contactPhone: "13800138000",
          email: "customer@example.test",
          address: "Test Address",
          paymentTerms: "Net 30",
          creditLimit: 10000,
          status: "active",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]);
      writeProjectJson(tempDir, path.join("data", "companies.json"), [
        {
          id: "CO001",
          name: "Integration Test Company",
          contactPerson: "Test Contact",
          contactPhone: "13900139000",
          email: "company@example.test",
          address: "Test Address",
          status: "active",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        },
      ]);
    },
  });

  try {
    const originalDeliveryNotes = readServerJson(
      server,
      path.join("data", "deliveryNotes.json"),
    );
    const originalStockMovements = readServerJson(
      server,
      path.join("data", "stockMovements.json"),
    );
    const originalLogs = readServerJson(server, path.join("data", "logs.json"));

    const harness = await bootServerPage(server, { hash: "#stock-movement" });
    const { document } = harness.window;

    assert.equal(
      document.getElementById("stock-movement").classList.contains("hidden"),
      false,
    );
    assert.equal(
      document
        .getElementById("sales-order-print-panel")
        .classList.contains("hidden"),
      true,
    );

    document.getElementById("add-outbound-btn").click();
    await flushAsyncTasks(10);

    assert.equal(
      document.getElementById("sales-order").classList.contains("hidden"),
      false,
    );

    const companySelect = document.querySelector(
      "#sales-order-company-container select",
    );
    const customerSelect = document.querySelector(
      "#sales-order-customer-container select",
    );
    const productSelect = document.querySelector(
      "#sales-order-table-body select",
    );

    assert.ok(companySelect);
    assert.ok(customerSelect);
    assert.ok(productSelect);

    changeField(companySelect, "CO001", harness.window);
    changeField(customerSelect, "C001", harness.window);
    changeField(productSelect, "P001", harness.window);
    await flushAsyncTasks(8);

    const quantityInput = document.querySelector(
      '#sales-order-table-body input[type="number"]',
    );
    assert.ok(quantityInput);
    changeField(quantityInput, "2", harness.window);
    await flushAsyncTasks(8);

    await harness.window.submitSalesOrder();
    await flushAsyncTasks(12);

    await waitFor(() => {
      return readServerDataset(server).then((dataset) => {
        assert.equal(
          dataset.deliveryNotes.length,
          originalDeliveryNotes.length + 1,
        );
      });
    });

    const savedDataset = await readServerDataset(server);
    const savedProducts = savedDataset.products;
    const savedDeliveryNotes = savedDataset.deliveryNotes;
    const savedStockMovements = savedDataset.stockMovements;
    const savedLogs = savedDataset.logs;

    const latestDelivery = savedDeliveryNotes[0];
    const newStockRecords = savedStockMovements.slice(
      0,
      savedStockMovements.length - originalStockMovements.length,
    );
    const newLogs = savedLogs.slice(0, savedLogs.length - originalLogs.length);
    const savedProduct = savedProducts.find((record) => record.id === "P001");

    assert.equal(Object.hasOwn(savedProduct, "stockQuantity"), false);
    assert.equal(latestDelivery.type, "sales");
    assert.equal(latestDelivery.companyId, "CO001");
    assert.equal(latestDelivery.customerId, "C001");
    assert.match(latestDelivery.orderNo, /^XS\d{12}$/);
    assert.equal(latestDelivery.details[0].productId, "P001");
    assert.equal(latestDelivery.details[0].quantity, 2);

    assert.ok(newStockRecords.length >= 1);
    assert.equal(newStockRecords[0].type, "outbound");
    assert.equal(newStockRecords[0].productId, "P001");
    assert.equal(newStockRecords[0].quantity, 2);
    assert.equal(newStockRecords[0].deliveryNoteId, latestDelivery.id);

    assert.ok(newLogs.length >= 1);
    assert.equal(newLogs[0].objectType, "delivery-note");
    assert.equal(newLogs[0].actionType, "add");
    assert.equal(
      document.getElementById("stock-movement").classList.contains("hidden"),
      true,
    );
    assert.equal(
      document
        .getElementById("sales-order-print-panel")
        .classList.contains("hidden"),
      false,
    );

    harness.close();
  } finally {
    await server.stop();
  }
});
