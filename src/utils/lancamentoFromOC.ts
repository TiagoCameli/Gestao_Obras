/**
 * lancamentoFromOC — Constrói um LancamentoFinanceiro pré-preenchido a partir
 * de uma OC aprovada.
 *
 * Como funciona o rateio derivado da OC:
 *   - Agrupa itens por chave (tipoDestino + obraId + etapaObraId + osId +
 *     equipamentoId + depositoDestinoId)
 *   - Pra cada grupo, soma o subtotal dos itens + a fatia rateada dos
 *     custos adicionais (frete/impostos/outras/desconto), proporcionalmente
 *     ao subtotal do grupo dentro do total da OC.
 *
 * Parcelas: usa as `oc.parcelas` quando presentes; senão, cria 1 parcela
 * única na `dataEntrega` (ou data atual + 30 dias) com o total geral.
 */
import type {
  OrdemCompra,
  LancamentoFinanceiro,
  ParcelaLancamento,
  RateioLancamento,
} from '../types';

function novoId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface GerarOpts {
  /** Número sequencial pré-calculado pelo chamador (ex: LF-2026-0001). */
  proximoNumero: string;
  /** Categoria default sugerida (id). */
  categoriaIdSugerida?: string;
  /** Empresa pagadora sugerida (vem do empresaFaturamento da OC). */
  empresaPagadoraId?: string;
}

