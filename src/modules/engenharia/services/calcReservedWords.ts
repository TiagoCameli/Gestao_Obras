// Palavras reservadas: nomes que colidem com funções/constantes do math.js.
// Definir uma variável com esses nomes mascara a função (ex: `"sin" = 5` quebraria
// `sin(x)`), então bloqueamos a DEFINIÇÃO (não o uso da função). Decisão D-6.
export const PALAVRAS_RESERVADAS: ReadonlySet<string> = new Set([
  'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
  'log', 'ln', 'log10', 'log2', 'exp', 'sqrt', 'abs',
  'min', 'max', 'sum', 'mean', 'median', 'std',
  'floor', 'ceil', 'round', 'pi', 'e', 'i',
  'true', 'false', 'null', 'nan', 'infinity',
  'mod', 'gcd', 'lcm', 'sign',
]);

/** Normaliza um nome de variável para comparação (lowercase + trim + colapsa espaços). */
export function normalizarNome(nome: string): string {
  return nome.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Uma variável é reservada se seu nome normalizado bater com a lista. Nomes
 * string com espaço (`"Brita 4"`) nunca colidem (funções math.js não têm espaço).
 */
export function ehReservada(nome: string): boolean {
  return PALAVRAS_RESERVADAS.has(normalizarNome(nome));
}
