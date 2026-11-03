import { existsSync } from "node:fs";
import { defineConfig } from "prisma/config";

// The Prisma CLI doesn't read .env when a config file exists, so load it here.
// Real environment variables win, and Docker and CI don't have a .env file.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// A placeholder keeps `prisma generate` working where no database exists
// (CI, Docker build). Commands that really connect use the real variable.
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url: databaseUrl },
});
