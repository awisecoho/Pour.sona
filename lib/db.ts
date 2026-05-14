import 'server-only'

import { Pool, QueryResultRow } from 'pg'
export type { PoolClient } from 'pg'

declare global {
  var __poursonaPool: Pool | undefined
}

function getConnectionString() {
  const connectionString =
    process.env.POSTGRES_URL ||
    process.env.DATABASE_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING

  if (!connectionString) {
    throw new Error('Missing POSTGRES_URL or DATABASE_URL')
  }

  return connectionString
}

export function getPool() {
  if (!global.__poursonaPool) {
    const connectionString = getConnectionString()
    const isLocal = process.env.NODE_ENV === 'development'

    const pool = new Pool({
      connectionString,
      ssl: isLocal ? false : { rejectUnauthorized: false },
      // Keep pool small — Vercel creates one pool per warm instance,
      // so each concurrent function can hold up to max connections.
      max: 3,
      // Release idle connections quickly to stay under Neon's limit.
      idleTimeoutMillis: 20000,
      // Fail fast rather than queue indefinitely if all connections busy.
      connectionTimeoutMillis: 8000,
    })

    // Prevent unhandled 'error' events from crashing the process.
    pool.on('error', (err) => {
      console.error('[db] pool error:', err.message)
    })

    global.__poursonaPool = pool
  }

  return global.__poursonaPool
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return getPool().query<T>(text, values)
}
