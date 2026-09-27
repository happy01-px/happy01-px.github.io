const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const importer = require("../js/modules/delivery-note-import.js");
const schema = require("../js/modules/data-schema.js");
const {
  createWindow,
  flushAsyncTasks,
  loadScripts,
} = require("./helpers/browser-harness");

const WORKFLOW_MARKUP = `
  <section id="settings" class="page-section"></section>
  <section id="history-import-workflow" class="page-section hidden">
    <h2 id="delivery-import-workflow-title"></h2>
    <p id="delivery-import-workflow-subtitle"></p>
    <div id="delivery-import-workflow-steps">
      <span data-step="review"></span>
      <span data-step="preview"></span>
      <span data-step="commit"></span>
    </div>
    <div id="delivery-import-workflow-content"></div>
    <div id="delivery-import-workflow-actions" class="hidden">
      <button id="delivery-import-workflow-secondary" type="button"></button>
      <button id="delivery-import-workflow-primary" type="button"></button>
    </div>
  </section>`;

function createImportDocument() {
  return {
    ok: true,
    fileName: "示例客户AA26-097.xlsx",
    sheetName: "Sheet1",
    errors: [],
    warnings: [],
    metadata: {
      companyName: "示例供货公司甲",
      companyAddress: "示例产业园",
      companyPhone: "13800000000",
      companyContact: "经理甲",
      customerName: "示例客户甲",
      customerAddress: "B08栋3楼",
      customerContact: "联系人乙",
      customerPhone: "13800000001",
      paymentTerms: "月结30天",
      orderNo: "AA26-097",
      issueDate: "2026-08-07",
    },
    items: [
      {
        productName: "片碱",
        specification: "",
        unit: "KG",
        quantity: 25,
        unitPrice: 5.5,
        notes: "",
      },
    ],
    calculatedTotal: 137.5,
  };
}

test("parses the ZH delivery template and skips a note-only row", () => {
  const result = importer.parseDeliverySheetRows(
    [
      ["示例供货公司乙"],
      ["销售出库单 制单日期：20260926"],
      [
        "地 址：示例市示例产业园B栋06号 订货电话：010-00000000 13800000000经理甲",
      ],
      ["收货单位：示例客户乙", "收货地址：示例路196号208室"],
      ["收货人：联系人乙 138 0000 0002 结款方式：月结 NO:BB26-046"],
      [
        "序号",
        "产品名称",
        "规格",
        "单位",
        "出库数量",
        "未税单价(RMB)",
        "金额（RMB)",
        "备注",
      ],
      ["1", "0.1碘", "", "瓶", "1", "90", "90", "未单"],
      ["2", "", "", "", "", "", "", "24包"],
      ["合计金额：", "", "￥90.00", "", "大写", "RMB90"],
    ],
    { fileName: "ZH.xlsx", sheetName: "Sheet1" },
  );

  assert.equal(result.ok, true);
  assert.deepEqual(result.metadata, {
    companyName: "示例供货公司乙",
    companyAddress: "示例市示例产业园B栋06号",
    companyPhone: "010-00000000 / 13800000000",
    companyContact: "经理甲",
    customerName: "示例客户乙",
    customerAddress: "示例路196号208室",
    customerContact: "联系人乙",
    customerPhone: "13800000002",
    paymentTerms: "月结",
    orderNo: "BB26-046",
    issueDate: "2026-09-26",
  });
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].productName, "0.1碘");
  assert.equal(result.calculatedTotal, 90);
  assert.match(result.warnings.join(" "), /24包/);
});

test("parses the YT layout with two product rows", () => {
  const result = importer.parseDeliverySheetRows([
    ["示例供货公司甲"],
    ["销售出库单 制单日期：20260807"],
    ["地 址：园区B栋06号 订货电话：010-00000000 13800000000经理甲"],
    ["收货单位：示例客户甲", "收货地址：B08栋3楼"],
    ["收货人：联系人乙 138 0000 0001 结款方式：月结30天 NO:AA26-097"],
    [
      "序号",
      "产品名称",
      "规格",
      "单位",
      "出库数量",
      "未税单价(RMB)",
      "金额",
      "备注",
    ],
    ["1", "片碱", "", "KG", "25", "5.5", "137.5"],
    ["2", "氯化镍", "", "kg", "50", "41", "2050"],
    ["", "", "￥2,187.50", "", "大写", "RMB2187.5"],
  ]);

  assert.equal(result.metadata.orderNo, "AA26-097");
  assert.equal(result.metadata.paymentTerms, "月结30天");
  assert.deepEqual(
    result.items.map((item) => [item.productName, item.unit, item.quantity]),
    [
      ["片碱", "KG", 25],
      ["氯化镍", "kg", 50],
    ],
  );
  assert.equal(result.sourceTotal, 2187.5);
  assert.equal(result.calculatedTotal, 2187.5);
});

