-- Aba "Documentos" do portal: o aluno lê o catálogo de tipos e os PRÓPRIOS envios.
-- Reusa public.usuario_atual_id().

-- TipoDocumento: catálogo (o aluno logado lê os tipos ativos)
grant select on table "TipoDocumento" to authenticated;
alter table "TipoDocumento" enable row level security;
drop policy if exists "tipodoc_le_ativos" on "TipoDocumento";
create policy "tipodoc_le_ativos" on "TipoDocumento"
  for select to authenticated using (ativo = true);

-- DocumentoEnviado: só os do próprio aluno
grant select on table "DocumentoEnviado" to authenticated;
alter table "DocumentoEnviado" enable row level security;
drop policy if exists "docenv_le_do_aluno" on "DocumentoEnviado";
create policy "docenv_le_do_aluno" on "DocumentoEnviado"
  for select to authenticated
  using ("alunoId" in (select id from "Aluno" where "usuarioId" = public.usuario_atual_id()));
