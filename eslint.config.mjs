import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  {
    rules: {
      // Browser storage restoration and theme initialization run after hydration.
      "react-hooks/set-state-in-effect": "off",
    },
  },
  globalIgnores([".next/**", "artifacts/**", "node_modules/**"]),
]);
