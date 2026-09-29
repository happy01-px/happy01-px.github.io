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
      <button id="delivery-import-workflow-partial" class="hidden" type="button"></button>
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

test("archive batch review requires every file to be confirmed or excluded", async () => {
  const harness = createWindow({ markup: WORKFLOW_MARKUP });
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
  const first = createImportDocument();
  const second = createImportDocument();
  second.fileName = "第二份.xlsx";
  second.metadata.orderNo = "AA26-098";
  harness.window.DeliveryNoteImport.showBatchReviewPage([
    {
      archiveName: "送货单.rar",
      relativePath: "客户甲/第一份.xlsx",
      fileName: "第一份.xlsx",
      status: "pending",
      documentCount: 1,
      itemCount: 1,
      documents: [first],
      errors: [],
      warnings: [],
    },
    {
      archiveName: "送货单.rar",
      relativePath: "客户乙/第二份.xlsx",
      fileName: "第二份.xlsx",
      status: "pending",
      documentCount: 1,
      itemCount: 1,
      documents: [second],
      errors: [],
      warnings: [],
    },
    {
      archiveName: "送货单.rar",
      relativePath: "其他/无法识别.xlsx",
      fileName: "无法识别.xlsx",
      status: "error",
      documentCount: 0,
      itemCount: 0,
      documents: [],
      errors: ["表头不完整"],
      warnings: [],
    },
  ]);

  const document = harness.window.document;
  const primary = document.getElementById("delivery-import-workflow-primary");
  assert.equal(primary.disabled, true);
  assert.match(primary.textContent, /还剩 3 个/);
  assert.equal(document.querySelectorAll("[data-batch-open]").length, 3);
  assert.equal(document.querySelectorAll("[data-import-document]").length, 1);
  assert.ok(document.querySelector("[data-batch-preview-document]"));
  assert.equal(
    document
      .getElementById("delivery-import-batch-detail-form")
      .classList.contains("hidden"),
    true,
  );
  assert.ok(document.querySelector("[data-batch-edit]"));

  document.querySelector("[data-batch-edit]").click();
  assert.equal(
    document
      .getElementById("delivery-import-batch-detail-form")
      .classList.contains("hidden"),
    false,
  );
  assert.equal(document.querySelector("[data-batch-confirm]"), null);
  document.querySelector('[data-field="customerContact"]').value =
    "编辑后的联系人";
  document.querySelector("[data-batch-edit-save]").click();
  assert.ok(document.querySelector("[data-batch-confirm]"));
  assert.match(
    document.getElementById("delivery-import-batch-preview").textContent,
    /编辑后的联系人/,
  );

  document.querySelector("[data-batch-confirm]").click();
  assert.equal(primary.disabled, true);
  assert.match(primary.textContent, /还剩 2 个/);
  assert.equal(
    document
      .getElementById("delivery-import-workflow-partial")
      .classList.contains("hidden"),
    false,
  );
  assert.match(
    document.getElementById("delivery-import-workflow-partial").textContent,
    /暂时导入已确认文件（1 个）/,
  );
  assert.match(
    document.querySelector(".delivery-import-batch-detail-heading h3")
      .textContent,
    /第二份/,
  );

  document.querySelector("[data-batch-confirm]").click();
  assert.equal(primary.disabled, true);
  assert.match(primary.textContent, /还剩 1 个/);
  assert.ok(document.querySelector("[data-batch-exclude]"));

  document.querySelector("[data-batch-exclude]").click();
  await flushAsyncTasks();
  assert.equal(harness.confirmCalls.length, 1);
  assert.equal(harness.confirmCalls[0].title, "排除此文件？");
  assert.equal(primary.disabled, false);
  assert.match(primary.textContent, /已确认文件（2 个）/);
  assert.equal(
    document.querySelector('[data-batch-count="excluded"]').textContent,
    "1",
  );

  harness.close();
});

