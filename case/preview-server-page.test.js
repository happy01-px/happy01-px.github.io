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
  const server = await startPreviewServer();

  try {
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
    fs.writeFileSync(
      path.join(server.tempDir, "data", "products.json"),
      JSON.stringify(serverOnlyProduct, null, 4),
      "utf8",
    );

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

test("preview_server-backed sales order flow persists server-side files through api/save", async () => {
  const server = await startPreviewServer();

  try {
    const originalProducts = readServerJson(
      server,
      path.join("data", "products.json"),
    );
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
      const deliveryNotes = readServerJson(
        server,
        path.join("data", "deliveryNotes.json"),
      );
      assert.equal(deliveryNotes.length, originalDeliveryNotes.length + 1);
    });

    const savedProducts = readServerJson(
      server,
      path.join("data", "products.json"),
    );
    const savedDeliveryNotes = readServerJson(
      server,
      path.join("data", "deliveryNotes.json"),
    );
    const savedStockMovements = readServerJson(
      server,
      path.join("data", "stockMovements.json"),
    );
    const savedLogs = readServerJson(server, path.join("data", "logs.json"));

    const latestDelivery = savedDeliveryNotes[0];
    const newStockRecords = savedStockMovements.slice(
      0,
      savedStockMovements.length - originalStockMovements.length,
    );
    const newLogs = savedLogs.slice(0, savedLogs.length - originalLogs.length);
    const originalProduct = originalProducts.find(
      (record) => record.id === "P001",
    );
    const savedProduct = savedProducts.find((record) => record.id === "P001");

    assert.equal(savedProduct.stockQuantity, originalProduct.stockQuantity - 2);
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
      false,
    );

    harness.close();
  } finally {
    await server.stop();
  }
});
