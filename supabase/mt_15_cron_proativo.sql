-- Torna a materialização das viagens PROATIVA: roda a cada 15 min (não só às 00:00).
-- Assim a "viagem do dia" existe sozinha no horário configurado, mesmo que a secretaria
-- mude os dias/horários DURANTE o dia (antes, só era criada às 00:00 ou quando alguém
-- acessava o app). A função já é idempotente (pula viagens que já existem).
--
-- Runner: node supabase/apply.mjs supabase/mt_15_cron_proativo.sql

do $$ begin perform cron.unschedule('materializar-viagens'); exception when others then null; end $$;
select cron.schedule('materializar-viagens', '*/15 * * * *', 'select public.materializar_viagens_hoje();');

-- roda uma vez agora para já refletir a configuração atual
select public.materializar_viagens_hoje();
