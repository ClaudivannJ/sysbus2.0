-- Trigger para sincronizar as configurações de horários do Destino para a Viagem de hoje

create or replace function public.trg_sync_destino_viagem_hoje()
returns trigger language plpgsql security definer as $$
declare
  hoje_brt date := (now() at time zone 'America/Recife')::date;
  data_viagem timestamp := ((hoje_brt::text || ' 00:00:00')::timestamp at time zone 'America/Recife') at time zone 'UTC';
  
  novo_abre timestamp;
  novo_fecha timestamp;
begin
  -- Se houver mudança em algum dos horários ou no intervalo da chamada
  if new."horarioSaida" is distinct from old."horarioSaida" or
     new."enqueteAbre" is distinct from old."enqueteAbre" or
     new."enqueteFecha" is distinct from old."enqueteFecha" or
     new."intervaloChamadaS" is distinct from old."intervaloChamadaS" then
     
     -- Pré-calcula os novos timestamps
     novo_abre := case when new."enqueteAbre" is not null then ((hoje_brt::text || ' ' || new."enqueteAbre" || ':00')::timestamp at time zone 'America/Recife') at time zone 'UTC' else null end;
     novo_fecha := case when new."enqueteFecha" is not null then ((hoje_brt::text || ' ' || new."enqueteFecha" || ':00')::timestamp at time zone 'America/Recife') at time zone 'UTC' else null end;
     
     -- Atualiza a Viagem cujo "data" corresponde exatamente à data_viagem gerada à meia-noite do dia corrente
     update "Viagem"
     set 
       "horario" = new."horarioSaida",
       "intervaloChamadaS" = new."intervaloChamadaS",
       -- Regra: Se a viagem de hoje já abriu (abreEm <= now), não retrocede para não fechar a enquete em andamento!
       "abreEm" = case 
                    when "abreEm" is not null and "abreEm" <= now() then "abreEm"
                    else novo_abre 
                  end,
       -- Regra: O fechamento sempre atualiza, permitindo que a secretaria estenda ou reabra uma enquete
       "fechaEm" = novo_fecha
     where "destinoId" = new.id
       and data::date = data_viagem::date;
  end if;
  return new;
end $$;

drop trigger if exists trg_destino_update_viagem on "Destino";
create trigger trg_destino_update_viagem
after update on "Destino"
for each row
execute function public.trg_sync_destino_viagem_hoje();
