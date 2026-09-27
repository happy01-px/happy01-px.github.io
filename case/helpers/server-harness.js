const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { projectRoot } = require("./browser-harness");

const SERVER_FILES = [
  "preview_server.js",
  "server",
  "index.html",
  "assets",
  "css",
  "js",
  "lib",
  "data",
];

function copyProjectForServer() {
  const tempDir = fs.mkdtempSync(
    path.join(os.tmpdir(), "inventory-server-test-"),
  );

  SERVER_FILES.forEach((entry) => {
    const source = path.join(projectRoot, entry);
    const target = path.join(tempDir, entry);
    const stat = fs.statSync(source);

    if (stat.isDirectory()) {
      fs.cpSync(source, target, { recursive: true });
      return;
    }

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
  });

  // Runtime snapshots belong to the active local preview and must never leak
  // into an isolated server test fixture.
  const copiedDataRoot = path.resolve(tempDir, "data");
  const copiedSnapshots = path.resolve(copiedDataRoot, ".snapshots");
  if (
    copiedSnapshots.startsWith(`${copiedDataRoot}${path.sep}`) &&
    fs.existsSync(copiedSnapshots)
  ) {
    fs.rmSync(copiedSnapshots, { recursive: true, force: true });
  }

  // The active preview may have a live SQLite database beside the JSON seeds.
  // Isolated server tests must always initialize from their copied fixtures.
  ["inventory.sqlite", "inventory.sqlite-shm", "inventory.sqlite-wal"].forEach(
    (fileName) => {
      const copiedDatabaseFile = path.resolve(copiedDataRoot, fileName);
      if (copiedDatabaseFile.startsWith(`${copiedDataRoot}${path.sep}`)) {
        fs.rmSync(copiedDatabaseFile, { force: true });
      }
    },
  );

  return tempDir;
}

function startPreviewServer(options = {}) {
  const tempDir = copyProjectForServer();

  if (typeof options.beforeStart === "function") {
    options.beforeStart(tempDir);
  }

  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["preview_server.js"], {
      cwd: tempDir,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let settled = false;
    let stdoutBuffer = "";
    let stderrBuffer = "";
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error("Timed out waiting for preview_server.js to start."));
    }, 15000);

    const onData = (chunk) => {
      stdoutBuffer += chunk.toString();
      const match = stdoutBuffer.match(
        /Server running at http:\/\/127\.0\.0\.1:(\d+)\//,
      );
      if (!match || settled) return;

      settled = true;
      clearTimeout(timeoutId);

      resolve({
        baseUrl: `http://127.0.0.1:${match[1]}`,
        tempDir,
        stdout: stdoutBuffer,
        async stop() {
          if (!child.killed) {
            await new Promise((stopResolve) => {
              child.once("exit", () => stopResolve());
              child.kill();
            });
          }
          fs.rmSync(tempDir, { recursive: true, force: true });
        },
      });
    };

    child.stdout.on("data", onData);
    child.stderr.on("data", (chunk) => {
      stderrBuffer += chunk.toString();
    });
    child.on("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(
        new Error(
          `preview_server.js exited early with code ${code}\n${stderrBuffer}`,
        ),
      );
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      reject(error);
    });
  });
}

module.exports = {
  startPreviewServer,
};
