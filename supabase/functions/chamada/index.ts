// Edge Function (Deno) — CHAMADA da viagem (aparece p/ TODOS: aluno, secretaria, monitor).
// Espelha lib/chamada.ts (planoChamada). A chamada é DETERMINÍSTICA pelo tempo no cliente
// (ChamadaAoVivo); aqui só devolvemos o plano por ponto (confirmados ordenados + início + intervalo).
// Início padrão = fechamento da enquete (fechaEm) ou horário da viagem; o MONITOR pode iniciar antes.
//
// JSON:
//  - { action?:"estado", destinoId? } → { intervaloSegundos, pontos[], meuReservaId? }
//      (aluno: usa a própria rota; gestor/monitor: passa destinoId)
//  - { action:"iniciar", localidadeId } → gestor/monitor antecipa a chamada do ponto (iniciadaEm=agora)
//
// Deploy: npx supabase functions deploy chamada --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alocarViagem, type ReservaInput } from "../_shared/alocacao.ts";
import { inicioDeHoje, amanha, horaParaHoje } from "../_shared/tempo.ts";

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
const um = (x: unknown) => (Array.isArray(x) ? x[0] ?? null : x ?? null);

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
  const { data: caller } = await db.from("Usuario").select("id, papel, secretariaId").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller) return json({ error: "usuário não encontrado" }, 404);
  const ehGestor = ["ADMIN", "FISCAL", "DONO"].includes(caller.papel);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const action = b.action ?? "estado";

  // resolve a rota + o reservaId do aluno (se for aluno)
  let destinoId = String(b.destinoId ?? "");
  let meuAlunoId: string | null = null;
  let minhaLocalidade: string | null = null;
  let minhaFaculdade: string | null = null;
  if (!destinoId || !ehGestor) {
    const { data: aluno } = await db.from("Aluno").select("id, destinoId, localidadeId, faculdade, usuario:Usuario!inner ( authUserId )").eq("usuario.authUserId", userData.user.id).maybeSingle();
    if (aluno) { destinoId = destinoId || aluno.destinoId; meuAlunoId = aluno.id; minhaLocalidade = aluno.localidadeId ?? null; minhaFaculdade = aluno.faculdade ?? null; }
  }
  if (!destinoId) return json({ error: "sem rota" }, 400);

  const { data: destino } = await db.from("Destino").select("secretariaId").eq("id", destinoId).maybeSingle();
  if (!destino) return json({ error: "rota não encontrada" }, 404);
  if (ehGestor && caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);

  const { data: viagem } = await db.from("Viagem").select("id, horario, fechaEm, chamadaIniciadaEm")
    .eq("destinoId", destinoId).gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString()).limit(1).maybeSingle();
  if (!viagem) return json({ viagem: null, pontos: [], intervaloSegundos: 10 });

  // início da chamada = quando o monitor iniciou (se iniciou), senão o fechamento da enquete / horário
  const inicioPadrao = viagem.fechaEm ?? horaParaHoje(viagem.horario)?.toISOString() ?? inicioDeHoje().toISOString();
  const chamadaEmISO = viagem.chamadaIniciadaEm ?? inicioPadrao;

  // ---- iniciar (antecipar) — chamada única, guarda o início na Viagem ----
  if (action === "iniciar") {
    if (!ehGestor) return json({ error: "só o monitor/secretaria inicia a chamada" }, 403);
    await db.from("Viagem").update({ chamadaIniciadaEm: new Date().toISOString() }).eq("id", viagem.id);
    return json({ ok: true });
  }

  // ---- estado: plano de chamada ----
  const { data: v } = await db.from("Viagem").select(
    `id, destino:Destino ( onibus:Onibus ( id, nome, capacidade, ativo, localidades:OnibusLocalidade ( localidadeId, prioridade ) ) ),
     reservas:Reserva ( id, alunoId, seq, status, vaiIda, onibusPreferidoId,
       aluno:Aluno ( nome, fotoUrl, localidadeId, localidade:Localidade ( nome ) ) )`,
  ).eq("id", viagem.id).maybeSingle();
  const { data: intervaloRow } = await db.from("Destino").select("intervaloChamadaS").eq("id", destinoId).maybeSingle();
  const intervaloSegundos = intervaloRow?.intervaloChamadaS ?? 10;

  const onibus = (v.destino?.onibus ?? []).filter((o: DB) => o.ativo);
  const reservas = (v.reservas ?? []).filter((r: DB) => r.status === "CONFIRMADA" && r.vaiIda);
  const rById = new Map(reservas.map((r: DB) => [r.id, r]));
  const ordenadas = [...reservas].sort((a: DB, b: DB) => Number(a.seq) - Number(b.seq));
  const reservaInputs: ReservaInput[] = ordenadas.map((r: DB, i: number) => ({
    id: r.id, alunoId: r.alunoId, localidadeId: r.aluno?.localidadeId ?? "", ordem: i + 1, onibusPreferidoId: r.onibusPreferidoId, status: r.status,
  }));
  const onibusInputs = onibus.map((o: DB) => ({ id: o.id, nome: o.nome, capacidade: o.capacidade, prioridades: Object.fromEntries((o.localidades ?? []).map((l: DB) => [l.localidadeId, l.prioridade])) }));
  const aloc = alocarViagem(reservaInputs, onibusInputs);

  // Chamada ÚNICA: os CONFIRMADOS na ordem de voto (FIFO). Não é por ponto de embarque —
  // a vaga/chamada é de quem votou primeiro. `alocacoes` já vem na ordem de voto.
  const listaConfirmados = aloc.alocacoes.filter((x) => x.status === "CONFIRMADA").map((a) => {
    const r: DB = rById.get(a.reservaId);
    return {
      reservaId: a.reservaId, nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null,
      onibusNome: a.onibusId ? (onibus.find((o: DB) => o.id === a.onibusId)?.nome ?? null) : null, posicao: a.posicao,
    };
  });
  // mantém o formato `pontos` (1 grupo) p/ compatibilidade com o componente atual
  const pontos = listaConfirmados.length
    ? [{ localidadeId: "GERAL", ponto: "Chamada (ordem de voto)", chamadaEmISO, ordem: listaConfirmados }]
    : [];

  const meuReservaId = meuAlunoId ? (reservas.find((r: DB) => r.alunoId === meuAlunoId)?.id ?? null) : null;

  // posição do ônibus no itinerário (onde está + quantos faltam) — visível ao aluno, se o módulo estiver ativo
  let posicaoOnibus: { nome: string; sentido: string; faltamQtd: number; meuPonto: boolean } | null = null;
  const { data: cfgItin } = await db.from("ConfiguracaoPlataforma").select("itinerarioAtivo").eq("id", "GLOBAL").maybeSingle();
  const { data: vp } = cfgItin?.itinerarioAtivo ? await db.from("Viagem").select("pontoAtualId").eq("id", viagem.id).maybeSingle() : { data: null };
  if (vp?.pontoAtualId) {
    const { data: pr } = await db.from("PontoRota").select("nome, sentido, localidadeId, faculdade").eq("id", vp.pontoAtualId).maybeSingle();
    if (pr) {
      const { data: rs } = await db.from("Reserva")
        .select("vaiIda, vaiVolta, aluno:Aluno ( localidadeId, faculdade ), embarques:Embarque ( sentido )")
        .eq("viagemId", viagem.id).eq("status", "CONFIRMADA");
      const temEmb = (r: DB, s: string) => (r.embarques ?? []).some((e: DB) => e.sentido === s);
      let faltam: DB[] = [];
      let meuPonto = false;
      if (pr.sentido === "IDA" && pr.localidadeId) {
        faltam = (rs ?? []).filter((r: DB) => r.vaiIda && um(r.aluno)?.localidadeId === pr.localidadeId && !temEmb(r, "IDA"));
        meuPonto = pr.localidadeId === minhaLocalidade;
      } else if (pr.sentido === "VOLTA" && pr.faculdade) {
        faltam = (rs ?? []).filter((r: DB) => r.vaiVolta && um(r.aluno)?.faculdade === pr.faculdade && temEmb(r, "IDA") && !temEmb(r, "VOLTA"));
        meuPonto = pr.faculdade === minhaFaculdade;
      }
      posicaoOnibus = { nome: pr.nome, sentido: pr.sentido, faltamQtd: faltam.length, meuPonto };
    }
  }

  return json({ viagem: { id: viagem.id, horario: viagem.horario }, intervaloSegundos, pontos, meuReservaId, podeIniciar: ehGestor, posicaoOnibus });
});
