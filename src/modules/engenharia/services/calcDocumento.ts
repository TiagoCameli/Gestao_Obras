import { evalSafe, type AlertaLinha } from './calcEngine';
import { ehReservada, normalizarNome } from './calcReservedWords';
import type { LinhaCalculo } from '../types/calculo';

export type TipoLinha = 'atribuicao_num' | 'atribuicao_str' | 'avaliacao' | 'vazio';

export interface LinhaAvaliada {
  id: string;
  expressao: string;
  tipo: TipoLinha;
  /** Texto à esquerda do 1º `=` (trim). */
  lhs: string;
  /** Texto à direita do 1º `=` (trim), ou null se não há `=` / RHS vazio. */
  rhsUsuario: string | null;
  /** Resultado calculado (stringificado), ou null. */
  resultado: string | null;
  /** Estado da engine. `revisado` é estado de UI, não emitido aqui. */
  alerta: Exclude<AlertaLinha, 'revisado'>;
  erroEngine?: string;
  /** Nome canônico da variável definida nesta linha (atribuições). */
  varDefinida?: string;
}

const RE_IDENT_SIMPLES = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const RE_STRING_LITERAL = /^"([^"]+)"$/;

interface AliasRegistrado {
  /** Forma canônica com espaços (ex: "brita 4"). */
  canonico: string;
  /** Chave segura no scope (ex: "__sv_brita_4"). */
  chaveScope: string;
}

function chaveScopeDe(canonico: string): string {
  return '__sv_' + canonico.replace(/[^a-z0-9]/gi, '_');
}

function stringifyResultado(v: unknown): string {
  if (typeof v === 'number') {
    return Number.isInteger(v) ? v.toString() : Number(v.toFixed(10)).toString();
  }
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return String(v);
}

function resultadosBatem(calc: string, user: string): boolean {
  const a = Number(calc);
  const b = Number(user);
  if (!Number.isNaN(a) && !Number.isNaN(b)) return Math.abs(a - b) < 1e-9;
  return calc.trim() === user.trim();
}

/**
 * Substitui aliases string na expressão por suas chaves de scope, greedy
 * longest-match (canônicos mais longos primeiro), case-insensitive, tolerando
 * espaços internos. Ex: com alias "brita 4" → chave "__sv_brita_4", a expressão
 * "x + brita4 + BRITA 4" vira "x + __sv_brita_4 + __sv_brita_4".
 */
export function substituirAliases(expr: string, aliases: AliasRegistrado[]): string {
  let out = expr;
  const ordenados = [...aliases].sort((a, b) => b.canonico.length - a.canonico.length);
  for (const a of ordenados) {
    const partes = a.canonico.split(' ').map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    // \b nas pontas evita casar DENTRO de uma chave ja substituida (ex: o alias
    // "brita" nao deve casar o "brita" de "__sv_brita_4"), e impede casar
    // substrings de outros identificadores (ex: "brita" em "cobrita").
    const padrao = '\\b' + partes.join('\\s*') + '\\b';
    const re = new RegExp(padrao, 'gi');
    out = out.replace(re, a.chaveScope);
  }
  return out;
}

function classificar(expressao: string): {
  tipo: TipoLinha;
  lhs: string;
  rhsUsuario: string | null;
  rhsExpr: string;
  nomeVar?: string;
  ehString?: boolean;
} {
  const igualIdx = expressao.indexOf('=');
  if (igualIdx < 0) {
    return { tipo: 'vazio', lhs: expressao, rhsUsuario: null, rhsExpr: '' };
  }
  const lhs = expressao.slice(0, igualIdx).trim();
  const rhsRaw = expressao.slice(igualIdx + 1);
  const rhsTrim = rhsRaw.trim();
  const rhsUsuario = rhsTrim === '' ? null : rhsTrim;

  if (lhs === '') {
    return { tipo: 'vazio', lhs: '', rhsUsuario, rhsExpr: rhsRaw };
  }

  const mStr = lhs.match(RE_STRING_LITERAL);
  if (mStr && rhsUsuario !== null) {
    return { tipo: 'atribuicao_str', lhs, rhsUsuario, rhsExpr: rhsRaw, nomeVar: mStr[1], ehString: true };
  }
  if (RE_IDENT_SIMPLES.test(lhs) && rhsUsuario !== null) {
    return { tipo: 'atribuicao_num', lhs, rhsUsuario, rhsExpr: rhsRaw, nomeVar: lhs, ehString: false };
  }
  return { tipo: 'avaliacao', lhs, rhsUsuario, rhsExpr: rhsRaw };
}