test("partial archive import saves only confirmed files and filters them next time", async () => {
  const harness = createWindow({ markup: WORKFLOW_MARKUP });
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
    bills: [],
    customerProductPrices: [],
    deliveryNotes: [],
  };
  const first = createImportDocument();
  const second = createImportDocument();
  second.metadata.orderNo = "AA26-098";
  const records = [first, second].map((documentData, index) => ({
    archiveName: "销售出货单.rar",
    relativePath: `客户甲/送货单${index + 1}.xlsx`,
    fileName: `送货单${index + 1}.xlsx`,
    status: "pending",
    documentCount: 1,
    itemCount: 1,
    documents: [documentData],
    errors: [],
    warnings: [],
  }));

  harness.window.DeliveryNoteImport.showBatchReviewPage(records);
  const document = harness.window.document;
  document.querySelector("[data-batch-confirm]").click();
  document.getElementById("delivery-import-workflow-partial").click();
  await flushAsyncTasks(4);

  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /暂时导入的已确认文件/,
  );
  assert.equal(harness.confirmCalls.at(-1).okText, "预览已确认文件");
  document.getElementById("delivery-import-workflow-primary").click();
  await flushAsyncTasks(4);

  assert.equal(harness.window.mockData.deliveryNotes.length, 1);
  assert.equal(
    harness.window.mockData.deliveryNotes[0].sourceArchiveEntryKey,
    "销售出货单.rar::客户甲/送货单1.xlsx",
  );
  const filtered =
    harness.window.DeliveryNoteImport.filterPreviouslyImportedArchiveRecords(
      records,
      harness.window.mockData,
    );
  assert.equal(filtered.skipped.length, 1);
  assert.equal(filtered.pending.length, 1);
  assert.equal(filtered.pending[0].fileName, "送货单2.xlsx");

  harness.close();
});

test("confirmed files with the same order number merge instead of blocking preview", async () => {
  const harness = createWindow({ markup: WORKFLOW_MARKUP });
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
    bills: [],
    customerProductPrices: [],
    deliveryNotes: [],
  };
  const first = createImportDocument();
  first.sourceFileName = "HS26-002.xlsx";
  first.sourceArchiveEntryKey = "销售出货单.rar::环晟/hs26-002.xlsx";
  const duplicate = createImportDocument();
  duplicate.fileName = "HS26-002.xlsx-1.xlsx";
  duplicate.sourceFileName = "HS26-002.xlsx-1.xlsx";
  duplicate.sourceArchiveEntryKey = "销售出货单.rar::环晟/hs26-002.xlsx-1.xlsx";
  const records = [first, duplicate].map((documentData, index) => ({
    archiveName: "销售出货单.rar",
    relativePath: `环晟/${documentData.fileName}`,
    fileName: documentData.fileName,
    status: "pending",
    documentCount: 1,
    itemCount: 1,
    documents: [documentData],
    errors: [],
    warnings: [],
    id: `same-order-${index + 1}`,
  }));

  harness.window.DeliveryNoteImport.showBatchReviewPage(records);
  const document = harness.window.document;
  document.querySelector("[data-batch-confirm]").click();
  document.querySelector("[data-batch-confirm]").click();
  document.getElementById("delivery-import-workflow-primary").click();
  await flushAsyncTasks(3);

  assert.equal(harness.alerts.length, 0);
  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /预览本次新增与补充内容/,
  );
  assert.match(
    document.querySelector("[data-import-merge-summary]").textContent,
    /相同送货单号已自动合并.*AA26-097.*去除 1 条完全重复/s,
  );

  const plan = harness.window.DeliveryNoteImport.createImportPlan(
    harness.window.DeliveryNoteImport.mergeDocumentsByOrderNumber([
      {
        ...records[0].documents[0],
        orderNo: "AA26-097",
        issueDate: "2026-08-07",
        companyName: "示例供货公司甲",
        customerName: "示例客户甲",
      },
      {
        ...records[1].documents[0],
        orderNo: "AA26-097",
        issueDate: "2026-08-07",
        companyName: "示例供货公司甲",
        customerName: "示例客户甲",
      },
    ]).documents,
  );
  assert.equal(plan.deliveryNotes.length, 1);
  assert.equal(plan.deliveryNotes[0].details.length, 1);
  assert.equal(plan.deliveryNotes[0].sourceArchiveEntryKeys.length, 2);
  const filteredAfterMerge =
    harness.window.DeliveryNoteImport.filterPreviouslyImportedArchiveRecords(
      records,
      { deliveryNotes: plan.deliveryNotes },
    );
  assert.equal(filteredAfterMerge.skipped.length, 2);
  assert.equal(filteredAfterMerge.pending.length, 0);

  harness.close();
});

