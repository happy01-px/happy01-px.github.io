const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFile } = require("child_process");
const { pathToFileURL } = require("url");

const PORT = 8080;
const HOST = "127.0.0.1";
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(["127.0.0.1", "localhost"]);
const LOCAL_REMOTE_ADDRESSES = new Set([
  "127.0.0.1",
  "::1",
  "::ffff:127.0.0.1",
]);
const SPLIT_DATA_TABLES = Object.freeze([
  "products",
  "suppliers",
  "customers",
  "companies",
  "bills",
  "deliveryNotes",
  "stockMovements",
  "logs",
]);
let currentPort = PORT;
const shouldOpenBrowser =
  process.argv.includes("--open") || process.env.INVENTORY_OPEN === "1";
let browserOpened = false;

// Determine paths for packaged executable vs development
const isPkg =
  typeof (/** @type {NodeJS.Process & { pkg?: unknown }} */ (process).pkg) !==
  "undefined";

// staticBase: Immutable application files (HTML, JS, CSS)
// In development: current directory
// In pkg: snapshot filesystem (inside the exe)
const staticBase = __dirname;

// dataBase: Mutable user data
// In development: current directory
// In pkg: The directory where the executable is located (external to the exe)
const dataBase = isPkg ? path.dirname(process.execPath) : __dirname;
const runtimeDir = path.join(dataBase, ".runtime");
const serverInfoPath = path.join(runtimeDir, "server-info.json");

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

process.on("exit", removeServerInfo);
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

const fileWriteQueue = new Map();

function createBackupStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function buildBackupFilePath(targetFile) {
  const extension = path.extname(targetFile);
  const baseName = path.basename(targetFile, extension);
  const backupDir = path.join(path.dirname(targetFile), ".backups");
  return path.join(backupDir, `${baseName}.${createBackupStamp()}${extension}`);
}

function queueFileOperation(targetFile, task, callback) {
  const previous = fileWriteQueue.get(targetFile) || Promise.resolve();
  const current = previous
    .catch(() => {})
    .then(
      () =>
        new Promise((resolve, reject) => {
          task((error, value) => {
            if (error) {
              reject(error);
              return;
            }

            resolve(value);
          });
        }),
    );

  fileWriteQueue.set(targetFile, current);

  current
    .then((value) => callback(null, value))
    .catch((error) => callback(error))
    .finally(() => {
      if (fileWriteQueue.get(targetFile) === current) {
        fileWriteQueue.delete(targetFile);
      }
    });
}

function writeJsonFileAtomicallyUnqueued(targetFile, data, callback) {
  const targetDir = path.dirname(targetFile);
  const serialized = JSON.stringify(data, null, 4);
  const tempFile = path.join(
    targetDir,
    `.${path.basename(targetFile)}.${process.pid}.${Date.now()}.tmp`,
  );

  fs.mkdir(targetDir, { recursive: true }, (mkdirError) => {
    if (mkdirError) {
      callback(mkdirError);
      return;
    }

    fs.readFile(targetFile, "utf8", (readError, currentContent) => {
      if (readError && readError.code !== "ENOENT") {
        callback(readError);
        return;
      }

      const finishWithCleanup = (error) => {
        if (!error) {
          callback(null);
          return;
        }

        fs.rm(tempFile, { force: true }, () => callback(error));
      };

      const writeTempFile = () => {
        fs.writeFile(tempFile, serialized, "utf8", (writeError) => {
          if (writeError) {
            finishWithCleanup(writeError);
            return;
          }

          fs.rename(tempFile, targetFile, (renameError) => {
            if (!renameError) {
              callback(null);
              return;
            }

            if (renameError.code === "EEXIST" || renameError.code === "EPERM") {
              fs.rm(targetFile, { force: true }, (removeError) => {
                if (removeError) {
                  finishWithCleanup(removeError);
                  return;
                }

                fs.rename(tempFile, targetFile, finishWithCleanup);
              });
              return;
            }

            finishWithCleanup(renameError);
          });
        });
      };

      if (readError) {
        writeTempFile();
        return;
      }

      const backupFile = buildBackupFilePath(targetFile);
      fs.mkdir(
        path.dirname(backupFile),
        { recursive: true },
        (backupDirError) => {
          if (backupDirError) {
            callback(backupDirError);
            return;
          }

          fs.writeFile(backupFile, currentContent, "utf8", (backupError) => {
            if (backupError) {
              callback(backupError);
              return;
            }

            writeTempFile();
          });
        },
      );
    });
  });
}

function writeJsonFileAtomically(targetFile, data, callback) {
  queueFileOperation(
    targetFile,
    (done) => {
      writeJsonFileAtomicallyUnqueued(targetFile, data, done);
    },
    callback,
  );
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

  // Handle data saving endpoint
  if (request.url.startsWith("/api/save") && request.method === "POST") {
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
        const data = JSON.parse(body);

        const parts = request.url.split("/");

        if (parts.length <= 3) {
          response.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({ success: false, error: "Missing table name" }),
          );
          return;
        }

        const tableName = parts[3];
        if (!SPLIT_DATA_TABLES.includes(tableName)) {
          response.writeHead(400, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(
            JSON.stringify({ success: false, error: "Invalid table name" }),
          );
          return;
        }

        const targetFile = path.join(dataBase, "data", `${tableName}.json`);

        writeJsonFileAtomically(targetFile, data, (err) => {
          if (err) {
            console.error(`Error writing to ${targetFile}:`, err);
            response.writeHead(500, {
              "Content-Type": "application/json; charset=utf-8",
            });
            response.end(
              JSON.stringify({ success: false, error: err.message }),
            );
            return;
          }

          console.log(`Successfully saved data to ${targetFile}`);
          response.writeHead(200, {
            "Content-Type": "application/json; charset=utf-8",
          });
          response.end(JSON.stringify({ success: true }));
        });
      } catch (e) {
        console.error("Invalid JSON received:", e);
        response.writeHead(400, {
          "Content-Type": "application/json; charset=utf-8",
        });
        response.end(JSON.stringify({ success: false, error: "Invalid JSON" }));
      }
    });
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

server.listen(currentPort, HOST, onServerListening);

server.on(
  "error",
  /** @param {NodeJS.ErrnoException} e */ (e) => {
    if (e.code === "EADDRINUSE") {
      const nextPort = currentPort + 1;
      console.log(`Port ${currentPort} is in use, retrying on ${nextPort}...`);
      server.close();
      currentPort = nextPort;
      server.listen(currentPort, HOST, onServerListening);
    } else {
      console.error(e);
    }
  },
);
