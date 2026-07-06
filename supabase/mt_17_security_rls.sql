-- Habilitar Row Level Security (RLS) para as tabelas principais

-- Tabela Usuario
alter table "Usuario" enable row level security;

-- Política para o próprio usuário ler seus dados (authUserId)
drop policy if exists "usuario_le_proprio" on "Usuario";
create policy "usuario_le_proprio" on "Usuario" for select to authenticated
  using ("authUserId" = auth.uid());

-- Tabela Localidade
alter table "Localidade" enable row level security;

-- Política para qualquer usuário autenticado listar as localidades
drop policy if exists "localidade_select_auth" on "Localidade";
create policy "localidade_select_auth" on "Localidade" for select to authenticated
  using (true);

-- Tabela OnibusLocalidade
alter table "OnibusLocalidade" enable row level security;

-- Política para qualquer usuário autenticado listar pontos de ônibus
drop policy if exists "onibuslocalidade_select_auth" on "OnibusLocalidade";
create policy "onibuslocalidade_select_auth" on "OnibusLocalidade" for select to authenticated
  using (true);
