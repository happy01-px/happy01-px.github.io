const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { startPreviewServer } = require("./helpers/server-harness");
const AppDataSchema = require("../js/modules/data-schema.js");

let server;

test.before(async () => {
  server = await startPreviewServer();
});

test.after(async () => {
  await server?.stop();
});

test("preview_server serves the main page with the expected content type", async () => {
  const response = await fetch(`${server.baseUrl}/`);
  const html = await response.text();

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(html, /<html/);
});

test("preview_server rejects non-local requests based on origin headers", async () => {
  const response = await fetch(`${server.baseUrl}/`, {
    headers: {
      Origin: "http://evil.example",
    },
  });

  assert.equal(response.status, 403);
});

test("preview_server exposes the authoritative dataset snapshot", async () => {
  const response = await fetch(`${server.baseUrl}/api/data-all`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.formatVersion, 4);
  assert.equal(body.revision, 0);
  assert.ok(Array.isArray(body.dataset.products));
  assert.ok(Array.isArray(body.dataset.logs));
});

test("preview_server migrates the latest legacy snapshot into SQLite once", async () => {
  const migrationServer = await startPreviewServer({
    beforeStart(tempDir) {
      const rawDataset = Object.fromEntries(
        AppDataSchema.DATA_TABLES.map((tableName) => [
          tableName,
          JSON.parse(
            fs.readFileSync(
              path.join(tempDir, "data", `${tableName}.json`),
              "utf8",
            ),
          ),
        ]),
      );
      const dataset = AppDataSchema.migrateDataset(rawDataset);
      dataset.companies[0].name = "SQLite Migration Company";
      const snapshotsDir = path.join(tempDir, "data", ".snapshots");
      fs.mkdirSync(snapshotsDir, { recursive: true });
      fs.writeFileSync(
        path.join(
          snapshotsDir,
          "dataset.000000000012.2026-09-26T00-00-00-000Z.json",
        ),
        JSON.stringify({
          formatVersion: AppDataSchema.DATA_FORMAT_VERSION,
          revision: 12,
          updatedAt: "2026-09-26T00:00:00.000Z",
          dataset,
        }),
        "utf8",
      );
    },
  });

  try {
    const response = await fetch(`${migrationServer.baseUrl}/api/data-all`);
    const snapshot = await response.json();
    assert.equal(response.status, 200);
    assert.equal(snapshot.revision, 12);
    assert.equal(
      snapshot.dataset.companies[0].name,
      "SQLite Migration Company",
    );
    assert.equal(
      fs.existsSync(
        path.join(migrationServer.tempDir, "data", "inventory.sqlite"),
      ),
      true,
    );
  } finally {
    await migrationServer.stop();
  }
});

test("preview_server disables unsafe per-table writes", async () => {
  const response = await fetch(`${server.baseUrl}/api/save/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([]),
  });

  const body = await response.json();

  assert.equal(response.status, 410);
  assert.match(body.error, /disabled/);
});

test("preview_server commits incremental changes to SQLite", async () => {
  const initialResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const initial = await initialResponse.json();
  const product = {
    id: "P-BATCH",
    name: "Batch Product",
    category: "办公设备",
    unit: "件",
    costPrice: 10,
    retailPrice: 20,
    minStock: 1,
    maxStock: 20,
    supplierId: initial.dataset.suppliers[0].id,
    status: "active",
    createdAt: "2026-09-25T10:00:00",
    updatedAt: "2026-09-25T10:00:00",
  };

  const response = await fetch(`${server.baseUrl}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formatVersion: 4,
      expectedRevision: initial.revision,
      changes: {
        products: {
          upsert: [product],
          delete: [],
          order: [
            product.id,
            ...initial.dataset.products.map((record) => record.id),
          ],
        },
      },
    }),
  });
  const body = await response.json();
  const savedResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const savedSnapshot = await savedResponse.json();
  const databasePath = path.join(server.tempDir, "data", "inventory.sqlite");
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const storedRow = database
    .prepare(
      "SELECT payload_json FROM business_records WHERE table_name = ? AND record_id = ?",
    )
    .get("products", product.id);
  database.close();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.revision, initial.revision + 1);
  assert.equal(savedSnapshot.dataset.products[0].id, "P-BATCH");
  assert.equal(
    JSON.parse(String(storedRow.payload_json)).name,
    "Batch Product",
  );

  const invalidResponse = await fetch(`${server.baseUrl}/api/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formatVersion: 4,
      expectedRevision: body.revision,
      changes: {
        products: {
          upsert: [{ ...product, retailPrice: -1 }],
          delete: [],
        },
      },
    }),
  });
  const invalidBody = await invalidResponse.json();

  assert.equal(invalidResponse.status, 400);
  assert.match(invalidBody.error, /retailPrice/);
});

test("preview_server rejects stale revisions without changing data", async () => {
  const currentResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const current = await currentResponse.json();
  const response = await fetch(`${server.baseUrl}/api/save-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formatVersion: 4,
      expectedRevision: Math.max(0, current.revision - 1),
      dataset: current.dataset,
    }),
  });
  const body = await response.json();

  assert.equal(response.status, 409);
  assert.equal(body.currentRevision, current.revision);
});

