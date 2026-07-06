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
  const { data: caller } = await db.from("Usuario").select("id, papel, secretariaId, permissoes").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller) return json({ error: "usuário não encontrado" }, 404);
  const ehGestor = ["ADMIN", "FISCAL", "DONO"].includes(caller.papel);
  // monitor = gestor OU aluno designado monitor (permissão ESCANEAR_EMBARQUE) — pode operar a chamada
  const ehMonitor = ehGestor || (caller.papel === "ALUNO" && Array.isArray(caller.permissoes) && caller.permissoes.includes("ESCANEAR_EMBARQUE"));

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

  // início padrão da chamada (fallback p/ pontos sem horário) = fechamento da enquete / horário
  const inicioPadrao = viagem.fechaEm ?? horaParaHoje(viagem.horario)?.toISOString() ?? inicioDeHoje().toISOString();

  // ---- iniciar (antecipar) — chamada única, guarda o início na Viagem ----
  if (action === "iniciar") {
    if (!ehMonitor) return json({ error: "só o monitor/secretaria inicia a chamada" }, 403);
    // escopo de tenant: monitor (gestor ou aluno-monitor) só opera rotas da própria secretaria
    if (caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);
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
  const { umOnibusApenas } = aloc;

  // horário da chamada POR PONTO (config da secretaria) → cada embarque inicia sozinho no seu horário
  const { data: horRows } = await db.from("HorarioChamada").select("localidadeId, horario").eq("destinoId", destinoId);
  const horPorLoc = new Map<string, string>((horRows ?? []).map((h: DB) => [h.localidadeId, h.horario]));

  let pontos: { localidadeId: string; ponto: string; chamadaEmISO: string; ordem: DB[] }[];

  if (umOnibusApenas) {
    // Único ônibus: lista global ordenada por seq (posicao global = cadeira 1..n)
    // Todos ficam numa única chamada, sem agrupamento por ponto de embarque.
    const itensGlobal = aloc.alocacoes
      .filter((a) => a.status === "CONFIRMADA")
      .sort((a, b) => a.ordem - b.ordem)
      .map((a) => {
        const r: DB = rById.get(a.reservaId);
        return { reservaId: a.reservaId, nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null, onibusNome: a.onibusId ? (onibus.find((o: DB) => o.id === a.onibusId)?.nome ?? null) : null, posicao: a.posicao };
      });
    pontos = [{ localidadeId: "__global__", ponto: "Chamada geral", chamadaEmISO: viagem.chamadaIniciadaEm ?? inicioPadrao, ordem: itensGlobal }];
  } else {
    // Múltiplos ônibus: agrupa por ponto de embarque, posição exibida = posicaoLocalidade
    const grupos = new Map<string, { ponto: string; itens: DB[] }>();
    for (const a of aloc.alocacoes.filter((x) => x.status === "CONFIRMADA")) {
      const r: DB = rById.get(a.reservaId);
      const key = r.aluno?.localidadeId ?? "__sem__";
      let g = grupos.get(key);
      if (!g) { g = { ponto: r.aluno?.localidade?.nome ?? "Sem ponto", itens: [] }; grupos.set(key, g); }
      g.itens.push({ reservaId: a.reservaId, nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null, onibusNome: a.onibusId ? (onibus.find((o: DB) => o.id === a.onibusId)?.nome ?? null) : null, posicao: a.posicaoLocalidade });
    }
    pontos = [...grupos.entries()].map(([localidadeId, g]) => {
      const horaCfg = horPorLoc.get(localidadeId);
      const inicioPonto = viagem.chamadaIniciadaEm
        ?? (horaCfg ? horaParaHoje(horaCfg)?.toISOString() ?? inicioPadrao : inicioPadrao);
      return { localidadeId, ponto: g.ponto, chamadaEmISO: inicioPonto, ordem: g.itens };
    }).sort((a, b) => a.ponto.localeCompare(b.ponto));
  }

  // ALUNO vê só a chamada do SEU ponto de embarque; gestor/monitor vê todos.
  if (meuAlunoId && !ehGestor && minhaLocalidade) {
    pontos = pontos.filter((p) => p.localidadeId === minhaLocalidade);
  }

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
