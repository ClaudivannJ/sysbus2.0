-- O formulário PÚBLICO de auto-cadastro (anon) e a edição de perfil (authenticated)
-- precisam listar as rotas/cidades (Destino). Destino não tem dado sensível
-- (id, nome, horários). Liberamos leitura da lista aos dois papéis.
grant select on table "Destino" to anon;
drop policy if exists "destino_lista_publica" on "Destino";
create policy "destino_lista_publica" on "Destino"
  for select to anon, authenticated using (true);
