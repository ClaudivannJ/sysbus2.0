-- mt_18_transparencia_embarque.sql
-- Atualização segura e idempotente da transparência de embarque.

-- 1. Atualização segura de Destino
do $$
begin
  if exists (
    select 1 from information_schema.columns 
    where table_name='Destino' and column_name='exibirQuemFalta'
  ) then
    alter table "Destino" rename column "exibirQuemFalta" to "transparenciaEmbarque";
  end if;

  if not exists (
    select 1 from information_schema.columns 
    where table_name='Destino' and column_name='transparenciaEmbarque'
  ) then
    alter table "Destino" add column "transparenciaEmbarque" text default 'CONTAGEM_NOMES';
  end if;
end $$;

-- 2. Coluna em Onibus
alter table "Onibus" add column if not exists "transparenciaEmbarque" text default null;

-- 3. Garantir padrão em Destino
alter table "Destino" alter column "transparenciaEmbarque" set default 'CONTAGEM_NOMES';
update "Destino" set "transparenciaEmbarque" = 'CONTAGEM_NOMES' where "transparenciaEmbarque" is null;
