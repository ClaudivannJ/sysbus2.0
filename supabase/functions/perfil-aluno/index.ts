// Edge Function (Deno) — PERFIL do aluno. Espelha portal/perfil/actions.ts (atualizarPerfil).
// multipart/form-data: nome, faculdade?, curso?, matricula?, destinoId, dataNascimento? + foto?
// Atualiza Aluno (+ foto no bucket público) e sincroniza Usuario.nome. Guardada por JWT.
// (A troca de senha é feita no cliente via supabase.auth — não precisa desta função.)
//
// Deploy: npx supabase functions deploy perfil-aluno --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { lerArquivoValidado } from "../_shared/upload.ts";

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
const BUCKET_PUB = "midia";
const EXT_OK = new Set(["png", "jpg", "jpeg", "webp"]);

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
    .select(`id, usuarioId, usuario:Usuario!inner ( authUserId )`).eq("usuario.authUserId", userData.user.id).maybeSingle();
  if (!aluno) return json({ error: "aluno não encontrado" }, 404);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "envie multipart/form-data" }, 400); }
  const s = (k: string) => String(form.get(k) ?? "").trim();
  const nome = s("nome");
  const destinoId = s("destinoId");
  const faculdade = s("faculdade") || null;
  const curso = s("curso") || null;
  const matricula = s("matricula") || null;
  const dataNascimento = s("dataNascimento") || null;
  if (nome.length < 3) return json({ error: "Informe o nome completo." }, 400);
  if (!destinoId) return json({ error: "Selecione a rota." }, 400);

  let fotoUrl: string | undefined;
  const foto = form.get("foto");
  if (foto instanceof File && foto.size > 0) {
    const val = await lerArquivoValidado(foto, EXT_OK);
    if (!val.ok) return json({ error: `Foto: ${val.erro}` }, val.status);
    const nomeArq = `foto-${crypto.randomUUID()}.${val.ext}`;
    const { error: upErr } = await db.storage.from(BUCKET_PUB).upload(nomeArq, val.bytes, {
      contentType: val.contentType, upsert: true,
    });
    if (upErr) return json({ error: "Falha no upload da foto." }, 500);
    fotoUrl = db.storage.from(BUCKET_PUB).getPublicUrl(nomeArq).data.publicUrl;
  }

  const { error: aErr } = await db.from("Aluno").update({
    nome, faculdade, curso, matricula, destinoId,
    dataNascimento: dataNascimento ? `${dataNascimento}T12:00:00-03:00` : null,
    ...(fotoUrl ? { fotoUrl } : {}),
  }).eq("id", aluno.id);
  if (aErr) return json({ error: "Não foi possível salvar o perfil." }, 500);

  if (aluno.usuarioId) await db.from("Usuario").update({ nome }).eq("id", aluno.usuarioId);

  return json({ ok: true, fotoUrl: fotoUrl ?? null });
});
