// Edge Function (Deno) — DONO (L0) provisiona uma SECRETARIA (tenant) + seu ADMIN inicial.
// Cria Secretaria + convida o ADMIN por e-mail (generateLink invite + Resend, ou fallback link).
// Guardada por JWT: só DONO. Registra LogAuditoria.
//
// Deploy: npx supabase functions deploy provisionar-secretaria --use-api --project-ref mtumvzzvwankdppebhle

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

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "secretaria";
}

async function enviarConvite(email: string, nome: string, link: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false;
  const from = Deno.env.get("EMAIL_FROM") ?? "SYSBUS <onboarding@resend.dev>";
  const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
    <h2 style="color:#0f172a">Acesso à sua secretaria no SYSBUS</h2>
    <p>Olá, ${nome.split(" ")[0]}! Sua secretaria foi criada na plataforma.</p>
    <p><a href="${link}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">Definir senha e acessar</a></p>
  </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [email], subject: "Seu acesso ao SYSBUS (Secretaria)", html }),
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
  if (!caller || caller.papel !== "DONO") return json({ error: "só o operador da plataforma pode provisionar secretarias" }, 403);

  let b: Record<string, string> = {};
  try { b = await req.json(); } catch { /* */ }
  const nome = String(b.nome ?? "").trim();
  const municipio = String(b.municipio ?? "").trim();
  const uf = String(b.uf ?? "").trim().toUpperCase();
  const cnpj = String(b.cnpj ?? "").trim() || null;
  const adminNome = String(b.adminNome ?? "").trim();
  const adminEmail = String(b.adminEmail ?? "").trim().toLowerCase();

  if (nome.length < 3) return json({ error: "Informe o nome da secretaria." }, 400);
  if (!municipio || uf.length !== 2) return json({ error: "Informe município e UF." }, 400);
  if (adminNome.length < 3) return json({ error: "Informe o nome do responsável." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(adminEmail)) return json({ error: "E-mail do responsável inválido." }, 400);

  const { data: jaEmail } = await db.from("Usuario").select("id").eq("email", adminEmail).maybeSingle();
  if (jaEmail) return json({ error: "Já existe uma conta com este e-mail." }, 409);

  try {
    const secretariaId = crypto.randomUUID();
    const slug = `${slugify(nome)}-${crypto.randomUUID().slice(0, 6)}`;
    const { error: sErr } = await db.from("Secretaria").insert({
      id: secretariaId, slug, nome, municipio, uf, cnpj, status: "ATIVA",
    });
    if (sErr) return json({ error: `Falha ao criar secretaria: ${sErr.message}` }, 500);

    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type: "invite", email: adminEmail, options: { redirectTo: `${APP_URL}/definir-senha` },
    });
    if (linkErr || !linkData.user) {
      await db.from("Secretaria").delete().eq("id", secretariaId); // rollback
      return json({ error: "Não foi possível convidar o responsável." }, 500);
    }
    const actionLink = linkData.properties?.action_link ?? "";

    await db.from("Usuario").insert({
      id: crypto.randomUUID(), nome: adminNome, email: adminEmail, senhaHash: "__supabase_auth__",
      papel: "ADMIN", authUserId: linkData.user.id, secretariaId,
    });

    await db.from("LogAuditoria").insert({
      id: crypto.randomUUID(), usuarioId: caller.id, usuarioNome: caller.nome, papel: "DONO",
      acao: "SECRETARIA_PROVISIONADA", descricao: `Provisionou a secretaria ${nome} (${municipio}/${uf}) — ADMIN ${adminNome}`,
      entidade: "Secretaria", entidadeId: secretariaId, secretariaId,
    });

    const emailEnviado = await enviarConvite(adminEmail, adminNome, actionLink);
    return json({ ok: true, secretariaId, emailEnviado, actionLink: emailEnviado ? undefined : actionLink });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro ao provisionar." }, 500);
  }
});
