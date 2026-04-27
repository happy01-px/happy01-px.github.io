const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const { projectRoot } = require("./browser-harness");

const SERVER_FILES = [
  "preview_server.js",
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

  return tempDir;
}

function startPreviewServer() {
  const tempDir = copyProjectForServer();

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
