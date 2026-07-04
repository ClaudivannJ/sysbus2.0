-- Resolve o e-mail de login a partir do CPF (só dígitos). Usada pela Edge Function
-- `login-aluno` (service role). NÃO exposta ao cliente → sem risco de enumeração.
-- SECURITY DEFINER: roda como owner para ler Usuario/Aluno ignorando RLS.
create or replace function public.email_por_cpf(cpf_digits text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select u.email
  from "Usuario" u
  join "Aluno" a on a."usuarioId" = u.id
  where regexp_replace(a.cpf, '\D', '', 'g') = cpf_digits
  limit 1
$$;

-- Trava execução: apenas service_role (a Edge Function) pode chamar.
revoke all on function public.email_por_cpf(text) from public;
revoke all on function public.email_por_cpf(text) from anon;
revoke all on function public.email_por_cpf(text) from authenticated;
grant execute on function public.email_por_cpf(text) to service_role;
