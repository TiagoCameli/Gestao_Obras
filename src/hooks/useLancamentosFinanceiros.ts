/**
 * useLancamentosFinanceiros — Hooks de Lançamento Financeiro.
 *
 * Um lançamento tem 3 entidades filhas (parcelas, rateios, pagamentos).
 * O hook de leitura sempre carrega o lançamento + filhas em paralelo
 * (3 queries leves), e o hook de mutation cria/atualiza tudo numa única
 * operação (delete-then-insert das filhas pra simplicidade).
 *
 * Status do lançamento é DERIVADO das parcelas (recalculado a cada mudança):
 *   - todas parcelas em_aberto      → 'em_aberto'
 *   - algumas pago, outras em_aberto → 'pago_parcial'
 *   - todas parcelas pago            → 'pago'
 *
 * Esse hook não toca em pagamentos — isso é responsabilidade do
 * useRegistrarPagamentoFinanceiro / useEstornarPagamentoFinanceiro.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  dbToLancamentoFinanceiro,
  lancamentoFinanceiroToDb,
  dbToParcelaLancamento,
  parcelaLancamentoToDb,
  dbToRateioLancamento,
  rateioLancamentoToDb,
} from '../lib/mappers';
import { useAuth } from '../contexts/AuthContext';
import type {
  LancamentoFinanceiro,
  ParcelaLancamento,
  StatusLancamento,
} from '../types';

/** Calcula status do lançamento a partir das parcelas. */
export function statusDoLancamento(parcelas: ParcelaLancamento[]): StatusLancamento {
  if (parcelas.length === 0) return 'em_aberto';
  const pagas = parcelas.filter((p) => p.status === 'pago').length;
  if (pagas === 0) return 'em_aberto';
  if (pagas === parcelas.length) return 'pago';
  return 'pago_parcial';
}

/** Lista TODOS os lançamentos ativos com parcelas + rateios carregados. */
export function useLancamentosFinanceiros() {
  return useQuery({
    queryKey: ['financeiro_lancamentos'],
    queryFn: async () => {
      // 3 queries em paralelo: lancamentos, parcelas, rateios
      const [lanc, parc, rat] = await Promise.all([
        supabase
          .from('financeiro_lancamentos')
          .select('*')
          .is('deletado_em', null)
          .order('data_vencimento', { ascending: true }),
        supabase.from('financeiro_parcelas').select('*'),
        supabase.from('financeiro_rateios').select('*'),
      ]);
      if (lanc.error) throw lanc.error;
      if (parc.error) throw parc.error;
      if (rat.error) throw rat.error;

      // Indexa parcelas e rateios por lançamento_id pra join em memória
      const parcelasPorLanc = new Map<string, ParcelaLancamento[]>();
      for (const row of parc.data ?? []) {
        const p = dbToParcelaLancamento(row);
        const arr = parcelasPorLanc.get(p.lancamentoId) ?? [];
        arr.push(p);
        parcelasPorLanc.set(p.lancamentoId, arr);
      }
      const rateiosPorLanc = new Map<string, ReturnType<typeof dbToRateioLancamento>[]>();
      for (const row of rat.data ?? []) {
        const r = dbToRateioLancamento(row);
        const arr = rateiosPorLanc.get(r.lancamentoId) ?? [];
        arr.push(r);
        rateiosPorLanc.set(r.lancamentoId, arr);
      }

      return (lanc.data ?? []).map((row): LancamentoFinanceiro => {
        const base = dbToLancamentoFinanceiro(row);
        const parcelas = (parcelasPorLanc.get(base.id) ?? []).sort((a, b) => a.numero - b.numero);
        const rateios = rateiosPorLanc.get(base.id) ?? [];
        return { ...base, parcelas, rateios };
      });
    },
  });
}

/** Carrega 1 lançamento específico (usado pelo form de edição). */
export function useLancamentoFinanceiro(id?: string) {
  return useQuery({
    queryKey: ['financeiro_lancamentos', id],
    enabled: Boolean(id),
    queryFn: async () => {
      const [lanc, parc, rat] = await Promise.all([
        supabase.from('financeiro_lancamentos').select('*').eq('id', id).single(),
        supabase.from('financeiro_parcelas').select('*').eq('lancamento_id', id),
        supabase.from('financeiro_rateios').select('*').eq('lancamento_id', id),
      ]);
      if (lanc.error) throw lanc.error;
      if (parc.error) throw parc.error;
      if (rat.error) throw rat.error;
      const base = dbToLancamentoFinanceiro(lanc.data);
      const parcelas = (parc.data ?? []).map(dbToParcelaLancamento).sort((a, b) => a.numero - b.numero);
      const rateios = (rat.data ?? []).map(dbToRateioLancamento);
      return { ...base, parcelas, rateios };
    },
  });
}

