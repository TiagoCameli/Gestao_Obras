// Marco 5 / PR25a — Hooks de checklists pré-uso.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type {
  ChecklistTemplate, ChecklistPergunta, ChecklistExecucao, ChecklistResposta,
  CategoriaPergunta, RespostaChecklist, StatusExecucaoChecklist,
} from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

function dbToTemplate(row: any): ChecklistTemplate {
  return {
    id: row.id,
    nome: row.nome ?? '',
    tipoEquipamento: row.tipo_equipamento ?? '',
    versao: Number(row.versao ?? 1),
    ativo: !!row.ativo,
    observacoes: row.observacoes ?? '',
    createdAt: row.created_at ?? '',
    createdBy: row.created_by ?? '',
    updatedAt: row.updated_at ?? '',
    updatedBy: row.updated_by ?? '',
  };
}

function dbToPergunta(row: any): ChecklistPergunta {
  return {
    id: row.id,
    templateId: row.template_id,
    ordem: Number(row.ordem ?? 0),
    categoria: (row.categoria ?? 'geral') as CategoriaPergunta,
    pergunta: row.pergunta ?? '',
    descricao: row.descricao ?? '',
    obrigatoria: !!row.obrigatoria,
    critica: !!row.critica,
  };
}

/** Lista templates ativos. */
export function useChecklistTemplates() {
  return useQuery({
    queryKey: ['checklists_template'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists_template')
        .select('*')
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('tipo_equipamento');
      if (error) throw error;
      return (data ?? []).map(dbToTemplate);
    },
  });
}

/** Encontra template ATIVO mais recente para um tipo de equipamento. */
export function useChecklistTemplateParaTipo(tipoEquipamento: string | null | undefined) {
  return useQuery({
    queryKey: ['checklist_template_tipo', tipoEquipamento ?? ''],
    enabled: !!tipoEquipamento,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklists_template')
        .select('*')
        .eq('tipo_equipamento', tipoEquipamento!)
        .eq('ativo', true)
        .is('deleted_at', null)
        .order('versao', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data ? dbToTemplate(data) : null;
    },
  });
}

/** Perguntas de um template, em ordem. */
export function useChecklistPerguntas(templateId: string | null | undefined) {
  return useQuery({
    queryKey: ['checklist_perguntas', templateId ?? ''],
    enabled: !!templateId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_perguntas')
        .select('*')
        .eq('template_id', templateId!)
        .order('ordem');
      if (error) throw error;
      return (data ?? []).map(dbToPergunta);
    },
  });
}

// Inputs do enviar checklist
export interface RespostaInput {
  perguntaId: string;
  perguntaSnapshot: string;
  resposta: RespostaChecklist;
  observacao: string;
  fotoBlob?: Blob | null;  // upload em sequência se houver
  fotoUrl?: string | null;  // se já foi pré-upload, passa a url
}

