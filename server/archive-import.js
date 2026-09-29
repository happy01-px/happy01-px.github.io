const path = require("path");
const { unzipSync } = require("fflate");
const { createExtractorFromData } = require("node-unrar-js");

const XLSX = require(path.join(__dirname, "..", "lib", "xlsx.full.min.js"));
global.XLSX = global.XLSX || XLSX;
const DeliveryNoteImport = require("../js/modules/delivery-note-import.js");

const MAX_ARCHIVE_SIZE = 80 * 1024 * 1024;
const MAX_WORKBOOK_COUNT = 3000;
const MAX_WORKBOOK_SIZE = 20 * 1024 * 1024;
const MAX_EXTRACTED_SIZE = 200 * 1024 * 1024;

function normalizeArchiveEntryName(value) {
  const normalized = String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
  if (
    !normalized ||
    normalized.startsWith("/") ||
    /^[a-z]:\//i.test(normalized) ||
    normalized.split("/").some((segment) => segment === "..")
  ) {
    return "";
  }
  return normalized;
}

function isSupportedWorkbook(name) {
  const normalized = normalizeArchiveEntryName(name);
  if (!normalized || !/\.xlsx?$/i.test(normalized)) return false;
  return !path.posix.basename(normalized).startsWith("~$");
}

function validateWorkbookEntries(entries) {
  if (!entries.length) {
    throw new Error("压缩包中没有可导入的 .xlsx 或 .xls 文件。");
  }
  if (entries.length > MAX_WORKBOOK_COUNT) {
    throw new Error(
      `压缩包内 Excel 文件超过 ${MAX_WORKBOOK_COUNT} 个，请拆分后导入。`,
    );
  }
  let totalSize = 0;
  for (const entry of entries) {
    const size = Number(entry.size) || 0;
    if (size > MAX_WORKBOOK_SIZE) {
      throw new Error(
        `文件“${path.posix.basename(entry.name)}”超过 20MB，无法导入。`,
      );
    }
    totalSize += size;
  }
  if (totalSize > MAX_EXTRACTED_SIZE) {
    throw new Error("压缩包内 Excel 解压后总大小超过 200MB，请拆分后导入。");
  }
}

function toArrayBuffer(buffer) {
  return buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength,
  );
}

async function extractRarWorkbooks(buffer) {
  const extractor = await createExtractorFromData({
    data: toArrayBuffer(buffer),
  });
  const list = extractor.getFileList();
  if (list.arcHeader?.flags?.volume) {
    throw new Error("暂不支持分卷 RAR，请先合并为单个压缩包。");
  }
  if (list.arcHeader?.flags?.headerEncrypted) {
    throw new Error("压缩包已加密，请先解除密码后再导入。");
  }

  const headers = [...list.fileHeaders];
  const candidates = headers
    .filter(
      (header) =>
        !header.flags?.directory &&
        !header.flags?.encrypted &&
        isSupportedWorkbook(header.name),
    )
    .map((header) => ({
      name: normalizeArchiveEntryName(header.name),
      originalName: header.name,
      size: Number(header.unpSize) || 0,
    }));
  validateWorkbookEntries(candidates);

  const allowedNames = new Set(candidates.map((entry) => entry.originalName));
  const extracted = extractor.extract({
    files: (header) => allowedNames.has(header.name),
  });
  const workbooks = [];
  for (const file of extracted.files) {
    if (!file.extraction) continue;
    const name = normalizeArchiveEntryName(file.fileHeader.name);
    if (!isSupportedWorkbook(name)) continue;
    workbooks.push({ name, data: Buffer.from(file.extraction) });
  }
  return workbooks;
}

function extractZipWorkbooks(buffer) {
  let workbookCount = 0;
  let extractedSize = 0;
  const archive = unzipSync(new Uint8Array(buffer), {
    filter: (entry) => {
      if (!isSupportedWorkbook(entry.name)) return false;
      workbookCount += 1;
      const size = Number(entry.originalSize) || 0;
      extractedSize += size;
      if (workbookCount > MAX_WORKBOOK_COUNT) {
        throw new Error(
          `压缩包内 Excel 文件超过 ${MAX_WORKBOOK_COUNT} 个，请拆分后导入。`,
        );
      }
      if (size > MAX_WORKBOOK_SIZE) {
        throw new Error(
          `文件“${path.posix.basename(entry.name)}”超过 20MB，无法导入。`,
        );
      }
      if (extractedSize > MAX_EXTRACTED_SIZE) {
        throw new Error(
          "压缩包内 Excel 解压后总大小超过 200MB，请拆分后导入。",
        );
      }
      return true;
    },
  });
  const entries = Object.entries(archive)
    .map(([name, data]) => ({
      name: normalizeArchiveEntryName(name),
      size: data.byteLength,
      data: Buffer.from(data),
    }))
    .filter((entry) => isSupportedWorkbook(entry.name));
  validateWorkbookEntries(entries);
  return entries;
}

