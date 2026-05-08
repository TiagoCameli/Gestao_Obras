// Placeholder da aba "Equipamentos" / "Carretas" (analítica) — adapta
// rótulo e descrição ao mode atual. Implementação real chega em F2.

import { useCombustivelFilter } from './filters/FilterContext';
import ComingSoon from './ComingSoon';

export default function ConsumidoresPlaceholder() {
  const { state } = useCombustivelFilter();
  const isProprios = state.mode === 'proprios';
  return (
    <ComingSoon
      phase="F2"
      title={isProprios ? 'Análise por Equipamento' : 'Análise por Carreta'}
      description={
        isProprios
          ? 'Mini-perfil de consumo por máquina: total no período, consumo médio (L/h), comparativo vs categoria e marcação de equipamentos com consumo crescente.'
          : 'Mini-perfil de consumo por placa: total no período, ranking por transportadora, frequência de abastecimento e comparativo entre carretas da mesma frota.'
      }
    />
  );
}