export interface EnviarChecklistInput {
  templateId: string;
  templateVersao: number;
  equipamentoId: string;
  operadorFuncionarioId: string | null;
  operadorNome: string;
  medicaoAtual: number | null;
  status: StatusExecucaoChecklist;
  observacoesGerais: string;
  respostas: RespostaInput[];
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

async function uploadFoto(execucaoId: string, perguntaId: string, blob: Blob): Promise<string> {
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  const path = `${execucaoId}/${perguntaId}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from('checklist-fotos')
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  // URL assinada de 1 hora (re-mint on demand pelo consumer)
  const { data: signed, error: signErr } = await supabase.storage
    .from('checklist-fotos')
    .createSignedUrl(path, 60 * 60);
  if (signErr) throw signErr;
  return signed.signedUrl;
}

/** Envia execução completa (1 execucao + N respostas + uploads de fotos). */
export function useEnviarChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnviarChecklistInput): Promise<{ execucaoId: string }> => {
      const execucaoId = gerarId();
      const agora = new Date().toISOString();

      // 1) Insere a execução
      const { error: execErr } = await supabase.from('checklist_execucoes').insert({
        id: execucaoId,
        template_id: input.templateId,
        template_versao: input.templateVersao,
        equipamento_id: input.equipamentoId,
        operador_funcionario_id: input.operadorFuncionarioId,
        operador_nome: input.operadorNome,
        medicao_atual: input.medicaoAtual,
        status: input.status,
        observacoes_gerais: input.observacoesGerais,
        os_gerada_id: null,
        iniciado_em: agora,
        concluido_em: agora,
        sincronizado_em: agora,
        created_by: input.operadorNome,
      });
      if (execErr) throw execErr;

      // 2) Upload de fotos (apenas para respostas "nao" que tem blob)
      const respostasComUrl: (RespostaInput & { fotoUrlFinal: string | null })[] = [];
      for (const r of input.respostas) {
        let fotoUrlFinal: string | null = r.fotoUrl ?? null;
        if (r.fotoBlob && r.resposta === 'nao') {
          fotoUrlFinal = await uploadFoto(execucaoId, r.perguntaId, r.fotoBlob);
        }
        respostasComUrl.push({ ...r, fotoUrlFinal });
      }

      // 3) Insere respostas em batch
      const respostasPayload = respostasComUrl.map((r) => ({
        id: gerarId(),
        execucao_id: execucaoId,
        pergunta_id: r.perguntaId,
        pergunta_snapshot: r.perguntaSnapshot,
        resposta: r.resposta,
        observacao: r.observacao,
        foto_url: r.fotoUrlFinal,
      }));
      const { error: respErr } = await supabase.from('checklist_respostas').insert(respostasPayload);
      if (respErr) throw respErr;

      return { execucaoId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['checklist_execucoes'] });
      qc.invalidateQueries({ queryKey: ['checklists_nao_conformidades'] });
    },
  });
}

/** Lista execuções recentes (admin view). */
export function useChecklistExecucoes(filtros?: {
  equipamentoId?: string;
  operadorId?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['checklist_execucoes', filtros ?? {}],
    queryFn: async () => {
      let q = supabase
        .from('checklist_execucoes')
        .select('*')
        .order('concluido_em', { ascending: false })
        .limit(filtros?.limit ?? 100);
      if (filtros?.equipamentoId) q = q.eq('equipamento_id', filtros.equipamentoId);
      if (filtros?.operadorId) q = q.eq('operador_funcionario_id', filtros.operadorId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((row: any): ChecklistExecucao => ({
        id: row.id,
        templateId: row.template_id,
        templateVersao: Number(row.template_versao ?? 1),
        equipamentoId: row.equipamento_id,
        operadorFuncionarioId: row.operador_funcionario_id ?? null,
        operadorNome: row.operador_nome ?? '',
        medicaoAtual: row.medicao_atual != null ? Number(row.medicao_atual) : null,
        status: (row.status ?? 'concluido') as StatusExecucaoChecklist,
        observacoesGerais: row.observacoes_gerais ?? '',
        osGeradaId: row.os_gerada_id ?? null,
        iniciadoEm: row.iniciado_em ?? '',
        concluidoEm: row.concluido_em ?? '',
        sincronizadoEm: row.sincronizado_em ?? '',
        createdAt: row.created_at ?? '',
        createdBy: row.created_by ?? '',
      }));
    },
  });
}

/** Respostas de uma execução. */
export function useChecklistRespostas(execucaoId: string | null | undefined) {
  return useQuery({
    queryKey: ['checklist_respostas', execucaoId ?? ''],
    enabled: !!execucaoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('checklist_respostas')
        .select('*')
        .eq('execucao_id', execucaoId!);
      if (error) throw error;
      return (data ?? []).map((row: any): ChecklistResposta => ({
        id: row.id,
        execucaoId: row.execucao_id,
        perguntaId: row.pergunta_id,
        perguntaSnapshot: row.pergunta_snapshot ?? '',
        resposta: (row.resposta ?? 'sim') as RespostaChecklist,
        observacao: row.observacao ?? '',
        fotoUrl: row.foto_url ?? null,
      }));
    },
  });
}
