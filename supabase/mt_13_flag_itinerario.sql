-- Feature flag: módulo de ITINERÁRIO/PONTOS (operação da viagem). O DONO liga/desliga,
-- igual ao NFC. Começa DESLIGADO — o módulo será revisitado depois.
--
-- Runner: node supabase/apply.mjs supabase/mt_13_flag_itinerario.sql

alter table "ConfiguracaoPlataforma" add column if not exists "itinerarioAtivo" boolean not null default false;
