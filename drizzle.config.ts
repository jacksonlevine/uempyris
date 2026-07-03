import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  dbCredentials: {
    // Local dev container (uempyris-pg, host port 5433). Override via env for prod.
    url:
      process.env.DATABASE_URL ??
      'postgres://postgres:dev@localhost:5433/postgres',
  },
})
