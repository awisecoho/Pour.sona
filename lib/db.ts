import 'server-only'

import { Pool, QueryResultRow } from 'pg'

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

function getPool() {
  if (!global.__poursonaPool) {
    const connectionString = getConnectionString()
    global.__poursonaPool = new Pool({
      connectionString,
      ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
    })
  }

  return global.__poursonaPool
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: unknown[] = []
) {
  return getPool().query<T>(text, values)
}