export function lancamentoFromOC(
  oc: OrdemCompra,
  opts: GerarOpts,
): LancamentoFinanceiro {
  const lancId = novoId('flanc');

  // ─── 1) Calcular rateio: agrupa itens por destino ─────────────────
  type Chave = string;
  const grupos = new Map<Chave, {
    tipoDestino: OrdemCompra['itens'][0]['tipoDestino'];
    obraId?: string;
    etapaObraId?: string;
    osId?: string;
    equipamentoId?: string;
    depositoDestinoId?: string;
    subtotalItens: number;
  }>();

  for (const item of oc.itens) {
    const tipoDestino = item.tipoDestino ?? oc.tipoDestino ?? 'sede';
    const obraId = item.obraId || oc.obraId || undefined;
    const etapaObraId = item.etapaObraId || oc.etapaObraId || undefined;
    const osId = item.osId || undefined;
    const equipamentoId = item.equipamentoId || oc.equipamentoId || undefined;
    const depositoDestinoId = item.depositoDestinoId || oc.depositoDestinoId || undefined;
    const chave = `${tipoDestino}|${obraId ?? ''}|${etapaObraId ?? ''}|${osId ?? ''}|${equipamentoId ?? ''}|${depositoDestinoId ?? ''}`;
    const existente = grupos.get(chave);
    if (existente) {
      existente.subtotalItens += item.subtotal || 0;
    } else {
      grupos.set(chave, {
        tipoDestino,
        obraId,
        etapaObraId,
        osId,
        equipamentoId,
        depositoDestinoId,
        subtotalItens: item.subtotal || 0,
      });
    }
  }

  const totalItens = oc.totalMateriais || oc.itens.reduce((s, i) => s + (i.subtotal || 0), 0);
  // Custos adicionais líquidos (frete + outras + impostos - desconto) — vão
  // ser rateados proporcionalmente ao subtotal do grupo.
  const custosAdicionais =
    (oc.custosAdicionais?.frete ?? 0) +
    (oc.custosAdicionais?.outrasDespesas ?? 0) +
    (oc.custosAdicionais?.impostos ?? 0) -
    (oc.custosAdicionais?.desconto ?? 0);

  const rateios: RateioLancamento[] = Array.from(grupos.values()).map((g) => {
    const fatia = totalItens > 0
      ? g.subtotalItens + (custosAdicionais * (g.subtotalItens / totalItens))
      : g.subtotalItens;
    // Arredonda pra 2 casas pra evitar centavos errantes
    const valor = Math.round(fatia * 100) / 100;
    return {
      id: novoId('rat'),
      lancamentoId: lancId,
      tipoDestino: g.tipoDestino || 'sede',
      obraId: g.obraId,
      etapaObraId: g.etapaObraId,
      ordemServicoId: g.osId,
      equipamentoId: g.equipamentoId,
      depositoMaterialId: g.tipoDestino === 'tanque_combustivel' ? undefined : g.depositoDestinoId,
      depositoId: g.tipoDestino === 'tanque_combustivel' ? g.depositoDestinoId : undefined,
      valor,
    };
  });

  // Ajuste de centavos: força a soma do rateio bater com totalGeral (último item compensa)
  const totalGeral = oc.totalGeral || (totalItens + custosAdicionais);
  if (rateios.length > 0) {
    const somaRateios = rateios.reduce((s, r) => s + r.valor, 0);
    const diff = +(totalGeral - somaRateios).toFixed(2);
    if (Math.abs(diff) > 0.001) {
      rateios[rateios.length - 1].valor = +(rateios[rateios.length - 1].valor + diff).toFixed(2);
    }
  }

  // ─── 2) Parcelas: usa as da OC, senão cria 1 parcela única ────────
  let parcelas: ParcelaLancamento[];
  if (oc.parcelas && oc.parcelas.length > 0) {
    parcelas = oc.parcelas.map((p, i) => ({
      id: novoId('parc'),
      lancamentoId: lancId,
      numero: p.numero || i + 1,
      dataVencimento: p.data,
      valor: p.valor,
      status: 'em_aberto',
    }));
  } else {
    const venc = oc.dataEntrega || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    parcelas = [{
      id: novoId('parc'),
      lancamentoId: lancId,
      numero: 1,
      dataVencimento: venc,
      valor: totalGeral,
      status: 'em_aberto',
    }];
  }

  return {
    id: lancId,
    numero: opts.proximoNumero,
    origem: 'oc',
    ordemCompraId: oc.id,
    dataEmissao: new Date().toISOString().slice(0, 10),
    dataVencimento: parcelas[0]?.dataVencimento || new Date().toISOString().slice(0, 10),
    fornecedorId: oc.fornecedorId,
    favorecidoNome: '',
    empresaPagadoraId: opts.empresaPagadoraId,
    categoriaId: opts.categoriaIdSugerida,
    descricao: `OC ${oc.numero}${oc.observacoes ? ' — ' + oc.observacoes.slice(0, 80) : ''}`,
    valorTotal: totalGeral,
    formaPagamento: oc.formaPagamento || 'pix',
    observacoes: '',
    anexosUrls: [],
    status: 'em_aberto',
    parcelas,
    rateios,
  };
}

/**
 * Sugere a categoria padrão para a OC baseado no tipoDestino predominante
 * dos itens. Heurística simples: maior soma por tipoDestino.
 */
export function sugerirCategoriaFromOC(
  oc: OrdemCompra,
  categorias: { id: string; nome: string }[],
): string | undefined {
  const tipoToCategoria: Record<string, string> = {
    obra_etapa: 'Material de construção',
    obra_deposito: 'Material de construção',
    deposito_central: 'Material de construção',
    sede: 'Administrativo / Sede',
    manutencao_equipamento: 'Manutenção de equipamento',
    tanque_combustivel: 'Combustível',
  };
  const acc: Record<string, number> = {};
  for (const item of oc.itens) {
    const tipo = item.tipoDestino ?? oc.tipoDestino ?? 'sede';
    acc[tipo] = (acc[tipo] ?? 0) + (item.subtotal || 0);
  }
  const tipoPredominante = Object.entries(acc).sort(([, a], [, b]) => b - a)[0]?.[0];
  if (!tipoPredominante) return undefined;
  const nome = tipoToCategoria[tipoPredominante];
  return categorias.find((c) => c.nome === nome)?.id;
}
