import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'

import * as schema from './schema'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    'postgres://postgres:dev@localhost:5433/postgres',
})

export const db = drizzle(pool, { schema })
