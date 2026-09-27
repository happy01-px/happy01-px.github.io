const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const SQLITE_SCHEMA_VERSION = 1;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function createConflictError(expectedRevision, currentRevision) {
  const error = /** @type {Error & {code: string, currentRevision: number}} */ (
    new Error(
      `Dataset revision conflict: expected ${expectedRevision}, current ${currentRevision}`,
    )
  );
  error.code = "REVISION_CONFLICT";
  error.currentRevision = currentRevision;
  return error;
}

class SQLiteInventoryStore {
  constructor(options) {
    this.filePath = options.filePath;
    this.dataTables = options.dataTables;
    this.formatVersion = options.formatVersion;
    this.validateDataset = options.validateDataset;
    this.database = null;
  }

  open() {
    if (this.database) return;

    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    this.database = new DatabaseSync(this.filePath);
    this.database.exec("PRAGMA journal_mode = WAL");
    this.database.exec("PRAGMA synchronous = FULL");
    this.database.exec("PRAGMA busy_timeout = 5000");
    this.database.exec("PRAGMA foreign_keys = ON");
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS app_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) STRICT;

      CREATE TABLE IF NOT EXISTS business_records (
        table_name TEXT NOT NULL,
        record_id TEXT NOT NULL,
        position INTEGER NOT NULL,
        payload_json TEXT NOT NULL,
        PRIMARY KEY (table_name, record_id)
      ) STRICT;

      CREATE INDEX IF NOT EXISTS idx_business_records_table_position
        ON business_records (table_name, position, record_id);

