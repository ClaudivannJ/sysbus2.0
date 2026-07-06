-- View analítica para calcular o tempo médio que o ônibus gasta de um ponto até o próximo e o tempo parado em cada ponto.

create or replace view "AnalyticsTempoViagem" as
with viagens as (
  select
    r."viagemId",
    v."destinoId",
    r."pontoRotaId",
    pr."ordem",
    pr."nome" as "pontoNome",
    pr."sentido",
    r."chegouEm",
    r."saiuEm",
    date_trunc('month', v."data") as "mes",
    extract(epoch from (r."saiuEm" - r."chegouEm")) / 60.0 as "minutosParado",
    -- o tempo de deslocamento até este ponto é a diferença entre a chegada neste ponto e a saída do ponto anterior na mesma viagem.
    extract(epoch from (r."chegouEm" - lag(r."saiuEm") over (partition by r."viagemId" order by r."chegouEm"))) / 60.0 as "minutosDeslocamento"
  from "RegistroPonto" r
  join "Viagem" v on v.id = r."viagemId"
  join "PontoRota" pr on pr.id = r."pontoRotaId"
)
select
  "destinoId",
  "pontoRotaId",
  "pontoNome",
  "sentido",
  "ordem",
  "mes",
  avg("minutosParado") as "mediaMinutosParado",
  avg("minutosDeslocamento") as "mediaMinutosDeslocamento",
  count(*) as "amostras"
from viagens
group by "destinoId", "pontoRotaId", "pontoNome", "sentido", "ordem", "mes";

-- O acesso à View será gerido via API ou funções, não precisa de RLS se acessarmos usando o SERVICE ROLE ou se darmos permissão de select p/ autenticado.
grant select on "AnalyticsTempoViagem" to authenticated;
