const path = require("path");
const { app, BrowserWindow, Menu, dialog, shell } = require("electron");

const APP_ID = "com.happy01.inventory";
const APP_NAME = "仓库库存管理系统";

let mainWindow = null;
let inventoryServer = null;
let allowQuit = false;
let shutdownPromise = null;

function getDesktopDataDirectory() {
  const localAppData = process.env.LOCALAPPDATA || app.getPath("userData");
  return path.join(localAppData, "Happy01Inventory");
}

function isAppUrl(targetUrl, serverUrl) {
  try {
    return new URL(targetUrl).origin === new URL(serverUrl).origin;
  } catch {
    return false;
  }
}

async function createMainWindow() {
  process.env.INVENTORY_DESKTOP = "1";
  process.env.INVENTORY_DATA_DIR = getDesktopDataDirectory();

  const {
    startInventoryServer,
    stopInventoryServer,
  } = require("../preview_server.js");
  inventoryServer = { startInventoryServer, stopInventoryServer };
  const serverInfo = await startInventoryServer();

  Menu.setApplicationMenu(null);
  mainWindow = new BrowserWindow({
    title: APP_NAME,
    width: 1440,
    height: 920,
    minWidth: 1080,
    minHeight: 700,
    show: false,
    backgroundColor: "#f3f4f6",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!isAppUrl(url, serverInfo.url) && /^https?:/i.test(url)) {
      shell.openExternal(url).catch((error) => {
        console.error("Failed to open external link:", error);
      });
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (!isAppUrl(url, serverInfo.url)) {
      event.preventDefault();
    }
  });

  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false),
  );

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(serverInfo.url);
}

async function stopApplicationServices() {
  if (shutdownPromise) return shutdownPromise;
  shutdownPromise = (async () => {
    try {
      await inventoryServer?.stopInventoryServer();
    } catch (error) {
      console.error("Failed to stop inventory services cleanly:", error);
    } finally {
      allowQuit = true;
    }
  })();
  return shutdownPromise;
}

async function requestApplicationQuit() {
  await stopApplicationServices();
  app.quit();
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.setName(APP_NAME);
  app.setAppUserModelId(APP_ID);

  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(async () => {
    try {
      await createMainWindow();
    } catch (error) {
      console.error("Desktop application startup failed:", error);
      dialog.showErrorBox(
        `${APP_NAME}启动失败`,
        error?.message || "无法启动本地数据服务。",
      );
      await requestApplicationQuit();
    }
  });

  app.on("before-quit", (event) => {
    if (allowQuit) return;
    event.preventDefault();
    requestApplicationQuit().catch((error) => {
      console.error("Application shutdown failed:", error);
      allowQuit = true;
      app.quit();
    });
  });

  app.on("window-all-closed", () => {
    app.quit();
  });
}
