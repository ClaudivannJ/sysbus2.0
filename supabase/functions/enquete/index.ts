// Edge Function (Deno) — ENQUETE/RESERVA da viagem de hoje ("melhor que a enquete
// do WhatsApp"). Espelha carteirinha/[token]/actions.ts + lib/fila.ts + lib/eventos.ts.
//
// Ações (POST, JWT do aluno): { action: "estado" | "confirmar" | "cancelar", intencao? }
//  - estado    : materializa a viagem de hoje (calendário) e devolve fila + minha reserva.
//  - confirmar : valida (autorizado + janela abre/fecha) e faz upsert da reserva (seq atômico).
//  - cancelar  : marca CANCELADA (sempre permitido).
// Após confirmar/cancelar: recomputa a fila UMA vez e faz BROADCAST pronto no canal
// `fila:<viagemId>` (fan-out estilo enquete — cliente só renderiza, sem rebusca).
//
// Deploy (COM verify_jwt): npx supabase functions deploy enquete --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { alocarViagem, type ReservaInput } from "../_shared/alocacao.ts";
import { resolverViagem } from "../_shared/calendario.ts";

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

interface ItemFila {
  reservaId: string; nome: string; fotoUrl: string | null; localidadeId: string | null;
  localidade: string | null; hora: string; status: "CONFIRMADA" | "ESPERA";
  onibusNome: string | null; posicao: number | null; transbordo: boolean;
}
interface DadosFila { confirmados: number; emEspera: number; naFila: number; voltam: number; itens: ItemFila[]; }

// deno-lint-ignore no-explicit-any
type DB = any;

async function calcularFila(db: DB, viagemId: string): Promise<DadosFila | null> {
  const { data: v } = await db.from("Viagem").select(
    `id, destino:Destino ( onibus:Onibus ( id, nome, capacidade, ativo, localidades:OnibusLocalidade ( localidadeId, prioridade ) ) ),
     reservas:Reserva ( id, alunoId, seq, status, vaiIda, vaiVolta, onibusPreferidoId, criadoEm,
       aluno:Aluno ( nome, fotoUrl, localidadeId, localidade:Localidade ( nome ) ) )`,
  ).eq("id", viagemId).maybeSingle();
  if (!v) return null;

  const onibus = (v.destino?.onibus ?? []).filter((o: DB) => o.ativo);
  const reservas = v.reservas ?? [];
  const rById = new Map(reservas.map((r: DB) => [r.id, r]));

  // mapeia p/ engine (ordem justa por seq atômico)
  const ordenadas = [...reservas].filter((r: DB) => r.vaiIda)
    .sort((a: DB, b: DB) => Number(a.seq) - Number(b.seq));
  const reservaInputs: ReservaInput[] = ordenadas.map((r: DB, i: number) => ({
    id: r.id, alunoId: r.alunoId, localidadeId: r.aluno?.localidadeId ?? "", ordem: i + 1,
    onibusPreferidoId: r.onibusPreferidoId, status: r.status,
  }));
  const onibusInputs = onibus.map((o: DB) => ({
    id: o.id, nome: o.nome, capacidade: o.capacidade,
    prioridades: Object.fromEntries((o.localidades ?? []).map((l: DB) => [l.localidadeId, l.prioridade])),
  }));
  const resultado = alocarViagem(reservaInputs, onibusInputs);

  const prioridadeDe = (onibusId: string, locId: string) =>
    onibus.find((x: DB) => x.id === onibusId)?.localidades?.find((l: DB) => l.localidadeId === locId)?.prioridade ?? 1;

  const itens: ItemFila[] = resultado.alocacoes.map((a) => {
    const r: DB = rById.get(a.reservaId)!;
    return {
      reservaId: a.reservaId, nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null,
      localidadeId: r.aluno?.localidadeId ?? null, localidade: r.aluno?.localidade?.nome ?? null,
      hora: r.criadoEm, status: a.status,
      onibusNome: a.onibusId ? (onibus.find((o: DB) => o.id === a.onibusId)?.nome ?? null) : null,
      posicao: a.posicao,
      transbordo: a.onibusId ? prioridadeDe(a.onibusId, r.aluno?.localidadeId ?? "") > 1 : false,
    };
  });
  return {
    confirmados: itens.filter((i) => i.status === "CONFIRMADA").length,
    emEspera: itens.filter((i) => i.status === "ESPERA").length,
    naFila: reservas.filter((r: DB) => r.status !== "CANCELADA" && r.vaiIda).length,
    voltam: reservas.filter((r: DB) => r.status !== "CANCELADA" && r.vaiVolta).length,
    itens,
  };
}

