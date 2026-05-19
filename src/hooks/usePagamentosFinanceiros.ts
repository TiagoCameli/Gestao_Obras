/**
 * usePagamentosFinanceiros — Registrar e estornar pagamento de parcela.
 *
 * Modelo v1: 1 parcela = 1 pagamento. Registrar pagamento marca a parcela
 * como `pago`. Estornar = hard delete do `financeiro_pagamento`, e a parcela
 * volta pra `em_aberto`.
 *
 * Ambas operações recalculam o `status` do lançamento pai (em_aberto /
 * pago_parcial / pago) baseado no novo conjunto de parcelas.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  pagamentoLancamentoToDb,
  parcelaLancamentoToDb,
} from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import { statusDoLancamento } from './useLancamentosFinanceiros';
import type {
  PagamentoLancamento,
  ParcelaLancamento,
  LancamentoFinanceiro,
} from '../types';

interface RegistrarParams {
  /** Parcela sendo paga. */
  parcela: ParcelaLancamento;
  /** Lançamento pai (necessário pra recalcular status). */
  lancamento: LancamentoFinanceiro;
  /** Dados do pagamento (sem id — geramos). */
  pagamento: Omit<PagamentoLancamento, 'id' | 'criadoPor' | 'criadoEm' | 'parcelaId'>;
}

export function useRegistrarPagamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async ({ parcela, lancamento, pagamento }: RegistrarParams) => {
      const agora = new Date().toISOString();
      const nomeUsuario = usuario?.nome ?? '';

      // 1) Insere pagamento
      const pagId = `fpag_${crypto.randomUUID()}`;
      const { error: errP } = await supabase
        .from('financeiro_pagamentos')
        .insert(pagamentoLancamentoToDb({
          id: pagId,
          parcelaId: parcela.id,
          dataPagamento: pagamento.dataPagamento,
          valor: pagamento.valor,
          formaPagamento: pagamento.formaPagamento,
          comprovanteUrl: pagamento.comprovanteUrl,
          observacoes: pagamento.observacoes,
          criadoPor: nomeUsuario,
          criadoEm: agora,
        }));
      if (errP) throw errP;

      // 2) Atualiza parcela pra 'pago'
      const parcelaAtualizada: ParcelaLancamento = {
        ...parcela,
        status: 'pago',
        dataPagamento: pagamento.dataPagamento,
        valorPago: pagamento.valor,
      };
      const { error: errPa } = await supabase
        .from('financeiro_parcelas')
        .update(parcelaLancamentoToDb(parcelaAtualizada))
        .eq('id', parcela.id);
      if (errPa) {
        // rollback do pagamento se falhar
        await supabase.from('financeiro_pagamentos').delete().eq('id', pagId);
        throw errPa;
      }

      // 3) Recalcula status do lançamento
      const novasParcelas = lancamento.parcelas.map((p) =>
        p.id === parcela.id ? parcelaAtualizada : p,
      );
      const novoStatus = statusDoLancamento(novasParcelas);
      if (novoStatus !== lancamento.status) {
        await supabase
          .from('financeiro_lancamentos')
          .update({
            status: novoStatus,
            atualizado_em: agora,
            atualizado_por: nomeUsuario,
          })
          .eq('id', lancamento.id);
      }

      return { pagamentoId: pagId, novoStatus };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos', vars.lancamento.id] });
      qc.invalidateQueries({ queryKey: ['financeiro_pagamentos'] });
    },
  });
}

interface EstornarParams {
  pagamento: PagamentoLancamento;
  parcela: ParcelaLancamento;
  lancamento: LancamentoFinanceiro;
}

export function useEstornarPagamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async ({ pagamento, parcela, lancamento }: EstornarParams) => {
      const agora = new Date().toISOString();

      // 1) Hard delete do pagamento
      const { error: errD } = await supabase
        .from('financeiro_pagamentos')
        .delete()
        .eq('id', pagamento.id);
      if (errD) throw errD;

      // 2) Parcela volta pra em_aberto
      const parcelaAtualizada: ParcelaLancamento = {
        ...parcela,
        status: 'em_aberto',
        dataPagamento: undefined,
        valorPago: undefined,
      };
      const { error: errPa } = await supabase
        .from('financeiro_parcelas')
        .update(parcelaLancamentoToDb(parcelaAtualizada))
        .eq('id', parcela.id);
      if (errPa) throw errPa;

      // 3) Recalcula status do lançamento
      const novasParcelas = lancamento.parcelas.map((p) =>
        p.id === parcela.id ? parcelaAtualizada : p,
      );
      const novoStatus = statusDoLancamento(novasParcelas);
      if (novoStatus !== lancamento.status) {
        await supabase
          .from('financeiro_lancamentos')
          .update({
            status: novoStatus,
            atualizado_em: agora,
            atualizado_por: usuario?.nome ?? null,
          })
          .eq('id', lancamento.id);
      }

      return { novoStatus };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos', vars.lancamento.id] });
      qc.invalidateQueries({ queryKey: ['financeiro_pagamentos'] });
    },
  });
}

/** Lista pagamentos de uma parcela (pra exibir histórico). */
export async function listarPagamentosParcela(parcelaId: string) {
  const { data, error } = await supabase
    .from('financeiro_pagamentos')
    .select('*')
    .eq('parcela_id', parcelaId)
    .order('data_pagamento', { ascending: false });
  if (error) throw error;
  return data ?? [];
}
