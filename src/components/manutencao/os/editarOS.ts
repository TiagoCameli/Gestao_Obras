// Montagem pura do payload de edição de um serviço do caderno.
// Backend: useAtualizarOS grava todos os campos; aqui só sobrescrevemos os 5
// que o caderno captura (máquina, data, tipo, horímetro, descrição), preservando
// o resto (custos, peças/óleos são independentes, calculados por trigger).

import type { OrdemServico, TipoOS } from '../../../types';

/**
 * Deriva o valor do <input type="date"> (yyyy-mm-dd) a partir de uma data ISO
 * salva, usando as partes LOCAIS. É o inverso exato da convenção de gravação
 * (`new Date(input+'T12:00:00').toISOString()`): a âncora de meio-dia dá 12h de
 * folga pra cada lado, então nunca pula de dia no fuso do usuário. Nulo/inválido
 * cai pra hoje.
 */
export function dataParaInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  const y = base.getFullYear();
  const m = String(base.getMonth() + 1).padStart(2, '0');
  const day = String(base.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export interface CamposServicoEditado {
  equipamentoId: string;
  dataInput: string; // yyyy-mm-dd
  tipo: TipoOS;
  medicaoAbertura: string; // valor cru do input
  descricao: string;
  usuarioNome: string;
}

/** Converte o horímetro digitado (aceita vírgula) em número ou null. */
function parseMedicao(raw: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  const parsed = parseFloat(t.replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * Retorna uma cópia da OS com os campos do cabeçalho sobrescritos.
 * A data vai pros dois campos (início e conclusão) com âncora meio-dia, idêntico
 * ao NovaOSModal. `updatedAt` NÃO é tocado (fica pro banco, igual salvarDescricao).
 */
export function montarOSEditada(os: OrdemServico, campos: CamposServicoEditado): OrdemServico {
  const dataIso = new Date(campos.dataInput + 'T12:00:00').toISOString();
  return {
    ...os,
    equipamentoId: campos.equipamentoId,
    tipo: campos.tipo,
    medicaoAbertura: parseMedicao(campos.medicaoAbertura),
    dataInicioExecucao: dataIso,
    dataConclusao: dataIso,
    solucaoAplicada: campos.descricao.trim(),
    updatedBy: campos.usuarioNome,
  };
}
