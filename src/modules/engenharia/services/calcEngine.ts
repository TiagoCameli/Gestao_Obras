import { create, all } from 'mathjs';

// Sandbox: bloqueia `import` e `createUnit` (vetores documentados pela math.js
// como security-sensitive) quando chamados de dentro de expressões do usuário.
//
// Por que NÃO sobrescrever `parse`, `simplify`, `derivative`, `resolve`, `reviver`:
// a função `evaluate` do math.js usa `parse` internamente pra montar o AST. Se
// derrubarmos `parse`, derrubamos a engine inteira. Esses 5 nomes não são
// vetores de segurança por si só (não criam capabilities novas). O master plan
// original listava os 7, mas testar mostra que `parse` rompe `evaluate`; seguimos
// a recomendacão oficial: https://mathjs.org/docs/expressions/security.html.
//
// Usamos uma instância PRIVADA (`create(all)`) pra que esse `import` não vaze
// pra outros consumidores de math.js no bundle.
const mathInstance = create(all);
mathInstance.import(
  {
    import: () => { throw new Error('Function import is disabled'); },
    createUnit: () => { throw new Error('Function createUnit is disabled'); },
  },
  { override: true },
);

export type AlertaLinha = 'ok' | 'erro' | 'revisado' | 'vazio';

export interface ResultadoParse {
  /** Texto à esquerda do "=" — a expressão que será avaliada. Pode ser '' se sem `=`. */
  lhs: string;
  /** Texto à direita do "=" digitado pelo usuário. `null` se sem `=` ou RHS vazio. */
  rhsUsuario: string | null;
  /** Valor calculado pela engine (stringificado). `null` se LHS vazio ou erro. */
  resultado: string | null;
  /** Estado da linha. `vazio` quando sem `=` ou LHS vazio. */
  alerta: AlertaLinha;
  /** Mensagem curta de erro de parse (se houver). */
  erroEngine?: string;
}

/** Avalia uma expressão usando a instância sandboxed do math.js. Throws em erro. */
export function evalSafe(expr: string, scope: Record<string, unknown> = {}): unknown {
  return mathInstance.evaluate(expr, scope);
}

/**
 * Parseia uma linha do bloco de cálculo no formato `lhs=rhs` (rhs opcional).
 *
 * Regras (prompt original, fase 5):
 * - linha sem `=`: alerta='vazio' (apenas exibe texto).
 * - linha com `=` e LHS vazio (`=10`): alerta='vazio' (UX neutra).
 * - linha com `=` e RHS vazio (`1+1=`): app preenche resultado, alerta='ok'.
 * - LHS válido + RHS bate: alerta='ok'.
 * - LHS válido + RHS não-bate: alerta='erro'.
 * - LHS erro de parse: alerta='erro' + erroEngine populado.
 *
 * Comparação RHS vs resultado é numérica quando ambos forem números (tolera
 * 1e-9 de epsilon). Caso contrário, comparação textual normalizada (trim).
 */
export function parseLinha(expressaoCompleta: string): ResultadoParse {
  const txt = expressaoCompleta;
  const igualIdx = txt.indexOf('=');

  if (igualIdx < 0) {
    return { lhs: txt, rhsUsuario: null, resultado: null, alerta: 'vazio' };
  }

  const lhs = txt.slice(0, igualIdx).trim();
  const rhsRaw = txt.slice(igualIdx + 1);
  const rhsUsuario = rhsRaw.trim() === '' ? null : rhsRaw.trim();

  if (lhs === '') {
    return { lhs: '', rhsUsuario, resultado: null, alerta: 'vazio' };
  }

  let resultado: string | null = null;
  try {
    const valor = evalSafe(lhs);
    resultado = stringifyResultado(valor);
  } catch (e) {
    return {
      lhs,
      rhsUsuario,
      resultado: null,
      alerta: 'erro',
      erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
    };
  }

  if (rhsUsuario === null) {
    return { lhs, rhsUsuario: null, resultado, alerta: 'ok' };
  }

  if (resultado !== null && resultadosBatem(resultado, rhsUsuario)) {
    return { lhs, rhsUsuario, resultado, alerta: 'ok' };
  }

  return { lhs, rhsUsuario, resultado, alerta: 'erro' };
}

function stringifyResultado(v: unknown): string {
  if (typeof v === 'number') {
    // Trunca casas pequenas pra evitar `0.30000000000000004`.
    return Number.isInteger(v) ? v.toString() : Number(v.toFixed(10)).toString();
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function resultadosBatem(calc: string, user: string): boolean {
  const a = Number(calc);
  const b = Number(user);
  if (!Number.isNaN(a) && !Number.isNaN(b)) {
    return Math.abs(a - b) < 1e-9;
  }
  return calc.trim() === user.trim();
}
