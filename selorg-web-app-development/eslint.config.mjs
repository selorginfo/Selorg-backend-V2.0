import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "coverage/**",
      // Static assets served verbatim, including vendored third-party bundles
      // (e.g. the Paynimo checkout SDK's jQuery) that are not ours to lint.
      "public/**",
    ],
  },
];

export default eslintConfig;
