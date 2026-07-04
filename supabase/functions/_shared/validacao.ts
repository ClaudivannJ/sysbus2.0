// Validações de domínio reutilizáveis nas Edge Functions.

// Valida CPF pelo algoritmo dos dígitos verificadores (não só o tamanho).
// Rejeita sequências repetidas (000..., 111...) que passam na conta mas são inválidas.
export function cpfValido(entrada: string): boolean {
  const cpf = (entrada ?? "").replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const dv = (base: string, pesoInicial: number) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = dv(cpf.slice(0, 9), 10);
  if (d1 !== Number(cpf[9])) return false;
  const d2 = dv(cpf.slice(0, 10), 11);
  return d2 === Number(cpf[10]);
}
