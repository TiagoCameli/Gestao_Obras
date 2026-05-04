// COMPAT SHIM — Fase 3.
//
// Hook legado que ANTES lia/escrevia em `abastecimentos`. AGORA lê e escreve
// em `saidas_combustivel` filtrado por tipo_consumidor='equipamento_proprio'
// e converte os shapes pra que componentes legados (AbastecimentoForm,
// AbastecimentoList, FrotaCombustivelContainer etc) continuem funcionando
// sem mudança até a Fase 4 colapsá-los no SaidaCombustivelForm novo.
//
// Após Fase 5 (drop da tabela `abastecimentos` e do tipo Abastecimento):
// remover este arquivo + atualizar consumers pra usar useSaidasCombustivel
// direto com SaidaCombustivel.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Abastecimento } from '../types';

// IDs de queryKey invalidados em qualquer mutation desta família
// (ver tech-debt #6 — mantém cache coerente entre app legado e novo).
const INVALIDATE_KEYS: readonly (readonly string[])[] = [
  ['saidas_combustivel'],
  ['transportadora_movimentos'],
  ['transportadora_saldos'],
  ['abastecimentos'],
  ['abastecimentos_carreta'],
  ['depositos'], // legado já invalidava esta — preservar
];

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  for (const k of INVALIDATE_KEYS) qc.invalidateQueries({ queryKey: k });
}

/** Converte uma row de saidas_combustivel pro shape legado Abastecimento.
 *  Campos do shape antigo derivados/preenchidos com defaults compatíveis. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToAbastecimentoLegado(row: any): Abastecimento {
  // Sentinel 'desconhecido' (tech-debt #8): trata como vazio no shape legado
  // pra que UI antiga não mostre o sentinel ao usuário.
  const equipId = row.equipamento_id === 'desconhecido' ? '' : (row.equipamento_id ?? '');
  return {
    id: row.id,
    dataHora: row.data,
    tipoCombustivel: row.tipo_combustivel ?? '',
    quantidadeLitros: Number(row.litros),
    valorTotal: Number(row.valor_total),
    obraId: row.obra_id ?? '',
    etapaId: row.etapa_id ?? '',
    alocacoes: row.alocacoes ?? [],
    depositoId: row.tanque_id ?? '',
    equipamentoId: equipId,
    veiculo: '', // campo legado descartado no schema novo
    fotosUrls: row.foto_urls ?? [],
    observacoes: row.observacoes ?? '',
    criadoPor: row.created_by ?? '',
    origemCombustivel: row.origem ?? 'tanque',
    fornecedor: '', // campo legado descartado
    pago: row.pago ?? false,
    dataPagamento: row.pago_em ?? '',
    pagoPor: '', // descartado (Q3) — se vier algo histórico em obs, fica
  };
}

/** Converte Abastecimento (shape legado) pra payload de saidas_combustivel.
 *  Sempre tipo_consumidor='equipamento_proprio'. Sentinel 'desconhecido'
 *  quando equipamentoId vazio (Q5 + tech-debt #8). */
function abastecimentoLegadoToSaidaPayload(a: Abastecimento) {
  return {
    id: a.id,
    data: a.dataHora,
    origem: a.origemCombustivel || 'tanque',
    tipo_consumidor: 'equipamento_proprio' as const,
    tanque_id: a.depositoId || null,
    equipamento_id: a.equipamentoId || 'desconhecido',
    transportadora_id: null,
    placa: null,
    motorista_id: null,
    obra_id: a.obraId || null,
    etapa_id: a.etapaId || null,
    alocacoes: a.alocacoes ?? null,
    tipo_combustivel: a.tipoCombustivel,
    litros: a.quantidadeLitros,
    preco_medio_tanque_snapshot:
      a.quantidadeLitros > 0 ? a.valorTotal / a.quantidadeLitros : 0,
    taxa_litro: 0,
    preco_unitario:
      a.quantidadeLitros > 0 ? a.valorTotal / a.quantidadeLitros : 0,
    valor_total: a.valorTotal,
    foto_urls: a.fotosUrls && a.fotosUrls.length > 0 ? a.fotosUrls : null,
    observacoes: a.observacoes || null,
    pago: a.pago ?? null,
    pago_em: a.dataPagamento && a.dataPagamento !== '' ? a.dataPagamento : null,
    movimento_id: null,
    created_by: a.criadoPor || null,
  };
}

export function useAbastecimentos() {
  return useQuery({
    queryKey: ['abastecimentos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saidas_combustivel')
        .select('*')
        .eq('tipo_consumidor', 'equipamento_proprio')
        .order('data', { ascending: false });
      if (error) throw error;
      return (data ?? []).map(rowToAbastecimentoLegado);
    },
  });
}

export function useAdicionarAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abastecimento: Abastecimento) => {
      const { error } = await supabase
        .from('saidas_combustivel')
        .insert(abastecimentoLegadoToSaidaPayload(abastecimento));
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useAtualizarAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (abastecimento: Abastecimento) => {
      const payload = abastecimentoLegadoToSaidaPayload(abastecimento);
      const { error } = await supabase
        .from('saidas_combustivel')
        .update(payload)
        .eq('id', abastecimento.id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useExcluirAbastecimento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('saidas_combustivel').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useMarcarAbastecimentoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, pagoPor }: { id: string; pagoPor: string }) => {
      // Schema novo não tem pago_por. Preserva nome em observacoes
      // se vier (defensivo — UI legada talvez ainda passe). Lê obs atual,
      // injeta sentinel "[pago por: X]" no fim, escreve.
      const now = new Date().toISOString();
      const { data: current, error: e1 } = await supabase
        .from('saidas_combustivel')
        .select('observacoes')
        .eq('id', id)
        .maybeSingle();
      if (e1) throw e1;
      const obsAntiga = current?.observacoes ?? '';
      const obsNova = pagoPor
        ? (obsAntiga ? `${obsAntiga}\n[pago por: ${pagoPor}]` : `[pago por: ${pagoPor}]`)
        : obsAntiga;

      const { error } = await supabase
        .from('saidas_combustivel')
        .update({ pago: true, pago_em: now, observacoes: obsNova || null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useDesmarcarAbastecimentoPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saidas_combustivel')
        .update({ pago: false, pago_em: null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
