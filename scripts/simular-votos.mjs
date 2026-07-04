// TESTE DE CARGA — simula 100 alunos votando SEQUENCIALMENTE na enquete de hoje
// (rota Arcoverde), como na enquete do WhatsApp. A cada voto faz broadcast → a fila
// sobe AO VIVO em "Viagem ao vivo" (secretaria) e no portal do aluno.
//
// Distribuição: Itaiba 50 · Negras 20 · Giral 20 · Estrada 10.
// Uso: abra "Viagem ao vivo" no navegador e rode:  node scripts/simular-votos.mjs
// (é idempotente/repetível: limpa os votos de teste e vota de novo)

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const envv = (f, k) => { const l = readFileSync(f, "utf8").split("\n").find((x) => x.startsWith(k + "=")); return l ? l.slice(k.length + 1).trim().replace(/^"(.*)"$/, "$1") : undefined; };
const URL = envv("C:/Users/aluno/Desktop/carteirinhabus/.env", "NEXT_PUBLIC_SUPABASE_URL");
const ANON = envv("C:/Users/aluno/Desktop/sysbus2.0/.env.local", "VITE_SUPABASE_ANON_KEY");
const DIRECT = envv("C:/Users/aluno/Desktop/sysbus2.0/.env.migrations", "DIRECT_URL");
const DELAY = Number(process.argv[2] ?? 350); // ms entre votos

const c = new pg.Client({ connectionString: DIRECT });
await c.connect();

const dest = (await c.query(`select id, "secretariaId" from "Destino" where nome='Arcoverde'`)).rows[0];
const locs = Object.fromEntries((await c.query(`select id, nome from "Localidade"`)).rows.map((r) => [r.nome, r.id]));
const viagem = (await c.query(`select id from "Viagem" where "destinoId"=$1 and data >= date_trunc('day', now() at time zone 'America/Recife') limit 1`, [dest.id])).rows[0];
if (!viagem) { console.log("Sem viagem de hoje p/ Arcoverde — configure a rota (dias/enquete)."); process.exit(1); }

// distribuição por localidade
const plano = [["Itaiba", 50], ["Negras", 20], ["Giral", 20], ["Estrada", 10]];

// 1) garante os 100 alunos de teste (idempotente por CPF de teste)
console.log("Preparando 100 alunos de teste…");
let n = 0;
const alunoIds = [];
for (const [loc, qtd] of plano) {
  for (let i = 1; i <= qtd; i++) {
    n++;
    const cpf = `TESTE-${String(n).padStart(3, "0")}`;
    let row = (await c.query(`select id from "Aluno" where cpf=$1`, [cpf])).rows[0];
    if (!row) {
      const id = crypto.randomUUID();
      await c.query(
        `insert into "Aluno" (id, nome, cpf, status, "destinoId", "localidadeId", "secretariaId") values ($1,$2,$3,'ATIVO',$4,$5,$6)`,
        [id, `Teste ${loc} ${i}`, cpf, dest.id, locs[loc], dest.secretariaId],
      );
      row = { id };
    } else {
      // garante a localidade certa
      await c.query(`update "Aluno" set "localidadeId"=$1, "destinoId"=$2 where id=$3`, [locs[loc], dest.id, row.id]);
    }
    alunoIds.push(row.id);
  }
}

// 2) limpa os votos de teste anteriores nesta viagem (fresh)
await c.query(`delete from "Reserva" where "viagemId"=$1 and "alunoId" in (select id from "Aluno" where cpf like 'TESTE-%')`, [viagem.id]);
console.log(`Viagem: ${viagem.id} — votos de teste zerados. Iniciando ${alunoIds.length} votos (a cada ${DELAY}ms)…\n`);

// 3) DONO loga e vota sequencialmente via transporte/adicionar (insere + broadcast)
const sb = createClient(URL, ANON, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: "claudivan.ar2002@gmail.com", password: "Sysbus@a0f4b28b" });
const token = (await sb.auth.getSession()).data.session.access_token;
const FN = `${URL}/functions/v1/transporte`;

// embaralha p/ parecer votos aleatórios de pontos diferentes
const ordem = alunoIds.map((id) => id).sort(() => Math.random() - 0.5);
const t0 = Date.now();
for (let i = 0; i < ordem.length; i++) {
  await fetch(FN, { method: "POST", headers: { "Content-Type": "application/json", apikey: ANON, Authorization: "Bearer " + token }, body: JSON.stringify({ action: "adicionar", destinoId: dest.id, alunoId: ordem[i] }) });
  if ((i + 1) % 10 === 0 || i === ordem.length - 1) console.log(`  ${i + 1}/${ordem.length} votos`);
  await new Promise((r) => setTimeout(r, DELAY));
}
console.log(`\n✔ ${ordem.length} votos em ${Math.round((Date.now() - t0) / 1000)}s. Veja a fila (últimos 5 por ponto + "ver todos").`);
await c.end();
process.exit(0);
