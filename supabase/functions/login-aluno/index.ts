// Edge Function (Deno) — login por CPF OU e-mail.
//
// O Supabase Auth autentica por e-mail; alunos costumam logar por CPF. Esta função
// recebe { login, senha }, resolve o e-mail (CPF → RPC email_por_cpf, com service role)
// e faz o signInWithPassword no SERVIDOR, devolvendo os tokens de sessão. O front então
// chama supabase.auth.setSession(...). Vantagens:
//  - o e-mail nunca é exposto ao cliente (sem enumeração por CPF);
//  - falha sempre com mensagem genérica (não revela se o CPF/e-mail existe).
//
// Deploy: npx supabase functions deploy login-aluno --project-ref mtumvzzvwankdppebhle
//
// Nota: usamos verify_jwt = false (endpoint público de login) — ver config abaixo.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  let login = "";
  let senha = "";
  try {
    const body = await req.json();
    login = String(body.login ?? "").trim();
    senha = String(body.senha ?? "");
  } catch {
    return json({ error: "corpo inválido" }, 400);
  }
  if (!login || !senha) return json({ error: "informe login e senha" }, 400);

  // resolve o e-mail: se contém '@' é e-mail; senão trata como CPF (só dígitos).
  let email: string | null = null;
  if (login.includes("@")) {
    email = login.toLowerCase();
  } else {
    const digits = login.replace(/\D/g, "");
    if (digits.length !== 11) return json({ error: "credenciais inválidas" }, 401);
    const admin = createClient(URL, SERVICE, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await admin.rpc("email_por_cpf", { cpf_digits: digits });
    if (error) return json({ error: "falha ao resolver login" }, 500);
    email = (data as string | null) ?? null;
  }

  // resposta genérica para não revelar existência da conta
  if (!email) return json({ error: "credenciais inválidas" }, 401);

  const anon = createClient(URL, ANON, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: sess, error: sErr } = await anon.auth.signInWithPassword({
    email,
    password: senha,
  });
  if (sErr || !sess.session) return json({ error: "credenciais inválidas" }, 401);

  return json({
    access_token: sess.session.access_token,
    refresh_token: sess.session.refresh_token,
  });
});
