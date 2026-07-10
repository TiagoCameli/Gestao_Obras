// Movimentações do almoxarifado de manutenção: unifica entradas de material
// (compra via NF) com as saídas (peças e óleos baixados em OS) numa lista
// cronológica. Só lógica pura — os hooks de dados vivem nos componentes.
//
// Saídas vêm de os_pecas + os_oleos. Uma baixa só entra na lista se a OS de
// origem existe (osNumeroPorId tem a chave); isso descarta baixas de OS
// excluída, cujo saldo já foi estornado pela view v_saldo_estoque. Peça
// devolvida não é saída líquida, então também fica de fora.

import type { EntradaMaterial, OSPeca, OSOleo } from '../types';

export type TipoMovimentacao = 'entrada' | 'saida';

export type OrigemMovimentacao =
  | { kind: 'nf'; notaFiscal: string }
  | { kind: 'os'; osId: string; osNumero: string };

export interface Movimentacao {
  id: string;
  tipo: TipoMovimentacao;
  data: string; // ISO
  insumoId: string | null;
  insumoNome: string;
  quantidade: number;
  valorTotal: number;
  origem: OrigemMovimentacao;
}

interface MontarInput {
  entradas: EntradaMaterial[];
  pecas: OSPeca[];
  oleos: OSOleo[];
  insumoNomePorId: Map<string, string>;
  tipoOleoNomePorId: Map<string, string>;
  osNumeroPorId: Map<string, string>;
}

const SEM_NOME = 'Peça não identificada';

export function montarMovimentacoes(input: MontarInput): Movimentacao[] {
  const { entradas, pecas, oleos, insumoNomePorId, tipoOleoNomePorId, osNumeroPorId } = input;

  const movs: Movimentacao[] = [];

  for (const e of entradas) {
    movs.push({
      id: e.id,
      tipo: 'entrada',
      data: e.dataHora,
      insumoId: e.insumoId,
      insumoNome: insumoNomePorId.get(e.insumoId) ?? SEM_NOME,
      quantidade: e.quantidade,
      valorTotal: e.valorTotal,
      origem: { kind: 'nf', notaFiscal: e.notaFiscal },
    });
  }

  for (const p of pecas) {
    if (p.status === 'devolvida') continue;
    const numero = osNumeroPorId.get(p.osId);
    if (!numero) continue; // OS excluída → saldo já estornado
    movs.push({
      id: p.id,
      tipo: 'saida',
      data: p.createdAt,
      insumoId: p.insumoId,
      insumoNome: insumoNomePorId.get(p.insumoId) ?? SEM_NOME,
      quantidade: p.quantidade,
      valorTotal: p.custoTotal,
      origem: { kind: 'os', osId: p.osId, osNumero: numero },
    });
  }

  for (const o of oleos) {
    const numero = osNumeroPorId.get(o.osId);
    if (!numero) continue;
    const nome = o.insumoId
      ? insumoNomePorId.get(o.insumoId) ?? SEM_NOME
      : tipoOleoNomePorId.get(o.tipoOleoId) ?? SEM_NOME;
    movs.push({
      id: o.id,
      tipo: 'saida',
      data: o.createdAt,
      insumoId: o.insumoId ?? null,
      insumoNome: nome,
      quantidade: o.quantidade,
      valorTotal: o.valorTotal,
      origem: { kind: 'os', osId: o.osId, osNumero: numero },
    });
  }

  // Mais recente primeiro; desempata por id pra ordem estável.
  movs.sort((a, b) => {
    if (a.data !== b.data) return a.data < b.data ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });

  return movs;
}

/** Saldo do insumo/depósito depois de remover uma entrada de `qtdEntrada`. */
export function saldoAposExcluirEntrada(saldoAtual: number, qtdEntrada: number): number {
  return saldoAtual - qtdEntrada;
}

/** Saldo depois de trocar a quantidade de uma entrada de `qtdAntiga` para `qtdNova`. */
export function saldoAposEditarEntrada(saldoAtual: number, qtdAntiga: number, qtdNova: number): number {
  return saldoAtual + (qtdNova - qtdAntiga);
}

/** Mensagem de bloqueio quando a operação deixaria o saldo negativo; null se ok. */
export function mensagemSaldoNegativo(saldoResultante: number): string | null {
  if (saldoResultante < 0) {
    return 'Essa peça já foi consumida em serviço; alterar essa entrada deixaria o saldo negativo.';
  }
  return null;
}