test("preview_server serializes simultaneous saves from multiple windows", async () => {
  const currentResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const current = await currentResponse.json();
  const firstDataset = structuredClone(current.dataset);
  const secondDataset = structuredClone(current.dataset);
  firstDataset.logs.push({
    id: "LOG-CONCURRENT-A",
    userId: "U-A",
    userName: "窗口 A",
    actionType: "edit",
    objectType: "system",
    objectName: "并发保存 A",
    details: "窗口 A 并发保存",
    ipAddress: "127.0.0.1",
    timestamp: "2026-09-25T10:00:00.000Z",
  });
  secondDataset.logs.push({
    id: "LOG-CONCURRENT-B",
    userId: "U-B",
    userName: "窗口 B",
    actionType: "edit",
    objectType: "system",
    objectName: "并发保存 B",
    details: "窗口 B 并发保存",
    ipAddress: "127.0.0.1",
    timestamp: "2026-09-25T10:00:01.000Z",
  });

  const save = (dataset) =>
    fetch(`${server.baseUrl}/api/save-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatVersion: 4,
        expectedRevision: current.revision,
        dataset,
      }),
    });
  const responses = await Promise.all([
    save(firstDataset),
    save(secondDataset),
  ]);
  const statuses = responses.map((response) => response.status).sort();
  const latestResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const latest = await latestResponse.json();
  const concurrentLogIds = latest.dataset.logs
    .map((entry) => entry.id)
    .filter((id) => id.startsWith("LOG-CONCURRENT-"));

  assert.deepEqual(statuses, [200, 409]);
  assert.equal(latest.revision, current.revision + 1);
  assert.equal(concurrentLogIds.length, 1);
});

test("preview_server rejects invalid fields and broken references", async () => {
  const currentResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const current = await currentResponse.json();
  const invalidFields = structuredClone(current.dataset);
  invalidFields.products[0].retailPrice = -1;

  const invalidFieldResponse = await fetch(`${server.baseUrl}/api/save-all`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      formatVersion: 4,
      expectedRevision: current.revision,
      dataset: invalidFields,
    }),
  });
  const invalidFieldBody = await invalidFieldResponse.json();
  assert.equal(invalidFieldResponse.status, 400);
  assert.match(invalidFieldBody.error, /retailPrice/);

  const brokenReference = structuredClone(current.dataset);
  brokenReference.products[0].supplierId = "MISSING-SUPPLIER";
  const brokenReferenceResponse = await fetch(
    `${server.baseUrl}/api/save-all`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatVersion: 4,
        expectedRevision: current.revision,
        dataset: brokenReference,
      }),
    },
  );
  const brokenReferenceBody = await brokenReferenceResponse.json();
  assert.equal(brokenReferenceResponse.status, 400);
  assert.match(brokenReferenceBody.error, /missing supplier/);
});

test("preview_server ignores an incomplete newer snapshot", async () => {
  const currentResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const current = await currentResponse.json();
  const snapshotDir = path.join(server.tempDir, "data", ".snapshots");
  fs.mkdirSync(snapshotDir, { recursive: true });
  fs.writeFileSync(
    path.join(snapshotDir, "dataset.999999999999.incomplete.json"),
    '{"formatVersion":2,"revision":999999999999,"dataset":',
    "utf8",
  );

  const recoveredResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const recovered = await recoveredResponse.json();
  assert.equal(recoveredResponse.status, 200);
  assert.equal(recovered.revision, current.revision);
  assert.deepEqual(recovered.dataset, current.dataset);
});

test("preview_server records committed revisions in the SQLite transaction journal", async () => {
  let currentResponse = await fetch(`${server.baseUrl}/api/data-all`);
  let current = await currentResponse.json();

  for (let index = 0; index < 22; index += 1) {
    const saveResponse = await fetch(`${server.baseUrl}/api/save-all`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        formatVersion: 4,
        expectedRevision: current.revision,
        dataset: current.dataset,
      }),
    });
    assert.equal(saveResponse.status, 200);
    const saved = await saveResponse.json();
    current = { ...current, revision: saved.revision };
  }

  const database = new DatabaseSync(
    path.join(server.tempDir, "data", "inventory.sqlite"),
    { readOnly: true },
  );
  const journal = database
    .prepare(
      "SELECT COUNT(*) AS count, MAX(revision) AS maxRevision FROM business_transactions",
    )
    .get();
  database.close();
  assert.ok(Number(journal.count) >= 22);
  assert.equal(Number(journal.maxRevision), current.revision);

  currentResponse = await fetch(`${server.baseUrl}/api/data-all`);
  const latest = await currentResponse.json();
  assert.equal(latest.revision, current.revision);
});

test("preview_server returns 400 for invalid save targets and bad export payloads", async () => {
  const badTableResponse = await fetch(`${server.baseUrl}/api/save/bad-name`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify([]),
  });
  const badExportResponse = await fetch(`${server.baseUrl}/api/export/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ filename: "statement" }),
  });

  const badTableBody = await badTableResponse.json();
  const badExportBody = await badExportResponse.json();

  assert.equal(badTableResponse.status, 410);
  assert.match(badTableBody.error, /disabled/);
  assert.equal(badExportResponse.status, 400);
  assert.match(badExportBody.error, /Missing export html/);
});
