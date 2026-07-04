// Edge Function (Deno) — SECRETARIA avalia a renovação/autorização do aluno.
// Espelha (painel)/renovacoes/actions.ts. Guardada por gestor (ADMIN/FISCAL/DONO da
// secretaria do aluno). Ações (JSON):
//  - { action:"aprovar",  id }              → Renovacao APROVADA + Carteirinha (validade do
//                                              semestre, versao+1, novo qrToken → invalida QR antigo).
//  - { action:"rejeitar", id, observacao }  → Renovacao REJEITADA + motivo.
//  - { action:"url",      id }              → URL assinada do comprovante.
// Registra LogAuditoria (append-only).
//
// Deploy: npx supabase functions deploy avaliar-renovacao --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5";
import { fimDoSemestreDeLabel } from "../_shared/tempo.ts";

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
  const { data: caller } = await db.from("Usuario").select("id, nome, papel, secretariaId").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || !["ADMIN", "FISCAL", "DONO"].includes(caller.papel)) return json({ error: "sem permissão" }, 403);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const action = b.action ?? "";
  const id = String(b.id ?? "");
  if (!id) return json({ error: "id ausente" }, 400);

  const { data: renovRaw } = await db.from("Renovacao")
    .select(`id, semestre, comprovanteUrl, alunoId, aluno:Aluno ( nome, secretariaId, carteirinha:Carteirinha ( id, versao ) )`)
    .eq("id", id).maybeSingle();
  if (!renovRaw) return json({ error: "renovação não encontrada" }, 404);
  const renov: DB = renovRaw;
  const aluno = um(renov.aluno);
  const cart = um(aluno?.carteirinha);

  // guarda de tenant: DONO tudo; ADMIN/FISCAL só a própria secretaria
  const podeGerir = caller.papel === "DONO" || (["ADMIN", "FISCAL"].includes(caller.papel) && aluno?.secretariaId && aluno.secretariaId === caller.secretariaId);
  if (!podeGerir) return json({ error: "sem permissão nesta secretaria" }, 403);

  async function audit(acao: string, descricao: string) {
    await db.from("LogAuditoria").insert({
      id: crypto.randomUUID(), usuarioId: caller.id, usuarioNome: caller.nome, papel: caller.papel,
      acao, descricao, entidade: "Aluno", entidadeId: renov.alunoId,
      secretariaId: aluno?.secretariaId ?? caller.secretariaId ?? null,
    });
  }

  if (action === "url") {
    const nome = String(renov.comprovanteUrl ?? "").replace(/^priv:/, "");
    if (!nome) return json({ error: "sem comprovante" }, 404);
    const { data: signed, error } = await db.storage.from("documentos").createSignedUrl(nome, 3600);
    if (error) return json({ error: "falha ao gerar link" }, 500);
    return json({ url: signed.signedUrl });
  }

  if (action === "aprovar") {
    if (!cart) return json({ error: "aluno sem carteirinha" }, 409);
    // validade = fim do PERÍODO LETIVO configurado pela secretaria; se não houver,
    // cai no cálculo padrão (X.1→jun, X.2→dez). É gravada no ato → a carteirinha
    // deste período expira no fim dele e não vale no próximo.
    const { data: periodo } = await db.from("PeriodoLetivo").select("label, validadeAte").eq("secretariaId", aluno.secretariaId).maybeSingle();
    const novaValidade = periodo?.validadeAte ? new Date(periodo.validadeAte) : fimDoSemestreDeLabel(renov.semestre);
    const rotuloSemestre = periodo?.label ?? renov.semestre;
    const novaVersao = (cart.versao ?? 1) + 1;
    const novoToken = await new SignJWT({ v: novaVersao })
      .setProtectedHeader({ alg: "HS256" }).setSubject(cart.id).setIssuedAt()
      .sign(new TextEncoder().encode(AUTH_SECRET));

    await db.from("Renovacao").update({
      status: "APROVADA", avaliadorId: caller.id, avaliadoEm: new Date().toISOString(),
      validadeConcedida: novaValidade.toISOString(), observacao: null,
    }).eq("id", id);
    await db.from("Carteirinha").update({
      validade: novaValidade.toISOString(), versao: novaVersao, qrToken: novoToken,
    }).eq("id", cart.id);
    await audit("AUTORIZACAO_APROVADA", `Aprovou a autorização de ${aluno.nome} (período ${rotuloSemestre}, validade ${novaValidade.toLocaleDateString("pt-BR", { timeZone: "America/Recife" })})`);
    return json({ ok: true, validade: novaValidade.toISOString() });
  }

  if (action === "rejeitar") {
    const observacao = String(b.observacao ?? "").trim() || null;
    await db.from("Renovacao").update({
      status: "REJEITADA", avaliadorId: caller.id, avaliadoEm: new Date().toISOString(), observacao,
    }).eq("id", id);
    await audit("AUTORIZACAO_REJEITADA", `Rejeitou a autorização de ${aluno.nome} (semestre ${renov.semestre})${observacao ? ` — ${observacao}` : ""}`);
    return json({ ok: true });
  }

  return json({ error: "ação inválida" }, 400);
});