test("treats the specification column as unit when the template has no unit header", () => {
  const result = importer.parseDeliverySheetRows([
    ["示例电镀材料贸易部"],
    ["销售出库单"],
    ["地 址：示例市示例路49号 订货电话：010-00000000 联系人丙 13800000000"],
    ["制单日期:2026-5-28", "收货单位:示例客户丙"],
    ["收货地址:示例产业园 结款方式：月结 NO：CC26-033"],
    ["序号", "产品名称", "规格", "出库数量", "单价（RBM）", "金额", "备注"],
    ["1", "天黍99", "kg", "25", "6.50", "162.50"],
    ["2", "铁铲", "把", "1", "11.00", "11.00"],
    ["合计数量："],
    ["合计金额：", "", "￥173.50", "大写", "RMB173.5"],
  ]);

  assert.equal(result.metadata.companyContact, "联系人丙");
  assert.equal(result.metadata.issueDate, "2026-05-28");
  assert.deepEqual(
    result.items.map((item) => [item.specification, item.unit]),
    [
      ["", "kg"],
      ["", "把"],
    ],
  );
  assert.equal(result.sourceTotal, 173.5);
  assert.match(result.warnings.join(" "), /收货联系人/);
});

test("parses the supplied customer statement layouts into grouped delivery notes", () => {
  const lianhang = importer.parseStatementSheetRows([
    ["示例电镀材料贸易部"],
    ["26年8月对账单"],
    ["示例供货公司乙"],
    ["电话：010-00000000 13800000000经理甲"],
    ["客户名称：示例客户丙", "", "", "", "对账日期：", "9/1/26"],
    ["联系人：联系人丙", "", "联系电话："],
    ["单据：", "共2单"],
    ["客户地址：示例市示例产业园"],
    [
      "序号",
      "送货日期",
      "送货单号",
      "产品名称",
      "规格",
      "数量",
      "单价",
      "金额",
      "备注",
    ],
    ["1", "8/4", "CC26-052", "氟化氢铵", "kg", "25", "15", "375", "示例"],
    ["2", "8/7", "CC26-053", "还原剂", "kg", "60", "5.5", "330"],
    ["", "", "", "", "", "26年8月货款", "", "705"],
    ["", "", "", "", "", "26年3月货款", "", "3316"],
    ["", "RMB4021", "", "", "", "合计", "", "4021"],
  ]);

  assert.equal(lianhang.ok, true);
  assert.equal(lianhang.documents.length, 2);
  assert.deepEqual(lianhang.statementMeta.orderNumbers, [
    "CC26-052",
    "CC26-053",
  ]);
  assert.equal(lianhang.statementMeta.statementDate, "2026-09-01");
  assert.equal(lianhang.statementMeta.currentAmount, 705);
  assert.equal(lianhang.statementMeta.arrearsAmount, 3316);
  assert.equal(lianhang.statementMeta.totalAmount, 4021);
  assert.equal(
    lianhang.documents[0].metadata.companyName,
    "示例电镀材料贸易部",
  );

  const yitian = importer.parseStatementSheetRows([
    ["示例供货公司甲"],
    ["26年8月对 账 单"],
    ["示例供货公司甲"],
    ["电话：010-00000000 13800000000经理甲"],
    ["客户名称：", "示例客户甲", "", "", "", "对账日期：2026-9-1"],
    ["联系人：联系人乙", "", "联系电话：13800000003"],
    ["单据：", "共2单"],
    ["客户地址：示例市示例产业园"],
    [
      "序号",
      "送货日期",
      "送货单号",
      "产品名称",
      "规格",
      "数量",
      "单价",
      "金额",
      "备注",
    ],
    ["1", "8/4", "AA26-094", "还原剂", "kg", "60", "5", "300"],
    ["2", "8/4", "AA26-094", "氟化氢铵", "kg", "50", "14", "700"],
    ["3", "8/5", "AA26-095", "手指套", "包", "1", "16", "16"],
    ["", "", "", "", "", "26年8月货款", "", "1016"],
    ["", "", "", "", "8月含税", "1016", "1.08", "1097.28"],
    ["", "", "", "", "", "26年6月货款", "", "28918"],
    ["", "", "", "", "", "合计", "", "30015.28"],
  ]);

  assert.equal(yitian.documents.length, 2);
  assert.equal(yitian.documents[0].metadata.customerPhone, "13800000003");
  assert.equal(yitian.statementMeta.taxRate, 0.08);
  assert.equal(yitian.statementMeta.amountWithTax, 1097.28);
  assert.equal(yitian.statementMeta.totalAmount, 30015.28);

  const zhihao = importer.parseStatementSheetRows([
    ["示例供货公司乙"],
    ["26年7月对 账 单"],
    ["示例供货公司乙"],
    ["电话：010-00000000 13800000000经理甲"],
    ["客户名称：", "示例客户乙", "", "", "", "对账日期：2026/8/1"],
    ["联系人：", "联系人乙", "联系电话：", "138 0000 0002"],
    ["单据：", "共1单"],
    ["客户地址：示例市示例产业园"],
    [
      "序号",
      "送货日期",
      "送货单号",
      "产品名称",
      "规格",
      "数量",
      "单价",
      "金额",
      "备注",
    ],
    ["1", "8/5", "BB26-037", "碳酸氢钠", "KG", "150", "5", "750"],
    ["2", "8/5", "BB26-037", "量杯", "5L/个", "2", "17", "34"],
    ["", "", "", "26年8月含税款", "", "784", "1.08", "846.72"],
    ["", "", "", "", "", "26年4月合计", "", "28025"],
    ["", "", "", "", "", "合计", "", "28871.72"],
  ]);

  assert.equal(zhihao.documents.length, 1);
  assert.equal(zhihao.documents[0].metadata.customerPhone, "13800000002");
  assert.deepEqual(
    zhihao.documents[0].items.map((item) => [item.specification, item.unit]),
    [
      ["", "KG"],
      ["5L", "个"],
    ],
  );
  assert.equal(zhihao.statementMeta.periodStart, "2026-08-01");
  assert.equal(zhihao.statementMeta.totalAmount, 28871.72);
  assert.match(zhihao.warnings.join(" "), /标题月份为 7 月/);
});

