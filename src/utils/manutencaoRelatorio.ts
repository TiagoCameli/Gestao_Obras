// Pure function: monta relatório de serviços por máquina.
// Sem side effects. Usada por Excel e PDF exports.

import type { OrdemServico } from '../types';
import { TIPO_OS_LABEL } from '../types';
import type { TipoOS } from '../types';

export interface LinhaRelatorio {
  numero: string;
  data: string;       // 'YYYY-MM-DD'
  tipo: string;       // label legível
  custoPecas: number;
  custoTerceiros: number;
  custoOleos: number;
  custoTotal: number;
}

export interface SubtotaisRelatorio {
  pecas: number;
  terceiros: number;
  oleos: number;
  total: number;
}

export interface RelatorioPorMaquina {
  linhas: LinhaRelatorio[];
  subtotais: SubtotaisRelatorio;
}

/**
 * Monta as linhas e subtotais para um relatório por máquina.
 *
 * Defensive: filtra para 'concluida' caso servicos já venha filtrado ou não.
 * `data` usa dataConclusao ?? dataAbertura.
 * `tipo` usa TIPO_OS_LABEL quando disponível.
 */
export function montarRelatorioPorMaquina(
  servicos: OrdemServico[],
): RelatorioPorMaquina {
  const concluidas = servicos.filter((s) => s.status === 'concluida');

  const linhas: LinhaRelatorio[] = concluidas.map((s) => ({
    numero: s.numero,
    data: (s.dataConclusao ?? s.dataAbertura ?? '').slice(0, 10),
    tipo: TIPO_OS_LABEL[s.tipo as TipoOS] ?? s.tipo,
    custoPecas: s.custoPecas ?? 0,
    custoTerceiros: s.custoTerceiros ?? 0,
    custoOleos: s.custoOleos ?? 0,
    custoTotal: s.custoTotal ?? 0,
  }));

  const subtotais: SubtotaisRelatorio = {
    pecas: linhas.reduce((acc, l) => acc + l.custoPecas, 0),
    terceiros: linhas.reduce((acc, l) => acc + l.custoTerceiros, 0),
    oleos: linhas.reduce((acc, l) => acc + l.custoOleos, 0),
    total: linhas.reduce((acc, l) => acc + l.custoTotal, 0),
  };

  return { linhas, subtotais };
}
