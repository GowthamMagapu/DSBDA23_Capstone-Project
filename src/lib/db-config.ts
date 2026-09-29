// Connection settings shared by every PrismaMariaDb adapter in the app.
//
// MySQL 8 defaults to the `caching_sha2_password` auth plugin, which asks the client to
// fetch the server's RSA public key before it will finish the handshake. The MariaDB
// driver refuses to do that unless told to, so without `allowPublicKeyRetrieval` the
// handshake never completes and Prisma fails with a pool timeout and zero connections
// ever established — a confusing symptom for what is really an authentication problem.
//
// Retrieving the key is safe over a trusted link but MITM-able over an untrusted one: an
// attacker who substitutes their own key can capture the password. It is therefore enabled
// only when the database is local, or when explicitly opted into for an environment where
// the link is known to be trusted (e.g. a private network or a TLS-terminated tunnel).
//
// Hosted databases (TiDB Cloud, Aiven, ...) require TLS. It is enabled by DATABASE_SSL=true or
// by `?sslaccept=strict` in DATABASE_URL — the parameter the Prisma CLI itself needs for
// `prisma db push`, so one URL serves both. The server certificate is always verified: against
// the system CAs by default, or against DATABASE_SSL_CA (PEM contents) for providers such as
// Aiven that sign with their own CA. Over TLS, MySQL 8 auth completes without key retrieval.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function isLocalDatabaseHost(hostname: string) {
  return LOCAL_HOSTS.has(hostname.toLowerCase())
}

export type MariaDbConnectionConfig = {
  host: string
  port: number
  user: string
  password: string
  database: string
  connectionLimit: number
  allowPublicKeyRetrieval?: boolean
  ssl?: { rejectUnauthorized: true; ca?: string }
}

export function buildSslConfig(databaseUrl: URL): MariaDbConnectionConfig['ssl'] {
  const requested = process.env.DATABASE_SSL === 'true' || databaseUrl.searchParams.get('sslaccept') === 'strict'
  if (!requested) return undefined
  // Env UIs often flatten a PEM onto one line with literal "\n" separators.
  const ca = process.env.DATABASE_SSL_CA?.replace(/\\n/g, '\n').trim()
  return ca ? { rejectUnauthorized: true, ca } : { rejectUnauthorized: true }
}

/** Builds the adapter config from a parsed DATABASE_URL. */
export function buildMariaDbConfig(databaseUrl: URL): MariaDbConnectionConfig {
  const host = databaseUrl.hostname
  const allowPublicKeyRetrieval =
    isLocalDatabaseHost(host) || process.env.DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL === 'true'

  return {
    host,
    port: Number(databaseUrl.port) || 3306,
    user: decodeURIComponent(databaseUrl.username),
    password: decodeURIComponent(databaseUrl.password),
    database: databaseUrl.pathname.slice(1),
    connectionLimit: 5,
    allowPublicKeyRetrieval,
    ssl: buildSslConfig(databaseUrl),
  }
}
