-- MULTI-TENANT (fase 1 — fundação). Adiciona `secretariaId` às tabelas-raiz de
-- domínio e faz backfill para a única secretaria existente (Itaíba). As demais
-- tabelas derivam o tenant por relação (Viagem→Destino, Reserva→Aluno, etc.).
-- As POLICIES de enforcement (ADMIN/FISCAL só veem a própria secretaria) entram
-- junto com cada tela do painel, onde há como testar o isolamento.

-- 1) colunas (idempotente)
alter table "Destino"       add column if not exists "secretariaId" text;
alter table "Aluno"         add column if not exists "secretariaId" text;
alter table "Onibus"        add column if not exists "secretariaId" text;
alter table "Localidade"    add column if not exists "secretariaId" text;
alter table "TipoDocumento" add column if not exists "secretariaId" text;

-- 2) backfill para a secretaria de Itaíba (única existente)
do $$
declare sec text := (select id from "Secretaria" order by "criadoEm" nulls first limit 1);
begin
  update "Destino"       set "secretariaId" = sec where "secretariaId" is null;
  update "Aluno"         set "secretariaId" = sec where "secretariaId" is null;
  update "Onibus"        set "secretariaId" = sec where "secretariaId" is null;
  update "Localidade"    set "secretariaId" = sec where "secretariaId" is null;
  update "TipoDocumento" set "secretariaId" = sec where "secretariaId" is null;
  -- usuários não-DONO sem secretaria → Itaíba (DONO é L0 da plataforma, fica null)
  update "Usuario" set "secretariaId" = sec where "secretariaId" is null and papel <> 'DONO';
end $$;

-- 3) FKs (idempotente via catch)
do $$ begin alter table "Destino"       add constraint "Destino_secretariaId_fkey"       foreign key ("secretariaId") references "Secretaria"(id); exception when duplicate_object then null; end $$;
do $$ begin alter table "Aluno"         add constraint "Aluno_secretariaId_fkey"         foreign key ("secretariaId") references "Secretaria"(id); exception when duplicate_object then null; end $$;
do $$ begin alter table "Onibus"        add constraint "Onibus_secretariaId_fkey"        foreign key ("secretariaId") references "Secretaria"(id); exception when duplicate_object then null; end $$;
do $$ begin alter table "Localidade"    add constraint "Localidade_secretariaId_fkey"    foreign key ("secretariaId") references "Secretaria"(id); exception when duplicate_object then null; end $$;
do $$ begin alter table "TipoDocumento" add constraint "TipoDocumento_secretariaId_fkey" foreign key ("secretariaId") references "Secretaria"(id); exception when duplicate_object then null; end $$;

-- 4) helper: secretaria do usuário logado (mesmo padrão de usuario_atual_id()).
create or replace function public.secretaria_atual_id()
returns text language sql stable security definer set search_path = public as $$
  select "secretariaId" from "Usuario" where "authUserId" = auth.uid() limit 1
$$;
grant execute on function public.secretaria_atual_id() to authenticated;
