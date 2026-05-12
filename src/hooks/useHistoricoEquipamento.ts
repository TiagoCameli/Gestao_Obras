// Marco 1 / PR8 — Hook que monta timeline cronológica unificada do equipamento.
//
// Fontes:
//   1. historico_status_equipamento (transições de status)
//   2. saidas_combustivel (abastecimentos do equipamento)
//   3. apontamentos (horas trabalhadas)
//   4. medicoes_equipamento (leituras de horímetro/km com origem 'manual')
//   5. documentos_equipamento (CRLV, IPVA, seguro etc. — só created_at)
//
// Estratégia: 5 queries em paralelo via Promise.all, depois merge + sort
// no client. Volume típico por equipamento é baixo (centenas de linhas
// máx), então não compensa fazer view SQL agora.

import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { StatusEquipamento } from '../types';
import { STATUS_EQUIPAMENTO_LABEL, TIPO_DOCUMENTO_LABEL } from '../types';
import type { TipoDocumentoEquipamento } from '../types';

export type TipoEventoHistorico =
  | 'status'
  | 'abastecimento'
  | 'apontamento'
  | 'medicao'
  | 'documento';

export interface EventoHistorico {
  id: string;
  tipo: TipoEventoHistorico;
  data: string;
  titulo: string;
  descricao: string;
  valor: string;
  autor: string;
}

export function useHistoricoEquipamento(equipamentoId: string | null | undefined) {
  return useQuery<EventoHistorico[]>({
    queryKey: ['historico_equipamento', equipamentoId ?? ''],
    enabled: !!equipamentoId,
    queryFn: async () => {
      const eqId = equipamentoId!;

      const [statusRes, saidasRes, apontRes, medsRes, docsRes] = await Promise.all([
        supabase
          .from('historico_status_equipamento')
          .select('id, equipamento_id, status_de, status_para, motivo, observacoes, created_at, created_by')
          .eq('equipamento_id', eqId)
          .order('created_at', { ascending: false }),
        supabase
          .from('saidas_combustivel')
          .select('id, data, litros, valor_total, tipo_combustivel, motorista, observacoes, created_by')
          .eq('equipamento_id', eqId)
          .is('deleted_at', null)
          .order('data', { ascending: false })
          .limit(500),
        supabase
          .from('apontamentos')
          .select('id, data, hora_inicio, hora_fim, horas_trabalhadas, tipo, observacoes, criado_por, status')
          .eq('equipamento_id', eqId)
          .order('data', { ascending: false })
          .limit(500),
        supabase
          .from('medicoes_equipamento')
          .select('id, data, valor, tipo_medicao, origem, observacoes, created_by')
          .eq('equipamento_id', eqId)
          .eq('origem', 'manual')
          .is('deleted_at', null)
          .order('data', { ascending: false }),
        supabase
          .from('documentos_equipamento')
          .select('id, tipo, numero, emissao, vencimento, created_at, created_by, observacoes')
          .eq('equipamento_id', eqId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);

      if (statusRes.error) throw statusRes.error;
      if (saidasRes.error) throw saidasRes.error;
      if (apontRes.error) throw apontRes.error;
      if (medsRes.error) throw medsRes.error;
      if (docsRes.error) throw docsRes.error;

      const eventos: EventoHistorico[] = [];

      // 1) Status
      for (const r of statusRes.data ?? []) {
        const de = r.status_de
          ? STATUS_EQUIPAMENTO_LABEL[r.status_de as StatusEquipamento]
          : 'inicial';
        const para = STATUS_EQUIPAMENTO_LABEL[r.status_para as StatusEquipamento];
        eventos.push({
          id: `status-${r.id}`,
          tipo: 'status',
          data: r.created_at,
          titulo: `${de} → ${para}`,
          descricao: r.motivo || r.observacoes || '',
          valor: '',
          autor: r.created_by ?? '',
        });
      }

      // 2) Saídas combustível
      for (const r of saidasRes.data ?? []) {
        const litros = Number(r.litros ?? 0);
        const valor = Number(r.valor_total ?? 0);
        eventos.push({
          id: `abast-${r.id}`,
          tipo: 'abastecimento',
          data: r.data,
          titulo: `Abastecimento — ${litros.toLocaleString('pt-BR')} L`,
          descricao: r.motorista
            ? `${r.observacoes || ''} ${r.motorista ? `· Motorista: ${r.motorista}` : ''}`.trim()
            : (r.observacoes || ''),
          valor: valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
          autor: r.created_by ?? '',
        });
      }

      // 3) Apontamentos (horas trabalhadas)
      for (const r of apontRes.data ?? []) {
        const horas = Number(r.horas_trabalhadas ?? 0);
        if (horas <= 0) continue; // ignora apontamentos sem horas
        const tipoLabel = r.tipo === 'ausencia' ? 'Ausência'
          : r.tipo === 'normal' ? 'Trabalho normal'
          : r.tipo;
        eventos.push({
          id: `apont-${r.id}`,
          tipo: 'apontamento',
          data: `${r.data}T${r.hora_inicio || '00:00'}:00`,
          titulo: `${tipoLabel} — ${horas.toLocaleString('pt-BR')} h`,
          descricao: [
            r.hora_inicio && r.hora_fim ? `${r.hora_inicio} → ${r.hora_fim}` : '',
            r.observacoes,
          ].filter(Boolean).join(' · '),
          valor: '',
          autor: r.criado_por ?? '',
        });
      }

      // 4) Medições manuais
      for (const r of medsRes.data ?? []) {
        const valor = Number(r.valor ?? 0);
        const unidade = r.tipo_medicao === 'horimetro' ? 'h' : 'km';
        eventos.push({
          id: `med-${r.id}`,
          tipo: 'medicao',
          data: r.data,
          titulo: `Leitura manual — ${valor.toLocaleString('pt-BR')} ${unidade}`,
          descricao: r.observacoes || '',
          valor: '',
          autor: r.created_by ?? '',
        });
      }

      // 5) Documentos cadastrados
      for (const r of docsRes.data ?? []) {
        const label = TIPO_DOCUMENTO_LABEL[r.tipo as TipoDocumentoEquipamento] ?? r.tipo;
        eventos.push({
          id: `doc-${r.id}`,
          tipo: 'documento',
          data: r.created_at,
          titulo: `Documento ${label}${r.numero ? ` #${r.numero}` : ''}`,
          descricao: [
            r.emissao ? `Emissão: ${r.emissao.slice(0, 10).split('-').reverse().join('/')}` : '',
            r.vencimento ? `Vencimento: ${r.vencimento.slice(0, 10).split('-').reverse().join('/')}` : '',
            r.observacoes,
          ].filter(Boolean).join(' · '),
          valor: '',
          autor: r.created_by ?? '',
        });
      }

      // Sort cronológico decrescente
      eventos.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));

      return eventos;
    },
  });
}
