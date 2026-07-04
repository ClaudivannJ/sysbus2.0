// Edge Function (Deno) — CONTAGEM INTELIGENTE de embarque (o grande diferencial).
// Centraliza quem CONFIRMOU vs quem realmente EMBARCOU (via QR) e recomenda mandar
// 1 ou 2 ônibus — elimina a contagem manual descentralizada (erro humano).
// Guardada por gestor/monitor (ADMIN/FISCAL/DONO da secretaria da rota). JSON: { destinoId }.
//
// Deploy: npx supabase functions deploy contagem-embarque --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alocarViagem, type ReservaInput } from "../_shared/alocacao.ts";
import { inicioDeHoje, amanha } from "../_shared/tempo.ts";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// deno-lint-ignore no-explicit-any
type DB = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const asUser = createClient(URL_, ANON, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "não autenticado" }, 401);

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller } = await db.from("Usuario").select("papel, secretariaId").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || !["ADMIN", "FISCAL", "DONO"].includes(caller.papel)) return json({ error: "sem permissão" }, 403);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const destinoId = String(b.destinoId ?? "");
  if (!destinoId) return json({ error: "destinoId ausente" }, 400);

  const { data: destino } = await db.from("Destino").select("secretariaId, nome").eq("id", destinoId).maybeSingle();
  if (!destino) return json({ error: "rota não encontrada" }, 404);
  if (caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);

  const { data: viagem } = await db.from("Viagem").select("id, horario")
    .eq("destinoId", destinoId).gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString())
    .limit(1).maybeSingle();
  if (!viagem) return json({ viagem: null, rota: destino.nome });

  const { data: v } = await db.from("Viagem").select(
    `id, destino:Destino ( onibus:Onibus ( id, nome, capacidade, ativo, localidades:OnibusLocalidade ( localidadeId, prioridade ) ) ),
     reservas:Reserva ( id, alunoId, seq, status, vaiIda, vaiVolta, onibusPreferidoId,
       aluno:Aluno ( localidadeId ), embarques:Embarque ( sentido ) )`,
  ).eq("id", viagem.id).maybeSingle();

  const onibus = (v.destino?.onibus ?? []).filter((o: DB) => o.ativo);
  const reservas = (v.reservas ?? []).filter((r: DB) => r.status === "CONFIRMADA");

  // alocação (IDA) para saber confirmados por ônibus
  const ordenadas = [...reservas].filter((r: DB) => r.vaiIda).sort((a: DB, b: DB) => Number(a.seq) - Number(b.seq));
  const reservaInputs: ReservaInput[] = ordenadas.map((r: DB, i: number) => ({
    id: r.id, alunoId: r.alunoId, localidadeId: r.aluno?.localidadeId ?? "", ordem: i + 1,
    onibusPreferidoId: r.onibusPreferidoId, status: r.status,
  }));
  const onibusInputs = onibus.map((o: DB) => ({
    id: o.id, nome: o.nome, capacidade: o.capacidade,
    prioridades: Object.fromEntries((o.localidades ?? []).map((l: DB) => [l.localidadeId, l.prioridade])),
  }));
  const aloc = alocarViagem(reservaInputs, onibusInputs);
  const onibusDaReserva = new Map(aloc.alocacoes.map((a) => [a.reservaId, a.onibusId]));

  const embarcou = (r: DB, s: string) => (r.embarques ?? []).some((e: DB) => e.sentido === s);

  const porOnibus = onibus.map((o: DB) => {
    const confirmadosIda = reservas.filter((r: DB) => r.vaiIda && onibusDaReserva.get(r.id) === o.id);
    return {
      nome: o.nome, capacidade: o.capacidade,
      confirmadosIda: confirmadosIda.length,
      embarcadosIda: confirmadosIda.filter((r: DB) => embarcou(r, "IDA")).length,
    };
  });

  const totalConfirmadosIda = reservas.filter((r: DB) => r.vaiIda).length;
  const totalConfirmadosVolta = reservas.filter((r: DB) => r.vaiVolta).length;
  const totalEmbarcadosIda = reservas.filter((r: DB) => r.vaiIda && embarcou(r, "IDA")).length;
  const totalEmbarcadosVolta = reservas.filter((r: DB) => r.vaiVolta && embarcou(r, "VOLTA")).length;
  const capacidadeUmOnibus = onibus.reduce((m: number, o: DB) => Math.max(m, o.capacidade), 0);
  const capacidadeTotal = onibus.reduce((s: number, o: DB) => s + o.capacidade, 0);

  // recomendação: se todos os confirmados cabem em 1 ônibus, manda só 1 (economia)
  const cabeEmUm = onibus.length > 1 && totalConfirmadosIda > 0 && totalConfirmadosIda <= capacidadeUmOnibus;

  return json({
    viagem: { id: viagem.id, horario: viagem.horario }, rota: destino.nome,
    capacidadeUmOnibus, capacidadeTotal, qtdOnibus: onibus.length, porOnibus,
    ida: { confirmados: totalConfirmadosIda, embarcados: totalEmbarcadosIda },
    volta: { confirmados: totalConfirmadosVolta, embarcados: totalEmbarcadosVolta },
    recomendacao: cabeEmUm ? "UM_ONIBUS" : "MANTER",
    mensagem: cabeEmUm
      ? `${totalConfirmadosIda} confirmados cabem em 1 ônibus (capacidade ${capacidadeUmOnibus}). Pode enviar apenas 1 — economia de 1 veículo.`
      : `${totalConfirmadosIda} confirmados — necessários ${onibus.length} ônibus (cap. total ${capacidadeTotal}).`,
  });
});
