const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const splitDataDir = path.join(rootDir, "data");
const combinedDataPath = path.join(rootDir, "data.json");
const tableNames = [
  "products",
  "suppliers",
  "customers",
  "companies",
  "bills",
  "deliveryNotes",
  "stockMovements",
  "logs",
];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(relativePath, "utf8"));
}

function main() {
  const combinedData = {};

  tableNames.forEach((tableName) => {
    combinedData[tableName] = readJson(
      path.join(splitDataDir, `${tableName}.json`),
    );
  });

  fs.writeFileSync(
    combinedDataPath,
    JSON.stringify(combinedData, null, 4),
    "utf8",
  );
  console.log(
    `synced ${path.relative(rootDir, combinedDataPath)} from split data files`,
  );
}

main();
