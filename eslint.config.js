const js = require("@eslint/js");
const globals = require("globals");

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
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-irregular-whitespace": "off",
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
];
