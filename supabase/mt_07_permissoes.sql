-- Permissões GRANULARES por funcionário (a secretaria define o que cada um acessa).
alter table "Usuario" add column if not exists permissoes text[] not null default '{}';

-- Gestor (ADMIN/DONO) lê os usuários (funcionários) da sua secretaria (p/ a tela Funcionários).
drop policy if exists "usuario_gestor_le" on "Usuario";
create policy "usuario_gestor_le" on "Usuario" for select to authenticated
  using (public.pode_gerir_secretaria("secretariaId"));
