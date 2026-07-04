// Edge Function (Deno) — DOCUMENTOS do aluno. Espelha portal/documentos/actions.ts.
//  - multipart/form-data { tipoId, arquivo } → upload (bucket privado) + upsert DocumentoEnviado(PENDENTE).
//  - application/json  { docId }            → devolve URL ASSINADA temporária do próprio envio.
// Guardada por JWT (só o aluno logado, sobre os PRÓPRIOS documentos).
//
// Deploy: npx supabase functions deploy documento-aluno --use-api --project-ref mtumvzzvwankdppebhle

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
const BUCKET_PRIV = "documentos";
const PREFIXO_PRIV = "priv:";
const EXT_OK = new Set(["png", "jpg", "jpeg", "webp", "pdf"]);
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", pdf: "application/pdf" };

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
    .select(`id, usuario:Usuario!inner ( authUserId )`).eq("usuario.authUserId", userData.user.id).maybeSingle();
  if (!aluno) return json({ error: "aluno não encontrado" }, 404);

  const ct = req.headers.get("content-type") ?? "";

  // ---- JSON: URL assinada do próprio documento ----
  if (ct.includes("application/json")) {
    let docId = "";
    try { docId = String((await req.json()).docId ?? ""); } catch { /* */ }
    if (!docId) return json({ error: "docId ausente" }, 400);
    const { data: doc } = await db.from("DocumentoEnviado").select("arquivoUrl, alunoId").eq("id", docId).maybeSingle();
    if (!doc || doc.alunoId !== aluno.id) return json({ error: "não encontrado" }, 404);
    const nome = String(doc.arquivoUrl).startsWith(PREFIXO_PRIV) ? String(doc.arquivoUrl).slice(PREFIXO_PRIV.length) : String(doc.arquivoUrl);
    const { data: signed, error } = await db.storage.from(BUCKET_PRIV).createSignedUrl(nome, 3600);
    if (error) return json({ error: "falha ao gerar link" }, 500);
    return json({ url: signed.signedUrl });
  }

  // ---- multipart: enviar/reenviar documento ----
  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "envie multipart/form-data" }, 400); }
  const tipoId = String(form.get("tipoId") ?? "").trim();
  const arquivo = form.get("arquivo");
  if (!tipoId) return json({ error: "tipoId ausente" }, 400);
  if (!(arquivo instanceof File) || arquivo.size === 0) return json({ error: "Anexe um arquivo." }, 400);

  const ext = (arquivo.name.split(".").pop() ?? "bin").toLowerCase();
  if (!EXT_OK.has(ext)) return json({ error: `Tipo não permitido: .${ext}` }, 400);
  const nome = `doc-${crypto.randomUUID()}.${ext}`;
  const { error: upErr } = await db.storage.from(BUCKET_PRIV).upload(nome, new Uint8Array(await arquivo.arrayBuffer()), {
    contentType: MIME[ext] ?? "application/octet-stream", upsert: true,
  });
  if (upErr) return json({ error: "falha no upload" }, 500);
  const arquivoUrl = `${PREFIXO_PRIV}${nome}`;

  // upsert por (alunoId, tipoId) — reenviar volta para PENDENTE
  const { data: existente } = await db.from("DocumentoEnviado").select("id").eq("alunoId", aluno.id).eq("tipoId", tipoId).maybeSingle();
  if (existente) {
    await db.from("DocumentoEnviado").update({
      arquivoUrl, status: "PENDENTE", observacao: null, avaliadorId: null, avaliadoEm: null, criadoEm: new Date().toISOString(),
    }).eq("id", existente.id);
  } else {
    const { error } = await db.from("DocumentoEnviado").insert({
      id: crypto.randomUUID(), alunoId: aluno.id, tipoId, arquivoUrl, status: "PENDENTE",
    });
    if (error) return json({ error: "falha ao registrar" }, 500);
  }
  return json({ ok: true });
});
