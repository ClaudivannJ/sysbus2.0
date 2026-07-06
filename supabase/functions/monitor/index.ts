// Edge Function (Deno) — MONITOR (fiscal no ônibus): chamada por ponto + embarque.
// Espelha lib/chamada.ts (plano por ponto) + monitor/actions.ts (registrarEmbarque).
// Guardada por JWT: FISCAL/ADMIN/DONO da secretaria da rota. Ações (JSON):
//  - { action:"estado", destinoId }                 → viagem de hoje + pontos (confirmados
//                                                      ordenados) com status de embarque (ida/volta)
//                                                      + nfcAtivo (flag de plataforma).
//  - { action:"embarcar",   reservaId, sentido }    → upsert Embarque.
//  - { action:"desembarcar",reservaId, sentido }    → remove Embarque.
//  - { action:"definir-ponto", destinoId, pontoRotaId } → marca em qual ponto o ônibus está
//                                                      (pontoRotaId null = limpa/encerra).
//  - { action:"escanear",   destinoId, sentido, texto } → resolve o QR/NFC lido (URL /v/<token>
//                                                      ou token puro) → reserva de HOJE do aluno
//                                                      → marca Embarque. Devolve resultado + aluno.
//
// Deploy: npx supabase functions deploy monitor --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify } from "https://esm.sh/jose@5";
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
const AUTH_SECRET = Deno.env.get("AUTH_SECRET")!;
// deno-lint-ignore no-explicit-any
type DB = any;
const um = (x: unknown) => (Array.isArray(x) ? x[0] ?? null : x ?? null);

