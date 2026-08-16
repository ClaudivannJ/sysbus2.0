-- mt_22_pontos_referencia.sql
-- Adiciona suporte a descrição de referência visual por ponto de itinerário e permissão de representante de comissão.

-- 1. Novos campos em PontoRota
alter table "PontoRota"
  add column if not exists "descricaoReferencia" text default null,
  add column if not exists "avisoTemporario" text default null;

-- 2. Permissão em Aluno (Representante de Comissão / Ponto)
alter table "Aluno"
  add column if not exists "isRepresentante" boolean default false;