test("archive screening lists recognized, failed and automatically filtered files before review", async () => {
  const harness = createWindow({ markup: WORKFLOW_MARKUP });
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
  const recognizedDocument = createImportDocument();
  const recognized = {
    archiveName: "销售出货单.rar",
    relativePath: "华庆/识别成功.xlsx",
    fileName: "识别成功.xlsx",
    status: "pending",
    documentCount: 1,
    itemCount: 1,
    documents: [recognizedDocument],
    errors: [],
    warnings: [],
  };
  const failed = {
    archiveName: "销售出货单.rar",
    relativePath: "华庆/识别失败.xlsx",
    fileName: "识别失败.xlsx",
    status: "error",
    documentCount: 0,
    itemCount: 0,
    documents: [],
    errors: ["没有找到送货单表头"],
    warnings: [],
  };
  const filtered = {
    ...recognized,
    relativePath: "华庆/上次已导入.xlsx",
    fileName: "上次已导入.xlsx",
  };

  harness.window.DeliveryNoteImport.showArchiveScreeningPage(
    [recognized, failed],
    [filtered],
  );

  const document = harness.window.document;
  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /检查压缩包解析结果/,
  );
  assert.equal(
    document.querySelector('[data-archive-screening-tab="recognized"] strong')
      .textContent,
    "1",
  );
  assert.equal(
    document.querySelector('[data-archive-screening-tab="unrecognized"] strong')
      .textContent,
    "1",
  );
  assert.equal(
    document.querySelector('[data-archive-screening-tab="filtered"] strong')
      .textContent,
    "1",
  );
  assert.match(
    document.querySelector('[data-archive-screening-panel="unrecognized"]')
      .textContent,
    /识别失败\.xlsx.*没有找到送货单表头/s,
  );

  document.querySelector('[data-archive-screening-tab="filtered"]').click();
  assert.equal(
    document.querySelector('[data-archive-screening-panel="filtered"]').hidden,
    false,
  );
  assert.match(
    document.querySelector('[data-archive-screening-panel="filtered"]')
      .textContent,
    /上次已导入\.xlsx.*自动过滤/s,
  );

  document.getElementById("delivery-import-workflow-primary").click();
  await flushAsyncTasks();
  assert.match(
    document.getElementById("delivery-import-workflow-title").textContent,
    /批量核对压缩包/,
  );
  assert.equal(document.querySelectorAll("[data-batch-open]").length, 2);
  assert.doesNotMatch(
    document.getElementById("delivery-import-batch-review").textContent,
    /上次已导入\.xlsx/,
  );

  harness.close();
});

