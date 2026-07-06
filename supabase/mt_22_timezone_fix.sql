-- mt_22 — Corrige fuso horário nas colunas de data/hora
-- Converte `timestamp without time zone` → `timestamptz` nas tabelas Reserva e Viagem.
-- Com isso, o `now()` gravado em UTC pelo servidor Supabase virá com a anotação de fuso
-- correta, e o navegador/cliente converterá para America/Recife (-03:00) automaticamente.
--
-- PROBLEMA RESOLVIDO: votos criados às 16h25 apareciam como 19h25 porque o banco gravava
-- em UTC (sem fuso) e o navegador assumia que era hora local, somando 3h a mais.

-- 1) A view AnalyticsTempoViagem referencia a coluna "data" de Viagem.
--    O Postgres bloqueia ALTER em colunas usadas por views → precisamos dropá-la antes
--    e recriá-la logo após. O conteúdo abaixo é idêntico ao mt_21.
DROP VIEW IF EXISTS "AnalyticsTempoViagem";

-- 2) Tabela Reserva
ALTER TABLE "Reserva" ALTER COLUMN "criadoEm" TYPE timestamptz USING "criadoEm" AT TIME ZONE 'UTC';

-- 3) Tabela Viagem
--    A coluna "data" guarda apenas a DATA da viagem (sem hora), então mantemos como DATE.
--    criadoEm, abreEm e fechaEm passam a ser timestamptz.
ALTER TABLE "Viagem" ALTER COLUMN "criadoEm" TYPE timestamptz USING "criadoEm" AT TIME ZONE 'UTC';
ALTER TABLE "Viagem" ALTER COLUMN "abreEm"   TYPE timestamptz USING "abreEm"   AT TIME ZONE 'UTC';
ALTER TABLE "Viagem" ALTER COLUMN "fechaEm"  TYPE timestamptz USING "fechaEm"  AT TIME ZONE 'UTC';

-- 4) Recria a view AnalyticsTempoViagem (igual ao mt_21)
CREATE OR REPLACE VIEW "AnalyticsTempoViagem" AS
WITH viagens AS (
  SELECT
    r."viagemId",
    v."destinoId",
    r."pontoRotaId",
    pr."ordem",
    pr."nome"    AS "pontoNome",
    pr."sentido",
    r."chegouEm",
    r."saiuEm",
    date_trunc('month', v."data"::timestamp) AS "mes",
    EXTRACT(epoch FROM (r."saiuEm" - r."chegouEm")) / 60.0 AS "minutosParado",
    EXTRACT(epoch FROM (r."chegouEm" - lag(r."saiuEm") OVER (PARTITION BY r."viagemId" ORDER BY r."chegouEm"))) / 60.0 AS "minutosDeslocamento"
  FROM "RegistroPonto" r
  JOIN "Viagem"    v  ON v.id  = r."viagemId"
  JOIN "PontoRota" pr ON pr.id = r."pontoRotaId"
)
SELECT
  "destinoId",
  "pontoRotaId",
  "pontoNome",
  "sentido",
  "ordem",
  "mes",
  avg("minutosParado")       AS "mediaMinutosParado",
  avg("minutosDeslocamento") AS "mediaMinutosDeslocamento",
  count(*)                   AS "amostras"
FROM viagens
GROUP BY "destinoId", "pontoRotaId", "pontoNome", "sentido", "ordem", "mes";

GRANT SELECT ON "AnalyticsTempoViagem" TO authenticated;
