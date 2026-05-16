/**
 * Validações de negócio para Ordens de Compra do módulo Compras v2.
 *
 * Regras de destino × tipo de item:
 *
 * | Destino                    | Material | Serviço | Campos extras                       |
 * | -------------------------- | -------- | ------- | ----------------------------------- |
 * | obra_etapa                 | ✅       | ✅      | obraId + etapaObraId obrigatórios   |
 * | obra_deposito              | ✅       | ❌      | obraId + depositoDestinoId          |
 * | deposito_central           | ✅       | ❌      | depositoDestinoId                   |
 * | sede                       | ✅       | ✅      | —                                   |
 * | manutencao_equipamento     | ✅*      | ✅      | equipamentoId; material passa pelo  |
 * |                            |          |         | almoxarifado (depositoDestinoId)    |
 */

import type { ItemOrdemCompra, OrdemCompra, TipoDestinoOC } from '../types';

export type ValidacaoResultado =
  | { ok: true }
  | { ok: false; erro: string; campo?: string };

export interface RegraDestino {
  aceitaMaterial: boolean;
  aceitaServico: boolean;
  exigeObra: boolean;
  exigeEtapa: boolean;
  exigeDeposito: boolean;
  exigeEquipamento: boolean;
  /** Para manutenção: material sempre passa pelo almoxarifado */
  geraEntradaDeposito: boolean;
  label: string;
}

export const REGRAS_DESTINO: Record<TipoDestinoOC, RegraDestino> = {
  obra_etapa: {
    aceitaMaterial: true,
    aceitaServico: true,
    exigeObra: true,
    exigeEtapa: true,
    exigeDeposito: false,
    exigeEquipamento: false,
    geraEntradaDeposito: false,
    label: 'Obra (etapa específica)',
  },
  obra_deposito: {
    aceitaMaterial: true,
    aceitaServico: false,
    exigeObra: true,
    exigeEtapa: false,
    exigeDeposito: true,
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Obra (depósito da obra)',
  },
  deposito_central: {
    aceitaMaterial: true,
    aceitaServico: false,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: true,
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Depósito Central',
  },
  sede: {
    aceitaMaterial: true,
    aceitaServico: true,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: false,
    exigeEquipamento: false,
    geraEntradaDeposito: false,
    label: 'Sede da empresa',
  },
  manutencao_equipamento: {
    // Material vai pro almoxarifado de peças (filtrado no select).
    // NÃO exige equipamento aqui — a peça será destinada ao equipamento
    // específico mais tarde, via Ordem de Serviço de manutenção.
    aceitaMaterial: true,
    aceitaServico: true,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: true, // almoxarifado de peças
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Manutenção de equipamento',
  },
  tanque_combustivel: {
    // Entrada de combustível: vai pro tanque e PRONTO. A distribuição
    // por obra/etapa é feita depois, via saída de combustível.
    aceitaMaterial: true, // combustível é "material" tipo "combustível"
    aceitaServico: false,
    exigeObra: false,
    exigeEtapa: false,
    exigeDeposito: true, // o "depósito" aqui é o tanque
    exigeEquipamento: false,
    geraEntradaDeposito: true,
    label: 'Tanque de combustível',
  },
};

export function regraDoDestino(destino: TipoDestinoOC): RegraDestino {
  return REGRAS_DESTINO[destino];
}

/**
 * Valida se um item específico é compatível com o destino da OC.
 */
export function validarItemNoDestino(
  item: ItemOrdemCompra,
  destino: TipoDestinoOC
): ValidacaoResultado {
  const regra = REGRAS_DESTINO[destino];
  const tipo = item.tipo ?? 'material';

  if (tipo === 'material' && !regra.aceitaMaterial) {
    return { ok: false, erro: `Destino "${regra.label}" não aceita materiais.` };
  }
  if (tipo === 'servico' && !regra.aceitaServico) {
    return { ok: false, erro: `Destino "${regra.label}" não aceita serviços.` };
  }
  return { ok: true };
}