test("archive batch selection keeps the queue page and detail in sync", async () => {
  const harness = createWindow({ markup: `<main>${WORKFLOW_MARKUP}</main>` });
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
  const records = Array.from({ length: 45 }, (_, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    const documentData = createImportDocument();
    documentData.fileName = `送货单${sequence}.xlsx`;
    documentData.metadata.orderNo = `AA26-${sequence}`;
    return {
      archiveName: "送货单.rar",
      relativePath: `客户/送货单${sequence}.xlsx`,
      fileName: `送货单${sequence}.xlsx`,
      status: "pending",
      documentCount: 1,
      itemCount: 1,
      documents: [documentData],
      errors: [],
      warnings: [],
    };
  });

  harness.window.DeliveryNoteImport.showBatchReviewPage(records);
  const document = harness.window.document;
  const main = document.querySelector("main");
  main.scrollTo = function (_left, top) {
    this.scrollTop = top;
  };
  main.scrollTop = 420;
  document.querySelector(".delivery-import-batch-queue").scrollTop = 180;
  document.querySelector('[data-batch-open="batch-file-40"]').click();

  assert.equal(
    document.querySelector(".delivery-import-batch-row.is-active").dataset
      .batchRecordId,
    "batch-file-40",
  );
  assert.match(
    document.querySelector(".delivery-import-batch-detail-heading h3")
      .textContent,
    /送货单40\.xlsx/,
  );
  assert.equal(main.scrollTop, 420);
  assert.equal(
    document.querySelector(".delivery-import-batch-queue").scrollTop,
    180,
  );

  document.querySelector("[data-batch-confirm]").click();
  await flushAsyncTasks();

  assert.match(
    document.querySelector(".delivery-import-batch-pagination").textContent,
    /第 2\/2 页/,
  );
  assert.equal(
    document.querySelector(".delivery-import-batch-row.is-active").dataset
      .batchRecordId,
    "batch-file-41",
  );
  assert.match(
    document.querySelector(".delivery-import-batch-detail-heading h3")
      .textContent,
    /送货单41\.xlsx/,
  );
  assert.equal(main.scrollTop, 420);

  harness.close();
});

test("archive batch review confirms only safe files in bulk", async () => {
  const harness = createWindow({ markup: `<main>${WORKFLOW_MARKUP}</main>` });
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
  const records = ["001", "002", "003"].map((sequence, index) => ({
    archiveName: "送货单.rar",
    relativePath: `客户甲/送货单${sequence}.xlsx`,
    fileName: `送货单${sequence}.xlsx`,
    status: "pending",
    documentCount: 1,
    itemCount: 1,
    documents: [createImportDocument()],
    errors: [],
    warnings: index === 1 ? ["客户名称需要人工复核"] : [],
  }));

  harness.window.DeliveryNoteImport.showBatchReviewPage(records);
  const document = harness.window.document;
  assert.ok(document.getElementById("delivery-import-batch-confirm-page"));
  assert.ok(document.getElementById("delivery-import-batch-confirm-directory"));
  assert.ok(document.getElementById("delivery-import-batch-confirm-selected"));
  assert.ok(document.getElementById("delivery-import-batch-exclude-selected"));

  document.getElementById("delivery-import-batch-confirm-page").click();
  await flushAsyncTasks();

  assert.equal(
    document.querySelector('[data-batch-count="confirmed"]').textContent,
    "2",
  );
  assert.equal(
    document.querySelector('[data-batch-count="pending"]').textContent,
    "1",
  );
  assert.match(
    document.getElementById("delivery-import-batch-review").textContent,
    /客户名称需要人工复核|1 项提醒/,
  );

  harness.close();
});

