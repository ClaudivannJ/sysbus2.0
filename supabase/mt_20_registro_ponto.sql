create table if not exists "RegistroPonto" (
  "id"                    text primary key,
  "viagemId"              text not null references "Viagem"(id) on delete cascade,
  "pontoRotaId"           text not null references "PontoRota"(id) on delete cascade,
  "chegouEm"              timestamptz not null,
  "saiuEm"                timestamptz,
  "distanciaDetectadaM"   int,      -- distância do dispositivo ao ponto quando detectou
  "fiscal"                text,     -- id do Usuario que registrou
  "origem"                text not null default 'GPS', -- 'GPS' | 'MANUAL'
  "sincronizadoEm"        timestamptz not null default now()
);

alter table "RegistroPonto" enable row level security;

drop policy if exists "registroponto_select_auth" on "RegistroPonto";
create policy "registroponto_select_auth" on "RegistroPonto" for select to authenticated
  using (true);

drop policy if exists "registroponto_insert_gestor" on "RegistroPonto";
create policy "registroponto_insert_gestor" on "RegistroPonto" for insert to authenticated
  with check (pode_gerir_secretaria((select "secretariaId" from "Destino" where id = (select "destinoId" from "Viagem" where id = "viagemId"))));

drop policy if exists "registroponto_update_gestor" on "RegistroPonto";
create policy "registroponto_update_gestor" on "RegistroPonto" for update to authenticated
  using (pode_gerir_secretaria((select "secretariaId" from "Destino" where id = (select "destinoId" from "Viagem" where id = "viagemId"))));