test("history import uses a routed review and returns from preview with edits", async () => {
  const harness = createWindow({
    markup: WORKFLOW_MARKUP,
  });
  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/app/app-shell.js",
    "js/modules/delivery-note-import.js",
  ]);
  harness.window.mockData = {
    companies: [],
    customers: [],
    products: [],
    suppliers: [],
    customerProductPrices: [],
    deliveryNotes: [],
  };
  harness.window.DeliveryNoteImport.showReviewPage([createImportDocument()]);

  const document = harness.window.document;
  assert.equal(
    document.getElementById("modal").classList.contains("hidden"),
    true,
  );
  assert.equal(
    document
      .getElementById("history-import-workflow")
      .classList.contains("hidden"),
    false,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /核对送货单解析结果/,
  );
  assert.equal(
    document.querySelector('[data-field="orderNo"]').value,
    "AA26-097",
  );
  assert.equal(
    document.querySelector('[data-field="productName"]').value,
    "片碱",
  );
  assert.equal(
    document.querySelectorAll(".delivery-import-table th").length,
    9,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /不会生成出库流水/,
  );
  assert.doesNotMatch(
    document.getElementById("delivery-import-workflow-content").textContent,
    /生效日期/,
  );
  assert.ok(document.querySelector('[data-field="priceTaxMode"]'));
  assert.match(
    document.getElementById("delivery-import-workflow-primary").textContent,
    /预览本次新增/,
  );

  document.querySelector('[data-field="customerContact"]').value =
    "修改后的联系人";
  document.getElementById("delivery-import-workflow-primary").click();
  await flushAsyncTasks(4);

  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /预览本次新增与补充内容/,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /尚未写入系统/,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /示例供货公司甲/,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /示例客户甲/,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /片碱/,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /客户商品价格版本/,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-content").textContent,
    /新增\s+1/,
  );
  assert.doesNotMatch(
    document.getElementById("delivery-import-workflow-content").textContent,
    /1\/0|补充\s+0|调整\s+0/,
  );
  assert.ok(
    document.querySelector(
      '.delivery-import-change-card[data-change-kind="create"] .is-create',
    ),
  );
  assert.doesNotMatch(
    document.getElementById("delivery-import-workflow-content").textContent,
    /辅助供应商/,
  );
  assert.ok(
    document.querySelectorAll(".delivery-import-preview-table").length > 0,
  );
  assert.ok(
    Array.from(
      document.querySelectorAll(".delivery-import-preview-table"),
    ).every((table) =>
      table.parentElement.classList.contains(
        "delivery-import-preview-table-wrap",
      ),
    ),
  );
  assert.equal(
    document.getElementById("delivery-import-workflow-primary").textContent,
    "最终确认导入",
  );
  assert.equal(
    document.getElementById("delivery-import-workflow-primary").disabled,
    false,
  );
  assert.equal(
    document.getElementById("delivery-import-workflow-secondary").textContent,
    "返回修改",
  );

  document.getElementById("delivery-import-workflow-secondary").click();
  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /核对送货单解析结果/,
  );
  assert.equal(
    document.querySelector('[data-field="customerContact"]').value,
    "修改后的联系人",
  );
  assert.match(
    document.getElementById("delivery-import-workflow-primary").textContent,
    /预览本次新增/,
  );
});

