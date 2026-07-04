-- CRON DIÁRIO: pré-cria as viagens do dia (00:00 BRT) respeitando o calendário.
-- Assim a "viagem do dia" já aparece limpa com "A votação abre às Xh" desde 00:00,
-- e a viagem de ontem some (a query filtra pela data de hoje).
create extension if not exists pg_cron;

create or replace function public.materializar_viagens_hoje()
returns int language plpgsql security definer set search_path = public as $$
declare
  hoje_brt date := (now() at time zone 'America/Recife')::date;
  dow int := extract(isodow from (now() at time zone 'America/Recife')::date);
  data_viagem timestamp := ((hoje_brt::text || ' 00:00:00')::timestamp at time zone 'America/Recife') at time zone 'UTC';
  d record; n int := 0;
begin
  for d in select * from "Destino"
           where (dow = any("diasSemana")) and ("enqueteAbre" is not null or "enqueteFecha" is not null)
  loop
    if exists (select 1 from "ExcecaoCalendario" e where e.data::date = hoje_brt and (e."destinoId" = d.id or e."destinoId" is null)) then continue; end if;
    if exists (select 1 from "Viagem" v where v."destinoId" = d.id and v.data::date = data_viagem::date and v.horario = d."horarioSaida") then continue; end if;
    insert into "Viagem" (id, data, horario, "abreEm", "fechaEm", "intervaloChamadaS", status, "destinoId")
    values (
      gen_random_uuid()::text, data_viagem, d."horarioSaida",
      case when d."enqueteAbre" is not null then ((hoje_brt::text || ' ' || d."enqueteAbre" || ':00')::timestamp at time zone 'America/Recife') at time zone 'UTC' else null end,
      case when d."enqueteFecha" is not null then ((hoje_brt::text || ' ' || d."enqueteFecha" || ':00')::timestamp at time zone 'America/Recife') at time zone 'UTC' else null end,
      d."intervaloChamadaS", 'ABERTA', d.id
    );
    n := n + 1;
  end loop;
  return n;
end $$;

-- agenda p/ 00:00 BRT (= 03:00 UTC). idempotente.
do $$ begin perform cron.unschedule('materializar-viagens'); exception when others then null; end $$;
select cron.schedule('materializar-viagens', '0 3 * * *', 'select public.materializar_viagens_hoje();');
