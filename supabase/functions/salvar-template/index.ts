// Edge Function (Deno) — salva o TEMPLATE da carteirinha de uma rota (ModeloCarteirinha).
// Espelha (painel)/rotas/actions.ts salvarTemplate. Guardada por gestor (ADMIN/DONO da
// secretaria da rota). multipart/form-data: destinoId, larguraBase, alturaBase, campos(JSON),
// arteUrlExistente?, arte?(File → bucket público midia). Upsert por destinoId.
//
// Deploy: npx supabase functions deploy salvar-template --use-api --project-ref mtumvzzvwankdppebhle

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
const EXT_OK = new Set(["png", "jpg", "jpeg", "webp"]);
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

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
  const { data: caller } = await db.from("Usuario").select("papel, secretariaId").eq("authUserId", userData.user.id).maybeSingle();
  if (!caller || !["ADMIN", "DONO"].includes(caller.papel)) return json({ error: "sem permissão" }, 403);

  let form: FormData;
  try { form = await req.formData(); } catch { return json({ error: "envie multipart/form-data" }, 400); }
  const destinoId = String(form.get("destinoId") ?? "").trim();
  if (!destinoId) return json({ error: "Rota não informada." }, 400);

  const { data: destino } = await db.from("Destino").select("secretariaId").eq("id", destinoId).maybeSingle();
  if (!destino) return json({ error: "rota não encontrada" }, 404);
  const podeGerir = caller.papel === "DONO" || (destino.secretariaId && destino.secretariaId === caller.secretariaId);
  if (!podeGerir) return json({ error: "sem permissão nesta rota" }, 403);

  const larguraBase = Number(form.get("larguraBase")) || 1012;
  const alturaBase = Number(form.get("alturaBase")) || 638;
  let campos: unknown = [];
  try { campos = JSON.parse(String(form.get("campos") ?? "[]")); } catch { campos = []; }

  async function resolverArte(campoFile: string, campoExistente: string): Promise<string | null> {
    const arte = form.get(campoFile);
    if (arte instanceof File && arte.size > 0) {
      const ext = (arte.name.split(".").pop() ?? "bin").toLowerCase();
      if (!EXT_OK.has(ext)) throw new Error(`Arte: tipo não permitido (.${ext})`);
      const nome = `arte-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await db.storage.from("midia").upload(nome, new Uint8Array(await arte.arrayBuffer()), { contentType: MIME[ext], upsert: true });
      if (upErr) throw new Error("Falha no upload da arte.");
      return db.storage.from("midia").getPublicUrl(nome).data.publicUrl;
    }
    return (form.get(campoExistente) as string) || null;
  }

  let arteFrenteUrl: string | null;
  let arteVersoUrl: string | null;
  try {
    arteFrenteUrl = await resolverArte("arte", "arteUrlExistente");
    arteVersoUrl = await resolverArte("arteVerso", "arteVersoUrlExistente");
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Falha na arte." }, 400);
  }

  const agora = new Date().toISOString();
  const dados = { largura: larguraBase, altura: alturaBase, campos, arteFrenteUrl, arteVersoUrl, atualizadoEm: agora };
  const { data: existente } = await db.from("ModeloCarteirinha").select("id").eq("destinoId", destinoId).maybeSingle();
  if (existente) {
    const { error } = await db.from("ModeloCarteirinha").update(dados).eq("id", existente.id);
    if (error) return json({ error: error.message }, 500);
  } else {
    const { error } = await db.from("ModeloCarteirinha").insert({ id: crypto.randomUUID(), destinoId, ...dados });
    if (error) return json({ error: error.message }, 500);
  }
  return json({ ok: true, arteFrenteUrl, arteVersoUrl });
});
