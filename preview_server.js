const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { pathToFileURL } = require("url");
const AppDataSchema = require("./js/modules/data-schema.js");
const { SQLiteInventoryStore } = require("./server/sqlite-store.js");

const PORT = 8080;
const HOST = "127.0.0.1";
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost"]);
const LOCAL_REMOTE_ADDRESSES = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);
const SPLIT_DATA_TABLES = AppDataSchema.DATA_TABLES;
let currentPort = PORT;
const shouldOpenBrowser =
  process.env.INVENTORY_DESKTOP !== "1" &&
  (process.argv.includes("--open") || process.env.INVENTORY_OPEN === "1");
let browserOpened = false;
let startPromise = null;

// Determine paths for packaged executable vs development
const isPkg =
  typeof (/** @type {NodeJS.Process & { pkg?: unknown }} */ (process).pkg) !==
  "undefined";

// staticBase: Immutable application files (HTML, JS, CSS)
// In development: current directory
// In pkg: snapshot filesystem (inside the exe)
const staticBase = process.env.INVENTORY_STATIC_DIR
  ? path.resolve(process.env.INVENTORY_STATIC_DIR)
  : __dirname;

// dataBase: Mutable user data. Packaged applications must not write next to the
// executable because that directory can be read-only and can be replaced by an
// upgrade. Development keeps data in the repository for compatibility.
const packagedDataBase = path.join(
  process.env.LOCALAPPDATA || os.homedir(),
  "Happy01Inventory",
);
const dataBase = process.env.INVENTORY_DATA_DIR
  ? path.resolve(process.env.INVENTORY_DATA_DIR)
  : isPkg
    ? packagedDataBase
    : __dirname;
const legacyDataBase = isPkg ? path.dirname(process.execPath) : __dirname;
const runtimeDir = path.join(dataBase, ".runtime");
const serverInfoPath = path.join(runtimeDir, "server-info.json");
const sqlitePath = path.join(dataBase, "data", "inventory.sqlite");
let sqliteStore;

console.log(`Server starting...`);
console.log(`Static Base (App): ${staticBase}`);
console.log(`Data Base (User): ${dataBase}`);