async function extractArchiveWorkbooks(buffer, fileName) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer || []);
  if (!buffer.length) throw new Error("压缩包内容为空。");
  if (buffer.length > MAX_ARCHIVE_SIZE) {
    throw new Error("压缩包超过 80MB，请拆分后导入。");
  }
  if (/\.rar$/i.test(fileName || "")) return extractRarWorkbooks(buffer);
  if (/\.zip$/i.test(fileName || "")) return extractZipWorkbooks(buffer);
  throw new Error("仅支持 .rar 或 .zip 压缩包。");
}

function parseWorkbookEntry(entry, archiveName, index) {
  const relativePath = normalizeArchiveEntryName(entry.name);
  const displayName = path.posix.basename(relativePath);
  const baseRecord = {
    id: `archive-file-${index + 1}`,
    archiveName,
    relativePath,
    fileName: displayName,
    size: entry.data.length,
  };
  try {
    const parsed = DeliveryNoteImport.parseWorkbookBuffer(
      toArrayBuffer(entry.data),
      relativePath,
    );
    if (!parsed.ok) {
      return {
        ...baseRecord,
        status: "error",
        importKind: "unknown",
        errors: parsed.errors || ["无法识别该工作簿。"],
        warnings: parsed.warnings || [],
        documentCount: 0,
        itemCount: 0,
        totalAmount: 0,
        documents: [],
      };
    }
    const documents = Array.isArray(parsed.documents)
      ? parsed.documents
      : [parsed];
    return {
      ...baseRecord,
      status: "pending",
      importKind:
        parsed.importKind || documents[0]?.importKind || "delivery-note",
      errors: [],
      warnings: [
        ...(parsed.warnings || []),
        ...documents.flatMap((document) => document.warnings || []),
      ],
      documentCount: documents.length,
      itemCount: documents.reduce(
        (sum, document) => sum + (document.items?.length || 0),
        0,
      ),
      totalAmount: documents.reduce(
        (sum, document) => sum + Number(document.calculatedTotal || 0),
        0,
      ),
      documents,
    };
  } catch (error) {
    return {
      ...baseRecord,
      status: "error",
      importKind: "unknown",
      errors: [error?.message || "Excel 解析失败。"],
      warnings: [],
      documentCount: 0,
      itemCount: 0,
      totalAmount: 0,
      documents: [],
    };
  }
}

async function notifyProgress(onProgress, payload) {
  if (typeof onProgress !== "function") return;
  await onProgress(payload);
}

async function parseArchiveBuffer(buffer, fileName, options = {}) {
  const { onProgress, shouldAbort } = options;
  const assertNotAborted = () => {
    if (!shouldAbort?.()) return;
    const error = new Error("Archive parsing cancelled.");
    error.name = "AbortError";
    throw error;
  };
  assertNotAborted();
  await notifyProgress(onProgress, {
    phase: "extracting",
    current: 0,
    total: 0,
    fileName,
  });
  const workbooks = await extractArchiveWorkbooks(buffer, fileName);
  assertNotAborted();
  await notifyProgress(onProgress, {
    phase: "extracted",
    current: 0,
    total: workbooks.length,
    fileName,
  });
  const records = [];
  for (let index = 0; index < workbooks.length; index += 1) {
    assertNotAborted();
    const entry = workbooks[index];
    await notifyProgress(onProgress, {
      phase: "parsing",
      current: index + 1,
      total: workbooks.length,
      fileName: entry.name,
    });
    records.push(parseWorkbookEntry(entry, fileName, index));
  }
  await notifyProgress(onProgress, {
    phase: "complete",
    current: workbooks.length,
    total: workbooks.length,
    fileName,
  });
  return {
    success: true,
    archiveName: fileName,
    workbookCount: records.length,
    readyCount: records.filter((record) => record.status === "pending").length,
    errorCount: records.filter((record) => record.status === "error").length,
    records,
  };
}

module.exports = {
  MAX_ARCHIVE_SIZE,
  MAX_WORKBOOK_COUNT,
  MAX_WORKBOOK_SIZE,
  MAX_EXTRACTED_SIZE,
  normalizeArchiveEntryName,
  isSupportedWorkbook,
  extractArchiveWorkbooks,
  parseArchiveBuffer,
};
