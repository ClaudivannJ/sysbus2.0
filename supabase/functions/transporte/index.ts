// Edge Function (Deno) — SECRETARIA acompanha a viagem ao vivo + INSERE aluno na fila
// manualmente (aluno sem celular/internet). A ordem é justa: o `seq` (autoincrement) é
// atribuído no INSTANTE da inserção → o inserido entra na posição do horário de inserção.
// Guardada por gestor (ADMIN/FISCAL/DONO da secretaria da rota). JSON:
//  - { action:"estado",   destinoId }            → { viagem, fila }
//  - { action:"adicionar",destinoId, alunoId, intencao? } → cria Reserva origem MANUAL + broadcast
//  - { action:"remover",  destinoId, alunoId }   → cancela + broadcast
//
// Deploy: npx supabase functions deploy transporte --use-api --project-ref mtumvzzvwankdppebhle

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
// deno-lint-ignore no-explicit-any
type DB = any;

interface ItemFila { reservaId: string; nome: string; fotoUrl: string | null; localidadeId: string | null; localidade: string | null; hora: string; status: "CONFIRMADA" | "ESPERA"; onibusNome: string | null; posicao: number | null; transbordo: boolean }
interface DadosFila { confirmados: number; emEspera: number; naFila: number; voltam: number; itens: ItemFila[] }

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
  const ordenadas = [...reservas].filter((r: DB) => r.vaiIda).sort((a: DB, b: DB) => Number(a.seq) - Number(b.seq));
  const reservaInputs: ReservaInput[] = ordenadas.map((r: DB, i: number) => ({ id: r.id, alunoId: r.alunoId, localidadeId: r.aluno?.localidadeId ?? "", ordem: i + 1, onibusPreferidoId: r.onibusPreferidoId, status: r.status }));
  const onibusInputs = onibus.map((o: DB) => ({ id: o.id, nome: o.nome, capacidade: o.capacidade, prioridades: Object.fromEntries((o.localidades ?? []).map((l: DB) => [l.localidadeId, l.prioridade])) }));
  const res = alocarViagem(reservaInputs, onibusInputs);
  const prioridadeDe = (oid: string, loc: string) => onibus.find((x: DB) => x.id === oid)?.localidades?.find((l: DB) => l.localidadeId === loc)?.prioridade ?? 1;
  const itens: ItemFila[] = res.alocacoes.map((a) => {
    const r: DB = rById.get(a.reservaId);
    return { reservaId: a.reservaId, nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null, localidadeId: r.aluno?.localidadeId ?? null, localidade: r.aluno?.localidade?.nome ?? null, hora: r.criadoEm, status: a.status, onibusNome: a.onibusId ? (onibus.find((o: DB) => o.id === a.onibusId)?.nome ?? null) : null, posicao: a.posicao, transbordo: a.onibusId ? prioridadeDe(a.onibusId, r.aluno?.localidadeId ?? "") > 1 : false };
  });
  return { confirmados: itens.filter((i) => i.status === "CONFIRMADA").length, emEspera: itens.filter((i) => i.status === "ESPERA").length, naFila: reservas.filter((r: DB) => r.status !== "CANCELADA" && r.vaiIda).length, voltam: reservas.filter((r: DB) => r.status !== "CANCELADA" && r.vaiVolta).length, itens };
}

async function broadcast(fila: DadosFila | null, viagemId: string) {
  try {
    await fetch(`${URL_}/realtime/v1/api/broadcast`, { method: "POST", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" }, body: JSON.stringify({ messages: [{ topic: `fila:${viagemId}`, event: "update", payload: fila ?? {} }] }) });
  } catch { /* best-effort */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "não autenticado" }, 401);

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller } = await db.from("Usuario").select("papel, secretariaId").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || !["ADMIN", "FISCAL", "DONO"].includes(caller.papel)) return json({ error: "sem permissão" }, 403);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const action = b.action ?? "estado";
  const destinoId = String(b.destinoId ?? "");
  if (!destinoId) return json({ error: "destinoId ausente" }, 400);

  const { data: destino } = await db.from("Destino").select("secretariaId").eq("id", destinoId).maybeSingle();
  if (!destino) return json({ error: "rota não encontrada" }, 404);
  if (caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);

  // materializa a viagem pelo calendário (ou explica o motivo de não haver hoje)
  const resV = await resolverViagem(db, destinoId);
  if (!resV.id) {
    return json({
      viagem: null, fila: null, aberta: false,
      motivo: resV.motivo ?? "SEM_VIAGEM", proximaData: resV.proxima ?? null,
      descricaoExcecao: resV.descricao ?? null, horarioSaida: resV.horario ?? null,
    });
  }
  const { data: viagem } = await db.from("Viagem").select("id, horario, status, abreEm, fechaEm").eq("id", resV.id).maybeSingle();
  if (!viagem) return json({ viagem: null, fila: null, aberta: false });

  // frota ativa hoje (p/ avisar "só 1 ônibus" etc.)
  const { data: frotaRows } = await db.from("Onibus").select("capacidade, ativo").eq("destinoId", destinoId);
  const ativosFrota = (frotaRows ?? []).filter((o: DB) => o.ativo);
  const frota = { ativos: ativosFrota.length, capacidade: ativosFrota.reduce((s: number, o: DB) => s + o.capacidade, 0) };

  const agora = Date.now();
  const aberta = viagem.status === "ABERTA"
    && (!viagem.abreEm || agora >= new Date(viagem.abreEm).getTime())
    && (!viagem.fechaEm || agora < new Date(viagem.fechaEm).getTime());

  if (action === "adicionar" || action === "remover") {
    const alunoId = String(b.alunoId ?? "");
    if (!alunoId) return json({ error: "alunoId ausente" }, 400);
    // enquete fechada: só remover (não inserir)
    if (action === "adicionar" && !aberta) return json({ error: "A enquete está encerrada — só é possível remover." }, 409);
    // o aluno tem de ser da mesma secretaria (ou DONO)
    const { data: aluno } = await db.from("Aluno").select("secretariaId").eq("id", alunoId).maybeSingle();
    if (!aluno) return json({ error: "aluno não encontrado" }, 404);
    if (caller.papel !== "DONO" && aluno.secretariaId !== caller.secretariaId) return json({ error: "aluno de outra secretaria" }, 403);

    if (action === "remover") {
      await db.from("Reserva").update({ status: "CANCELADA" }).eq("viagemId", viagem.id).eq("alunoId", alunoId);
    } else {
      const intencao = b.intencao ?? "IDA_VOLTA";
      const vaiIda = intencao !== "SO_VOLTA";
      const vaiVolta = intencao !== "SO_IDA";
      const { data: existe } = await db.from("Reserva").select("id").eq("viagemId", viagem.id).eq("alunoId", alunoId).maybeSingle();
      if (existe) await db.from("Reserva").update({ status: "CONFIRMADA", vaiIda, vaiVolta, origem: "MANUAL" }).eq("id", existe.id);
      else await db.from("Reserva").insert({ id: crypto.randomUUID(), viagemId: viagem.id, alunoId, origem: "MANUAL", status: "CONFIRMADA", vaiIda, vaiVolta });
    }
  }

  const fila = await calcularFila(db, viagem.id);
  if (action === "adicionar" || action === "remover") await broadcast(fila, viagem.id);
  return json({ viagem: { id: viagem.id, horario: viagem.horario, status: viagem.status, abreEm: viagem.abreEm }, fila, aberta, frota });
});