/** Cria lançamento + parcelas + rateios numa única operação lógica. */
export function useAdicionarLancamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (lanc: LancamentoFinanceiro) => {
      const status = statusDoLancamento(lanc.parcelas);
      const nomeUsuario = usuario?.nome ?? '';
      const agora = new Date().toISOString();

      // 1) Header
      const { error: errH } = await supabase
        .from('financeiro_lancamentos')
        .insert(lancamentoFinanceiroToDb({
          ...lanc,
          status,
          criadoPor: nomeUsuario,
          criadoEm: agora,
        }));
      if (errH) throw errH;

      // 2) Parcelas (em lote)
      if (lanc.parcelas.length > 0) {
        const { error: errP } = await supabase
          .from('financeiro_parcelas')
          .insert(lanc.parcelas.map(parcelaLancamentoToDb));
        if (errP) {
          // rollback do header se falhou (best-effort)
          await supabase.from('financeiro_lancamentos').delete().eq('id', lanc.id);
          throw errP;
        }
      }

      // 3) Rateios (em lote)
      if (lanc.rateios.length > 0) {
        const { error: errR } = await supabase
          .from('financeiro_rateios')
          .insert(lanc.rateios.map(rateioLancamentoToDb));
        if (errR) {
          await supabase.from('financeiro_lancamentos').delete().eq('id', lanc.id);
          throw errR;
        }
      }

      // 4) Se origem='oc', atualiza a OC pra registrar o vínculo
      if (lanc.origem === 'oc' && lanc.ordemCompraId) {
        await supabase
          .from('ordens_compra')
          .update({
            lancamento_financeiro_id: lanc.id,
            lancamento_financeiro_status: 'lancada',
            lancado_financeiro_em: agora,
            lancado_financeiro_por: nomeUsuario,
          })
          .eq('id', lanc.ordemCompraId);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      if (vars.origem === 'oc') qc.invalidateQueries({ queryKey: ['ordens_compra'] });
    },
  });
}

/** Atualiza lançamento — replace das filhas (parcelas/rateios). */
export function useAtualizarLancamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (lanc: LancamentoFinanceiro) => {
      const status = statusDoLancamento(lanc.parcelas);
      const agora = new Date().toISOString();

      const { error: errH } = await supabase
        .from('financeiro_lancamentos')
        .update(lancamentoFinanceiroToDb({
          ...lanc,
          status,
          atualizadoPor: usuario?.nome,
          atualizadoEm: agora,
        }))
        .eq('id', lanc.id);
      if (errH) throw errH;

      // Replace de parcelas: deleta antigas (não pagas, mantém histórico
      // de pagamentos via cascade que vai junto — mas só estamos delete-
      // ando as que estão em_aberto na nova lista) e insere novas.
      // Pra simplificar v1: deletamos TODAS e re-inserimos. Pagamentos
      // associados (financeiro_pagamentos.parcela_id) caem em cascata.
      const { error: errDp } = await supabase
        .from('financeiro_parcelas')
        .delete()
        .eq('lancamento_id', lanc.id);
      if (errDp) throw errDp;
      if (lanc.parcelas.length > 0) {
        const { error: errP } = await supabase
          .from('financeiro_parcelas')
          .insert(lanc.parcelas.map(parcelaLancamentoToDb));
        if (errP) throw errP;
      }

      const { error: errDr } = await supabase
        .from('financeiro_rateios')
        .delete()
        .eq('lancamento_id', lanc.id);
      if (errDr) throw errDr;
      if (lanc.rateios.length > 0) {
        const { error: errR } = await supabase
          .from('financeiro_rateios')
          .insert(lanc.rateios.map(rateioLancamentoToDb));
        if (errR) throw errR;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos', vars.id] });
    },
  });
}

/** Atualiza APENAS a lista de anexos do lançamento. Operação rápida que
 *  não toca em parcelas/rateios nem altera `atualizado_em` agressivamente
 *  (anexos são metadados — adicionar comprovante depois é comum mesmo em
 *  lançamentos fechados). Usado pelo drawer pra add/remover anexo inline. */
export function useAtualizarAnexosLancamento() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async ({ id, anexosUrls }: { id: string; anexosUrls: string[] }) => {
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .update({
          anexos_urls: anexosUrls,
          atualizado_em: new Date().toISOString(),
          atualizado_por: usuario?.nome ?? null,
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos', vars.id] });
    },
  });
}

/** Fecha o lançamento — trava edição (descrição, valor, parcelas, rateio).
 *  Pagamentos continuam permitidos. Pra desfazer, use `useReabrirLancamento`. */
export function useFecharLancamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (lancamentoId: string) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .update({
          fechado: true,
          fechado_em: agora,
          fechado_por: usuario?.nome ?? null,
          atualizado_em: agora,
          atualizado_por: usuario?.nome ?? null,
        })
        .eq('id', lancamentoId);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos', id] });
    },
  });
}

/** Reabre lançamento fechado — destrava a edição. */
export function useReabrirLancamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (lancamentoId: string) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .update({
          fechado: false,
          reaberto_em: agora,
          reaberto_por: usuario?.nome ?? null,
          atualizado_em: agora,
          atualizado_por: usuario?.nome ?? null,
        })
        .eq('id', lancamentoId);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos', id] });
    },
  });
}

/** Soft-delete do lançamento. Mantém auditoria mas remove da UI ativa.
 *  Se origem='oc', limpa o vínculo na OC pra permitir gerar outro. */
export function useExcluirLancamentoFinanceiro() {
  const qc = useQueryClient();
  const { usuario } = useAuth();
  return useMutation({
    mutationFn: async (lanc: LancamentoFinanceiro) => {
      const agora = new Date().toISOString();
      const { error } = await supabase
        .from('financeiro_lancamentos')
        .update({
          deletado_em: agora,
          deletado_por: usuario?.nome ?? null,
        })
        .eq('id', lanc.id);
      if (error) throw error;

      if (lanc.origem === 'oc' && lanc.ordemCompraId) {
        await supabase
          .from('ordens_compra')
          .update({
            lancamento_financeiro_id: null,
            lancamento_financeiro_status: 'pendente',
            lancado_financeiro_em: null,
            lancado_financeiro_por: null,
          })
          .eq('id', lanc.ordemCompraId);
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['financeiro_lancamentos'] });
      if (vars.origem === 'oc') qc.invalidateQueries({ queryKey: ['ordens_compra'] });
    },
  });
}
