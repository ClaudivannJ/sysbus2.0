-- O `service_role` (chave admin, usada só server-side nas Edge Functions, bypassa RLS)
-- também não herdou os privilégios default do Supabase nas tabelas criadas pelo Prisma
-- → dava "permission denied for schema public" ao chamar RPC/PostgREST.
-- Restauramos o acesso completo padrão do Supabase p/ service_role (nunca exposto ao cliente).
grant usage on schema public to service_role;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all routines in schema public to service_role;

-- Futuras tabelas/rotinas criadas pelo owner também já nascem acessíveis ao service_role.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant all on routines to service_role;

-- Recarrega o cache de schema do PostgREST p/ enxergar a RPC email_por_cpf.
notify pgrst, 'reload schema';