/**
 * Validação completa da OC antes de salvar.
 */
export function validarOrdemCompra(oc: OrdemCompra): ValidacaoResultado {
  if (!oc.fornecedorId) {
    return { ok: false, erro: 'Selecione um fornecedor.', campo: 'fornecedorId' };
  }
  if (oc.itens.length === 0) {
    return { ok: false, erro: 'Adicione ao menos um item.', campo: 'itens' };
  }
  if (!oc.tipoDestino) {
    return { ok: false, erro: 'Selecione o destino da OC.', campo: 'tipoDestino' };
  }

  const regra = REGRAS_DESTINO[oc.tipoDestino];

  if (regra.exigeObra && !oc.obraId) {
    return { ok: false, erro: `Destino "${regra.label}" exige selecionar a obra.`, campo: 'obraId' };
  }
  if (regra.exigeEtapa && !oc.etapaObraId) {
    return { ok: false, erro: `Destino "${regra.label}" exige selecionar a etapa.`, campo: 'etapaObraId' };
  }
  if (regra.exigeDeposito && !oc.depositoDestinoId) {
    return {
      ok: false,
      erro: `Destino "${regra.label}" exige selecionar o depósito de entrada.`,
      campo: 'depositoDestinoId',
    };
  }
  if (regra.exigeEquipamento && !oc.equipamentoId) {
    return {
      ok: false,
      erro: `Destino "${regra.label}" exige indicar o equipamento.`,
      campo: 'equipamentoId',
    };
  }

  // Cada item precisa ser compatível com o destino
  for (const item of oc.itens) {
    const r = validarItemNoDestino(item, oc.tipoDestino);
    if (!r.ok) {
      return {
        ok: false,
        erro: `Item "${item.descricao || 'sem descrição'}" inválido: ${r.erro}`,
      };
    }
  }

  return { ok: true };
}

/**
 * Validação do pedido — exige itens OU descrição livre (modelo híbrido).
 */
export function validarPedidoCompra(pedido: {
  itens: { descricao?: string }[];
  descricaoLivre?: string;
  obraId?: string;
  solicitante?: string;
}): ValidacaoResultado {
  if (!pedido.solicitante?.trim()) {
    return { ok: false, erro: 'Informe o solicitante.', campo: 'solicitante' };
  }
  const temItens = pedido.itens.some((i) => (i.descricao ?? '').trim().length > 0);
  const temDescricao = (pedido.descricaoLivre ?? '').trim().length > 0;
  if (!temItens && !temDescricao) {
    return {
      ok: false,
      erro: 'Adicione ao menos um item OU escreva uma descrição livre do pedido.',
      campo: 'itens',
    };
  }
  return { ok: true };
}

/**
 * Detecta itens potencialmente duplicados (busca fuzzy simples) na base de Insumos.
 * Retorna a lista ordenada por similaridade (maior primeiro).
 */
export function buscarInsumosSimilares(
  termo: string,
  insumos: { id: string; nome: string; categoria?: string }[],
  limite: number = 5
): { id: string; nome: string; categoria?: string; similaridade: number }[] {
  const t = normalizar(termo);
  if (!t) return [];
  return insumos
    .map((i) => ({ ...i, similaridade: similaridade(t, normalizar(i.nome)) }))
    .filter((i) => i.similaridade > 0.55)
    .sort((a, b) => b.similaridade - a.similaridade)
    .slice(0, limite);
}

function normalizar(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Similaridade simples baseada em tokens compartilhados. 0..1. */
function similaridade(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const ta = new Set(a.split(' '));
  const tb = new Set(b.split(' '));
  const inter = [...ta].filter((x) => tb.has(x)).length;
  const uniao = new Set([...ta, ...tb]).size;
  return uniao === 0 ? 0 : inter / uniao;
}
