-- RLS: o ALUNO lê as PRÓPRIAS renovações (para o status "Em análise" no portal).
-- Reusa public.usuario_atual_id() criada em rls_aluno.sql.
alter table "Renovacao" enable row level security;
drop policy if exists "renovacao_le_do_aluno" on "Renovacao";
create policy "renovacao_le_do_aluno" on "Renovacao"
  for select to authenticated
  using ("alunoId" in (select id from "Aluno" where "usuarioId" = public.usuario_atual_id()));
