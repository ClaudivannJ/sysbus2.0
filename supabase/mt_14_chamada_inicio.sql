-- Chamada única (pela ordem dos confirmados). O monitor pode "iniciar agora" antes do
-- horário — guardamos o início efetivo na própria Viagem (substitui o controle por ponto).
--
-- Runner: node supabase/apply.mjs supabase/mt_14_chamada_inicio.sql

alter table "Viagem" add column if not exists "chamadaIniciadaEm" timestamptz;
