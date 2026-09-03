import nextPlugin from "eslint-config-next";

/**
 * ESLint flat config (ESLint 9). Next 16 eliminó `next lint`, así que el
 * script npm corre eslint directo con este archivo. eslint-config-next v16
 * exporta el array flat listo para usar.
 */
const config = [
  ...nextPlugin,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
      "scripts/**",
      "drizzle/**",
      "e2e/**",
      "public/**",
      "supabase/**",
      "test-hero/**",
    ],
  },
];

export default config;