/**
 * Avalia o documento inteiro em ordem, mantendo scope cumulativo + aliases.
 * Função pura. Não muta as linhas de entrada.
 */
export function recalcularDocumento(linhas: LinhaCalculo[]): LinhaAvaliada[] {
  const scope: Record<string, unknown> = {};
  const aliases: AliasRegistrado[] = [];
  const out: LinhaAvaliada[] = [];

  for (const linha of linhas) {
    const c = classificar(linha.expressao);
    const base = { id: linha.id, expressao: linha.expressao, lhs: c.lhs, rhsUsuario: c.rhsUsuario };

    if (c.tipo === 'vazio') {
      out.push({ ...base, tipo: 'vazio', resultado: null, alerta: 'vazio' });
      continue;
    }

    if (c.tipo === 'atribuicao_num' || c.tipo === 'atribuicao_str') {
      if (ehReservada(c.nomeVar!)) {
        out.push({
          ...base, tipo: c.tipo, resultado: null, alerta: 'erro',
          erroEngine: `'${c.nomeVar}' é palavra reservada (função do math.js)`,
        });
        continue;
      }
      let valor: unknown;
      try {
        valor = evalSafe(substituirAliases(c.rhsExpr, aliases), scope);
      } catch (e) {
        out.push({
          ...base, tipo: c.tipo, resultado: null, alerta: 'erro',
          erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
        });
        continue;
      }
      const resultado = stringifyResultado(valor);

      if (c.ehString) {
        const canonico = normalizarNome(c.nomeVar!);
        const chave = chaveScopeDe(canonico);
        scope[chave] = valor;
        if (!aliases.some((a) => a.canonico === canonico)) {
          aliases.push({ canonico, chaveScope: chave });
        }
        out.push({ ...base, tipo: 'atribuicao_str', resultado, alerta: 'ok', varDefinida: canonico });
      } else {
        scope[c.nomeVar!] = valor;
        out.push({ ...base, tipo: 'atribuicao_num', resultado, alerta: 'ok', varDefinida: c.nomeVar });
      }
      continue;
    }

    // Avaliação (expr= ou expr=valor)
    let valor: unknown;
    try {
      valor = evalSafe(substituirAliases(c.lhs, aliases), scope);
    } catch (e) {
      out.push({
        ...base, tipo: 'avaliacao', resultado: null, alerta: 'erro',
        erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
      });
      continue;
    }
    const resultado = stringifyResultado(valor);

    if (c.rhsUsuario === null) {
      out.push({ ...base, tipo: 'avaliacao', resultado, alerta: 'ok' });
    } else if (resultadosBatem(resultado, c.rhsUsuario)) {
      out.push({ ...base, tipo: 'avaliacao', resultado, alerta: 'ok' });
    } else {
      out.push({ ...base, tipo: 'avaliacao', resultado, alerta: 'erro' });
    }
  }

  return out;
}

export interface CaixaCalc {
  id: string;
  linhas: LinhaCalculo[];
  x: number;
  y: number;
}

