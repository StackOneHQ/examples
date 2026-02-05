import { Pool } from 'pg'

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  })
}

let pool: Pool | null = null
function poolOrCreate(): Pool {
  if (!pool) pool = getPool()
  return pool
}

export { poolOrCreate as pool }

/** Run a parameterized query. Returns rows. */
export async function query<T = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T[]> {
  const client = await poolOrCreate().connect()
  try {
    const res = await client.query(text, values)
    return (res.rows ?? []) as T[]
  } finally {
    client.release()
  }
}

/** Run a query and return the first row or null. */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<T | null> {
  const rows = await query<T>(text, values)
  return rows[0] ?? null
}
