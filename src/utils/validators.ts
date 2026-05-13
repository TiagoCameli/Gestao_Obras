/**
 * Validadores de documentos brasileiros.
 *
 * Convenções:
 * - Funções aceitam o valor com ou sem máscara.
 * - Retornam `true` para válido, `false` para inválido.
 * - String vazia é considerada VÁLIDA (campo opcional). Se o campo for
 *   obrigatório, isso deve ser tratado separadamente.
 */

/** Valida dígitos verificadores de um CPF. */
export function validarCPF(cpf: string): boolean {
  if (!cpf) return true; // vazio = válido (opcional)
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false; // todos iguais
  let soma = 0;
  for (let i = 0; i < 9; i++) soma += parseInt(digits[i], 10) * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  if (resto !== parseInt(digits[9], 10)) return false;
  soma = 0;
  for (let i = 0; i < 10; i++) soma += parseInt(digits[i], 10) * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10) resto = 0;
  return resto === parseInt(digits[10], 10);
}

/** Valida dígitos verificadores de um CNPJ. */
export function validarCNPJ(cnpj: string): boolean {
  if (!cnpj) return true; // vazio = válido (opcional)
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(digits)) return false; // todos iguais

  const calc = (length: number): number => {
    const weights = length === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < length; i++) soma += parseInt(digits[i], 10) * weights[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const dv1 = calc(12);
  if (dv1 !== parseInt(digits[12], 10)) return false;
  const dv2 = calc(13);
  return dv2 === parseInt(digits[13], 10);
}
