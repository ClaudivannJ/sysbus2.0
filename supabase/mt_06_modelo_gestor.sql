-- Gestor lê o ModeloCarteirinha das rotas da sua secretaria (p/ editar o template).
drop policy if exists "modelo_gestor_le" on "ModeloCarteirinha";
create policy "modelo_gestor_le" on "ModeloCarteirinha" for select to authenticated
  using (public.pode_gerir_secretaria((select d."secretariaId" from "Destino" d where d.id = "ModeloCarteirinha"."destinoId")));
