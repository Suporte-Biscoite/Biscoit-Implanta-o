// Aplica as migrações em db/migrations (em ordem) e cadastra os administradores
// iniciais definidos em INITIAL_ADMINS (lista de e-mails separados por vírgula).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL não definida"); process.exit(1); }
const client = new pg.Client({ connectionString: url });
await client.connect();
await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (nome text PRIMARY KEY, aplicada_em timestamptz NOT NULL DEFAULT now())");
const dir = path.resolve("db/migrations");
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
  const { rowCount } = await client.query("SELECT 1 FROM schema_migrations WHERE nome=$1", [f]);
  if (rowCount) continue;
  console.log("Aplicando", f);
  await client.query("BEGIN");
  try {
    await client.query(fs.readFileSync(path.join(dir, f), "utf8"));
    await client.query("INSERT INTO schema_migrations(nome) VALUES ($1) ON CONFLICT DO NOTHING", [f]);
    await client.query("COMMIT");
  } catch (e) { await client.query("ROLLBACK"); throw e; }
}
for (const email of (process.env.INITIAL_ADMINS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean)) {
  await client.query(
    "INSERT INTO users(email, role, criado_por) VALUES ($1,'ADMIN','bootstrap') ON CONFLICT (email) DO NOTHING", [email]);
  console.log("Admin inicial garantido:", email);
}
await client.end();
console.log("Migrações OK.");