// extrai o token JWT de um texto lido do QR (URL .../v/<token>) ou de uma tag NFC (URL ou token puro)
function extrairToken(texto: string): string {
  const t = texto.trim();
  const m = t.match(/\/v\/([^/?#\s]+)/);
  if (m) return m[1];
  return t;
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
  const { data: caller } = await db.from("Usuario").select("id, papel, secretariaId, permissoes").eq("authUserId", userData.user.id).maybeSingle();
  // monitor = staff (FISCAL/ADMIN/DONO) OU um ALUNO que a secretaria designou como monitor
  // (permissão ESCANEAR_EMBARQUE) — assim o mesmo aluno atua como monitor sem 2ª conta.
  const ehMonitor = Boolean(caller) && (
    ["FISCAL", "ADMIN", "DONO"].includes(caller!.papel) ||
    (caller!.papel === "ALUNO" && Array.isArray(caller!.permissoes) && caller!.permissoes.includes("ESCANEAR_EMBARQUE"))
  );
  if (!ehMonitor) return json({ error: "sem permissão" }, 403);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const action = b.action ?? "estado";
  const sentido = b.sentido === "VOLTA" ? "VOLTA" : "IDA";

  // ---- escanear (QR/NFC) → marca Embarque da reserva de hoje ----
  if (action === "escanear") {
    const destinoId = String(b.destinoId ?? "");
    if (!destinoId) return json({ error: "destinoId ausente" }, 400);
    const texto = String(b.texto ?? "");
    if (!texto) return json({ resultado: "TOKEN_INVALIDO", mensagem: "Nada foi lido." });

    // escopo de tenant da rota
    const { data: destino } = await db.from("Destino").select("secretariaId, nome").eq("id", destinoId).maybeSingle();
    if (!destino) return json({ error: "rota não encontrada" }, 404);
    if (caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);

    // 1) valida a assinatura do token
    const token = extrairToken(texto);
    let cid = "", v = -1;
    try {
      const { payload } = await jwtVerify(token, new TextEncoder().encode(AUTH_SECRET));
      if (!payload.sub) return json({ resultado: "TOKEN_INVALIDO", mensagem: "QR/NFC inválido." });
      cid = String(payload.sub);
      v = Number(payload.v);
    } catch {
      return json({ resultado: "TOKEN_INVALIDO", mensagem: "QR/NFC inválido ou de outro sistema." });
    }

    // 2) resolve a carteirinha → aluno e valida versão/validade
    const { data: cart } = await db.from("Carteirinha")
      .select("versao, qrToken, validade, aluno:Aluno ( id, nome, fotoUrl, destinoId, secretariaId )")
      .eq("id", cid).maybeSingle();
    if (!cart) return json({ resultado: "TOKEN_INVALIDO", mensagem: "Carteirinha não encontrada." });
    const aluno = um(cart.aluno) as { id: string; nome: string; fotoUrl: string | null; destinoId: string | null; secretariaId: string | null } | null;
    if (!aluno) return json({ resultado: "TOKEN_INVALIDO", mensagem: "Carteirinha sem aluno." });
    const info = { nome: aluno.nome, fotoUrl: aluno.fotoUrl };

    if (cart.versao !== v || cart.qrToken !== token) return json({ resultado: "DESATUALIZADA", aluno: info, mensagem: "Carteirinha desatualizada — peça para o aluno abrir o app." });
    if (!cart.validade) return json({ resultado: "NAO_AUTORIZADA", aluno: info, mensagem: "Aluno sem autorização válida." });
    if (new Date(cart.validade).getTime() < Date.now()) return json({ resultado: "EXPIRADA", aluno: info, mensagem: "Carteirinha expirada." });

    // 3) a carteirinha é da mesma rota que o monitor está operando?
    if (aluno.destinoId && aluno.destinoId !== destinoId) return json({ resultado: "OUTRA_ROTA", aluno: info, mensagem: "Aluno é de outra rota." });

    // 4) reserva CONFIRMADA de hoje nesta viagem
    const { data: viagem } = await db.from("Viagem").select("id")
      .eq("destinoId", destinoId).gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString())
      .limit(1).maybeSingle();
    if (!viagem) return json({ resultado: "SEM_VIAGEM", aluno: info, mensagem: "Sem viagem hoje nesta rota." });

    const { data: reserva } = await db.from("Reserva").select("id, status, vaiIda, vaiVolta")
      .eq("viagemId", viagem.id).eq("alunoId", aluno.id).maybeSingle();
    if (!reserva || reserva.status !== "CONFIRMADA") return json({ resultado: "NAO_CONFIRMADO", aluno: info, mensagem: "Aluno não confirmou presença hoje." });
    if (sentido === "IDA" ? !reserva.vaiIda : !reserva.vaiVolta) {
      return json({ resultado: "NAO_NESTE_SENTIDO", aluno: info, mensagem: `Aluno não vai na ${sentido === "IDA" ? "ida" : "volta"}.` });
    }

    // 5) marca embarque (idempotente)
    const { data: existe } = await db.from("Embarque").select("id, horario").eq("reservaId", reserva.id).eq("sentido", sentido).maybeSingle();
    if (existe) return json({ resultado: "JA_EMBARCADO", aluno: info, horario: existe.horario, mensagem: "Já havia embarcado." });
    await db.from("Embarque").insert({ id: crypto.randomUUID(), reservaId: reserva.id, sentido, fiscalId: caller.id });
    return json({ resultado: "OK", aluno: info, mensagem: "Embarque registrado." });
  }

  // ---- definir ponto atual do ônibus ----
  if (action === "definir-ponto") {
    const destinoId = String(b.destinoId ?? "");
    if (!destinoId) return json({ error: "destinoId ausente" }, 400);
    const { data: destino } = await db.from("Destino").select("secretariaId").eq("id", destinoId).maybeSingle();
    if (!destino) return json({ error: "rota não encontrada" }, 404);
    if (caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);
    const { data: viagem } = await db.from("Viagem").select("id")
      .eq("destinoId", destinoId).gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString())
      .limit(1).maybeSingle();
    if (!viagem) return json({ error: "sem viagem hoje" }, 404);
    const pontoRotaId = b.pontoRotaId ? String(b.pontoRotaId) : null;
    let sentidoAtual: string | null = null;
    if (pontoRotaId) {
      const { data: pr } = await db.from("PontoRota").select("sentido, destinoId").eq("id", pontoRotaId).maybeSingle();
      if (!pr || pr.destinoId !== destinoId) return json({ error: "ponto inválido" }, 400);
      sentidoAtual = pr.sentido;
    }
    await db.from("Viagem").update({ pontoAtualId: pontoRotaId, sentidoAtual }).eq("id", viagem.id);
    return json({ ok: true });
  }

  // ---- registrar chegada / saída (GPS/Geofencing) ----
  if (action === "registrar-chegada" || action === "registrar-saida") {
    const destinoId = String(b.destinoId ?? "");
    if (!destinoId) return json({ error: "destinoId ausente" }, 400);
    const pontoRotaId = String(b.pontoRotaId ?? "");
    if (!pontoRotaId) return json({ error: "pontoRotaId ausente" }, 400);
    
    const { data: destino } = await db.from("Destino").select("secretariaId").eq("id", destinoId).maybeSingle();
    if (!destino) return json({ error: "rota não encontrada" }, 404);
    if (caller.papel !== "DONO" && destino.secretariaId !== caller.secretariaId) return json({ error: "sem permissão nesta rota" }, 403);
    
    const { data: viagem } = await db.from("Viagem").select("id")
      .eq("destinoId", destinoId).gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString())
      .limit(1).maybeSingle();
    if (!viagem) return json({ error: "sem viagem hoje" }, 404);

    if (action === "registrar-chegada") {
      const distanciaDetectadaM = b.distanciaM ? Number(b.distanciaM) : null;
      const origem = String(b.origem ?? "GPS");
      const chegouEm = b.chegouEm ? String(b.chegouEm) : new Date().toISOString();
      
      const { data: pr } = await db.from("PontoRota").select("sentido").eq("id", pontoRotaId).maybeSingle();
      if (pr) await db.from("Viagem").update({ pontoAtualId: pontoRotaId, sentidoAtual: pr.sentido }).eq("id", viagem.id);

      const id = String(b.id ?? crypto.randomUUID());
      const { error } = await db.from("RegistroPonto").insert({
        id, viagemId: viagem.id, pontoRotaId, chegouEm, distanciaDetectadaM, origem, fiscal: caller.id
      });
      return json({ ok: true, id, error: error?.message }); // Retorna msg se erro de duplicidade p/ debug
    } else {
      const id = String(b.id ?? ""); 
      const saiuEm = b.saiuEm ? String(b.saiuEm) : new Date().toISOString();
      
      if (id) {
        await db.from("RegistroPonto").update({ saiuEm }).eq("id", id);
      } else {
        const { data: ult } = await db.from("RegistroPonto")
          .select("id")
          .eq("viagemId", viagem.id).eq("pontoRotaId", pontoRotaId).is("saiuEm", null)
          .order("chegouEm", { ascending: false }).limit(1).maybeSingle();
        if (ult) await db.from("RegistroPonto").update({ saiuEm }).eq("id", ult.id);
      }
      return json({ ok: true });
    }
  }

  // ---- embarcar / desembarcar ----
  if (action === "embarcar" || action === "desembarcar") {
    const reservaId = String(b.reservaId ?? "");
    if (!reservaId) return json({ error: "reservaId ausente" }, 400);
    if (action === "desembarcar") {
      await db.from("Embarque").delete().eq("reservaId", reservaId).eq("sentido", sentido);
      return json({ ok: true });
    }
    const { data: existe } = await db.from("Embarque").select("id").eq("reservaId", reservaId).eq("sentido", sentido).maybeSingle();
    if (existe) {
      await db.from("Embarque").update({ horario: new Date().toISOString(), fiscalId: caller.id }).eq("id", existe.id);
    } else {
      await db.from("Embarque").insert({ id: crypto.randomUUID(), reservaId, sentido, fiscalId: caller.id });
    }
    return json({ ok: true });
  }

  // ---- estado: viagem de hoje + plano de chamada + embarques ----
  const destinoId = String(b.destinoId ?? "");
  if (!destinoId) return json({ error: "destinoId ausente" }, 400);

  // escopo de tenant
  const { data: destino } = await db.from("Destino").select("secretariaId, nome, exibirQuemFalta").eq("id", destinoId).maybeSingle();
  if (!destino) return json({ error: "rota não encontrada" }, 404);
  const podeVer = caller.papel === "DONO" || destino.secretariaId === caller.secretariaId;
  if (!podeVer) return json({ error: "sem permissão nesta rota" }, 403);

  const { data: cfg } = await db.from("ConfiguracaoPlataforma").select("nfcAtivo, itinerarioAtivo").eq("id", "GLOBAL").maybeSingle();
  const nfcAtivo = Boolean(cfg?.nfcAtivo);
  const itinerarioAtivo = Boolean(cfg?.itinerarioAtivo);

  const { data: viagem } = await db.from("Viagem").select("id, horario, pontoAtualId, sentidoAtual")
    .eq("destinoId", destinoId).gte("data", inicioDeHoje().toISOString()).lt("data", amanha().toISOString())
    .limit(1).maybeSingle();
  if (!viagem) return json({ viagem: null, pontos: [], rota: destino.nome, nfcAtivo, itinerario: [] });

  const { data: v } = await db.from("Viagem").select(
    `id, destino:Destino ( onibus:Onibus ( id, nome, capacidade, ativo, localidades:OnibusLocalidade ( localidadeId, prioridade ) ) ),
     reservas:Reserva ( id, alunoId, seq, status, vaiIda, vaiVolta, onibusPreferidoId,
       aluno:Aluno ( nome, fotoUrl, faculdade, localidadeId, localidade:Localidade ( nome ) ),
       embarques:Embarque ( sentido ) )`,
  ).eq("id", viagem.id).maybeSingle();

  // itinerário configurado (pontos por sentido) + "quem falta" em cada ponto — só se o módulo estiver ativo
  const { data: itinRaw } = itinerarioAtivo
    ? await db.from("PontoRota").select("id, sentido, ordem, nome, localidadeId, faculdade").eq("destinoId", destinoId).order("ordem")
    : { data: [] as DB[] };
  const reservasConf = (v.reservas ?? []).filter((r: DB) => r.status === "CONFIRMADA");
  const temEmb = (r: DB, s: string) => (r.embarques ?? []).some((e: DB) => e.sentido === s);
  const itinerario = (itinRaw ?? []).map((p: DB) => {
    let faltantes: DB[] = [];
    if (p.sentido === "IDA" && p.localidadeId) {
      faltantes = reservasConf.filter((r: DB) => r.vaiIda && r.aluno?.localidadeId === p.localidadeId && !temEmb(r, "IDA"));
    } else if (p.sentido === "VOLTA" && p.faculdade) {
      faltantes = reservasConf.filter((r: DB) => r.vaiVolta && r.aluno?.faculdade === p.faculdade && temEmb(r, "IDA") && !temEmb(r, "VOLTA"));
    }
    const exibirQuem = destino.exibirQuemFalta ?? "QTD_NOME";
    return {
      id: p.id, sentido: p.sentido, ordem: p.ordem, nome: p.nome,
      faltamQtd: exibirQuem === "NAO_EXIBIR" ? 0 : faltantes.length,
      faltam: exibirQuem === "QTD_NOME" ? faltantes.map((r: DB) => ({ nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null })) : [],
    };
  });

  const onibus = (v.destino?.onibus ?? []).filter((o: DB) => o.ativo);
  const reservas = v.reservas ?? [];
  const rById = new Map(reservas.map((r: DB) => [r.id, r]));
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

  // só CONFIRMADA entra na chamada; agrupa por ponto e ordena por ônibus+posição
  const grupos = new Map<string, { ponto: string; itens: DB[] }>();
  for (const a of aloc.alocacoes.filter((x) => x.status === "CONFIRMADA")) {
    const r: DB = rById.get(a.reservaId);
    const key = r.aluno?.localidadeId ?? "__sem__";
    let g = grupos.get(key);
    if (!g) { g = { ponto: r.aluno?.localidade?.nome ?? "Sem ponto", itens: [] }; grupos.set(key, g); }
    const emb = (r.embarques ?? []).map((e: DB) => e.sentido);
    g.itens.push({
      reservaId: a.reservaId, nome: r.aluno?.nome ?? "", fotoUrl: r.aluno?.fotoUrl ?? null,
      onibusNome: a.onibusId ? (onibus.find((o: DB) => o.id === a.onibusId)?.nome ?? null) : null,
      posicao: a.posicao, embarcouIda: emb.includes("IDA"), embarcouVolta: emb.includes("VOLTA"),
    });
  }
  const pontos = [...grupos.values()].map((g) => ({
    ponto: g.ponto,
    itens: g.itens.sort((a, b) => (a.onibusNome ?? "").localeCompare(b.onibusNome ?? "") || (a.posicao ?? 0) - (b.posicao ?? 0)),
  })).sort((a, b) => a.ponto.localeCompare(b.ponto));

  return json({
    viagem: { id: viagem.id, horario: viagem.horario, pontoAtualId: viagem.pontoAtualId ?? null, sentidoAtual: viagem.sentidoAtual ?? null },
    rota: destino.nome, pontos, nfcAtivo,
    itinerario, exibirQuemFalta: destino.exibirQuemFalta ?? "QTD_NOME",
  });
});
