// Flat ESLint config. Grok v5 hosting task 2: enable no-undef and
// react/jsx-no-undef (the plugin's canonical equivalent of "react/no-undef")
// so the class of single-symbol bugs that blocked iter 6+7 (isDragging prop,
// axios ref) is caught at lint time instead of runtime.
//
// This config intentionally does NOT extend eslint:recommended — CRA's own
// dev-server ships its own rule set. We only want the two guards.
import globals from "globals";
import react from "eslint-plugin-react";

export default [
  { ignores: ["build/**", "node_modules/**", "public/**"] },
  {
    files: ["src/**/*.{js,jsx,mjs,cjs}"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node, ...globals.es2022 },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { react },
    rules: {
      "no-undef": "error",
      "react/jsx-no-undef": "error",
    },
    settings: { react: { version: "detect" } },
  },
];
