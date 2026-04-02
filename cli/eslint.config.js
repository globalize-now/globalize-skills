import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

export default [
  {
    ignores: ["node_modules/"],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: {
        console: "readonly",
        process: "readonly",
        fetch: "readonly",
        URL: "readonly",
      },
    },
  },
  prettierConfig,
];
