// Edge Function (Deno) — verificação PÚBLICA do QR da carteirinha. Espelha app/v/[token]/page.tsx.
// Recebe { token } (JWT do QR), verifica a assinatura (AUTH_SECRET) e devolve a situação
// + dados do aluno. Público (qualquer um que escaneia pode verificar) → deploy --no-verify-jwt.
//
// Deploy: npx supabase functions deploy verificar-carteirinha --no-verify-jwt --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jwtVerify } from "https://esm.sh/jose@5";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}
const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const AUTH_SECRET = Deno.env.get("AUTH_SECRET")!;
const um = (x: unknown) => (Array.isArray(x) ? x[0] ?? null : x ?? null);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "método não permitido" }, 405);

  let token = "";
  try { token = String((await req.json()).token ?? ""); } catch { /* */ }
  if (!token) return json({ situacao: "INVALIDO" });

  let cid = "", v = -1;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(AUTH_SECRET));
    if (!payload.sub) return json({ situacao: "INVALIDO" });
    cid = String(payload.sub);
    v = Number(payload.v);
  } catch {
    return json({ situacao: "INVALIDO" });
  }

  const db = createClient(URL_, SERVICE, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: cart } = await db.from("Carteirinha")
    .select(`versao, qrToken, validade, aluno:Aluno ( nome, faculdade, curso, matricula, fotoUrl, destino:Destino ( nome ) )`)
    .eq("id", cid).maybeSingle();
  if (!cart) return json({ situacao: "INVALIDO" });

  const aluno = um(cart.aluno) as Record<string, unknown> | null;
  const destino = um(aluno?.destino) as { nome: string } | null;
  const base = {
    nome: aluno?.nome ?? "",
    faculdade: (aluno?.faculdade as string) ?? destino?.nome ?? "",
    curso: (aluno?.curso as string) ?? null,
    matricula: (aluno?.matricula as string) ?? null,
    fotoUrl: (aluno?.fotoUrl as string) ?? null,
    validade: cart.validade ?? null,
  };

  let situacao: string;
  if (cart.versao !== v || cart.qrToken !== token) situacao = "DESATUALIZADA";
  else if (!cart.validade) situacao = "NAO_AUTORIZADA";
  else if (new Date(cart.validade).getTime() < Date.now()) situacao = "EXPIRADA";
  else situacao = "VALIDA";

  return json({ situacao, ...base });
});
