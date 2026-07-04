// Edge Function (Deno) — migra perfis LEGADOS (Usuario sem authUserId, criados no
// sistema antigo/NextAuth) para o Supabase Auth. Cria a identidade (generateLink invite)
// + vincula authUserId; opcionalmente envia o convite por e-mail (Resend). Só DONO.
// Idempotente: pula quem já tem conta. Suporta dryRun (só pré-visualiza).
//
// Deploy: npx supabase functions deploy migrar-legados --use-api --project-ref mtumvzzvwankdppebhle

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

async function enviarConvite(email: string, nome: string, link: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const from = Deno.env.get("EMAIL_FROM") ?? "SYSBUS <onboarding@resend.dev>";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#0f172a">Ative seu acesso ao SYSBUS</h2>
    <p>Olá, ${nome.split(" ")[0]}! O sistema de transporte foi atualizado. Ative seu acesso:</p>
    <p><a href="${link}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Definir senha e acessar</a></p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Ative seu acesso ao SYSBUS", html }),
  });
  return res.ok;
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
  const { data: caller } = await db.from("Usuario").select("id, nome, papel").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || caller.papel !== "DONO") return json({ error: "só o operador da plataforma pode migrar" }, 403);

  let b: Record<string, unknown> = {};
  try { b = await req.json(); } catch { /* */ }
  const dryRun = b.dryRun !== false; // padrão: pré-visualiza (seguro)
  const enviarEmail = b.enviarEmail === true;

  // legados = sem conta Supabase e com e-mail
  const { data: legados } = await db.from("Usuario")
    .select("id, nome, email, papel").is("authUserId", null).not("email", "is", null);
  const lista = (legados ?? []).filter((u) => u.email);

  if (dryRun) {
    return json({ dryRun: true, total: lista.length, usuarios: lista.map((u) => ({ nome: u.nome, email: u.email, papel: u.papel })) });
  }

  const resultado: { nome: string; email: string; papel: string; ok: boolean; emailEnviado: boolean; erro?: string }[] = [];
  for (const u of lista) {
    try {
      const { data: link, error } = await db.auth.admin.generateLink({
        type: "invite", email: u.email, options: { redirectTo: `${APP_URL}/definir-senha` },
      });
      if (error || !link.user) { resultado.push({ nome: u.nome, email: u.email, papel: u.papel, ok: false, emailEnviado: false, erro: error?.message }); continue; }
      await db.from("Usuario").update({ authUserId: link.user.id }).eq("id", u.id);
      const emailEnviado = enviarEmail ? await enviarConvite(u.email, u.nome, link.properties?.action_link ?? "") : false;
      resultado.push({ nome: u.nome, email: u.email, papel: u.papel, ok: true, emailEnviado });
    } catch (e) {
      resultado.push({ nome: u.nome, email: u.email, papel: u.papel, ok: false, emailEnviado: false, erro: e instanceof Error ? e.message : "erro" });
    }
  }

  const migrados = resultado.filter((r) => r.ok).length;
  await db.from("LogAuditoria").insert({
    id: crypto.randomUUID(), usuarioId: caller.id, usuarioNome: caller.nome, papel: "DONO",
    acao: "MIGRACAO_LEGADOS", descricao: `Migrou ${migrados}/${lista.length} perfis legados p/ Supabase Auth${enviarEmail ? " (com convite)" : ""}`,
    entidade: "Usuario", entidadeId: null, secretariaId: null,
  });

  return json({ dryRun: false, total: lista.length, migrados, resultado });
});
