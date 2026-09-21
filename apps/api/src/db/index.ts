import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema.ts'

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const migrationsFolder = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../drizzle')

// DATABASE_URL set -> real Postgres. Unset -> embedded PGlite on disk (zero-setup dev / small self-host).
export async function createDb(): Promise<Db> {
  const url = process.env.DATABASE_URL
  if (url) {
    const { drizzle } = await import('drizzle-orm/postgres-js')
    const { migrate } = await import('drizzle-orm/postgres-js/migrator')
    const postgres = (await import('postgres')).default
    const db = drizzle(postgres(url), { schema })
    await migrate(db, { migrationsFolder })
    return db
  }
  const { PGlite } = await import('@electric-sql/pglite')
  const { drizzle } = await import('drizzle-orm/pglite')
  const { migrate } = await import('drizzle-orm/pglite/migrator')
  const dataDir = process.env.PGLITE_DIR ?? path.resolve(migrationsFolder, '../data/pg')
  mkdirSync(dataDir, { recursive: true })
  const db = drizzle(new PGlite(dataDir), { schema })
  await migrate(db, { migrationsFolder })
  return db
}

export const db: Db = await createDb()
export { schema }
