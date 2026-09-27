const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const outputDir = path.join(projectRoot, ".runtime", "export-verification");
const testDataDir = path.join(projectRoot, ".runtime", "export-test-data");

process.env.INVENTORY_DATA_DIR = testDataDir;

const XLSX = require(path.join(projectRoot, "lib", "xlsx.full.min.js"));
const { startInventoryServer, stopInventoryServer } = require(
  path.join(projectRoot, "preview_server.js"),
);

function verifyExcelExport() {
  const outputPath = path.join(outputDir, "statement-verification.xlsx");
  const worksheet = XLSX.utils.aoa_to_sheet([
    ["库存管理系统 - Excel 导出验证"],
    ["对账单编号", "TEST-XLSX-001"],
    [],
    ["商品", "数量", "金额"],
    ["示例商品", 2, 1200],
  ]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "对账单");
  const workbookBytes = Buffer.from(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      compression: true,
    }),
  );
  fs.writeFileSync(outputPath, workbookBytes);

  const bytes = fs.readFileSync(outputPath);
  const reopened = XLSX.read(bytes, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json(reopened.Sheets["对账单"], {
    header: 1,
    raw: true,
  });
  const hasExpectedData = rows.some(
    (row) => row[0] === "示例商品" && row[1] === 2 && row[2] === 1200,
  );
  if (bytes.subarray(0, 2).toString("ascii") !== "PK" || !hasExpectedData) {
    throw new Error("Excel export verification failed");
  }

  return {
    outputPath,
    size: bytes.length,
    sheetCount: reopened.SheetNames.length,
  };
}

async function verifyPdfExport(serverUrl) {
  const outputPath = path.join(outputDir, "statement-verification.pdf");
  const response = await fetch(new URL("api/export/pdf", serverUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: "statement-verification.pdf",
      html: `<!doctype html>
        <html lang="zh-CN">
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: "Microsoft YaHei", sans-serif; padding: 32px; color: #111827; }
              table { width: 100%; border-collapse: collapse; }
              th, td { border: 1px solid #9ca3af; padding: 8px; text-align: left; }
            </style>
          </head>
          <body>
            <h1>库存管理系统 - PDF 导出验证</h1>
            <p>对账单编号：TEST-PDF-001</p>
            <table>
              <tr><th>商品</th><th>数量</th><th>金额</th></tr>
              <tr><td>示例商品</td><td>2</td><td>1200.00</td></tr>
            </table>
          </body>
        </html>`,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `PDF export returned HTTP ${response.status}: ${await response.text()}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, bytes);
  if (
    response.headers.get("content-type") !== "application/pdf" ||
    bytes.subarray(0, 5).toString("ascii") !== "%PDF-" ||
    bytes.length < 1000
  ) {
    throw new Error("PDF export verification failed");
  }

  return { outputPath, size: bytes.length };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const excel = verifyExcelExport();
  const serverInfo = await startInventoryServer();
  try {
    const pdf = await verifyPdfExport(serverInfo.url);
    console.log(JSON.stringify({ success: true, excel, pdf }, null, 2));
  } finally {
    await stopInventoryServer();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
