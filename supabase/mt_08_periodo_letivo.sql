-- PERÍODO LETIVO: a secretaria define o semestre atual + até quando a carteirinha
-- emitida NELE é válida (calendário letivo). Ao aprovar uma renovação, a validade
-- = validadeAte deste período. Carteirinha do semestre atual expira no fim dele
-- (não vale no próximo, pois a validade é gravada no ato da aprovação).
-- Um registro por secretaria (o período vigente).
create table if not exists "PeriodoLetivo" (
  id text primary key,
  "secretariaId" text not null unique references "Secretaria"(id) on delete cascade,
  label text not null,                 -- ex.: "2026.2"
  "validadeAte" timestamp not null,    -- ex.: 2026-12-31
  "atualizadoEm" timestamp not null default now()
);

-- gestor da secretaria lê e escreve o próprio período
grant select, insert, update on table "PeriodoLetivo" to authenticated;
alter table "PeriodoLetivo" enable row level security;
drop policy if exists "periodo_gestor_le" on "PeriodoLetivo";
create policy "periodo_gestor_le" on "PeriodoLetivo" for select to authenticated using (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "periodo_gestor_insere" on "PeriodoLetivo";
create policy "periodo_gestor_insere" on "PeriodoLetivo" for insert to authenticated with check (public.pode_gerir_secretaria("secretariaId"));
drop policy if exists "periodo_gestor_edita" on "PeriodoLetivo";
create policy "periodo_gestor_edita" on "PeriodoLetivo" for update to authenticated using (public.pode_gerir_secretaria("secretariaId")) with check (public.pode_gerir_secretaria("secretariaId"));
