const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const splitDataDir = path.join(rootDir, "data");
const combinedDataPath = path.join(rootDir, "data.json");
const AppDataSchema = require(path.join(
  rootDir,
  "js",
  "modules",
  "data-schema.js",
));
const tableNames = [
  "products",
  "suppliers",
  "customers",
  "companies",
  "warehouses",
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

  const persistedData = AppDataSchema.migrateDataset(combinedData);

  fs.writeFileSync(
    combinedDataPath,
    JSON.stringify(persistedData, null, 4),
    "utf8",
  );
  console.log(
    `synced ${path.relative(rootDir, combinedDataPath)} from split data files`,
  );
}

main();
