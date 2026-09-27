const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { execFile } = require("child_process");
const { startPreviewServer } = require("./helpers/server-harness");

function findBrowserExecutable() {
  const candidates = [
    process.env.CHROME_PATH,
    process.env.EDGE_PATH,
    process.platform === "win32" && process.env.PROGRAMFILES
      ? path.join(
          process.env.PROGRAMFILES,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : null,
    process.platform === "win32" && process.env["PROGRAMFILES(X86)"]
      ? path.join(
          process.env["PROGRAMFILES(X86)"],
          "Microsoft",
          "Edge",
          "Application",
          "msedge.exe",
        )
      : null,
    process.platform === "win32" && process.env.LOCALAPPDATA
      ? path.join(
          process.env.LOCALAPPDATA,
          "Google",
          "Chrome",
          "Application",
          "chrome.exe",
        )
      : null,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function dumpBrowserDom(browserPath, url, profileDir) {
  return new Promise((resolve, reject) => {
    execFile(
      browserPath,
      [
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        `--user-data-dir=${profileDir}`,
        "--window-size=1365,900",
        "--virtual-time-budget=5000",
        "--dump-dom",
        url,
      ],
      { windowsHide: true, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

test("real browser boots the inventory route through the preview server", async (t) => {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    t.skip("Chrome or Edge is not installed on this machine");
    return;
  }

  const server = await startPreviewServer();
  const profileDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "inventory-browser-test-"),
  );
  try {
    const html = await dumpBrowserDom(
      browserPath,
      `${server.baseUrl}/#inventory`,
      profileDir,
    );
    assert.match(html, /<title>仓库库存管理系统<\/title>/);
    assert.match(html, /<section id="inventory" class="page-section">/);
    assert.match(
      html,
      /id="filter-status-container"[\s\S]{0,4000}ant-select/,
      "Ant Design inventory filter should complete client rendering",
    );
  } finally {
    fs.rmSync(profileDir, { recursive: true, force: true });
    await server.stop();
  }
});

test("real browser initializes and scales a directly-routed sales order", async (t) => {
  const browserPath = findBrowserExecutable();
  if (!browserPath) {
    t.skip("Chrome or Edge is not installed on this machine");
    return;
  }

  const server = await startPreviewServer();
  const profileDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "inventory-sales-order-browser-test-"),
  );
  try {
    const html = await dumpBrowserDom(
      browserPath,
      `${server.baseUrl}/#sales-order`,
      profileDir,
    );
    const viewportTag = html.match(
      /<div[^>]*id="sales-order-paper-viewport"[^>]*>/,
    )?.[0];
    const paperTag = html.match(/<div[^>]*id="sales-order-paper"[^>]*>/)?.[0];
    assert.ok(viewportTag, "the sales order viewport should exist");
    assert.match(viewportTag, /style="[^"]*height:\s*\d+px/);
    assert.match(viewportTag, /data-scale="0\.\d+"/);
    assert.ok(paperTag, "the sales order paper should exist");
    assert.match(
      paperTag,
      /style="[^"]*transform:\s*scale\(0\.\d+\)/,
      "the 1220px paper should be scaled to the available viewport",
    );
    assert.match(html, /货品保证质量/);
    assert.match(html, /第一联白仓库存收款根联/);
  } finally {
    fs.rmSync(profileDir, { recursive: true, force: true });
    await server.stop();
  }
});
