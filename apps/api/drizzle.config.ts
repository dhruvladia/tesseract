import { defineConfig } from 'drizzle-kit'

// `drizzle-kit generate` only needs the schema; migrations are applied at API startup (src/db/index.ts).
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
})
