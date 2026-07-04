-- RLS: o ALUNO lê o template (arte + campos) APENAS da sua própria rota.
-- Necessário para renderizar a carteirinha no portal (Aluno → Destino → ModeloCarteirinha).
-- Escopo por rota já prepara o isolamento multi-tenant (aluno não vê rota de outra secretaria).
-- Reusa public.usuario_atual_id() criada em rls_aluno.sql.

-- Destino: só o destino do próprio aluno
alter table "Destino" enable row level security;
drop policy if exists "destino_le_do_aluno" on "Destino";
create policy "destino_le_do_aluno" on "Destino"
  for select to authenticated
  using (id = (select "destinoId" from "Aluno" where "usuarioId" = public.usuario_atual_id()));

-- ModeloCarteirinha: só o template da rota do próprio aluno
alter table "ModeloCarteirinha" enable row level security;
drop policy if exists "modelo_le_do_aluno" on "ModeloCarteirinha";
create policy "modelo_le_do_aluno" on "ModeloCarteirinha"
  for select to authenticated
  using ("destinoId" = (select "destinoId" from "Aluno" where "usuarioId" = public.usuario_atual_id()));
