const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { zipSync } = require("fflate");

const XLSX = require(path.join(__dirname, "..", "lib", "xlsx.full.min.js"));
const archiveImport = require("../server/archive-import.js");

function buildDeliveryWorkbook() {
  const rows = [
    ["示例供货公司"],
    ["销售出库单 制单日期：20260926"],
    ["地 址：示例园区 订货电话：010-00000000 13800000000联系人甲"],
    ["收货单位：示例客户", "收货地址：示例地址"],
    ["收货人：联系人乙 13800000001 结款方式：月结 NO:ZIP26-001"],
    [
      "序号",
      "产品名称",
      "规格",
      "单位",
      "出库数量",
      "含税价(RMB)",
      "金额",
      "备注",
    ],
    ["1", "测试商品", "", "kg", "2", "10", "20", ""],
    ["合计金额：", "", "￥20.00", "", "大写", "RMB20"],
  ];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.aoa_to_sheet(rows),
    "Sheet1",
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("archive entry validation rejects traversal and Office temp files", () => {
  assert.equal(archiveImport.normalizeArchiveEntryName("../secret.xlsx"), "");
  assert.equal(archiveImport.normalizeArchiveEntryName("C:/secret.xlsx"), "");
  assert.equal(
    archiveImport.normalizeArchiveEntryName("月份\\送货单.xlsx"),
    "月份/送货单.xlsx",
  );
  assert.equal(archiveImport.isSupportedWorkbook("月份/~$送货单.xlsx"), false);
  assert.equal(archiveImport.isSupportedWorkbook("月份/送货单.xlsx"), true);
});

test("ZIP archive import parses each supported workbook and ignores temp files", async () => {
  const workbook = buildDeliveryWorkbook();
  const zip = zipSync({
    "月份/送货单.xlsx": new Uint8Array(workbook),
    "月份/~$送货单.xlsx": new Uint8Array([1, 2, 3]),
    "说明.txt": new TextEncoder().encode("not a workbook"),
  });

  const result = await archiveImport.parseArchiveBuffer(
    Buffer.from(zip),
    "送货单.zip",
  );

  assert.equal(result.success, true);
  assert.equal(result.workbookCount, 1);
  assert.equal(result.readyCount, 1);
  assert.equal(result.errorCount, 0);
  assert.equal(result.records[0].relativePath, "月份/送货单.xlsx");
  assert.equal(result.records[0].documentCount, 1);
  assert.equal(result.records[0].itemCount, 1);
  assert.equal(result.records[0].documents[0].metadata.orderNo, "ZIP26-001");
  assert.equal(result.records[0].documents[0].priceTaxMode, "inclusive");
});

test("archive import reports extraction and each workbook parsing progress", async () => {
  const workbook = buildDeliveryWorkbook();
  const zip = zipSync({
    "batch/first.xlsx": new Uint8Array(workbook),
    "batch/second.xlsx": new Uint8Array(workbook),
  });
  const progress = [];

  const result = await archiveImport.parseArchiveBuffer(
    Buffer.from(zip),
    "delivery.zip",
    {
      onProgress(event) {
        progress.push(event);
      },
    },
  );

  assert.equal(result.workbookCount, 2);
  assert.deepEqual(
    progress.map(({ phase, current, total, fileName }) => ({
      phase,
      current,
      total,
      fileName,
    })),
    [
      {
        phase: "extracting",
        current: 0,
        total: 0,
        fileName: "delivery.zip",
      },
      {
        phase: "extracted",
        current: 0,
        total: 2,
        fileName: "delivery.zip",
      },
      {
        phase: "parsing",
        current: 1,
        total: 2,
        fileName: "batch/first.xlsx",
      },
      {
        phase: "parsing",
        current: 2,
        total: 2,
        fileName: "batch/second.xlsx",
      },
      {
        phase: "complete",
        current: 2,
        total: 2,
        fileName: "delivery.zip",
      },
    ],
  );
});
