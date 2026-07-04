// Edge Function (Deno) — a SECRETARIA cadastra um FUNCIONÁRIO (staff) definindo papel +
// PERMISSÕES granulares (o que ele acessa). Convida por e-mail (Resend). Guardada por
// ADMIN (da sua secretaria) ou DONO. JSON: { nome, email, papel:"ADMIN"|"FISCAL", permissoes[], secretariaId? }
//
// Deploy: npx supabase functions deploy provisionar-funcionario --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";
const PERMISSOES_VALIDAS = new Set([
  "VER_TRANSPORTE", "INSERIR_FILA", "VER_EMBARQUE", "ESCANEAR_EMBARQUE", "APROVAR_DOCUMENTOS",
  "GERIR_ALUNOS", "GERIR_ROTAS", "GERIR_FROTA", "GERIR_TEMPLATE", "GERIR_CALENDARIO", "VER_AUDITORIA", "GERIR_FUNCIONARIOS",
]);

async function enviarConvite(email: string, nome: string, link: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const from = Deno.env.get("EMAIL_FROM") ?? "SYSBUS <onboarding@resend.dev>";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#0f172a">Seu acesso ao SYSBUS</h2>
    <p>Olá, ${nome.split(" ")[0]}! Você foi cadastrado como responsável no sistema de transporte.</p>
    <p><a href="${link}" style="background:#173f63;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Definir senha e acessar</a></p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Seu acesso ao SYSBUS", html }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  const asUser = createClient(URL_, ANON, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } }, auth: { autoRefreshToken: false, persistSession: false } });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "não autenticado" }, 401);

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller } = await db.from("Usuario").select("id, nome, papel, secretariaId, permissoes").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || !["ADMIN", "DONO"].includes(caller.papel)) return json({ error: "sem permissão" }, 403);
  // ADMIN só cria funcionário se puder gerir funcionários (ou é o admin da secretaria)
  if (caller.papel === "ADMIN" && Array.isArray(caller.permissoes) && caller.permissoes.length > 0 && !caller.permissoes.includes("GERIR_FUNCIONARIOS"))
    return json({ error: "sem permissão para gerir funcionários" }, 403);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* */ }
  const nome = String(b.nome ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const papel = String(b.papel ?? "FISCAL");
  const permissoes = Array.isArray(b.permissoes) ? (b.permissoes as string[]).filter((p) => PERMISSOES_VALIDAS.has(p)) : [];
  const secretariaId = caller.papel === "DONO" ? (String(b.secretariaId ?? "") || null) : caller.secretariaId;

  if (nome.length < 3) return json({ error: "Informe o nome do funcionário." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
  if (!["ADMIN", "FISCAL"].includes(papel)) return json({ error: "Papel inválido." }, 400);
  if (!secretariaId) return json({ error: "Secretaria não definida." }, 400);

  const { data: ja } = await db.from("Usuario").select("id").eq("email", email).maybeSingle();
  if (ja) return json({ error: "Já existe uma conta com este e-mail." }, 409);

  try {
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({ type: "invite", email, options: { redirectTo: `${APP_URL}/definir-senha` } });
    if (linkErr || !linkData.user) return json({ error: "Não foi possível convidar o funcionário." }, 500);
    const actionLink = linkData.properties?.action_link ?? "";

    await db.from("Usuario").insert({
      id: crypto.randomUUID(), nome, email, senhaHash: "__supabase_auth__", papel,
      authUserId: linkData.user.id, secretariaId, permissoes,
    });
    await db.from("LogAuditoria").insert({
      id: crypto.randomUUID(), usuarioId: caller.id, usuarioNome: caller.nome, papel: caller.papel,
      acao: "FUNCIONARIO_CADASTRADO", descricao: `Cadastrou o funcionário ${nome} (${papel})`, entidade: "Usuario", entidadeId: null, secretariaId,
    });

    const emailEnviado = await enviarConvite(email, nome, actionLink);
    return json({ ok: true, emailEnviado, actionLink: emailEnviado ? undefined : actionLink });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro ao cadastrar." }, 500);
  }
});