      CREATE TABLE IF NOT EXISTS business_transactions (
        revision INTEGER PRIMARY KEY,
        committed_at TEXT NOT NULL,
        change_summary_json TEXT NOT NULL
      ) STRICT;
    `);
  }

  close() {
    if (!this.database) return;
    this.database.close();
    this.database = null;
  }

  getMeta(key) {
    const row = this.database
      .prepare("SELECT value FROM app_meta WHERE key = ?")
      .get(key);
    return row ? String(row.value) : null;
  }

  setMeta(key, value) {
    this.database
      .prepare(
        `INSERT INTO app_meta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      )
      .run(key, String(value));
  }

  isInitialized() {
    this.open();
    return this.getMeta("schema_version") !== null;
  }

  initialize(seedSnapshot) {
    this.open();

    if (this.isInitialized()) {
      const schemaVersion = Number(this.getMeta("schema_version"));
      if (schemaVersion !== SQLITE_SCHEMA_VERSION) {
        throw new Error(`Unsupported SQLite schema version: ${schemaVersion}`);
      }
      return this.readSnapshot();
    }

    if (!seedSnapshot?.dataset) {
      throw new Error("SQLite initialization requires a seed dataset");
    }

    const validationError = this.validateDataset(seedSnapshot.dataset);
    if (validationError) throw new Error(validationError);

    const revision = Number.isInteger(seedSnapshot.revision)
      ? seedSnapshot.revision
      : 0;
    const updatedAt = seedSnapshot.updatedAt || new Date().toISOString();

    this.database.exec("BEGIN IMMEDIATE");
    try {
      this.replaceAllRecords(seedSnapshot.dataset);
      this.setMeta("schema_version", SQLITE_SCHEMA_VERSION);
      this.setMeta("format_version", this.formatVersion);
      this.setMeta("revision", revision);
      this.setMeta("updated_at", updatedAt);
      this.database
        .prepare(
          `INSERT INTO business_transactions
             (revision, committed_at, change_summary_json)
           VALUES (?, ?, ?)`,
        )
        .run(
          revision,
          updatedAt,
          JSON.stringify({ type: "legacy-import", tables: this.dataTables }),
        );
      this.database.exec("COMMIT");
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }

    return this.readSnapshot();
  }

  replaceAllRecords(dataset) {
    this.database.exec("DELETE FROM business_records");
    const insert = this.database.prepare(
      `INSERT INTO business_records
         (table_name, record_id, position, payload_json)
       VALUES (?, ?, ?, ?)`,
    );

    this.dataTables.forEach((tableName) => {
      dataset[tableName].forEach((record, position) => {
        insert.run(
          tableName,
          String(record.id),
          position,
          JSON.stringify(record),
        );
      });
    });
  }

  readDataset() {
    const dataset = Object.fromEntries(
      this.dataTables.map((tableName) => [tableName, []]),
    );
    const rows = this.database
      .prepare(
        `SELECT table_name, payload_json
           FROM business_records
          ORDER BY table_name, position, record_id`,
      )
      .all();

    rows.forEach((row) => {
      const tableName = String(row.table_name);
      if (!Object.prototype.hasOwnProperty.call(dataset, tableName)) return;
      dataset[tableName].push(JSON.parse(String(row.payload_json)));
    });

    return dataset;
  }

  readSnapshot() {
    this.open();
    if (!this.isInitialized()) {
      throw new Error("SQLite inventory database is not initialized");
    }

    const dataset = this.readDataset();
    const validationError = this.validateDataset(dataset);
    if (validationError) {
      throw new Error(`SQLite dataset validation failed: ${validationError}`);
    }

    return {
      formatVersion: this.formatVersion,
      revision: Number(this.getMeta("revision")) || 0,
      updatedAt: this.getMeta("updated_at"),
      dataset,
    };
  }

  normalizeChanges(rawChanges) {
    if (
      !rawChanges ||
      typeof rawChanges !== "object" ||
      Array.isArray(rawChanges)
    ) {
      throw new Error("Transaction changes must be an object");
    }

    const unknownTables = Object.keys(rawChanges).filter(
      (tableName) => !this.dataTables.includes(tableName),
    );
    if (unknownTables.length) {
      throw new Error(`Unknown transaction table: ${unknownTables[0]}`);
    }

    const normalized = {};
    this.dataTables.forEach((tableName) => {
      const tableChanges = rawChanges[tableName];
      if (tableChanges === undefined) return;
      if (
        !tableChanges ||
        typeof tableChanges !== "object" ||
        Array.isArray(tableChanges)
      ) {
        throw new Error(
          `Transaction changes for ${tableName} must be an object`,
        );
      }

      const upsert = Array.isArray(tableChanges.upsert)
        ? clone(tableChanges.upsert)
        : [];
      const remove = Array.isArray(tableChanges.delete)
        ? tableChanges.delete.map((id) => String(id))
        : [];
      const order = Array.isArray(tableChanges.order)
        ? tableChanges.order.map((id) => String(id))
        : null;

      if (new Set(remove).size !== remove.length) {
        throw new Error(`${tableName}.delete contains duplicate ids`);
      }
      const upsertIds = upsert.map((record) => String(record?.id || ""));
      if (upsertIds.some((id) => !id)) {
        throw new Error(`${tableName}.upsert contains a record without an id`);
      }
      if (new Set(upsertIds).size !== upsertIds.length) {
        throw new Error(`${tableName}.upsert contains duplicate ids`);
      }
      if (upsertIds.some((id) => remove.includes(id))) {
        throw new Error(`${tableName} cannot upsert and delete the same id`);
      }
      if (order && new Set(order).size !== order.length) {
        throw new Error(`${tableName}.order contains duplicate ids`);
      }

      normalized[tableName] = { upsert, delete: remove, order };
    });

    return normalized;
  }

  applyChanges(dataset, changes) {
    const nextDataset = clone(dataset);

    Object.entries(changes).forEach(([tableName, tableChanges]) => {
      const currentRecords = nextDataset[tableName];
      const removeIds = new Set(tableChanges.delete);
      const upsertById = new Map(
        tableChanges.upsert.map((record) => [String(record.id), record]),
      );

      let nextRecords = currentRecords
        .filter((record) => !removeIds.has(String(record.id)))
        .map((record) => upsertById.get(String(record.id)) || record);

      const existingIds = new Set(
        nextRecords.map((record) => String(record.id)),
      );
      tableChanges.upsert.forEach((record) => {
        if (!existingIds.has(String(record.id))) {
          nextRecords.unshift(record);
          existingIds.add(String(record.id));
        }
      });

      if (tableChanges.order) {
        const recordById = new Map(
          nextRecords.map((record) => [String(record.id), record]),
        );
        if (
          tableChanges.order.length !== recordById.size ||
          tableChanges.order.some((id) => !recordById.has(id))
        ) {
          throw new Error(`${tableName}.order must contain every resulting id`);
        }
        nextRecords = tableChanges.order.map((id) => recordById.get(id));
      }

      nextDataset[tableName] = nextRecords;
    });

    return nextDataset;
  }

  writeChanges(changes, nextDataset) {
    const remove = this.database.prepare(
      "DELETE FROM business_records WHERE table_name = ? AND record_id = ?",
    );
    const upsert = this.database.prepare(
      `INSERT INTO business_records
         (table_name, record_id, position, payload_json)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(table_name, record_id) DO UPDATE SET
         position = excluded.position,
         payload_json = excluded.payload_json`,
    );
    const updatePosition = this.database.prepare(
      `UPDATE business_records
          SET position = ?
        WHERE table_name = ? AND record_id = ?`,
    );

    Object.entries(changes).forEach(([tableName, tableChanges]) => {
      tableChanges.delete.forEach((recordId) =>
        remove.run(tableName, recordId),
      );

      const positionById = new Map(
        nextDataset[tableName].map((record, position) => [
          String(record.id),
          position,
        ]),
      );
      tableChanges.upsert.forEach((record) => {
        upsert.run(
          tableName,
          String(record.id),
          positionById.get(String(record.id)),
          JSON.stringify(record),
        );
      });

      nextDataset[tableName].forEach((record, position) => {
        updatePosition.run(position, tableName, String(record.id));
      });
    });
  }

  commitChanges(rawChanges, expectedRevision) {
    this.open();
    const changes = this.normalizeChanges(rawChanges);

    this.database.exec("BEGIN IMMEDIATE");
    try {
      const currentRevision = Number(this.getMeta("revision")) || 0;
      if (expectedRevision !== currentRevision) {
        throw createConflictError(expectedRevision, currentRevision);
      }

      const currentDataset = this.readDataset();
      const nextDataset = this.applyChanges(currentDataset, changes);
      const validationError = this.validateDataset(nextDataset);
      if (validationError) throw new Error(validationError);

      const revision = currentRevision + 1;
      const updatedAt = new Date().toISOString();
      this.writeChanges(changes, nextDataset);
      this.setMeta("revision", revision);
      this.setMeta("updated_at", updatedAt);
      this.database
        .prepare(
          `INSERT INTO business_transactions
             (revision, committed_at, change_summary_json)
           VALUES (?, ?, ?)`,
        )
        .run(
          revision,
          updatedAt,
          JSON.stringify(
            Object.fromEntries(
              Object.entries(changes).map(([tableName, tableChanges]) => [
                tableName,
                {
                  upserted: tableChanges.upsert.map((record) =>
                    String(record.id),
                  ),
                  deleted: tableChanges.delete,
                  reordered: !!tableChanges.order,
                },
              ]),
            ),
          ),
        );
      this.database.exec("COMMIT");

      return {
        formatVersion: this.formatVersion,
        revision,
        updatedAt,
        dataset: nextDataset,
      };
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }

  replaceDataset(dataset, expectedRevision) {
    const current = this.readSnapshot();
    const changes = {};

    this.dataTables.forEach((tableName) => {
      const nextRecords = dataset[tableName];
      const nextIds = new Set(nextRecords.map((record) => String(record.id)));
      changes[tableName] = {
        upsert: nextRecords,
        delete: current.dataset[tableName]
          .map((record) => String(record.id))
          .filter((id) => !nextIds.has(id)),
        order: nextRecords.map((record) => String(record.id)),
      };
    });

    return this.commitChanges(changes, expectedRevision);
  }
}

module.exports = {
  SQLITE_SCHEMA_VERSION,
  SQLiteInventoryStore,
};
