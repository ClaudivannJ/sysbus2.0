// LIMPEZA DOS DADOS DE TESTE — exclui DEFINITIVAMENTE (hard delete) as 100 contas de teste
// criadas por scripts/simular-votos.mjs (cpf começa com "TESTE-"). NÃO é soft delete:
// são contas de teste e devem sumir do banco por completo, junto com tudo que dependa delas.
//
// Uso:  node scripts/limpar-testes.mjs
// (idempotente: rodar de novo quando não há teste apenas informa 0 removidos.)
//
// Remove, na ordem segura de dependências: Embarque → Reserva → Carteirinha →
// DocumentoEnviado → Renovacao → Aluno → Usuario (se houver vínculo).

import { readFileSync } from "node:fs";
import pg from "pg";

const envv = (f, k) => {
  const l = readFileSync(f, "utf8").split(/\r?\n/).find((x) => x.startsWith(k + "="));
  return l ? l.slice(k.length + 1).trim().replace(/^"(.*)"$/, "$1") : undefined;
};
const DIRECT = envv("C:/Users/aluno/Desktop/sysbus2.0/.env.migrations", "DIRECT_URL");
if (!DIRECT) { console.error("DIRECT_URL não encontrado em .env.migrations"); process.exit(1); }

const FILTRO = `cpf like 'TESTE-%'`; // apenas contas de teste

const c = new pg.Client({ connectionString: DIRECT, ssl: { rejectUnauthorized: false } });
await c.connect();

const alvo = await c.query(`select id, "usuarioId" from "Aluno" where ${FILTRO}`);
const alunoIds = alvo.rows.map((r) => r.id);
const usuarioIds = alvo.rows.map((r) => r.usuarioId).filter(Boolean);

if (alunoIds.length === 0) {
  console.log("Nenhuma conta de teste (TESTE-%) encontrada. Nada a remover.");
  await c.end();
  process.exit(0);
}

console.log(`Encontradas ${alunoIds.length} contas de teste. Removendo…`);

const del = async (sql, params) => (await c.query(sql, params)).rowCount ?? 0;

try {
  await c.query("begin");
  const emb = await del(`delete from "Embarque" where "reservaId" in (select id from "Reserva" where "alunoId" = any($1))`, [alunoIds]);
  const res = await del(`delete from "Reserva" where "alunoId" = any($1)`, [alunoIds]);
  const car = await del(`delete from "Carteirinha" where "alunoId" = any($1)`, [alunoIds]);
  const doc = await del(`delete from "DocumentoEnviado" where "alunoId" = any($1)`, [alunoIds]);
  const ren = await del(`delete from "Renovacao" where "alunoId" = any($1)`, [alunoIds]);
  const alu = await del(`delete from "Aluno" where id = any($1)`, [alunoIds]);
  const usu = usuarioIds.length ? await del(`delete from "Usuario" where id = any($1)`, [usuarioIds]) : 0;
  await c.query("commit");
  console.log("Removidos:");
  console.table([{ Embarque: emb, Reserva: res, Carteirinha: car, DocumentoEnviado: doc, Renovacao: ren, Aluno: alu, Usuario: usu }]);
  console.log("Concluído. As contas de teste foram excluídas definitivamente.");
} catch (e) {
  await c.query("rollback");
  console.error("Falhou (rollback aplicado):", e.message);
  process.exit(1);
} finally {
  await c.end();
}
