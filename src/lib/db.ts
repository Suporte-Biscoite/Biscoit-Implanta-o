// Pool do PostgreSQL. SEMPRE consultas parametrizadas ($1, $2...) — nunca concatenar texto em SQL.
import { Pool, type QueryResultRow } from "pg";

const g = globalThis as unknown as { __pool?: Pool };
export function pool(): Pool {
  if (!g.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL não definida");
    g.__pool = new Pool({
      connectionString: url,
      max: 5,
      // Em produção (Cloud SQL) o TLS é obrigatório no servidor; aqui só garantimos que o cliente exija.
      ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: true, ca: process.env.DATABASE_CA } : undefined,
    });
  }
  return g.__pool;
}
export async function q<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return (await pool().query<T>(sql, params)).rows;
}
export async function q1<T extends QueryResultRow = QueryResultRow>(sql: string, params: unknown[] = []) {
  return (await q<T>(sql, params))[0] ?? null;
}
