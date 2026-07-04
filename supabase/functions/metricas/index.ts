// Edge Function (Deno) — MÉTRICAS da secretaria (dashboard). Guardada por ADMIN/DONO.
// Agrega no servidor (service role), escopado pela secretaria do chamador (DONO = tudo).
//
// Deploy: npx supabase functions deploy metricas --use-api --project-ref mtumvzzvwankdppebhle

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { inicioDeHoje, amanha } from "../_shared/tempo.ts";

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
// deno-lint-ignore no-explicit-any
type DB = any;

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

  const sec: string | null = caller.papel === "DONO" ? null : caller.secretariaId;
  const comSec = (q: DB, col = "secretariaId") => (sec ? q.eq(col, sec) : q);
  const conta = async (q: DB) => (await q).count ?? 0;

  const agora = new Date().toISOString();
  const hoje0 = inicioDeHoje().toISOString();
  const hoje1 = amanha().toISOString();

  const [totalAlunos, autorizados, pendentesAut, rotas, onibus, reservasHoje, embarquesHoje] = await Promise.all([
    conta(comSec(db.from("Aluno").select("id", { count: "exact", head: true }))),
    // autorizados = carteirinha válida de aluno da secretaria
    conta(comSec(db.from("Carteirinha").select("id, aluno:Aluno!inner(secretariaId)", { count: "exact", head: true }).gt("validade", agora), "aluno.secretariaId")),
    conta(comSec(db.from("Renovacao").select("id, aluno:Aluno!inner(secretariaId)", { count: "exact", head: true }).eq("status", "PENDENTE"), "aluno.secretariaId")),
    conta(comSec(db.from("Destino").select("id", { count: "exact", head: true }))),
    conta(comSec(db.from("Onibus").select("id", { count: "exact", head: true }))),
    // reservas confirmadas da viagem de hoje
    conta(comSec(db.from("Reserva").select("id, viagem:Viagem!inner(data, destino:Destino!inner(secretariaId))", { count: "exact", head: true })
      .eq("status", "CONFIRMADA").gte("viagem.data", hoje0).lt("viagem.data", hoje1), "viagem.destino.secretariaId")),
    conta(comSec(db.from("Embarque").select("id, reserva:Reserva!inner(viagem:Viagem!inner(data, destino:Destino!inner(secretariaId)))", { count: "exact", head: true })
      .gte("reserva.viagem.data", hoje0).lt("reserva.viagem.data", hoje1), "reserva.viagem.destino.secretariaId")),
  ]);

  return json({ totalAlunos, autorizados, pendentesAut, rotas, onibus, reservasHoje, embarquesHoje });
});
