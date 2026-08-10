-- mt_18_transparencia_embarque.sql
-- Renomeia exibirQuemFalta -> transparenciaEmbarque em Destino
-- e adiciona override por ônibus em Onibus.

-- 1. Renomear coluna em Destino
alter table "Destino"
  rename column "exibirQuemFalta" to "transparenciaEmbarque";

-- 2. Adicionar coluna de override em Onibus
--    NULL = herda da rota, caso contrário sobrescreve
alter table "Onibus"
  add column if not exists "transparenciaEmbarque" text default null;

-- Valores válidos para ambas as colunas:
-- PRIVADO       → passageiros veem apenas que o ônibus está aguardando
-- CONTAGEM      → "Aguardando 5 passageiros"
-- CONTAGEM_NOMES → "Aguardando: João, Maria +3"
-- PERFIL_COMPLETO → cards com nome + foto

-- 3. Garantir valor padrão não-nulo em Destino (era QTD_NOME)
alter table "Destino"
  alter column "transparenciaEmbarque" set default 'CONTAGEM_NOMES';

update "Destino"
  set "transparenciaEmbarque" = 'CONTAGEM_NOMES'
  where "transparenciaEmbarque" is null;

alter table "Destino"
  alter column "transparenciaEmbarque" set not null;