test("archive import discovers a compatible local preview service", async () => {
  const harness = createWindow({
    markup: `${WORKFLOW_MARKUP}<button id="historical-business-import-btn"></button>`,
    url: "http://127.0.0.1:8080/",
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

  const calls = [];
  const parsedDocument = createImportDocument();
  harness.window.fetch = async (endpoint, options = {}) => {
    const bodySize = Number(
      options.body?.byteLength || options.body?.size || 0,
    );
    calls.push({ endpoint: String(endpoint), bodySize });
    const isCompatibleEndpoint =
      String(endpoint) === "http://127.0.0.1:8083/api/import/archive";
    if (!isCompatibleEndpoint) {
      return {
        ok: false,
        status: 404,
        headers: { get: () => "text/plain" },
        json: async () => {
          throw new Error("not json");
        },
      };
    }
    if (bodySize === 0) {
      return {
        ok: false,
        status: 400,
        headers: {
          get: (name) =>
            name.toLowerCase() === "x-archive-progress"
              ? "ndjson"
              : "application/json; charset=utf-8",
        },
        json: async () => ({ success: false, error: "压缩包内容为空。" }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/json; charset=utf-8" },
      json: async () => ({
        success: true,
        records: [
          {
            archiveName: "销售出货单.rar",
            relativePath: "客户甲/送货单.xlsx",
            fileName: "送货单.xlsx",
            status: "pending",
            documentCount: 1,
            itemCount: 1,
            documents: [parsedDocument],
            errors: [],
            warnings: [],
          },
        ],
      }),
    };
  };

  const archiveFile = {
    name: "销售出货单.rar",
    size: 4,
    arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
  };
  const handled = await harness.window.DeliveryNoteImport.handleFiles([
    archiveFile,
  ]);

  assert.equal(handled, true);
  assert.deepEqual(
    calls.filter((call) => call.bodySize > 0),
    [
      {
        endpoint: "http://127.0.0.1:8083/api/import/archive",
        bodySize: 4,
      },
    ],
  );
  assert.match(
    harness.window.document.getElementById("delivery-import-workflow-title")
      .textContent,
    /检查压缩包解析结果/,
  );
  harness.window.document
    .getElementById("delivery-import-workflow-primary")
    .click();
  await flushAsyncTasks();
  assert.match(
    harness.window.document.getElementById("delivery-import-workflow-title")
      .textContent,
    /批量核对/,
  );
  harness.close();
});

test("archive progress dialog shows the live count and current workbook", async () => {
  const harness = createWindow({
    markup: `${WORKFLOW_MARKUP}<button id="historical-business-import-btn"></button>`,
    url: "http://127.0.0.1:8083/",
  });
  harness.window.TextDecoder = TextDecoder;
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

  const parsedDocument = createImportDocument();
  const record = {
    archiveName: "销售出货单.rar",
    relativePath: "客户甲/2026年8月/送货单1170.xlsx",
    fileName: "送货单1170.xlsx",
    status: "pending",
    documentCount: 1,
    itemCount: 1,
    documents: [parsedDocument],
    errors: [],
    warnings: [],
  };
  /** @type {(() => void) | undefined} */
  let releaseRegressedProgress;
  const regressedProgressGate = new Promise((resolve) => {
    releaseRegressedProgress = () => resolve(undefined);
  });
  /** @type {(() => void) | undefined} */
  let releaseCompletion;
  const completionGate = new Promise((resolve) => {
    releaseCompletion = () => resolve(undefined);
  });
  let readCount = 0;
  const encoder = new TextEncoder();
  harness.window.fetch = async (_endpoint, options = {}) => {
    const bodySize = Number(options.body?.byteLength || 0);
    if (bodySize === 0) {
      return {
        ok: false,
        status: 400,
        headers: {
          get: (name) =>
            name.toLowerCase() === "x-archive-progress"
              ? "ndjson"
              : "application/json; charset=utf-8",
        },
        json: async () => ({ success: false, error: "压缩包内容为空。" }),
      };
    }
    return {
      ok: true,
      status: 200,
      headers: { get: () => "application/x-ndjson; charset=utf-8" },
      body: {
        getReader() {
          return {
            async read() {
              readCount += 1;
              if (readCount === 1) {
                return {
                  done: false,
                  value: encoder.encode(
                    `${JSON.stringify({
                      type: "progress",
                      phase: "parsing",
                      current: 2,
                      total: 1170,
                      fileName: "客户甲/2026年8月/送货单0002.xlsx",
                    })}\n`,
                  ),
                };
              }
              if (readCount === 2) {
                await regressedProgressGate;
                return {
                  done: false,
                  value: encoder.encode(
                    `${JSON.stringify({
                      type: "progress",
                      phase: "parsing",
                      current: 1,
                      total: 1170,
                      fileName: "客户甲/2026年8月/送货单0001.xlsx",
                    })}\n`,
                  ),
                };
              }
              if (readCount === 3) {
                await completionGate;
                return {
                  done: false,
                  value: encoder.encode(
                    `${JSON.stringify({
                      type: "complete",
                      result: { success: true, records: [record] },
                    })}\n`,
                  ),
                };
              }
              return { done: true, value: undefined };
            },
          };
        },
      },
    };
  };

  const pendingImport = harness.window.DeliveryNoteImport.handleFiles([
    {
      name: "销售出货单.rar",
      size: 4,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    },
  ]);
  await flushAsyncTasks();

  const dialog = harness.window.document.getElementById(
    "archive-import-progress-dialog",
  );
  assert.ok(dialog);
  assert.equal(
    dialog.querySelector("[data-archive-progress-status]").textContent,
    "正在解析 2/1170",
  );
  assert.equal(
    dialog.querySelector("[data-archive-progress-file]").textContent,
    "客户甲/2026年8月/送货单0002.xlsx",
  );
  assert.equal(
    dialog
      .querySelector(".archive-import-progress-track")
      .classList.contains("is-indeterminate"),
    false,
  );
  const progressWidthBeforeRegression = Number.parseFloat(
    dialog.querySelector("[data-archive-progress-bar]").style.width,
  );
  releaseRegressedProgress?.();
  await flushAsyncTasks();
  const progressWidthAfterRegression = Number.parseFloat(
    dialog.querySelector("[data-archive-progress-bar]").style.width,
  );
  assert.equal(progressWidthAfterRegression, progressWidthBeforeRegression);

  releaseCompletion?.();
  assert.equal(await pendingImport, true);
  assert.equal(
    harness.window.document.getElementById("archive-import-progress-dialog"),
    null,
  );
  harness.close();
});

test("archive import exits only after a second confirmation and aborts the request", async () => {
  const harness = createWindow({
    markup: `${WORKFLOW_MARKUP}<button id="historical-business-import-btn"></button>`,
    url: "http://127.0.0.1:8085/",
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
  /** @type {any} */
  let uploadSignal;
  harness.window.fetch = async (_endpoint, options = {}) => {
    const bodySize = Number(options.body?.byteLength || 0);
    if (bodySize === 0) {
      return {
        ok: false,
        status: 400,
        headers: {
          get: (name) =>
            name.toLowerCase() === "x-archive-progress"
              ? "ndjson"
              : "application/json; charset=utf-8",
        },
        json: async () => ({ success: false, error: "压缩包内容为空。" }),
      };
    }
    uploadSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal?.addEventListener(
        "abort",
        () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        },
        { once: true },
      );
    });
  };

  const pendingImport = harness.window.DeliveryNoteImport.handleFiles([
    {
      name: "销售出货单.rar",
      size: 4,
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    },
  ]);
  await flushAsyncTasks();

  const exitButton = harness.window.document.querySelector(
    "[data-archive-progress-exit]",
  );
  assert.ok(exitButton);
  harness.window.queueConfirmResult(false);
  exitButton.click();
  await flushAsyncTasks();
  assert.equal(harness.confirmCalls.length, 1);
  assert.match(harness.confirmCalls[0].title, /退出压缩包解析/);
  assert.equal(exitButton.disabled, false);
  assert.equal(uploadSignal.aborted, false);

  harness.window.queueConfirmResult(true);
  exitButton.click();
  assert.equal(await pendingImport, false);
  assert.equal(harness.confirmCalls.length, 2);
  assert.equal(uploadSignal.aborted, true);
  assert.equal(harness.alerts.length, 0);
  assert.equal(
    harness.window.document.getElementById("archive-import-progress-dialog"),
    null,
  );
  harness.close();
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

test("history import refresh without a draft returns to import settings", () => {
  const harness = createWindow({ markup: WORKFLOW_MARKUP });
  loadScripts(harness.window, [
    "js/modules/app-utils.js",
    "js/app/app-shell.js",
    "js/modules/delivery-note-import.js",
  ]);
  harness.window.mockData = { deliveryNotes: [] };

  assert.equal(harness.window.DeliveryNoteImport.restoreWorkflowDraft(), false);
  assert.equal(
    harness.window.document
      .getElementById("settings")
      .classList.contains("hidden"),
    false,
  );
  assert.equal(
    harness.window.document
      .getElementById("history-import-workflow")
      .classList.contains("hidden"),
    true,
  );
  assert.equal(harness.showSectionCalls.at(-1), "settings");

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
