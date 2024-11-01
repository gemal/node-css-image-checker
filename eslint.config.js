import globals from "globals";
import js from "@eslint/js";


export default [
  {
    languageOptions: {
      globals: {
        process: "readonly",
        describe: "readonly",
        it: "readonly",
        ...globals.browser
      }
    }
  },
  js.configs.recommended,
];