test("history import restores the preview step and edited fields after a refresh", async () => {
  const firstHarness = createWindow({ markup: WORKFLOW_MARKUP });
  loadScripts(firstHarness.window, [
    "js/modules/app-utils.js",
    "js/app/app-shell.js",
    "js/modules/delivery-note-import.js",
  ]);
  firstHarness.window.mockData = {
    companies: [],
    customers: [],
    products: [],
    suppliers: [],
    customerProductPrices: [],
    deliveryNotes: [],
  };
  firstHarness.window.DeliveryNoteImport.showReviewPage([
    createImportDocument(),
  ]);

  const editedContact = firstHarness.window.document.querySelector(
    '[data-field="customerContact"]',
  );
  editedContact.value = "刷新后保留的联系人";
  editedContact.dispatchEvent(
    new firstHarness.window.Event("input", { bubbles: true }),
  );
  firstHarness.window.document
    .getElementById("delivery-import-workflow-primary")
    .click();
  await flushAsyncTasks(4);

  const draftKey = firstHarness.window.DeliveryNoteImport.WORKFLOW_DRAFT_KEY;
  const rawDraft = firstHarness.window.sessionStorage.getItem(draftKey);
  assert.equal(JSON.parse(rawDraft).stage, "preview");

  const refreshedHarness = createWindow({ markup: WORKFLOW_MARKUP });
  loadScripts(refreshedHarness.window, [
    "js/modules/app-utils.js",
    "js/app/app-shell.js",
    "js/modules/delivery-note-import.js",
  ]);
  refreshedHarness.window.mockData = {
    companies: [],
    customers: [],
    products: [],
    suppliers: [],
    customerProductPrices: [],
    deliveryNotes: [],
  };
  refreshedHarness.window.sessionStorage.setItem(draftKey, rawDraft);

  assert.equal(
    refreshedHarness.window.DeliveryNoteImport.restoreWorkflowDraft(),
    true,
  );
  assert.match(
    refreshedHarness.window.document.getElementById(
      "delivery-import-workflow-title",
    ).textContent,
    /预览本次新增与补充内容/,
  );
  assert.equal(
    refreshedHarness.window.document.getElementById(
      "delivery-import-workflow-primary",
    ).disabled,
    false,
  );

  refreshedHarness.window.document
    .getElementById("delivery-import-workflow-secondary")
    .click();
  assert.equal(
    refreshedHarness.window.document.querySelector(
      '[data-field="customerContact"]',
    ).value,
    "刷新后保留的联系人",
  );

  refreshedHarness.close();
  firstHarness.close();
});

