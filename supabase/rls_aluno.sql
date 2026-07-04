-- RLS: o ALUNO lê apenas os PRÓPRIOS dados (portal do estudante — sysbus2.0).
-- O app antigo acessa via Prisma (superusuário), que ignora RLS → não é afetado.
-- Isso também fecha o acesso anônimo direto via PostgREST a essas tabelas.

-- Helper: id do Usuario logado. SECURITY DEFINER para poder ler a tabela Usuario
-- (que tem RLS) sem recursão, rodando como owner.
create or replace function public.usuario_atual_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select id from "Usuario" where "authUserId" = auth.uid() limit 1
$$;

grant execute on function public.usuario_atual_id() to authenticated;

-- Aluno: só o próprio
alter table "Aluno" enable row level security;
drop policy if exists "aluno_le_proprio" on "Aluno";
create policy "aluno_le_proprio" on "Aluno"
  for select to authenticated
  using ("usuarioId" = public.usuario_atual_id());

-- Carteirinha: só a do próprio aluno
alter table "Carteirinha" enable row level security;
drop policy if exists "carteirinha_le_propria" on "Carteirinha";
create policy "carteirinha_le_propria" on "Carteirinha"
  for select to authenticated
  using ("alunoId" in (select id from "Aluno" where "usuarioId" = public.usuario_atual_id()));