/** Avalia UMA linha contra um escopo FIXO (não muta). Usado na fase 2 da prancha. */
function avaliarLinhaFixo(
  linha: LinhaCalculo,
  scope: Record<string, unknown>,
  aliases: AliasRegistrado[],
): LinhaAvaliada {
  const c = classificar(linha.expressao);
  const base = { id: linha.id, expressao: linha.expressao, lhs: c.lhs, rhsUsuario: c.rhsUsuario };
  if (c.tipo === 'vazio') return { ...base, tipo: 'vazio', resultado: null, alerta: 'vazio' };

  if (c.tipo === 'atribuicao_num' || c.tipo === 'atribuicao_str') {
    if (ehReservada(c.nomeVar!)) {
      return {
        ...base, tipo: c.tipo, resultado: null, alerta: 'erro',
        erroEngine: `'${c.nomeVar}' é palavra reservada (função do math.js)`,
      };
    }
    let valor: unknown;
    try {
      valor = evalSafe(substituirAliases(c.rhsExpr, aliases), scope);
    } catch (e) {
      return {
        ...base, tipo: c.tipo, resultado: null, alerta: 'erro',
        erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
      };
    }
    const resultado = stringifyResultado(valor);
    const varDef = c.ehString ? normalizarNome(c.nomeVar!) : c.nomeVar!;
    return {
      ...base,
      tipo: c.ehString ? 'atribuicao_str' : 'atribuicao_num',
      resultado, alerta: 'ok', varDefinida: varDef,
    };
  }

  let valor: unknown;
  try {
    valor = evalSafe(substituirAliases(c.lhs, aliases), scope);
  } catch (e) {
    return {
      ...base, tipo: 'avaliacao', resultado: null, alerta: 'erro',
      erroEngine: e instanceof Error ? e.message : 'erro de cálculo',
    };
  }
  const resultado = stringifyResultado(valor);
  if (c.rhsUsuario === null || resultadosBatem(resultado, c.rhsUsuario)) {
    return { ...base, tipo: 'avaliacao', resultado, alerta: 'ok' };
  }
  return { ...base, tipo: 'avaliacao', resultado, alerta: 'erro' };
}

/**
 * Escopo compartilhado da prancha: define-anywhere/use-anywhere.
 * Ordem de leitura: y asc, depois x asc. Primeira definição de cada variável vence.
 * Fase 1: coleta atribuições até fixpoint (first-write-wins). Fase 2: avalia todas
 * as linhas contra o escopo completo. Retorna Map<idCaixa, LinhaAvaliada[]>.
 */
export function recalcularPrancha(caixas: CaixaCalc[]): Map<string, LinhaAvaliada[]> {
  const ordenadas = [...caixas].sort((a, b) => (a.y - b.y) || (a.x - b.x));
  const linhasOrdenadas: LinhaCalculo[] = [];
  const donoDe = new Map<string, string>();
  for (const cx of ordenadas) {
    for (const l of cx.linhas) {
      linhasOrdenadas.push(l);
      if (!donoDe.has(l.id)) donoDe.set(l.id, cx.id);
    }
  }

  const scope: Record<string, unknown> = {};
  const aliases: AliasRegistrado[] = [];
  const definido = new Set<string>();

  for (let pass = 0; pass < 8; pass++) {
    let mudou = false;
    for (const linha of linhasOrdenadas) {
      const c = classificar(linha.expressao);
      if (c.tipo !== 'atribuicao_num' && c.tipo !== 'atribuicao_str') continue;
      if (ehReservada(c.nomeVar!)) continue;
      const chave = c.ehString ? chaveScopeDe(normalizarNome(c.nomeVar!)) : c.nomeVar!;
      if (definido.has(chave)) continue;
      let valor: unknown;
      try {
        valor = evalSafe(substituirAliases(c.rhsExpr, aliases), scope);
      } catch {
        continue;
      }
      scope[chave] = valor;
      definido.add(chave);
      if (c.ehString) {
        const canonico = normalizarNome(c.nomeVar!);
        if (!aliases.some((a) => a.canonico === canonico)) {
          aliases.push({ canonico, chaveScope: chave });
        }
      }
      mudou = true;
    }
    if (!mudou) break;
  }

  const porCaixa = new Map<string, LinhaAvaliada[]>();
  for (const cx of caixas) porCaixa.set(cx.id, []);
  for (const linha of linhasOrdenadas) {
    porCaixa.get(donoDe.get(linha.id)!)!.push(avaliarLinhaFixo(linha, scope, aliases));
  }
  return porCaixa;
}
