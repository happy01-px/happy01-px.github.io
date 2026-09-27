const test = require("node:test");
const assert = require("node:assert/strict");
const InventoryCore = require("../js/modules/inventory-core.js");

test("inventory index calculates product, warehouse, location and batch balances", () => {
  const records = [
    {
      type: "inbound",
      productId: "P001",
      warehouseId: "WH001",
      locationCode: "A01",
      batchNo: "B001",
      quantity: 10,
    },
    {
      type: "outbound",
      productId: "P001",
      warehouseId: "WH001",
      locationCode: "A01",
      batchNo: "B001",
      quantity: 3,
    },
    {
      type: "inbound",
      productId: "P001",
      warehouseId: "WH002",
      locationCode: "B01",
      batchNo: "B002",
      quantity: 5,
    },
    {
      type: "outbound",
      status: "voided",
      productId: "P001",
      warehouseId: "WH002",
      quantity: 99,
    },
  ];
  const index = InventoryCore.buildInventoryIndex(records);

  assert.equal(InventoryCore.getIndexedQuantity(index, "P001"), 12);
  assert.equal(
    InventoryCore.getIndexedQuantity(index, "P001", {
      warehouseId: "WH001",
    }),
    7,
  );
  assert.equal(
    InventoryCore.getIndexedQuantity(index, "P001", {
      warehouseId: "WH001",
      locationCode: "A01",
    }),
    7,
  );
  assert.equal(
    InventoryCore.getIndexedQuantity(index, "P001", {
      warehouseId: "WH001",
      batchNo: "B001",
    }),
    7,
  );
});

test("derived stock is hydrated for runtime and removed from persistence", () => {
  const products = [{ id: "P001", name: "Widget", stockQuantity: 999 }];
  const records = [
    {
      type: "opening",
      productId: "P001",
      warehouseId: "WH001",
      quantity: 8,
    },
  ];

  const hydrated = InventoryCore.hydrateProductStock(products, records);
  const persisted = InventoryCore.stripDerivedStock(hydrated);

  assert.equal(hydrated[0].stockQuantity, 8);
  assert.equal(
    Object.getOwnPropertyDescriptor(hydrated[0], "stockQuantity").enumerable,
    false,
  );
  assert.doesNotMatch(JSON.stringify(hydrated), /stockQuantity/);
  assert.equal(Object.hasOwn(persisted[0], "stockQuantity"), false);
  assert.equal(products[0].stockQuantity, 999);
});

test("inventory index handles large ledgers with one reusable aggregation", () => {
  const records = Array.from({ length: 100000 }, (_, index) => ({
    type: index % 4 === 0 ? "outbound" : "inbound",
    productId: `P${String(index % 100).padStart(3, "0")}`,
    warehouseId: index % 2 === 0 ? "WH001" : "WH002",
    quantity: 1,
  }));

  const inventoryIndex = InventoryCore.buildInventoryIndex(records);
  assert.equal(inventoryIndex.byProduct.size, 100);
  assert.equal(inventoryIndex.byWarehouse.size, 100);
  assert.equal(
    InventoryCore.getIndexedQuantity(inventoryIndex, "P001", {
      warehouseId: "WH002",
    }),
    1000,
  );
});
