/**
 * insumoTipoVisual — Centraliza a lógica de classificação visual de itens em
 * pedidos / cotações / OCs, a partir do Insumo do catálogo.
 *
 * O sistema reconhece 4 tipos visuais:
 *  - material      → vai pra obras/depósitos
 *  - peca          → vai pra almoxarifado de peças (e opcionalmente vincula OS)
 *  - combustivel   → vai pra tanque
 *  - servico       → vai pra OS de manutenção / etapa de obra / sede
 *  - outros        → tratado como material (qualquer destino exceto tanque)
 *
 * As regras de destino permitido por tipo ficam aqui pra ser reutilizadas
 * pelos forms de Pedido, Cotação e OC.
 */
import type { Insumo, TipoDestinoOC } from '../types';

export type TipoVisual = 'material' | 'peca' | 'combustivel' | 'servico' | 'outros';

/**
 * Deriva o tipo visual a partir de um Insumo (que tem `tipo: string` + flag
 * `usadoEmManutencao`). Quando o insumo é undefined (texto livre), assume material.
 */
export function getTipoVisualInsumo(insumo: Insumo | undefined): TipoVisual {
  if (!insumo) return 'material';
  if (insumo.usadoEmManutencao) return 'peca';
  const t = (insumo.tipo || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (t === 'combustivel') return 'combustivel';
  if (t === 'servico' || t === 'mao de obra' || t === 'mao-de-obra') return 'servico';
  if (t === 'peca' || t === 'pecas') return 'peca';
  if (t === 'outros' || t === 'outro') return 'outros';
  // Fallback: tudo que não bateu é material
  return 'material';
}

/** Label em PT-BR para exibir no chip. */
export const TIPO_VISUAL_LABEL: Record<TipoVisual, string> = {
  material: 'Material',
  peca: 'Peça',
  combustivel: 'Combustível',
  servico: 'Serviço',
  outros: 'Outros',
};

/** Pequeno ícone emoji opcional usado no chip. */
export const TIPO_VISUAL_ICON: Record<TipoVisual, string> = {
  material: '',
  peca: '🔧 ',
  combustivel: '⛽ ',
  servico: '🛠 ',
  outros: '',
};

/**
 * Classes Tailwind do chip por tipo. Mantém consistência visual entre todos
 * os formulários e listas de compras.
 */
export const TIPO_VISUAL_CHIP_CLASS: Record<TipoVisual, string> = {
  material:
    'bg-emerald-100 text-emerald-800 border-emerald-300 ' +
    'dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800',
  peca:
    'bg-amber-100 text-amber-800 border-amber-300 ' +
    'dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-800',
  combustivel:
    'bg-sky-100 text-sky-800 border-sky-300 ' +
    'dark:bg-sky-950/40 dark:text-sky-200 dark:border-sky-800',
  servico:
    'bg-violet-100 text-violet-800 border-violet-300 ' +
    'dark:bg-violet-950/40 dark:text-violet-200 dark:border-violet-800',
  outros:
    'bg-slate-100 text-slate-800 border-slate-300 ' +
    'dark:bg-slate-900/60 dark:text-slate-200 dark:border-slate-700',
};

/**
 * Destinos permitidos por tipo de item.
 * Regras:
 *  - Peça        → SEMPRE almoxarifado de peças (manutenção)
 *  - Combustível → SEMPRE tanque
 *  - Serviço     → manutenção (OS) OU obra/etapa OU sede
 *  - Material/Outros → qualquer destino EXCETO tanque (tanque é só pra combustível)
 */
export function destinosPermitidos(tipo: TipoVisual): TipoDestinoOC[] {
  switch (tipo) {
    case 'peca':
      return ['manutencao_equipamento'];
    case 'combustivel':
      return ['tanque_combustivel'];
    case 'servico':
      return ['manutencao_equipamento', 'obra_etapa', 'sede'];
    case 'material':
    case 'outros':
    default:
      return ['obra_etapa', 'obra_deposito', 'deposito_central', 'sede', 'manutencao_equipamento'];
  }
}

/**
 * Destino padrão / forçado pra tipos com escolha única (peça e combustível).
 * Retorna undefined quando o usuário tem escolha (material/outros/serviço).
 */
export function destinoForcadoPorTipo(tipo: TipoVisual): TipoDestinoOC | undefined {
  if (tipo === 'peca') return 'manutencao_equipamento';
  if (tipo === 'combustivel') return 'tanque_combustivel';
  return undefined;
}

/**
 * Indica se um item deste tipo é tratado como SERVIÇO no domínio
 * (afeta como vai pra OC: serviço vai pra OS, demais viram material).
 */
export function ehServico(tipo: TipoVisual): boolean {
  return tipo === 'servico';
}
