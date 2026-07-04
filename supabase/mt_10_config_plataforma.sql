-- MULTI-TENANT (fase 3) — CONFIGURAÇÃO GLOBAL DA PLATAFORMA (controlada pelo DONO).
-- Feature flags de nível de plataforma. Primeiro flag: NFC (embarque por aproximação),
-- que o DONO liga/desliga sem mexer no código. Linha única (id fixo = 'GLOBAL').
--
-- Runner: node supabase/apply.mjs supabase/mt_10_config_plataforma.sql

create table if not exists "ConfiguracaoPlataforma" (
  "id"           text primary key default 'GLOBAL',
  "nfcAtivo"     boolean not null default false,
  "atualizadoEm" timestamptz not null default now()
);

-- garante a linha única
insert into "ConfiguracaoPlataforma" ("id") values ('GLOBAL')
  on conflict ("id") do nothing;

alter table "ConfiguracaoPlataforma" enable row level security;

-- helper: o chamador é DONO da plataforma?
create or replace function public.eh_dono()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from "Usuario" u
    where u."authUserId" = auth.uid() and u.papel = 'DONO'
  );
$$;

grant select, update on table "ConfiguracaoPlataforma" to authenticated;

-- qualquer usuário autenticado LÊ (monitor precisa saber se o NFC está ligado)
drop policy if exists "config_plataforma_le" on "ConfiguracaoPlataforma";
create policy "config_plataforma_le" on "ConfiguracaoPlataforma" for select to authenticated
  using (true);

-- só o DONO ESCREVE
drop policy if exists "config_plataforma_dono_edita" on "ConfiguracaoPlataforma";
create policy "config_plataforma_dono_edita" on "ConfiguracaoPlataforma" for update to authenticated
  using (public.eh_dono())
  with check (public.eh_dono());
