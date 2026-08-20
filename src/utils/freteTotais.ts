/**
 * Totais do rodapé da lista de fretes.
 *
 * O ponto delicado é o preço médio do material (R$/t). Ele é uma média
 * PONDERADA, e o denominador não pode ser a tonelagem toda:
 *
 *   - Frete de transferência move material que a EMT já tem. Carrega tonelada,
 *     mas valor de material zero — entrar no denominador puxaria o R$/t médio
 *     para baixo sem que preço nenhum tivesse mudado.
 *   - Frete de material lançado sem o valor unitário tem o mesmo efeito.
 *
 * Por isso o denominador é só a tonelagem que efetivamente carrega valor de
 * material. É a mesma leitura da coluna por linha, que mostra "—" quando o
 * valor de material é zero.
 */

export interface FreteParaTotais {
  pesoToneladas?: number | null;
  valorTotal?: number | null;
  valorMaterial?: number | null;
}

export interface TotaisFrete {
  peso: number;
  valor: number;
  valorMaterial: number;
  /** Tonelagem considerada no preço médio (só fretes com valor de material). */
  pesoComMaterial: number;
  /** R$/t médio ponderado. 0 quando não há tonelagem com material. */
  precoMedioMaterial: number;
}

export function calcularTotaisFrete(fretes: FreteParaTotais[]): TotaisFrete {
  let peso = 0;
  let valor = 0;
  let valorMaterial = 0;
  let pesoComMaterial = 0;

  for (const f of fretes) {
    const p = f.pesoToneladas ?? 0;
    const vm = f.valorMaterial ?? 0;
    peso += p;
    valor += f.valorTotal ?? 0;
    valorMaterial += vm;
    if (vm > 0) pesoComMaterial += p;
  }

  return {
    peso,
    valor,
    valorMaterial,
    pesoComMaterial,
    precoMedioMaterial: pesoComMaterial > 0 ? valorMaterial / pesoComMaterial : 0,
  };
}
