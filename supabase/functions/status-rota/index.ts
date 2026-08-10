import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// deno-lint-ignore no-explicit-any
type DB = any;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const um = (x: unknown) => (Array.isArray(x) ? (x[0] ?? null) : (x ?? null));

function inicioDeHoje() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
function amanha() {
  const d = inicioDeHoje();
  d.setDate(d.getDate() + 1);
  return d;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" } });

  const auth = req.headers.get("Authorization") ?? "";
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: auth } },
  });

  // Valida sessão do aluno
  const { data: { user } } = await db.auth.getUser();
  if (!user) return json({ error: "Não autenticado" }, 401);

  const url = new URL(req.url);
  let destinoId = url.searchParams.get("destinoId");
  if (!destinoId && req.method === "POST") {
    try { const b = await req.json(); destinoId = b.destinoId ?? null; } catch { /* ignore */ }
  }
  if (!destinoId) return json({ error: "destinoId ausente" }, 400);

  // 1. Carrega Destino + onibus da rota (para saber transparência)
  const { data: destino } = await db.from("Destino")
    .select("id, nome, transparenciaEmbarque, onibus:Onibus(id, nome, capacidade, transparenciaEmbarque)")
    .eq("id", destinoId).maybeSingle();

  if (!destino) return json({ error: "Rota não encontrada" }, 404);

  // 2. Busca a viagem de hoje
  const { data: viagem } = await db.from("Viagem").select("id, horario, pontoAtualId, sentidoAtual")
    .eq("destinoId", destinoId)
    .gte("data", inicioDeHoje().toISOString())
    .lt("data", amanha().toISOString())
    .limit(1).maybeSingle();

  if (!viagem) return json({ ativo: false, rota: destino.nome });

  // 3. Conta embarcados por ônibus nesta viagem (sentido atual)
  const sentido = viagem.sentidoAtual ?? "IDA";
  const { data: reservas } = await db.from("Reserva")
    .select("id, onibusId, status, vaiIda, vaiVolta, embarques:Embarque(sentido)")
    .eq("viagemId", viagem.id)
    .eq("status", "CONFIRMADA");

  const todasReservas: DB[] = reservas ?? [];

  // Por ônibus: capacidade preenchida e quem ainda não escaneou
  const onibus: DB[] = Array.isArray(destino.onibus) ? destino.onibus : destino.onibus ? [destino.onibus] : [];

  const statusPorOnibus = onibus.map((oni: DB) => {
    const reservasOnibus = todasReservas.filter((r: DB) => r.onibusId === oni.id);
    const vagas = reservasOnibus.length;
    const embarcados = reservasOnibus.filter((r: DB) =>
      (r.embarques ?? []).some((e: DB) => e.sentido === sentido)
    ).length;

    // Transparência: bus-level sobrescreve route-level
    const politica: string = (oni.transparenciaEmbarque ?? destino.transparenciaEmbarque ?? "CONTAGEM_NOMES");

    return {
      onibusId: oni.id,
      onibusNome: oni.nome,
      capacidade: oni.capacidade ?? vagas,
      embarcados,
      aguardando: vagas - embarcados,
      politica,
    };
  });

  // 4. Busca dados dos ausentes por ônibus (respeitando política)
  const { data: alunosReserva } = await db.from("Reserva")
    .select("id, onibusId, aluno:Aluno(nome, fotoUrl, faculdade), embarques:Embarque(sentido)")
    .eq("viagemId", viagem.id)
    .eq("status", "CONFIRMADA");

  const alunosMap: DB[] = alunosReserva ?? [];

  const statusFinal = statusPorOnibus.map((s: DB) => {
    const reservasOnibus = alunosMap.filter((r: DB) => r.onibusId === s.onibusId);
    const ausentes = reservasOnibus
      .filter((r: DB) => !(r.embarques ?? []).some((e: DB) => e.sentido === sentido))
      .map((r: DB) => {
        const aluno = um(r.aluno);
        const politica = s.politica;
        if (politica === "PRIVADO" || politica === "CONTAGEM") return null;
        if (politica === "CONTAGEM_NOMES") return { nome: aluno?.nome ?? "—" };
        // PERFIL_COMPLETO
        return { nome: aluno?.nome ?? "—", fotoUrl: aluno?.fotoUrl ?? null };
      })
      .filter(Boolean);

    return { ...s, ausentes: s.politica === "PRIVADO" ? [] : ausentes };
  });

  return json({
    ativo: true,
    rota: destino.nome,
    sentido,
    pontoAtualId: viagem.pontoAtualId ?? null,
    onibus: statusFinal,
  });
});
