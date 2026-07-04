-- Horário da CHAMADA por ponto de embarque (a secretaria define). Cada ponto (localidade)
-- de uma rota tem seu horário; a chamada inicia SOZINHA nesse horário (não depende do monitor).
-- Sem registro p/ um ponto → cai no padrão (fechamento da enquete / horário da viagem).
--
-- Runner: node supabase/apply.mjs supabase/mt_16_horario_chamada.sql

create table if not exists "HorarioChamada" (
  "id"           text primary key,
  "destinoId"    text not null references "Destino"("id") on delete cascade,
  "localidadeId" text not null references "Localidade"("id") on delete cascade,
  "horario"      text not null,  -- "HH:MM" (fuso America/Recife)
  "criadoEm"     timestamptz not null default now(),
  unique ("destinoId", "localidadeId")
);

alter table "HorarioChamada" enable row level security;
grant select, insert, update, delete on table "HorarioChamada" to authenticated;

drop policy if exists "horchamada_gestor_le" on "HorarioChamada";
create policy "horchamada_gestor_le" on "HorarioChamada" for select to authenticated
  using (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "horchamada_gestor_insere" on "HorarioChamada";
create policy "horchamada_gestor_insere" on "HorarioChamada" for insert to authenticated
  with check (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "horchamada_gestor_edita" on "HorarioChamada";
create policy "horchamada_gestor_edita" on "HorarioChamada" for update to authenticated
  using (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")))
  with check (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "horchamada_gestor_apaga" on "HorarioChamada";
create policy "horchamada_gestor_apaga" on "HorarioChamada" for delete to authenticated
  using (exists (select 1 from "Destino" d where d."id" = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));
