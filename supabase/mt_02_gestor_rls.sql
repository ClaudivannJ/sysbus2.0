-- MULTI-TENANT (fase 2 — enforcement do PAINEL). Gestor (ADMIN/FISCAL) enxerga só
-- a PRÓPRIA secretaria; DONO (L0) enxerga tudo. Aluno continua vendo só o próprio
-- (policies existentes; estas são ADITIVAS via OR).

-- helper central: o usuário logado pode gerir dados desta secretaria?
create or replace function public.pode_gerir_secretaria(sec text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when u.papel = 'DONO' then true
    when u.papel in ('ADMIN','FISCAL') then sec is not null and sec = u."secretariaId"
    else false
  end
  from "Usuario" u where u."authUserId" = auth.uid()
$$;
grant execute on function public.pode_gerir_secretaria(text) to authenticated;

-- Aluno: gestor lê os alunos da sua secretaria
drop policy if exists "aluno_gestor_le" on "Aluno";
create policy "aluno_gestor_le" on "Aluno"
  for select to authenticated using (public.pode_gerir_secretaria("secretariaId"));

-- Renovacao: gestor lê as renovações dos alunos da sua secretaria
drop policy if exists "renovacao_gestor_le" on "Renovacao";
create policy "renovacao_gestor_le" on "Renovacao"
  for select to authenticated
  using (public.pode_gerir_secretaria((select a."secretariaId" from "Aluno" a where a.id = "Renovacao"."alunoId")));

-- Carteirinha: gestor lê as carteirinhas dos alunos da sua secretaria (p/ status)
drop policy if exists "carteirinha_gestor_le" on "Carteirinha";
create policy "carteirinha_gestor_le" on "Carteirinha"
  for select to authenticated
  using (public.pode_gerir_secretaria((select a."secretariaId" from "Aluno" a where a.id = "Carteirinha"."alunoId")));
