/**
 * Geração de números de documentos do módulo Compras no formato PREFIX-AAAA-NNNN.
 *
 * Ex.: PED-2026-0001, COT-2026-0001, OC-2026-0001
 *
 * O ano é o ano atual (Brasília) e a sequência reinicia em 0001 quando o ano muda.
 */

const REGEX_NUMERO = /^([A-Z]+)-(\d{4})-(\d{4,})$/;

function anoAtual(): number {
  return new Date().getFullYear();
}

/**
 * Calcula o próximo número para um prefixo, considerando apenas os números
 * existentes do ano informado (default = ano atual).
 *
 * Compatível com numeração antiga sem ano (ex.: PED-0001) — esses são ignorados
 * no cálculo do ano novo.
 */
export function proximoNumeroPorAno(
  prefix: string,
  numerosExistentes: string[],
  ano: number = anoAtual()
): string {
  const pad4 = (n: number) => String(n).padStart(4, '0');

  const sequenciasDoAno = numerosExistentes
    .map((n) => {
      const m = n.match(REGEX_NUMERO);
      if (!m) return null;
      const [, p, a, seq] = m;
      if (p !== prefix) return null;
      if (parseInt(a, 10) !== ano) return null;
      return parseInt(seq, 10);
    })
    .filter((n): n is number => n !== null && n > 0);

  const proximaSeq = sequenciasDoAno.length > 0 ? Math.max(...sequenciasDoAno) + 1 : 1;
  return `${prefix}-${ano}-${pad4(proximaSeq)}`;
}

/**
 * Helper compatível com a função antiga `proximoNumero(prefix, existentes)` que
 * gerava `PREFIX-NNNN` — agora gera `PREFIX-AAAA-NNNN`. Mantemos o mesmo nome
 * e assinatura pra facilitar migração no código existente.
 */
export function proximoNumero(prefix: string, numerosExistentes: string[]): string {
  return proximoNumeroPorAno(prefix, numerosExistentes);
}

/**
 * Valida se um número está no formato esperado.
 */
export function ehNumeroValido(numero: string): boolean {
  return REGEX_NUMERO.test(numero);
}
