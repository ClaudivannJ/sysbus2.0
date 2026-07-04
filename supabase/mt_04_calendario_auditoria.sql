-- MULTI-TENANT (fase 4) — Calendário (CRUD do gestor) e Auditoria (read-only do gestor).

-- ExcecaoCalendario: gestor cria/lê/apaga exceções da sua secretaria
grant select, insert, delete on table "ExcecaoCalendario" to authenticated;
alter table "ExcecaoCalendario" enable row level security;
drop policy if exists "excecao_gestor_le" on "ExcecaoCalendario";
create policy "excecao_gestor_le" on "ExcecaoCalendario" for select to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "excecao_gestor_insere" on "ExcecaoCalendario";
create policy "excecao_gestor_insere" on "ExcecaoCalendario" for insert to authenticated
  with check (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "excecao_gestor_apaga" on "ExcecaoCalendario";
create policy "excecao_gestor_apaga" on "ExcecaoCalendario" for delete to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));

-- LogAuditoria: ganha secretariaId (p/ escopo) + gestor SÓ LÊ (inserção vem das Edge Functions)
alter table "LogAuditoria" add column if not exists "secretariaId" text;
do $$
declare sec text := (select id from "Secretaria" order by "criadoEm" nulls first limit 1);
begin
  update "LogAuditoria" set "secretariaId" = sec where "secretariaId" is null;
end $$;
grant select on table "LogAuditoria" to authenticated;
alter table "LogAuditoria" enable row level security;
drop policy if exists "auditoria_gestor_le" on "LogAuditoria";
create policy "auditoria_gestor_le" on "LogAuditoria" for select to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));