async function broadcastFila(fila: DadosFila | null, viagemId: string) {
  try {
    await fetch(`${URL_}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ topic: `fila:${viagemId}`, event: "update", payload: fila ?? {} }] }),
    });
  } catch { /* best-effort */ }
}

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
  const { data: aluno } = await db.from("Aluno")
    .select(`id, localidadeId, destinoId, usuario:Usuario!inner ( authUserId ), carteirinha:Carteirinha ( validade )`)
    .eq("usuario.authUserId", userData.user.id).maybeSingle();
  if (!aluno) return json({ error: "aluno não encontrado" }, 404);

  let body: Record<string, string> = {};
  try { body = await req.json(); } catch { /* estado sem corpo */ }
  const action = body.action ?? "estado";

  if (!aluno.destinoId) return json({ error: "sem rota definida" }, 400);
  // agenda da rota (dias/horário) — usada nos dois caminhos p/ o portal mostrar a semana
  const { data: cfgRota } = await db.from("Destino").select("diasSemana, horarioSaida, enqueteAbre").eq("id", aluno.destinoId).maybeSingle();
  const diasSemana: number[] = cfgRota?.diasSemana ?? [];
  const abreHora: string | null = cfgRota?.enqueteAbre ?? null;

  // NAVEGAÇÃO POR DIA (bolinhas da semana): passado = histórico (quem foi), futuro = aviso.
  const hojeStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Recife" }).format(new Date());
  const dataParam = String(body.data ?? "").slice(0, 10);
  if (dataParam && dataParam !== hojeStr) {
    const base = { data: dataParam, diasSemana, horarioSaida: cfgRota?.horarioSaida ?? null, abreHora };
    const inicioDia = new Date(`${dataParam}T00:00:00-03:00`);
    const fimDia = new Date(inicioDia.getTime() + 86400000);
    if (dataParam < hojeStr) {
      // HISTÓRICO (somente leitura): fila daquele dia
      const { data: vrow } = await db.from("Viagem").select("id, horario").eq("destinoId", aluno.destinoId)
        .gte("data", inicioDia.toISOString()).lt("data", fimDia.toISOString()).limit(1).maybeSingle();
      if (!vrow) return json({ modo: "HISTORICO", ...base, viagem: null, fila: null });
      const fila = await calcularFila(db, vrow.id);
      return json({ modo: "HISTORICO", ...base, viagem: { id: vrow.id, horario: vrow.horario }, fila });
    }
    // FUTURO: opera nesse dia? feriado? tem ônibus? → mensagem amigável
    const [yy, mm, dd] = dataParam.split("-").map(Number);
    const dowJs = new Date(Date.UTC(yy, mm - 1, dd)).getUTCDay();
    const dow = dowJs === 0 ? 7 : dowJs;
    let motivo: string | null = null;
    if (!diasSemana.includes(dow)) motivo = "FORA_DE_OPERACAO";
    else {
      const { data: exc } = await db.from("ExcecaoCalendario").select("descricao")
        .gte("data", inicioDia.toISOString()).lt("data", fimDia.toISOString())
        .or(`destinoId.eq.${aluno.destinoId},destinoId.is.null`).limit(1).maybeSingle();
      if (exc) motivo = "FERIADO";
      else {
        const { count } = await db.from("Onibus").select("id", { count: "exact", head: true }).eq("destinoId", aluno.destinoId).eq("ativo", true);
        if (!count) motivo = "SEM_ONIBUS";
      }
    }
    return json({ modo: "FUTURO", ...base, motivo });
  }

  const res = await resolverViagem(db, aluno.destinoId);
  const viagemId = res.id;
  if (!viagemId) {
    return json({
      viagem: null, fila: null, minhaReserva: null, autorizado: false,
      motivo: res.motivo ?? "SEM_VIAGEM", proximaData: res.proxima ?? null,
      descricaoExcecao: res.descricao ?? null, horarioSaida: res.horario ?? cfgRota?.horarioSaida ?? null,
      diasSemana,
    });
  }

  const { data: viagem } = await db.from("Viagem").select("id, status, horario, abreEm, fechaEm").eq("id", viagemId).maybeSingle();
  // PostgREST pode devolver o embed 1-1 como objeto OU array — normalizamos.
  const cart = Array.isArray(aluno.carteirinha) ? aluno.carteirinha[0] : aluno.carteirinha;
  const validade = cart?.validade ?? null;
  const autorizado = !!validade && new Date(validade).getTime() >= Date.now();
  const agora = Date.now();

  // janela da enquete: aberta se a viagem está ABERTA e agora ∈ [abreEm, fechaEm)
  const aberta = viagem?.status === "ABERTA"
    && (!viagem.abreEm || agora >= new Date(viagem.abreEm).getTime())
    && (!viagem.fechaEm || agora < new Date(viagem.fechaEm).getTime());

  if (action === "confirmar") {
    if (!autorizado) return json({ error: "Sua autorização do semestre não está válida." }, 403);
    if (!aberta) return json({ error: viagem?.abreEm && agora < new Date(viagem.abreEm).getTime() ? "A enquete ainda não abriu." : "A enquete já encerrou." }, 409);

    const intencao = body.intencao ?? "IDA_VOLTA";
    const vaiIda = intencao !== "SO_VOLTA";
    const vaiVolta = intencao !== "SO_IDA";

    // aluno pode ESCOLHER o ponto de embarque (persiste no aluno; a fila agrupa por ele)
    const novaLoc = String(body.localidadeId ?? "") || aluno.localidadeId;
    if (novaLoc && novaLoc !== aluno.localidadeId) {
      await db.from("Aluno").update({ localidadeId: novaLoc }).eq("id", aluno.id);
    }

    const { data: existente } = await db.from("Reserva").select("id, status").eq("viagemId", viagemId).eq("alunoId", aluno.id).maybeSingle();
    if (existente && existente.status !== "CANCELADA") {
      // já está na fila → só ajusta a intenção, MANTÉM a posição (seq)
      await db.from("Reserva").update({ status: "CONFIRMADA", vaiIda, vaiVolta }).eq("id", existente.id);
    } else {
      // voto novo OU re-voto após remover → entra no FIM da fila (novo seq/criadoEm)
      if (existente) await db.from("Reserva").delete().eq("id", existente.id);
      const { error } = await db.from("Reserva").insert({
        id: crypto.randomUUID(), viagemId, alunoId: aluno.id, origem: "APP", status: "CONFIRMADA", vaiIda, vaiVolta,
      });
      if (error) return json({ error: "Não foi possível reservar." }, 500);
    }
  } else if (action === "cancelar") {
    // desistir é SEMPRE permitido (mesmo fechada); re-votar só se ainda aberta
    await db.from("Reserva").update({ status: "CANCELADA" }).eq("viagemId", viagemId).eq("alunoId", aluno.id);
  }

  const fila = await calcularFila(db, viagemId);
  if (action === "confirmar" || action === "cancelar") await broadcastFila(fila, viagemId);
  if (fila && !autorizado) fila.itens = [];

  // localidades (pontos de embarque) da rota — p/ o aluno escolher onde embarca
  const { data: locRows } = await db.from("OnibusLocalidade")
    .select("localidade:Localidade ( id, nome ), onibus:Onibus!inner ( destinoId )")
    .eq("onibus.destinoId", aluno.destinoId);
  const vistos = new Set<string>();
  const localidades: { id: string; nome: string }[] = [];
  for (const r of (locRows ?? []) as DB[]) {
    const l = Array.isArray(r.localidade) ? r.localidade[0] : r.localidade;
    if (l && !vistos.has(l.id)) { vistos.add(l.id); localidades.push({ id: l.id, nome: l.nome }); }
  }

  const { data: minha } = await db.from("Reserva").select("status, vaiIda, vaiVolta").eq("viagemId", viagemId).eq("alunoId", aluno.id).maybeSingle();
  return json({
    viagem, fila, minhaReserva: minha ?? null, autorizado, aberta, localidades, localidadeId: aluno.localidadeId,
    diasSemana, horarioSaida: cfgRota?.horarioSaida ?? null,
  });
});
