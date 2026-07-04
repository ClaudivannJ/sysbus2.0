-- OPERAÇÃO DA VIAGEM (Pilar 4) — itinerário configurável de pontos + "quem falta" + ponto atual.
-- A secretaria configura, por rota e sentido, a sequência de pontos:
--   IDA   → pontos de embarque (cada um pode apontar p/ uma Localidade → sabemos quem falta ali)
--   VOLTA → pontos de desembarque/retorno nas faculdades (por nome da faculdade)
-- O monitor marca em qual ponto o ônibus está; o portal mostra onde ele está e quantos faltam.
--
-- Runner: node supabase/apply.mjs supabase/mt_12_pontos_rota.sql

create table if not exists "PontoRota" (
  "id"          text primary key,
  "destinoId"   text not null references "Destino"("id") on delete cascade,
  "sentido"     text not null check ("sentido" in ('IDA','VOLTA')),
  "ordem"       integer not null default 0,
  "nome"        text not null,
  "localidadeId" text references "Localidade"("id") on delete set null,  -- IDA: ponto ↔ localidade
  "faculdade"   text,                                                    -- VOLTA: faculdade atendida
  "criadoEm"    timestamptz not null default now()
);
create index if not exists "PontoRota_destino_sentido_idx" on "PontoRota" ("destinoId", "sentido", "ordem");

-- ponto atual do ônibus na viagem (o monitor avança); nulo = ainda não iniciou
alter table "Viagem" add column if not exists "pontoAtualId" text references "PontoRota"("id") on delete set null;
alter table "Viagem" add column if not exists "sentidoAtual" text;

-- config de exibição de "quem falta" (por rota): QTD | NOME | QTD_NOME | PERFIL
alter table "Destino" add column if not exists "exibirQuemFalta" text not null default 'QTD_NOME';

-- RLS: gestor da secretaria dona da rota faz CRUD (espelha o padrão de Onibus/Destino).
alter table "PontoRota" enable row level security;
grant select, insert, update, delete on table "PontoRota" to authenticated;

drop policy if exists "pontorota_gestor_le" on "PontoRota";
create policy "pontorota_gestor_le" on "PontoRota" for select to authenticated
  using (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "pontorota_gestor_insere" on "PontoRota";
create policy "pontorota_gestor_insere" on "PontoRota" for insert to authenticated
  with check (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "pontorota_gestor_edita" on "PontoRota";
create policy "pontorota_gestor_edita" on "PontoRota" for update to authenticated
  using (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")))
  with check (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "pontorota_gestor_apaga" on "PontoRota";
create policy "pontorota_gestor_apaga" on "PontoRota" for delete to authenticated
  using (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));
