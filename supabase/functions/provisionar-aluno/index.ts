// Edge Function (Deno) — SECRETARIA cadastra o aluno (fluxo 2). O aluno recebe um
// e-mail (via Resend) com link/token para DEFINIR A SENHA e depois enviar documentos.
//
// Guardada por JWT: só ADMIN (secretaria) ou DONO pode chamar. Cria Usuario+Aluno+
// Carteirinha (QR assinado, validade null = ainda não autorizado). NÃO cria Renovacao
// (os documentos vêm depois, quando o aluno acessa). Usa admin.generateLink({type:'invite'})
// — não dispara e-mail do Supabase; nós enviamos o e-mail bonito via Resend.
//
// Deploy (COM verificação de JWT):
//   npx supabase functions deploy provisionar-aluno --use-api --project-ref mtumvzzvwankdppebhle
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANON (auto) · AUTH_SECRET (setado) ·
//          RESEND_API_KEY, EMAIL_FROM, APP_URL (a adicionar).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SignJWT } from "https://esm.sh/jose@5";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTH_SECRET = Deno.env.get("AUTH_SECRET")!;
const APP_URL = Deno.env.get("APP_URL") ?? "http://localhost:5173";

async function qrToken(cid: string, versao: number): Promise<string> {
  return await new SignJWT({ v: versao })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(cid)
    .setIssuedAt()
    .sign(new TextEncoder().encode(AUTH_SECRET));
}

async function enviarConvite(email: string, nome: string, link: string): Promise<boolean> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return false; // sem key ainda → o front recebe o link como fallback
  const from = Deno.env.get("EMAIL_FROM") ?? "SYSBUS <onboarding@resend.dev>";
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto">
      <h2 style="color:#0f172a">Bem-vindo(a) ao transporte universitário</h2>
      <p>Olá, ${nome.split(" ")[0]}! A secretaria cadastrou você no SYSBUS.</p>
      <p>Para ativar seu acesso, <strong>defina sua senha</strong> e envie seus documentos:</p>
      <p style="margin:24px 0">
        <a href="${link}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none">
          Ativar meu acesso
        </a>
      </p>
      <p style="color:#64748b;font-size:13px">Se você não esperava este e-mail, ignore-o.</p>
    </div>`;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Ative seu acesso ao transporte universitário (SYSBUS)",
      html,
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  // 1) identifica o CHAMADOR pelo JWT e exige ADMIN/DONO
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(URL_, ANON, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "não autenticado" }, 401);

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: caller } = await db
    .from("Usuario")
    .select("papel, secretariaId")
    .eq("authUserId", userData.user.id)
    .maybeSingle();
  if (!caller || (caller.papel !== "ADMIN" && caller.papel !== "DONO")) {
    return json({ error: "sem permissão" }, 403);
  }

  // 2) valida entrada
  let b: Record<string, string>;
  try {
    b = await req.json();
  } catch {
    return json({ error: "corpo inválido" }, 400);
  }
  const nome = String(b.nome ?? "").trim();
  const email = String(b.email ?? "").trim().toLowerCase();
  const cpf = String(b.cpf ?? "").trim();
  const destinoId = String(b.destinoId ?? "").trim();
  const faculdade = (b.faculdade ?? "").trim() || null;
  const curso = (b.curso ?? "").trim() || null;
  const matricula = (b.matricula ?? "").trim() || null;

  if (nome.length < 3) return json({ error: "Informe o nome completo." }, 400);
  if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "E-mail inválido." }, 400);
  if (cpf.replace(/\D/g, "").length !== 11) return json({ error: "CPF inválido." }, 400);
  if (!destinoId) return json({ error: "Selecione a cidade/rota." }, 400);

  // 3) unicidade
  const { data: jaEmail } = await db.from("Usuario").select("id").eq("email", email).maybeSingle();
  if (jaEmail) return json({ error: "Já existe uma conta com este e-mail." }, 409);
  const { data: jaCpf } = await db.from("Aluno").select("id").eq("cpf", cpf).maybeSingle();
  if (jaCpf) return json({ error: "Já existe um aluno com este CPF." }, 409);

  try {
    // 4) cria a identidade + link de convite (NÃO envia e-mail pelo Supabase)
    const { data: linkData, error: linkErr } = await db.auth.admin.generateLink({
      type: "invite",
      email,
      options: { redirectTo: `${APP_URL}/definir-senha` },
    });
    if (linkErr || !linkData.user) {
      return json({ error: "Não foi possível criar o convite." }, 500);
    }
    const authUserId = linkData.user.id;
    const actionLink = linkData.properties?.action_link ?? "";

    // 5) grava Usuario + Aluno + Carteirinha (mesma secretaria do chamador)
    const usuarioId = crypto.randomUUID();
    const alunoId = crypto.randomUUID();
    const cartId = crypto.randomUUID();
    const ins = async (t: string, row: Record<string, unknown>) => {
      const { error } = await db.from(t).insert(row);
      if (error) throw new Error(`${t}: ${error.message}`);
    };
    await ins("Usuario", {
      id: usuarioId, nome, email, senhaHash: "__supabase_auth__", papel: "ALUNO",
      authUserId, secretariaId: caller.secretariaId ?? null,
    });
    await ins("Aluno", {
      id: alunoId, usuarioId, nome, cpf, faculdade, curso, matricula, destinoId,
      secretariaId: caller.secretariaId ?? null,
    });
    await ins("Carteirinha", {
      id: cartId, alunoId, versao: 1, validade: null, qrToken: await qrToken(cartId, 1),
    });

    // 6) envia o convite via Resend (ou devolve o link como fallback)
    const emailEnviado = await enviarConvite(email, nome, actionLink);
    return json({ ok: true, emailEnviado, actionLink: emailEnviado ? undefined : actionLink });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Erro ao provisionar." }, 500);
  }
});