function writeServerInfo(url) {
  try {
    fs.mkdirSync(runtimeDir, { recursive: true });
    fs.writeFileSync(
      serverInfoPath,
      JSON.stringify(
        {
          pid: process.pid,
          host: HOST,
          port: currentPort,
          url,
          startedAt: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.warn(`Failed to write server info: ${error.message}`);
  }
}

function removeServerInfo() {
  try {
    if (fs.existsSync(serverInfoPath)) {
      const currentInfo = JSON.parse(fs.readFileSync(serverInfoPath, "utf8"));
      if (currentInfo.pid && currentInfo.pid !== process.pid) return;
      fs.unlinkSync(serverInfoPath);
    }
  } catch (error) {
    console.warn(`Failed to remove server info: ${error.message}`);
  }
}

process.on("exit", () => {
  sqliteStore?.close();
  removeServerInfo();
});
["SIGINT", "SIGTERM"].forEach((signal) => {
  process.on(signal, () => {
    removeServerInfo();
    process.exit(0);
  });
});

function openBrowser(url) {
  if (!shouldOpenBrowser || browserOpened) return;
  browserOpened = true;

  const command =
    process.platform === "win32"
      ? "cmd"
      : process.platform === "darwin"
        ? "open"
        : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];

  execFile(command, args, { windowsHide: true }, (error) => {
    if (error) {
      console.warn(`Failed to open browser automatically: ${error.message}`);
    }
  });
}

function onServerListening() {
  const url = `http://${HOST}:${currentPort}/`;
  console.log(`Server running at ${url}`);
  writeServerInfo(url);
  openBrowser(url);
}

const mimeTypes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "application/font-woff",
  ".woff2": "font/woff2",
  ".ttf": "application/font-ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "application/font-otf",
  ".wasm": "application/wasm",
};

function isLocalHostname(hostname) {
  return LOCAL_HOSTNAMES.has(hostname);
}

function getHostnameFromHeader(value) {
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isLocalRequest(request) {
  const remoteAddress = request.socket.remoteAddress;
  if (remoteAddress && !LOCAL_REMOTE_ADDRESSES.has(remoteAddress)) {
    return false;
  }

  const hostHeader = request.headers.host;
  if (hostHeader) {
    const hostName = hostHeader.split(":")[0];
    if (!isLocalHostname(hostName)) {
      return false;
    }
  }

  const originHostname = getHostnameFromHeader(request.headers.origin);
  if (request.headers.origin && !originHostname) {
    return false;
  }
  if (originHostname && !isLocalHostname(originHostname)) {
    return false;
  }

  const refererHostname = getHostnameFromHeader(request.headers.referer);
  if (request.headers.referer && !refererHostname) {
    return false;
  }
  if (refererHostname && !isLocalHostname(refererHostname)) {
    return false;
  }

  return true;
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const originHostname = getHostnameFromHeader(origin);

  if (origin && originHostname && isLocalHostname(originHostname)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
  }

  response.setHeader("Access-Control-Allow-Methods", "OPTIONS, GET, POST");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getResponseContentType(contentType) {
  if (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType === "text/javascript" ||
    contentType === "image/svg+xml"
  ) {
    return `${contentType}; charset=utf-8`;
  }

  return contentType;
}

function sanitizeDownloadName(name, fallbackExt) {
  const cleaned = String(name || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return `export${fallbackExt || ""}`;
  }

  if (
    fallbackExt &&
    !cleaned.toLowerCase().endsWith(fallbackExt.toLowerCase())
  ) {
    return `${cleaned}${fallbackExt}`;
  }

  return cleaned;
}

function getPdfBrowserCandidates() {
  const localAppData = process.env.LOCALAPPDATA || "";
  const programFiles = process.env.ProgramFiles || "";
  const programFilesX86 =
    process.env["ProgramFiles(x86)"] ||
    process.env["ProgramFiles(x86)".replace(/[()]/g, "")] ||
    "";

  return [
    path.join(
      programFilesX86,
      "Microsoft",
      "Edge",
      "Application",
      "msedge.exe",
    ),
    path.join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(localAppData, "Microsoft", "Edge", "Application", "msedge.exe"),
    path.join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(localAppData, "Google", "Chrome", "Application", "chrome.exe"),
  ].filter(Boolean);
}

function resolvePdfBrowserExecutable() {
  for (const candidate of getPdfBrowserCandidates()) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function cleanupTempDir(tempDir) {
  if (!tempDir) return;
  fs.rm(tempDir, { recursive: true, force: true }, () => {});
}

function validateDatasetPayload(dataset) {
  return AppDataSchema.validateDataset(dataset);
}

function parseSnapshotRevision(fileName) {
  const match = /^dataset\.(\d{12})\..+\.json$/.exec(fileName);
  return match ? Number(match[1]) : null;
}

async function readLegacySplitDataset() {
  const rawDataset = {};
  for (const tableName of SPLIT_DATA_TABLES) {
    const relativePath = path.join("data", `${tableName}.json`);
    const candidates = [dataBase, legacyDataBase, staticBase]
      .map((basePath) => path.join(basePath, relativePath))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    let raw = null;
    let lastError = null;
    for (const candidate of candidates) {
      try {
        raw = await fs.promises.readFile(candidate, "utf8");
        break;
      } catch (error) {
        lastError = error;
        if (error.code !== "ENOENT") throw error;
      }
    }
    if (raw === null) throw lastError || new Error(`Missing ${relativePath}`);
    rawDataset[tableName] = JSON.parse(raw);
  }
  const dataset = AppDataSchema.migrateDataset(rawDataset);
  const validationError = validateDatasetPayload(dataset);
  if (validationError) throw new Error(validationError);
  return {
    formatVersion: AppDataSchema.DATA_FORMAT_VERSION,
    revision: 0,
    updatedAt: null,
    dataset,
  };
}

async function readLatestLegacyDatasetSnapshot() {
  const snapshotDirs = [dataBase, legacyDataBase]
    .map((basePath) => path.join(basePath, "data", ".snapshots"))
    .filter((candidate, index, all) => all.indexOf(candidate) === index);
  const candidates = [];

  for (const snapshotsDir of snapshotDirs) {
    let entries = [];
    try {
      entries = await fs.promises.readdir(snapshotsDir);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    entries.forEach((fileName) => {
      candidates.push({
        snapshotsDir,
        fileName,
        revision: parseSnapshotRevision(fileName),
      });
    });
  }

  const sortedCandidates = candidates
    .filter((entry) => Number.isInteger(entry.revision))
    .sort(
      (a, b) => b.revision - a.revision || b.fileName.localeCompare(a.fileName),
    );

  for (const candidate of sortedCandidates) {
    try {
      const raw = await fs.promises.readFile(
        path.join(candidate.snapshotsDir, candidate.fileName),
        "utf8",
      );
      const snapshot = JSON.parse(raw);
      if (snapshot.revision !== candidate.revision) {
        throw new Error("Snapshot revision does not match its filename");
      }
      const migratedDataset = AppDataSchema.migrateDataset(snapshot.dataset);
      const validationError = validateDatasetPayload(migratedDataset);
      if (validationError) throw new Error(validationError);
      return {
        ...snapshot,
        formatVersion: AppDataSchema.DATA_FORMAT_VERSION,
        dataset: migratedDataset,
      };
    } catch (error) {
      console.warn(
        `Ignoring invalid dataset snapshot ${candidate.fileName}:`,
        error.message,
      );
    }
  }

  return readLegacySplitDataset();
}

async function readLatestDatasetSnapshot() {
  if (!sqliteStore) {
    throw new Error("SQLite inventory store is not initialized");
  }
  return sqliteStore.readSnapshot();
}

function writeDatasetAtomically(dataset, expectedRevision, callback) {
  try {
    const snapshot = sqliteStore.replaceDataset(dataset, expectedRevision);
    callback(null, snapshot);
  } catch (error) {
    callback(error);
  }
}

function runBrowserPdfExport(
  browserPath,
  htmlPath,
  pdfPath,
  useNewHeadless,
  callback,
) {
  const headlessArg = useNewHeadless ? "--headless=new" : "--headless";
  const args = [
    headlessArg,
    "--disable-gpu",
    "--disable-extensions",
    "--no-first-run",
    "--no-default-browser-check",
    "--allow-file-access-from-files",
    "--no-pdf-header-footer",
    "--print-to-pdf-no-header",
    `--print-to-pdf=${pdfPath}`,
    "--run-all-compositor-stages-before-draw",
    "--virtual-time-budget=2000",
    pathToFileURL(htmlPath).href,
  ];

  execFile(
    browserPath,
    args,
    { windowsHide: true },
    (error, stdout, stderr) => {
      if (!error) {
        callback(null);
        return;
      }

      if (useNewHeadless) {
        runBrowserPdfExport(browserPath, htmlPath, pdfPath, false, callback);
        return;
      }

      const details = [error.message, stderr, stdout]
        .filter(Boolean)
        .join("\n")
        .trim();
      callback(new Error(details || "Failed to export PDF"));
    },
  );
}

function exportHtmlToPdf(html, filename, callback) {
  const browserPath = resolvePdfBrowserExecutable();
  if (!browserPath) {
    callback(new Error("No Edge or Chrome executable found for PDF export."));
    return;
  }

  fs.mkdtemp(
    path.join(os.tmpdir(), "inventory-bill-pdf-"),
    (tempErr, tempDir) => {
      if (tempErr) {
        callback(tempErr);
        return;
      }

      const safeFileBase = sanitizeDownloadName(filename, ".pdf").replace(
        /\.pdf$/i,
        "",
      );
      const htmlPath = path.join(tempDir, `${safeFileBase}.html`);
      const pdfPath = path.join(tempDir, `${safeFileBase}.pdf`);

      fs.writeFile(htmlPath, html, "utf8", (writeErr) => {
        if (writeErr) {
          cleanupTempDir(tempDir);
          callback(writeErr);
          return;
        }

        runBrowserPdfExport(
          browserPath,
          htmlPath,
          pdfPath,
          true,
          (exportErr) => {
            if (exportErr) {
              cleanupTempDir(tempDir);
              callback(exportErr);
              return;
            }

            fs.readFile(pdfPath, (readErr, pdfBuffer) => {
              cleanupTempDir(tempDir);
              if (readErr) {
                callback(readErr);
                return;
              }
              callback(null, pdfBuffer);
            });
          },
        );
      });
    },
  );
}

const server = http.createServer(function (request, response) {
  console.log("request ", request.method, request.url);

  if (!isLocalRequest(request)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  applyCorsHeaders(request, response);

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!["GET", "POST"].includes(request.method)) {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method Not Allowed");
    return;
  }

  if (request.url === "/api/export/pdf" && request.method === "POST") {
    let body = "";
    let bodyTooLarge = false;

    request.on("data", (chunk) => {
      if (bodyTooLarge) return;
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        response.writeHead(413, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({ success: false, error: "Payload too large" }),
        );
        request.destroy();
      }
    });

    request.on("end", () => {
      if (bodyTooLarge) return;

      try {
        const payload = JSON.parse(body || "{}");
        const html = String(payload.html || "").trim();
        const filename = sanitizeDownloadName(
          payload.filename || "statement.pdf",
          ".pdf",
        );

        if (!html) {
          response.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({ success: false, error: "Missing export html" }),
          );
          return;
        }

        exportHtmlToPdf(html, filename, (error, pdfBuffer) => {
          if (error) {
            console.error("PDF export failed:", error);
            response.writeHead(500, {
              "Content-Type": "application/json; charset=utf-8",
            });
            response.end(
              JSON.stringify({
                success: false,
                error: error.message || "Failed to export PDF",
              }),
            );
            return;
          }

          response.writeHead(200, {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
          });
          response.end(pdfBuffer);
        });
      } catch (error) {
        console.error("Invalid PDF export payload:", error);
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify({ success: false, error: "Invalid JSON" }));
      }
    });
    return;
  }

  if (request.url === "/api/data-all" && request.method === "GET") {
    readLatestDatasetSnapshot()
      .then((snapshot) => {
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Cache-Control": "no-store",
        });
        response.end(JSON.stringify(snapshot));
      })
      .catch((error) => {
        console.error("Error reading dataset:", error);
        response.writeHead(500, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to read dataset",
          }),
        );
      });
    return;
  }

  if (request.url === "/api/transactions" && request.method === "POST") {
    let body = "";
    let bodyTooLarge = false;
    request.on("data", (chunk) => {
      if (bodyTooLarge) return;
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        response.writeHead(413, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({ success: false, error: "Payload too large" }),
        );
        request.destroy();
      }
    });
    request.on("end", () => {
      if (bodyTooLarge) return;
      try {
        const payload = JSON.parse(body || "{}");
        const expectedRevision = Number(payload.expectedRevision);
        if (
          payload.formatVersion !== AppDataSchema.DATA_FORMAT_VERSION ||
          !Number.isInteger(expectedRevision) ||
          expectedRevision < 0
        ) {
          response.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({
              success: false,
              error:
                "A supported formatVersion and expectedRevision are required",
            }),
          );
          return;
        }

        const snapshot = sqliteStore.commitChanges(
          payload.changes,
          expectedRevision,
        );
        response.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            success: true,
            revision: snapshot.revision,
            updatedAt: snapshot.updatedAt,
          }),
        );
      } catch (error) {
        const status = error.code === "REVISION_CONFLICT" ? 409 : 400;
        if (status === 409) {
          console.warn("SQLite transaction revision conflict:", error.message);
        } else {
          console.error("SQLite transaction rejected:", error);
        }
        response.writeHead(status, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({
            success: false,
            error: error.message || "Failed to commit transaction",
            currentRevision: error.currentRevision,
          }),
        );
      }
    });
    return;
  }

  if (request.url === "/api/save-all" && request.method === "POST") {
    let body = "";
    let bodyTooLarge = false;
    request.on("data", (chunk) => {
      if (bodyTooLarge) return;
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        response.writeHead(413, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(
          JSON.stringify({ success: false, error: "Payload too large" }),
        );
        request.destroy();
      }
    });
    request.on("end", () => {
      if (bodyTooLarge) return;
      try {
        const payload = JSON.parse(body || "{}");
        const dataset = payload.dataset;
        const expectedRevision = Number(payload.expectedRevision);
        if (
          payload.formatVersion !== AppDataSchema.DATA_FORMAT_VERSION ||
          !Number.isInteger(expectedRevision) ||
          expectedRevision < 0
        ) {
          response.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({
              success: false,
              error:
                "A supported formatVersion and expectedRevision are required",
            }),
          );
          return;
        }
        const validationError = validateDatasetPayload(dataset);
        if (validationError) {
          response.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({ success: false, error: validationError }),
          );
          return;
        }

        writeDatasetAtomically(dataset, expectedRevision, (error, snapshot) => {
          if (error) {
            console.error("Error writing dataset:", error);
            response.writeHead(error.code === "REVISION_CONFLICT" ? 409 : 500, {
              "Content-Type": "application/json; charset=utf-8",
            });
            response.end(
              JSON.stringify({
                success: false,
                error: error.message || "Failed to save dataset",
                currentRevision: error.currentRevision,
              }),
            );
            return;
          }

          response.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({
              success: true,
              revision: snapshot.revision,
              updatedAt: snapshot.updatedAt,
            }),
          );
        });
      } catch {
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify({ success: false, error: "Invalid JSON" }));
      }
    });
    return;
  }

  // Per-table writes are disabled because they bypass cross-table validation
  // and cannot provide a consistent business transaction.
  if (request.url.startsWith("/api/save") && request.method === "POST") {
    response.writeHead(410, {
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(
      JSON.stringify({
        success: false,
        error: "Per-table save endpoints are disabled; use /api/transactions",
      }),
    );
    return;
  }

  // Handle File Serving
  let urlPath = request.url.split("?")[0];
  if (urlPath === "/") {
    urlPath = "/index.html";
  }

  // Prevent directory traversal
  if (urlPath.includes("..")) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  // Strategy:
  // 1. If requesting /data/..., try to serve from dataBase (external disk) first.
  // 2. Fallback to staticBase (bundled assets).

  let servePath = null;

  if (urlPath.startsWith("/data/")) {
    const externalPath = path.join(dataBase, urlPath.replace(/^\/+/, ""));
    if (fs.existsSync(externalPath)) {
      servePath = externalPath;
    }
  }

  if (!servePath) {
    servePath = path.join(staticBase, urlPath.replace(/^\/+/, ""));
  }

  const extname = String(path.extname(servePath)).toLowerCase();
  const contentType = mimeTypes[extname] || "application/octet-stream";

  fs.readFile(servePath, function (error, content) {
    if (error) {
      if (error.code == "ENOENT") {
        response.writeHead(404, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end("404 Not Found: " + urlPath, "utf-8");
      } else {
        response.writeHead(500, {
          "Content-Type": "text/plain; charset=utf-8",
        });
        response.end("Server Error: " + error.code);
      }
    } else {
      // Disable caching for development/real-time updates
      response.setHeader(
        "Cache-Control",
        "no-cache, no-store, must-revalidate",
      );
      response.setHeader("Pragma", "no-cache");
      response.setHeader("Expires", "0");

      response.writeHead(200, {
        "Content-Type": getResponseContentType(contentType),
      });
      response.end(content, "utf-8");
    }
  });
});

async function initializePersistence() {
  sqliteStore = new SQLiteInventoryStore({
    filePath: sqlitePath,
    dataTables: SPLIT_DATA_TABLES,
    formatVersion: AppDataSchema.DATA_FORMAT_VERSION,
    validateDataset: validateDatasetPayload,
  });

  const seedSnapshot = sqliteStore.isInitialized()
    ? undefined
    : await readLatestLegacyDatasetSnapshot();
  const snapshot = sqliteStore.initialize(seedSnapshot);
  console.log(`SQLite database: ${sqlitePath}`);
  console.log(`SQLite dataset revision: ${snapshot.revision}`);
}

function listenOnAvailablePort() {
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const onListening = () => {
        server.removeListener("error", onError);
        onServerListening();
        resolve({
          server,
          host: HOST,
          port: currentPort,
          url: `http://${HOST}:${currentPort}/`,
          dataBase,
          sqlitePath,
        });
      };
      const onError = /** @param {NodeJS.ErrnoException} error */ (error) => {
        server.removeListener("listening", onListening);
        if (error.code === "EADDRINUSE") {
          const nextPort = currentPort + 1;
          console.log(
            `Port ${currentPort} is in use, retrying on ${nextPort}...`,
          );
          currentPort = nextPort;
          attempt();
          return;
        }
        reject(error);
      };

      server.once("listening", onListening);
      server.once("error", onError);
      server.listen(currentPort, HOST);
    };

    attempt();
  });
}

function startInventoryServer() {
  if (startPromise) return startPromise;
  startPromise = initializePersistence()
    .then(() => listenOnAvailablePort())
    .catch((error) => {
      startPromise = null;
      throw error;
    });
  return startPromise;
}

async function stopInventoryServer() {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  sqliteStore?.close();
  sqliteStore = null;
  removeServerInfo();
}

if (require.main === module) {
  startInventoryServer().catch((error) => {
    console.error("Failed to initialize SQLite persistence:", error);
    process.exitCode = 1;
  });
}

module.exports = {
  startInventoryServer,
  stopInventoryServer,
};
