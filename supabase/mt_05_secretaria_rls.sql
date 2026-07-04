-- Secretaria: DONO (L0) lê todas; ADMIN lê a própria. (Escrita é via Edge Function.)
grant select on table "Secretaria" to authenticated;
alter table "Secretaria" enable row level security;
drop policy if exists "secretaria_gestor_le" on "Secretaria";
create policy "secretaria_gestor_le" on "Secretaria" for select to authenticated
  using (public.pode_gerir_secretaria(id));
