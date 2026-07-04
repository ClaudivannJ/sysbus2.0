-- SEGURANÇA (defesa em profundidade) — habilita RLS em Reserva, Viagem e Embarque.
-- Hoje essas tabelas NÃO têm grant p/ anon/authenticated, então o cliente já não as acessa
-- (só as Edge Functions via service_role, que aplicam auth + tenant no código). Porém, sem RLS,
-- um grant acidental futuro vazaria dados entre secretarias na hora. Ligar RLS = rede de segurança:
-- nega qualquer acesso direto do cliente por padrão. O service_role IGNORA RLS → funções seguem iguais.
--
-- Runner: node supabase/apply.mjs supabase/mt_11_rls_safety_net.sql

alter table "Reserva"  enable row level security;
alter table "Viagem"   enable row level security;
alter table "Embarque" enable row level security;

-- (sem policies para anon/authenticated de propósito: acesso direto do cliente = negado.
--  Todo acesso legítimo passa pelas Edge Functions com service_role.)
