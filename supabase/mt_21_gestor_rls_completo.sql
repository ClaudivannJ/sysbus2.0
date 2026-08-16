-- mt_21_gestor_rls_completo.sql
-- Consolidação completa de permissões de RLS para o gestor da secretaria (ADMIN / FISCAL)
-- aplicando o padrão de isolamento multi-tenant pode_gerir_secretaria em todas as tabelas do painel.

-- 1. Tabela Destino (Rotas)
grant select, insert, update, delete on table "Destino" to authenticated;
alter table "Destino" enable row level security;
drop policy if exists "destino_gestor_le" on "Destino";
create policy "destino_gestor_le" on "Destino" for select to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));

drop policy if exists "destino_gestor_escrita" on "Destino";
create policy "destino_gestor_escrita" on "Destino" for insert to authenticated
  with check (public.pode_gerir_secretaria("secretariaId"));

drop policy if exists "destino_gestor_edita" on "Destino";
create policy "destino_gestor_edita" on "Destino" for update to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));

-- 2. Tabela PontoRota (Itinerários)
grant select, insert, update, delete on table "PontoRota" to authenticated;
alter table "PontoRota" enable row level security;
drop policy if exists "pontorota_gestor_le" on "PontoRota";
create policy "pontorota_gestor_le" on "PontoRota" for select to authenticated
  using (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "pontorota_gestor_escrita" on "PontoRota";
create policy "pontorota_gestor_escrita" on "PontoRota" for insert to authenticated
  with check (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "pontorota_gestor_edita" on "PontoRota";
create policy "pontorota_gestor_edita" on "PontoRota" for update to authenticated
  using (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "pontorota_gestor_deleta" on "PontoRota";
create policy "pontorota_gestor_deleta" on "PontoRota" for delete to authenticated
  using (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

-- 3. Tabela HorarioChamada
grant select, insert, update, delete on table "HorarioChamada" to authenticated;
alter table "HorarioChamada" enable row level security;
drop policy if exists "horariochamada_gestor_le" on "HorarioChamada";
create policy "horariochamada_gestor_le" on "HorarioChamada" for select to authenticated
  using (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "horariochamada_gestor_escrita" on "HorarioChamada";
create policy "horariochamada_gestor_escrita" on "HorarioChamada" for insert to authenticated
  with check (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "horariochamada_gestor_edita" on "HorarioChamada";
create policy "horariochamada_gestor_edita" on "HorarioChamada" for update to authenticated
  using (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

drop policy if exists "horariochamada_gestor_deleta" on "HorarioChamada";
create policy "horariochamada_gestor_deleta" on "HorarioChamada" for delete to authenticated
  using (exists (select 1 from "Destino" d where d.id = "destinoId" and public.pode_gerir_secretaria(d."secretariaId")));

-- 4. Tabela PeriodoLetivo
grant select, insert, update, delete on table "PeriodoLetivo" to authenticated;
alter table "PeriodoLetivo" enable row level security;
drop policy if exists "periodo_gestor_le" on "PeriodoLetivo";
create policy "periodo_gestor_le" on "PeriodoLetivo" for select to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));

drop policy if exists "periodo_gestor_insere" on "PeriodoLetivo";
create policy "periodo_gestor_insere" on "PeriodoLetivo" for insert to authenticated
  with check (public.pode_gerir_secretaria("secretariaId"));

drop policy if exists "periodo_gestor_edita" on "PeriodoLetivo";
create policy "periodo_gestor_edita" on "PeriodoLetivo" for update to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));

-- 5. Tabela ModeloCarteirinha
grant select, insert, update, delete on table "ModeloCarteirinha" to authenticated;
alter table "ModeloCarteirinha" enable row level security;
drop policy if exists "modelo_gestor_le" on "ModeloCarteirinha";
create policy "modelo_gestor_le" on "ModeloCarteirinha" for select to authenticated
  using (public.pode_gerir_secretaria((select d."secretariaId" from "Destino" d where d.id = "ModeloCarteirinha"."destinoId")));

drop policy if exists "modelo_gestor_escrita" on "ModeloCarteirinha";
create policy "modelo_gestor_escrita" on "ModeloCarteirinha" for insert to authenticated
  with check (public.pode_gerir_secretaria((select d."secretariaId" from "Destino" d where d.id = "ModeloCarteirinha"."destinoId")));

drop policy if exists "modelo_gestor_edita" on "ModeloCarteirinha";
create policy "modelo_gestor_edita" on "ModeloCarteirinha" for update to authenticated
  using (public.pode_gerir_secretaria((select d."secretariaId" from "Destino" d where d.id = "ModeloCarteirinha"."destinoId")));

-- 6. Tabela Secretaria
grant select, update on table "Secretaria" to authenticated;
alter table "Secretaria" enable row level security;
drop policy if exists "secretaria_gestor_le" on "Secretaria";
create policy "secretaria_gestor_le" on "Secretaria" for select to authenticated
  using (public.pode_gerir_secretaria(id));

-- 7. Tabela ConfiguracaoPlataforma
grant select on table "ConfiguracaoPlataforma" to authenticated;
alter table "ConfiguracaoPlataforma" enable row level security;
drop policy if exists "config_plataforma_le" on "ConfiguracaoPlataforma";
create policy "config_plataforma_le" on "ConfiguracaoPlataforma" for select to authenticated
  using (true);
