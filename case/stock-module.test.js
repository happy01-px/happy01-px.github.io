const test = require("node:test");
const assert = require("node:assert/strict");
const {
  applyFixtureState,
  clickModalConfirm,
  createWindow,
  loadScripts,
  setRenderedSelectValue,
} = require("./helpers/browser-harness");
const { createFixtureData } = require("./helpers/fixtures");

function createStockMarkup() {
  return `
        <div id="stock-tabs">
            <button class="active" data-tab="all" type="button">全部</button>
        </div>
        <table>
            <thead id="stock-movement-table-head"></thead>
            <tbody id="stock-movement-table-body"></tbody>
        </table>
        <div id="stock-pagination-container"></div>
        <table><tbody id="dashboard-activity-table-body"></tbody></table>
        <select id="filter-supplier"></select>
    `;
}

test("stock movement tables wrap long business names without merging columns", () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.products[0].name = "超长名称表面处理专用化学试剂产品";
  fixture.mockData.suppliers[0].name = "示例新材料科技有限公司";
  fixture.stockMovementData[0].supplierName = "示例新材料科技有限公司";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.renderStockMovementTable("inbound");

  const row = harness.window.document.querySelector(
    "#stock-movement-table-body tr:first-child",
  );
  assert.equal(
    row.querySelector("td:first-child .stock-movement-cell-wrap").textContent,
    fixture.mockData.products[0].name,
  );
  assert.equal(
    row.querySelector("td:nth-child(4) .stock-movement-cell-wrap").textContent,
    fixture.mockData.suppliers[0].name,
  );
  assert.equal(
    harness.window.document
      .querySelector("#stock-movement-table-head th:last-child")
      .classList.contains("table-action-header"),
    true,
  );
  assert.equal(
    row.querySelector("td:last-child").classList.contains("table-action-cell"),
    true,
  );
  assert.ok(row.querySelector("td:last-child .table-action-links"));

  harness.close();
});

test("addInboundRecord updates inventory, storage and activity views", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  let inventoryRefreshCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.updateInventoryTable = () => {
    inventoryRefreshCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };

  await harness.window.addInboundRecord({
    productId: "P001",
    quantity: 3,
    remark: "Restock",
  });

  assert.equal(harness.window.mockData.products[0].stockQuantity, 23);
  assert.equal(harness.window.stockMovementData[0].type, "inbound");
  assert.equal(saveCalls, 1);
  assert.equal(inventoryRefreshCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.equal(
    harness.window.document.querySelectorAll(
      "#dashboard-activity-table-body tr",
    ).length,
    3,
  );

  harness.close();
});

test("deleteStockMovement warns when the target record no longer exists", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.updateInventoryTable = () => {};
  harness.window.addLog = () => {};
  harness.window.queueConfirmResult(true);

  await harness.window.deleteStockMovement("missing-record");

  assert.match(harness.alerts.at(-1), /记录未找到/);

  harness.close();
});

test("delivery note viewer provides a print action", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.deliveryNotes = [
    {
      id: "SD001",
      type: "sales",
      orderNo: "XS202609250001",
      customerNo: "KH26-001",
      companyName: "Demo Company",
      customerName: "Demo Customer",
      totalAmount: 200,
      details: [
        {
          productName: "Widget",
          quantity: 2,
          unit: "个",
          unitPrice: 100,
        },
      ],
    },
  ];
  let printedNoteId = "";

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.buildDeliveryNotePrintMarkup = () =>
    '<div class="mx-auto min-w-[1220px] max-w-[1220px]">Widget</div>';
  harness.window.printDeliveryNote = (note) => {
    printedNoteId = note.id;
    return true;
  };

  harness.window.showViewDeliveryNoteModal("SD001");

  assert.equal(
    harness.window.document.getElementById("modal-confirm").textContent,
    "打印送货单",
  );
  assert.equal(
    harness.window.document.getElementById("modal-cancel").textContent,
    "关闭",
  );
  assert.equal(await clickModalConfirm(harness.window), false);
  assert.equal(printedNoteId, "SD001");

  harness.close();
});

test("showAddOutboundModal blocks outbound records that exceed current stock", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.updateInventoryTable = () => {};
  harness.window.addLog = () => {};
  harness.window.saveMockData = () => {};

  harness.window.showAddOutboundModal();
  assert.equal(
    harness.window.document.querySelector(
      '#add-outbound-form [name="warehouseId"]',
    ),
    null,
  );
  assert.equal(
    harness.window.document.querySelector(
      '#add-outbound-form [name="batchNo"]',
    ),
    null,
  );
  harness.window.document.getElementById("outbound-product-id").value = "P001";
  harness.window.document.querySelector(
    '#add-outbound-form [name="quantity"]',
  ).value = "999";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.match(harness.alerts.at(-1), /库存不足/);

  harness.close();
});

