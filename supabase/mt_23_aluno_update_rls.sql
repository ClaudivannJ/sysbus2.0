-- mt_23_aluno_update_rls.sql
-- Adiciona política de UPDATE para o gestor da secretaria na tabela Aluno.
-- Necessário para que o painel possa editar dados do aluno (nome, curso, isRepresentante, etc.)
-- sem retornar 403 Forbidden no PATCH via Supabase REST API.

-- UPDATE: gestor edita alunos da sua secretaria
grant update on table "Aluno" to authenticated;

drop policy if exists "aluno_gestor_edita" on "Aluno";
create policy "aluno_gestor_edita" on "Aluno"
  for update to authenticated
  using  (public.pode_gerir_secretaria("secretariaId"))
  with check (public.pode_gerir_secretaria("secretariaId"));
