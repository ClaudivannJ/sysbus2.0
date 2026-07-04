-- MULTI-TENANT (fase 3) — ESCRITA de config pelo gestor (Rotas/Frota). CRUD direto
-- do cliente via RLS (WITH CHECK impede escrever em outra secretaria). Reusa pode_gerir_secretaria.

-- Destino: gestor edita a config da rota + cria rota (na própria secretaria)
grant insert, update on table "Destino" to authenticated;
drop policy if exists "destino_gestor_edita" on "Destino";
create policy "destino_gestor_edita" on "Destino" for update to authenticated
  using (public.pode_gerir_secretaria("secretariaId"))
  with check (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "destino_gestor_insere" on "Destino";
create policy "destino_gestor_insere" on "Destino" for insert to authenticated
  with check (public.pode_gerir_secretaria("secretariaId"));

-- Onibus: gestor faz CRUD da frota da própria secretaria
grant select, insert, update, delete on table "Onibus" to authenticated;
alter table "Onibus" enable row level security;
drop policy if exists "onibus_gestor_le" on "Onibus";
create policy "onibus_gestor_le" on "Onibus" for select to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "onibus_gestor_insere" on "Onibus";
create policy "onibus_gestor_insere" on "Onibus" for insert to authenticated
  with check (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "onibus_gestor_edita" on "Onibus";
create policy "onibus_gestor_edita" on "Onibus" for update to authenticated
  using (public.pode_gerir_secretaria("secretariaId"))
  with check (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "onibus_gestor_apaga" on "Onibus";
create policy "onibus_gestor_apaga" on "Onibus" for delete to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));