test("showAddInboundModal saves multiple products under one supplier", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  fixture.mockData.products = [];
  fixture.stockMovementData = [];
  let saveCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.updateInventoryTable = () => {};
  harness.window.updateSupplierTable = () => {};
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };

  harness.window.showAddInboundModal();
  assert.ok(harness.window.document.getElementById("add-inbound-batch-form"));
  assert.equal(
    harness.window.document.querySelectorAll('[id="inbound-batch-supplier-id"]')
      .length,
    1,
  );
  setRenderedSelectValue(harness.window, "inbound-batch-supplier-id", "S001");

  const fillRow = (rowId, values) => {
    setRenderedSelectValue(
      harness.window,
      `inbound-batch-product-${rowId}`,
      values.name,
    );
    const row = harness.window.document.querySelector(
      `[data-inbound-row="${rowId}"]`,
    );
    Object.entries(values).forEach(([field, value]) => {
      if (field === "name") return;
      row.querySelector(`[data-field="${field}"]`).value = String(value);
    });
  };

  fillRow("1", {
    name: "Inbound Custom Product",
    category: "临时分类",
    unit: "包",
    quantity: 9,
    costPrice: 11,
    retailPrice: 22,
    minStock: 4,
    maxStock: 40,
  });
  harness.window.document.getElementById("inbound-batch-add-row").click();
  fillRow("2", {
    name: "Second Product",
    category: "临时分类",
    unit: "箱",
    quantity: 3,
    costPrice: 20,
    retailPrice: 35,
    minStock: 2,
    maxStock: 30,
  });

  const result = await clickModalConfirm(harness.window);

  const createdProduct = harness.window.mockData.products.find(
    (product) => product.name === "Inbound Custom Product",
  );
  assert.equal(result, true);
  assert.ok(createdProduct);
  assert.equal(harness.window.mockData.products.length, 2);
  assert.equal(createdProduct.category, "临时分类");
  assert.equal(createdProduct.unit, "包");
  assert.equal(createdProduct.minStock, 4);
  assert.equal(createdProduct.maxStock, 40);
  assert.equal(harness.window.stockMovementData.length, 2);
  assert.equal(
    harness.window.stockMovementData.every(
      (record) => record.supplierId === "S001",
    ),
    true,
  );
  assert.equal(
    new Set(
      harness.window.stockMovementData.map((record) => record.inboundOrderNo),
    ).size,
    1,
  );
  assert.equal(harness.window.stockMovementData[0].warehouseId, "WH001");
  assert.equal(harness.window.stockMovementData[0].locationCode, "A01");
  assert.equal(harness.window.stockMovementData[0].companyId, "CO001");
  assert.equal(harness.window.mockData.deliveryNotes.length, 1);
  assert.equal(harness.window.mockData.deliveryNotes[0].type, "purchase");
  assert.equal(harness.window.mockData.deliveryNotes[0].details.length, 2);
  assert.equal(saveCalls, 1);
  assert.equal(logCalls.at(-1)[0], "add");

  harness.close();
});

test("showAddOutboundModal creates an outbound record for a valid request", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();
  let saveCalls = 0;
  let inventoryRefreshCalls = 0;
  const logCalls = [];

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = () => {
    saveCalls += 1;
  };
  harness.window.updateInventoryTable = () => {
    inventoryRefreshCalls += 1;
  };
  harness.window.addLog = (...args) => {
    logCalls.push(args);
  };

  harness.window.showAddOutboundModal();
  harness.window.document.getElementById("outbound-product-id").value = "P001";
  harness.window.document.querySelector(
    '#add-outbound-form [name="quantity"]',
  ).value = "2";
  harness.window.document.querySelector(
    '#add-outbound-form [name="remark"]',
  ).value = "Ship it";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, true);
  assert.equal(harness.window.mockData.products[0].stockQuantity, 18);
  assert.equal(harness.window.stockMovementData[0].type, "outbound");
  assert.equal(harness.window.stockMovementData[0].warehouseId, "WH001");
  assert.equal(saveCalls, 1);
  assert.equal(inventoryRefreshCalls, 1);
  assert.equal(logCalls[0][0], "add");
  assert.match(harness.alerts.at(-1), /出货记录添加成功/);

  harness.close();
});

test("showAddOutboundModal rolls back inventory when persistence fails", async () => {
  const harness = createWindow({ markup: createStockMarkup() });
  const fixture = createFixtureData();

  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/modules/app-state.js",
    "js/modules/stock-module.js",
  ]);
  applyFixtureState(harness.window, fixture);
  harness.window.saveMockData = async () => false;
  harness.window.updateInventoryTable = () => {};
  harness.window.addLog = () => {
    assert.fail("failed outbound operations must not be logged as successful");
  };

  harness.window.showAddOutboundModal();
  harness.window.document.getElementById("outbound-product-id").value = "P001";
  harness.window.document.querySelector(
    '#add-outbound-form [name="quantity"]',
  ).value = "2";

  const result = await clickModalConfirm(harness.window);

  assert.equal(result, false);
  assert.equal(harness.window.mockData.products[0].stockQuantity, 20);
  assert.equal(harness.window.stockMovementData.length, 2);
  assert.match(harness.alerts.at(-1), /已回滚/);

  harness.close();
});
