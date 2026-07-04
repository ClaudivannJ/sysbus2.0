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
import { inicioDeHoje, amanha, diaSemanaHojeISO, dataHojeUTC, horaParaHoje } from "../_shared/tempo.ts";

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

async function viagemDeHoje(db: DB, destinoId: string) {
  const { data } = await db.from("Viagem").select("id").eq("destinoId", destinoId)
    .gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString()).limit(1).maybeSingle();
  return data?.id ?? null;
}

// Próximo dia de operação (dias da semana da rota, pulando exceções) — p/ informar o aluno.
async function proximaData(db: DB, destino: DB): Promise<string | null> {
  const dias: number[] = Array.isArray(destino.diasSemana) ? destino.diasSemana : [];
  if (!dias.length) return null;
  const base = dataHojeUTC();
  const { data: excs } = await db.from("ExcecaoCalendario").select("data")
    .gte("data", new Date(base.getTime() + 86400000).toISOString())
    .lt("data", new Date(base.getTime() + 22 * 86400000).toISOString())
    .or(`destinoId.eq.${destino.id},destinoId.is.null`);
  const excSet = new Set((excs ?? []).map((e: DB) => new Date(e.data).toISOString().slice(0, 10)));
  const hojeDow = diaSemanaHojeISO();
  for (let i = 1; i <= 21; i++) {
    const dow = ((hojeDow - 1 + i) % 7) + 1; // avança dias mantendo o dia-da-semana correto
    if (!dias.includes(dow)) continue;
    const iso = new Date(base.getTime() + i * 86400000).toISOString().slice(0, 10);
    if (!excSet.has(iso)) return iso;
  }
  return null;
}

interface ResViagem { id: string | null; motivo?: string; proxima?: string | null; descricao?: string | null; horario?: string | null }

// Materializa a viagem de hoje respeitando o calendário (RF-16/17). Devolve o viagemId
// OU o MOTIVO de não haver viagem (fim de semana, feriado, rota sem enquete) + próxima data.
async function resolverViagem(db: DB, destinoId: string): Promise<ResViagem> {
  const existente = await viagemDeHoje(db, destinoId);
  if (existente) return { id: existente };

  const { data: destino } = await db.from("Destino")
    .select("id, horarioSaida, enqueteAbre, enqueteFecha, intervaloChamadaS, diasSemana").eq("id", destinoId).maybeSingle();
  if (!destino) return { id: null, motivo: "SEM_ROTA" };

  const opera = Array.isArray(destino.diasSemana) && destino.diasSemana.includes(diaSemanaHojeISO());
  const inicioDia = dataHojeUTC();
  const { data: exc } = await db.from("ExcecaoCalendario").select("descricao, tipo")
    .gte("data", inicioDia.toISOString()).lt("data", new Date(inicioDia.getTime() + 86400000).toISOString())
    .or(`destinoId.eq.${destinoId},destinoId.is.null`).limit(1).maybeSingle();
  const prox = await proximaData(db, destino);

  if (!opera) return { id: null, motivo: "FORA_DE_OPERACAO", proxima: prox, horario: destino.horarioSaida };
  if (exc) return { id: null, motivo: "FERIADO", descricao: exc.descricao ?? null, proxima: prox, horario: destino.horarioSaida };
  if (!destino.enqueteAbre && !destino.enqueteFecha) return { id: null, motivo: "SEM_ENQUETE" };

  const novoId = crypto.randomUUID();
  const { error } = await db.from("Viagem").insert({
    id: novoId, destinoId, data: inicioDeHoje().toISOString(), horario: destino.horarioSaida,
    abreEm: destino.enqueteAbre ? horaParaHoje(destino.enqueteAbre)?.toISOString() : null,
    fechaEm: destino.enqueteFecha ? horaParaHoje(destino.enqueteFecha)?.toISOString() : null,
    intervaloChamadaS: destino.intervaloChamadaS, status: "ABERTA",
  });
  if (error) return { id: await viagemDeHoje(db, destinoId) }; // corrida: já criada
  return { id: novoId };
}

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
  const res = await resolverViagem(db, aluno.destinoId);
  const viagemId = res.id;
  if (!viagemId) {
    return json({
      viagem: null, fila: null, minhaReserva: null, autorizado: false,
      motivo: res.motivo ?? "SEM_VIAGEM", proximaData: res.proxima ?? null,
      descricaoExcecao: res.descricao ?? null, horarioSaida: res.horario ?? null,
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
  return json({ viagem, fila, minhaReserva: minha ?? null, autorizado, aberta, localidades, localidadeId: aluno.localidadeId });
});
