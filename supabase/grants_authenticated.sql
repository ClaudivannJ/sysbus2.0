-- Tabelas criadas pelo Prisma NÃO herdaram os privilégios default do Supabase,
-- então nem USAGE no schema nem GRANT nas tabelas existiam — a RLS ficava inócua
-- e até o login (leitura de Usuario) quebraria com "permission denied".

-- 1) acesso ao schema (sem isto, nada é visível do cliente; anon p/ páginas públicas futuras)
grant usage on schema public to authenticated, anon;

-- 2) SELECT por tabela (RLS restringe as linhas). Concedemos explicitamente.
-- SEGURO: todas estas tabelas já têm RLS habilitada + policy de SELECT por dono/rota,
-- então o GRANT só habilita o acesso que a policy permite (linha a linha).
grant select on table "Usuario"           to authenticated;
grant select on table "Aluno"             to authenticated;
grant select on table "Carteirinha"       to authenticated;
grant select on table "Destino"           to authenticated;
grant select on table "ModeloCarteirinha" to authenticated;
grant select on table "Renovacao"         to authenticated;
