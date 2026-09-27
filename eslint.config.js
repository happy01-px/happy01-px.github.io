const js = require("@eslint/js");
const globals = require("globals");

const browserApplicationGlobals = Object.fromEntries(
  [
    "addLog",
    "clientIP",
    "createRuntimeId",
    "createSequentialId",
    "currentUser",
    "deepClone",
    "defaultLogsData",
    "defaultMockData",
    "defaultStockMovementData",
    "escapeHTML",
    "exportAllData",
    "finalizeStagedAuditLogs",
    "getInitial",
    "getLocalISOString",
    "importData",
    "initInventoryFilters",
    "logsData",
    "mockData",
    "normalizeList",
    "normalizeMockData",
    "paginationState",
    "persistLogsData",
    "renderAntdEmptyTableRow",
    "renderAntdInput",
    "renderAntdRadioGroup",
    "renderAntdSelect",
    "renderBillPartyFilter",
    "renderDashboardActivity",
    "renderLogsTable",
    "renderPaginationControl",
    "renderStockMovementTable",
    "restoreLogDates",
    "restoreStockMovementDates",
    "rollbackStagedAuditLogs",
    "saveMockData",
    "showModal",
    "stageAuditLogs",
    "stockMovementData",
    "updateBillsTable",
    "updateInventoryTable",
    "updateSupplierTable",
  ].map((name) => [name, "writable"]),
);

module.exports = [
  {
    ignores: [
      "assets/**/*",
      "coverage/**/*",
      "data/**/*",
      "lib/**/*",
      "node_modules/**/*",
      ".codex-temp/**/*",
      ".npm-cache/**/*",
      "temp_dom*.html",
    ],
  },
  {
    files: [
      "preview_server.js",
      "scripts/**/*.js",
      "case/**/*.js",
      "eslint.config.js",
    ],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-control-regex": "off",
    },
  },
  {
    files: ["js/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...browserApplicationGlobals,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-irregular-whitespace": "off",
      "no-redeclare": ["error", { builtinGlobals: false }],
      "no-undef": "error",
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern:
            "^(generatePageNumbers|initInventoryFilters|initLogFilters|renderPaginationControl|showModal)$",
        },
      ],
    },
  },
  {
    files: [
      "js/modules/inventory-core.js",
      "js/modules/data-schema.js",
      "js/modules/inventory-ledger.js",
    ],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "error",
    },
  },
];
