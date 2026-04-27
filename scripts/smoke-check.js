const fs = require("fs");
const path = require("path");
const vm = require("vm");

const rootDir = path.resolve(__dirname, "..");

function runNodeCheck(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  const source = fs.readFileSync(absolutePath, "utf8");
  new vm.Script(source, { filename: relativePath });
}

function readJson(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function ensureFileExists(relativePath) {
  const absolutePath = path.join(rootDir, relativePath);
  assert(fs.existsSync(absolutePath), `Missing file: ${relativePath}`);
}

function assertSplitDataFilesExist() {
  [
    "products",
    "suppliers",
    "customers",
    "companies",
    "bills",
    "deliveryNotes",
    "stockMovements",
    "logs",
  ].forEach((tableName) => {
    const tableData = readJson(`data/${tableName}.json`);
    assert(Array.isArray(tableData), `data/${tableName}.json should be an array.`);
  });
}

function checkHtmlForExternalAssets() {
  const indexHtml = fs.readFileSync(path.join(rootDir, "index.html"), "utf8");
  const externalAssetPattern =
    /<(script|link|img)\b[^>]+(?:src|href)=["']https?:\/\//i;
  assert(
    !externalAssetPattern.test(indexHtml),
    "index.html still contains external runtime assets.",
  );
}

function main() {
  [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/data-store.js",
    "js/modules/master-data-module.js",
    "js/modules/stock-module.js",
    "js/modules/logs-module.js",
    "js/modules/settings-module.js",
    "js/modules/bills-module.js",
    "js/script.js",
    "js/ui/antd-bridge.js",
    "js/app/navigation.js",
    "js/app/router.js",
    "js/app/charts.js",
    "js/app/bootstrap.js",
    "js/sales-order.js",
    "eslint.config.js",
    "preview_server.js",
  ].forEach(runNodeCheck);

  [
    "data/products.json",
    "data/suppliers.json",
    "data/companies.json",
    "data/customers.json",
    "data/bills.json",
    "data/stockMovements.json",
    "data/logs.json",
    "data/deliveryNotes.json",
  ].forEach(readJson);

  [
    "lib/tailwindcdn.min.js",
    "lib/chart.umd.min.js",
    "lib/font-awesome/font-awesome.min.css",
    "lib/font-awesome/fonts/fontawesome-webfont.woff2",
    "assets/admin-avatar.svg",
  ].forEach(ensureFileExists);

  checkHtmlForExternalAssets();

  assertSplitDataFilesExist();

  console.log("smoke-check: ok");
}

main();