test("history import refresh without a draft shows recovery actions", () => {
  const harness = createWindow({ markup: WORKFLOW_MARKUP });
  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/app/app-shell.js",
    "js/modules/delivery-note-import.js",
  ]);
  harness.window.mockData = { deliveryNotes: [] };

  assert.equal(harness.window.DeliveryNoteImport.restoreWorkflowDraft(), false);
  assert.match(
    harness.window.document.getElementById("delivery-import-workflow-content")
      .textContent,
    /没有待处理的导入任务/,
  );
  assert.equal(
    harness.window.document.getElementById("delivery-import-workflow-primary")
      .textContent,
    "选择送货单 / 对账单文件",
  );
  assert.equal(
    harness.window.document
      .getElementById("delivery-import-workflow-actions")
      .classList.contains("hidden"),
    false,
  );

  harness.close();
});

test("historical business import entry lives under system settings", () => {
  const indexHtml = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  const stockSection = indexHtml.slice(
    indexHtml.indexOf('<section id="stock-movement"'),
    indexHtml.indexOf('<section id="logs"'),
  );
  const settingsSection = indexHtml.slice(
    indexHtml.indexOf('<section id="settings"'),
    indexHtml.indexOf('<section id="usage-guide"'),
  );
  assert.doesNotMatch(stockSection, /historical-business-import-btn/);
  assert.match(settingsSection, /settings-history-import/);
  assert.match(settingsSection, /historical-business-import-btn/);
  assert.match(settingsSection, /客户商品价格版本/);
  assert.match(indexHtml, /id="history-import-workflow"/);
});

