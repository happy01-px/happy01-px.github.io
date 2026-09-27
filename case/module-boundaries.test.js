const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
}

test("legacy bills implementation is not reintroduced into script.js", () => {
  const script = read("js/script.js");
  assert.doesNotMatch(script, /function\s+updateBillsTable\s*\(/);
  assert.doesNotMatch(script, /activeBillsTab/);
  assert.doesNotMatch(script, /deleteLegacyBillRecord/);
});

test("application shell is separated from the Ant Design component module", () => {
  const script = read("js/script.js");
  const shell = read("js/app/app-shell.js");
  const html = read("index.html");

  assert.doesNotMatch(script, /function\s+renderPaginationControl\s*\(/);
  assert.doesNotMatch(script, /function\s+showModal\s*\(/);
  assert.match(shell, /function\s+renderPaginationControl\s*\(/);
  assert.match(shell, /function\s+showModal\s*\(/);
  assert.ok(html.indexOf("js/app/app-shell.js") > html.indexOf("js/script.js"));
});

test("bills list module is the single owner of list globals", () => {
  const moduleFiles = fs
    .readdirSync(path.join(projectRoot, "js", "modules"))
    .filter((name) => name.endsWith(".js"));
  const owners = moduleFiles.filter((name) =>
    read(path.join("js", "modules", name)).includes(
      "global.updateBillsTable =",
    ),
  );

  assert.deepEqual(owners, ["bills-list.js"]);
});

test("master data product and partner responsibilities stay separated", () => {
  const products = read("js/modules/master-data-products.js");
  const partners = read("js/modules/master-data-module.js");

  assert.match(products, /function\s+showAddProductModal\s*\(/);
  assert.match(products, /function\s+updateInventoryTable\s*\(/);
  assert.doesNotMatch(partners, /function\s+showAddProductModal\s*\(/);
  assert.doesNotMatch(partners, /function\s+updateInventoryTable\s*\(/);
  assert.match(
    products,
    /showAddInboundModal\(\{ source: "inventory" \}\)/,
  );
  assert.doesNotMatch(products, /<form id="add-product-form"/);
});

test("index loads split modules before their orchestrators", () => {
  const html = read("index.html");
  const expectedOrder = [
    "js/modules/master-data-core.js",
    "js/modules/master-data-products.js",
    "js/modules/master-data-module.js",
    "js/modules/bills-core.js",
    "js/modules/bills-state.js",
    "js/modules/bills-data.js",
    "js/modules/bills-statements.js",
    "js/modules/bills-list.js",
    "js/modules/bills-module.js",
  ];

  const positions = expectedOrder.map((entry) => html.indexOf(entry));
  positions.forEach((position) => assert.notEqual(position, -1));
  assert.deepEqual(
    positions,
    [...positions].sort((a, b) => a - b),
  );
});

test("inventory ledger loads after persistence and before stock workflows", () => {
  const html = read("index.html");
  const inventoryCorePosition = html.indexOf("js/modules/inventory-core.js");
  const dataStorePosition = html.indexOf("js/modules/data-store.js");
  const ledgerPosition = html.indexOf("js/modules/inventory-ledger.js");
  const stockPosition = html.indexOf("js/modules/stock-module.js");

  assert.ok(inventoryCorePosition >= 0);
  assert.ok(dataStorePosition > inventoryCorePosition);
  assert.ok(ledgerPosition > dataStorePosition);
  assert.ok(stockPosition > ledgerPosition);
});
