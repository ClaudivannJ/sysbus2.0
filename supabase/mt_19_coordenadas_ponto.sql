alter table "PontoRota"
  add column if not exists "lat"       float8,
  add column if not exists "lng"       float8,
  add column if not exists "raioMetros" int not null default 200;
