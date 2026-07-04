// Runner de migração SQL do sysbus2.0 → aplica um arquivo .sql na produção Supabase.
// Uso: node supabase/apply.mjs supabase/arquivo.sql
// Conexão via DIRECT_URL (porta 5432, sem pgbouncer) lida de .env.migrations.
import { readFileSync } from "node:fs";
import pg from "pg";

const url = readFileSync(new URL("../.env.migrations", import.meta.url), "utf8")
  .split("\n")
  .find((l) => l.startsWith("DIRECT_URL="))
  ?.slice("DIRECT_URL=".length)
  .trim();

if (!url) {
  console.error("DIRECT_URL não encontrada em .env.migrations");
  process.exit(1);
}

const file = process.argv[2];
if (!file) {
  console.error("Uso: node supabase/apply.mjs <arquivo.sql>");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  // roda o arquivo inteiro numa transação (suporta funções com $$…$$)
  await client.query("begin");
  await client.query(sql);
  await client.query("commit");
  console.log(`✓ aplicado: ${file}`);
} catch (e) {
  await client.query("rollback");
  console.error(`✗ falhou: ${e.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