test("desktop package keeps the Excel parser available offline", () => {
  const packageJson = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8"),
  );
  const indexHtml = fs.readFileSync(
    path.join(__dirname, "..", "index.html"),
    "utf8",
  );
  assert.ok(packageJson.build.files.includes("lib/**/*"));
  assert.ok(packageJson.build.files.includes("js/**/*"));
  assert.ok(
    fs.existsSync(path.join(__dirname, "..", "lib", "xlsx.full.min.js")),
  );
  assert.match(indexHtml, /src="lib\/xlsx\.full\.min\.js"/);
  assert.doesNotMatch(indexHtml, /https?:\/\/[^"']*xlsx/i);
});

test("older imported prices do not replace a newer manually maintained price", () => {
  const data = {
    customerProductPrices: [
      {
        id: "CPP-MANUAL",
        companyId: "CO001",
        customerId: "C001",
        productId: "P001",
        referencePrice: 120,
        priceTaxMode: "exclusive",
        status: "active",
        remark: "人工维护",
        createdAt: "2026-09-26T15:00:00",
        updatedAt: "2026-09-26T15:00:00",
      },
    ],
  };
  const created = importer.syncImportedCustomerPrices(
    [
      {
        id: "SD-HISTORY",
        orderNo: "OLD-001",
        companyId: "CO001",
        customerId: "C001",
        priceTaxModeSnapshot: "exclusive",
        createdAt: "2026-05-01T12:00:00",
        updatedAt: "2026-05-01T12:00:00",
        details: [
          {
            productId: "P001",
            confirmedUnitPrice: 90,
          },
        ],
      },
    ],
    data,
  );

  assert.equal(created, 1);
  assert.equal(data.customerProductPrices.length, 2);
  assert.equal(
    data.customerProductPrices.find((item) => item.id === "CPP-MANUAL").status,
    "active",
  );
  assert.equal(
    data.customerProductPrices.find((item) => item.id !== "CPP-MANUAL").status,
    "inactive",
  );
});

test("historical import creates related records without changing stock movements", async () => {
  const originalGlobals = {
    mockData: global.mockData,
    stockMovementData: global.stockMovementData,
    logsData: global.logsData,
    saveMockData: global.saveMockData,
    alert: global.alert,
    getDefaultWarehouseId: global.getDefaultWarehouseId,
    createSequentialId: global.createSequentialId,
    createRuntimeId: global.createRuntimeId,
  };
  let nextRuntimeId = 1;
  global.mockData = {
    products: [],
    suppliers: [],
    customers: [],
    customerProductPrices: [],
    companies: [],
    warehouses: [
      {
        id: "WH001",
        code: "MAIN",
        name: "主仓库",
        status: "active",
        locations: [{ code: "A01", name: "默认库位" }],
        createdAt: "2026-01-01T00:00:00",
        updatedAt: "2026-01-01T00:00:00",
      },
    ],
    bills: [],
    deliveryNotes: [],
  };
  global.stockMovementData = [
    {
      id: "SM001",
      type: "opening",
      status: "confirmed",
      productId: "P999",
    },
  ];
  global.logsData = [];
  global.saveMockData = async () => {
    assert.ok(
      global.mockData.customerProductPrices.every((record) =>
        /^\d{4}-\d{2}-\d{2}$/.test(record.effectiveFrom),
      ),
    );
    return true;
  };
  global.alert = () => {};
  global.getDefaultWarehouseId = () => "WH001";
  global.createRuntimeId = (prefix) => `${prefix}${nextRuntimeId++}`;
  global.createSequentialId = (items, prefix, padding = 3) =>
    `${prefix}${String(items.length + 1).padStart(padding, "0")}`;

  try {
    const saved = await importer.commitReviewedImports([
      {
        importKind: "customer-statement",
        statementGroupId: "示例客户丙.xlsx::Sheet1::2026-05-01",
        statementMeta: {
          sourceFileName: "示例客户丙.xlsx",
          statementDate: "2026-05-31",
          periodStart: "2026-05-01",
          periodEnd: "2026-05-31",
          taxRate: 0,
          arrears: [{ monthLabel: "2026-04 货款", amount: 100 }],
        },
        orderNo: "CC26-033",
        issueDate: "2026-05-28",
        companyId: importer.CREATE_NEW_VALUE,
        companyName: "示例电镀材料贸易部",
        companyContact: "联系人丙",
        companyPhone: "13800000000",
        companyAddress: "示例市",
        customerId: importer.CREATE_NEW_VALUE,
        customerName: "示例客户丙",
        customerContact: "",
        customerPhone: "",
        customerAddress: "示例产业园",
        paymentTerms: "月结",
        priceTaxMode: "inclusive",
        sourceFileName: "示例客户丙.xlsx",
        items: [
          {
            productId: importer.CREATE_NEW_VALUE,
            productName: "天黍99",
            specification: "",
            unit: "kg",
            quantity: 25,
            unitPrice: 6.5,
            notes: "",
          },
        ],
      },
    ]);

    assert.equal(saved, true);
    assert.equal(global.mockData.companies.length, 1);
    assert.equal(global.mockData.customers.length, 1);
    assert.equal(global.mockData.products.length, 1);
    assert.equal(global.mockData.suppliers[0].name, "历史送货单导入");
    assert.equal(global.mockData.deliveryNotes.length, 1);
    assert.equal(global.mockData.deliveryNotes[0].inventoryEffect, "none");
    assert.equal(global.mockData.deliveryNotes[0].totalAmount, 162.5);
    assert.equal(global.mockData.bills.length, 1);
    assert.equal(global.mockData.bills[0].recordType, "statement-v1");
    assert.equal(global.mockData.bills[0].documentCount, 1);
    assert.equal(global.mockData.bills[0].currentAmount, 162.5);
    assert.equal(global.mockData.bills[0].arrearsAmount, 100);
    assert.equal(global.mockData.bills[0].totalAmount, 262.5);
    assert.deepEqual(global.mockData.bills[0].sourceDocumentIds, [
      global.mockData.deliveryNotes[0].id,
    ]);
    assert.equal(global.mockData.customerProductPrices.length, 1);
    assert.deepEqual(
      {
        companyId: global.mockData.customerProductPrices[0].companyId,
        customerId: global.mockData.customerProductPrices[0].customerId,
        productId: global.mockData.customerProductPrices[0].productId,
        referencePrice: global.mockData.customerProductPrices[0].referencePrice,
        priceTaxMode: global.mockData.customerProductPrices[0].priceTaxMode,
        status: global.mockData.customerProductPrices[0].status,
        effectiveFrom: global.mockData.customerProductPrices[0].effectiveFrom,
      },
      {
        companyId: global.mockData.companies[0].id,
        customerId: global.mockData.customers[0].id,
        productId: global.mockData.products[0].id,
        referencePrice: 6.5,
        priceTaxMode: "inclusive",
        status: "active",
        effectiveFrom: "2026-05-28",
      },
    );
    assert.equal(global.stockMovementData.length, 1);
    assert.equal(global.stockMovementData[0].id, "SM001");

    const dataset = {
      ...global.mockData,
      products: global.mockData.products.map((item) => {
        const persisted = { ...item };
        delete persisted.stockQuantity;
        return persisted;
      }),
      stockMovements: [],
      logs: [],
    };
    assert.equal(schema.validateDataset(dataset), null);
  } finally {
    Object.assign(global, originalGlobals);
  }
});
