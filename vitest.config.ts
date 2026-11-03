import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// graphql 17 ships separate development and production builds. By default Vite
// picks the development one for our code while Node picks the production one
// for graphql-yoga, giving two GraphQLError classes, and Yoga would then hide
// our validation errors. These conditions match what Node itself uses.
const nodeConditions = ["module-sync", "node", "import", "default"];

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
    conditions: nodeConditions,
  },
  ssr: {
    resolve: { conditions: nodeConditions },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
