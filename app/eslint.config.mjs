import eslintPlugin from "eslint-plugin-eslint-plugin";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import prettier from "eslint-plugin-prettier";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default [{
    ignores: [
        "**/node_modules",
        "**/dist",
        "**/.nyc_output",
        "eslint.config.mjs",
    ],
}, ...compat.extends(
    "eslint:recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:@typescript-eslint/recommended",
), {
    plugins: {
        "eslint-plugin": eslintPlugin,
        "@typescript-eslint": typescriptEslint,
        prettier,
    },

    languageOptions: {
        globals: {
            ...globals.node,
        },

        parser: tsParser,

        parserOptions: {
            project: ["./tsconfig.json"],
            tsconfigRootDir: __dirname,
        },
    },

    rules: {
        "prettier/prettier": "error",

        "@typescript-eslint/prefer-readonly": [1, {
            onlyInlineLambdas: true,
        }],
    },
}, {
    files: ["**/*.ts"],

    languageOptions: {
        ecmaVersion: 5,
        sourceType: "script",
    },
}];
