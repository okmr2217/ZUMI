import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // ignores だけのオブジェクトにしないと全体には効かない（wrangler dev が .wrangler/tmp にバンドルを残す）
  { ignores: ["node_modules/**", ".wrangler/**", "dist/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
);
