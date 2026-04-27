const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { startPreviewServer } = require("./helpers/server-harness");

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

test("preview_server saves posted table data to the data directory", async () => {
  const payload = [
    {
      id: "P900",
      name: "Saved Product",
    },
  ];
  const response = await fetch(`${server.baseUrl}/api/save/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json();
  const savedFile = path.join(server.tempDir, "data", "products.json");
  const savedContent = JSON.parse(fs.readFileSync(savedFile, "utf8"));

  assert.equal(response.status, 200);
  assert.deepEqual(body, { success: true });
  assert.equal(savedContent[0].name, "Saved Product");
});

test("preview_server creates timestamped backups when overwriting saved data", async () => {
  const firstPayload = [
    {
      id: "P901",
      name: "Original Product",
    },
  ];
  const secondPayload = [
    {
      id: "P901",
      name: "Updated Product",
    },
  ];
  const targetFile = path.join(server.tempDir, "data", "products.json");
  const backupDir = path.join(server.tempDir, "data", ".backups");

  await fetch(`${server.baseUrl}/api/save/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(firstPayload),
  });

  const overwriteResponse = await fetch(`${server.baseUrl}/api/save/products`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(secondPayload),
  });

  const overwriteBody = await overwriteResponse.json();
  const savedContent = JSON.parse(fs.readFileSync(targetFile, "utf8"));
  const backupFiles = fs.existsSync(backupDir) ? fs.readdirSync(backupDir) : [];
  const latestBackupFile = backupFiles
    .filter((file) => /^products\..+\.json$/.test(file))
    .sort()
    .at(-1);
  const latestBackupContent = latestBackupFile
    ? JSON.parse(
        fs.readFileSync(path.join(backupDir, latestBackupFile), "utf8"),
      )
    : null;

  assert.equal(overwriteResponse.status, 200);
  assert.deepEqual(overwriteBody, { success: true });
  assert.equal(savedContent[0].name, "Updated Product");
  assert.equal(Array.isArray(latestBackupContent), true);
  assert.equal(latestBackupContent[0].name, "Original Product");
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

  assert.equal(badTableResponse.status, 400);
  assert.match(badTableBody.error, /Invalid table name/);
  assert.equal(badExportResponse.status, 400);
  assert.match(badExportBody.error, /Missing export html/);
});
