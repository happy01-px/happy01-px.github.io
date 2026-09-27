const { spawnSync } = require("child_process");

function restartInElectronIfNeeded() {
  if (process.env.ELECTRON_RUN_AS_NODE !== "1") return false;

  const electronBinary = String(require("electron"));
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;
  const result = spawnSync(electronBinary, [__filename], {
    env: environment,
    stdio: "inherit",
    windowsHide: true,
  });
  process.exitCode = result.status ?? 1;
  return true;
}

async function verifyPrinters() {
  const { app, BrowserWindow } = require("electron");
  await app.whenReady();
  const window = new BrowserWindow({ show: false });
  await window.loadURL("data:text/html,<title>Print verification</title>");
  const printers = await window.webContents.getPrintersAsync();
  console.log(
    JSON.stringify(
      {
        success: printers.length > 0,
        printerCount: printers.length,
        printers: printers.map((printer) => ({
          name: printer.name,
          displayName: printer.displayName,
        })),
      },
      null,
      2,
    ),
  );
  window.destroy();
  app.quit();
}

if (!restartInElectronIfNeeded()) {
  verifyPrinters().catch((error) => {
    console.error(error);
    const { app } = require("electron");
    app.exit(1);
  });
}
