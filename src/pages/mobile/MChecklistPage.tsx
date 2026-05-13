// Marco 5 / PR25a — Execução do checklist pré-uso pelo operador.
//
// Recebe :equipamentoId, carrega template ativo do tipo do equipamento e
// renderiza as perguntas em lista. Resposta padrão começa em branco (sem
// pre-marcação) para forçar atenção. Foto obrigatória + observação quando
// resposta = "nao". Botão "Concluir checklist" só habilita quando todas
// as perguntas obrigatórias foram respondidas e fotos exigidas anexadas.

import { useState, useMemo, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Camera, CheckCircle2, AlertTriangle, X, ChevronDown,
} from 'lucide-react';
import Button from '../../components/ui/Button';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import {
  useChecklistTemplateParaTipo,
  useChecklistPerguntas,
  useEnviarChecklist,
  type RespostaInput,
} from '../../hooks/useChecklists';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import {
  CATEGORIA_PERGUNTA_LABEL,
  type CategoriaPergunta,
  type RespostaChecklist,
} from '../../types';

interface RespostaState {
  resposta: RespostaChecklist | null;
  observacao: string;
  fotoBlob: Blob | null;
  fotoPreview: string | null;
}

export default function MChecklistPage() {
  const { equipamentoId } = useParams<{ equipamentoId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const { data: equipamentos = [] } = useEquipamentos();
  const equipamento = equipamentos.find((e) => e.id === equipamentoId);
  const { data: template, isLoading: loadingTpl } = useChecklistTemplateParaTipo(equipamento?.tipo);
  const { data: perguntas = [], isLoading: loadingPg } = useChecklistPerguntas(template?.id);
  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId ?? null);
  const enviar = useEnviarChecklist();

  const [respostas, setRespostas] = useState<Record<string, RespostaState>>({});
  const [obsGerais, setObsGerais] = useState('');
  const [medicaoLeitura, setMedicaoLeitura] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Inicializa respostas vazias quando perguntas carregam
  useEffect(() => {
    if (perguntas.length > 0 && Object.keys(respostas).length === 0) {
      const init: Record<string, RespostaState> = {};
      for (const p of perguntas) {
        init[p.id] = { resposta: null, observacao: '', fotoBlob: null, fotoPreview: null };
      }
      setRespostas(init);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perguntas.length]);

  const perguntasPorCategoria = useMemo(() => {
    const groups: Record<string, typeof perguntas> = {};
    for (const p of perguntas) {
      if (!groups[p.categoria]) groups[p.categoria] = [];
      groups[p.categoria].push(p);
    }
    return groups;
  }, [perguntas]);

  const stats = useMemo(() => {
    let respondidas = 0, nao = 0, naoCriticas = 0, faltaFoto = 0;
    for (const p of perguntas) {
      const r = respostas[p.id];
      if (!r || r.resposta === null) continue;
      respondidas++;
      if (r.resposta === 'nao') {
        nao++;
        if (p.critica) naoCriticas++;
        if (!r.fotoBlob) faltaFoto++;
        if (!r.observacao.trim()) faltaFoto++; // contagem leve: foto OU obs
      }
    }
    return { respondidas, total: perguntas.length, nao, naoCriticas, faltaFoto };
  }, [perguntas, respostas]);

  const podeConcluir =
    !!template &&
    stats.respondidas === stats.total &&
    perguntas.every((p) => {
      const r = respostas[p.id];
      if (!r) return false;
      if (r.resposta === 'nao') {
        // Obrigatório foto + observação em respostas "nao"
        return !!r.fotoBlob && !!r.observacao.trim();
      }
      return true;
    });

  function setResposta(perguntaId: string, patch: Partial<RespostaState>) {
    setRespostas((curr) => ({
      ...curr,
      [perguntaId]: { ...(curr[perguntaId] ?? {
        resposta: null, observacao: '', fotoBlob: null, fotoPreview: null,
      }), ...patch },
    }));
  }

  function setFoto(perguntaId: string, file: File | null) {
    if (!file) {
      setResposta(perguntaId, { fotoBlob: null, fotoPreview: null });
      return;
    }
    const preview = URL.createObjectURL(file);
    setResposta(perguntaId, { fotoBlob: file, fotoPreview: preview });
  }

  async function handleSubmit() {
    if (!template || !equipamentoId || !podeConcluir) return;
    setErro(null);
    setSubmitting(true);
    try {
      // Status: bloqueado se tem 'nao' crítico, com_pendencias se tem 'nao' sem ser crítico, ok se tudo sim
      let status: 'concluido' | 'concluido_com_pendencias' | 'bloqueado' = 'concluido';
      if (stats.naoCriticas > 0) status = 'bloqueado';
      else if (stats.nao > 0) status = 'concluido_com_pendencias';

      const respostasInput: RespostaInput[] = perguntas.map((p) => {
        const r = respostas[p.id]!;
        return {
          perguntaId: p.id,
          perguntaSnapshot: p.pergunta,
          resposta: r.resposta!,
          observacao: r.observacao,
          fotoBlob: r.fotoBlob,
        };
      });

      const medicaoNum = medicaoLeitura.trim() ? Number(medicaoLeitura.replace(',', '.')) : null;

      await enviar.mutateAsync({
        templateId: template.id,
        templateVersao: template.versao,
        equipamentoId,
        operadorFuncionarioId: usuario?.funcionarioId ?? null,
        operadorNome: usuario?.nome ?? '',
        medicaoAtual: medicaoNum,
        status,
        observacoesGerais: obsGerais.trim(),
        respostas: respostasInput,
      });

      // Limpa preview URLs
      for (const r of Object.values(respostas)) {
        if (r.fotoPreview) URL.revokeObjectURL(r.fotoPreview);
      }

      showToast({
        kind: status === 'bloqueado' ? 'error' : status === 'concluido_com_pendencias' ? 'info' : 'success',
        message:
          status === 'bloqueado' ? 'Checklist concluído — equipamento BLOQUEADO. Aguarde manutenção.'
            : status === 'concluido_com_pendencias' ? 'Checklist concluído com pendências.'
            : 'Checklist concluído. Boa operação!',
      });
      navigate('/m');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar checklist');
    } finally {
      setSubmitting(false);
    }
  }

  if (!equipamento) {
    return (
      <div className="space-y-3">
        <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <p className="text-sm text-[var(--color-danger-fg)]">Equipamento não encontrado.</p>
      </div>
    );
  }

  if (loadingTpl || loadingPg) {
    return <p className="text-sm text-[var(--color-fg-muted)] py-8 text-center">Carregando…</p>;
  }

  if (!template) {
    return (
      <div className="space-y-3">
        <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--color-warning-fg)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-fg)]">
            Sem checklist disponível
          </p>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1">
            Não há template ativo para o tipo "{equipamento.tipo}".
            Procure o gerente para cadastrar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Header */}
      <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
        {equipamento.codigoPatrimonio && (
          <div className="text-[11px] font-mono text-[var(--color-fg-muted)]">
            {equipamento.codigoPatrimonio}
          </div>
        )}
        <h1 className="text-base font-semibold text-[var(--color-fg)] mt-0.5">
          {equipamento.nome}
        </h1>
        <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
          {equipamento.tipo}{equipamento.modelo && ` · ${equipamento.modelo}`}
        </p>
        <p className="text-[11px] text-[var(--color-fg-subtle)] mt-1.5">
          {template.nome}
        </p>
      </div>

      {/* Medição atual */}
      <div>
        <label htmlFor="medicaoLeitura" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
          Leitura do {equipamento.tipoMedicao === 'horimetro' ? 'horímetro' : 'odômetro'} (opcional)
        </label>
        <input
          id="medicaoLeitura"
          type="number"
          inputMode="decimal"
          step="0.01"
          value={medicaoLeitura}
          onChange={(e) => setMedicaoLeitura(e.target.value)}
          placeholder={medicaoAtual ? `Atual: ${medicaoAtual.medicaoAtual.toLocaleString('pt-BR')}` : 'Ex.: 1234'}
          className="w-full h-11 rounded-xl px-3 text-base bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
      </div>

      {/* Progresso */}
      <div className="rounded-xl bg-[var(--color-surface-1)] border border-[var(--color-border)] p-2.5 flex items-center gap-3">
        <div className="flex-1">
          <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">Progresso</div>
          <div className="text-sm font-semibold text-[var(--color-fg)]">
            {stats.respondidas} / {stats.total} {stats.respondidas === stats.total && '✓'}
          </div>
        </div>
        {stats.nao > 0 && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-[var(--color-danger-fg)]">Não</div>
            <div className="text-sm font-semibold text-[var(--color-danger-fg)]">{stats.nao}</div>
          </div>
        )}
        <div
          aria-hidden
          className="h-2 w-20 bg-[var(--color-surface-2)] rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[var(--color-accent)] transition-all"
            style={{ width: `${(stats.respondidas / Math.max(1, stats.total)) * 100}%` }}
          />
        </div>
      </div>

      {/* Perguntas por categoria */}
      <div className="space-y-4">
        {Object.entries(perguntasPorCategoria).map(([cat, perguntasDaCategoria]) => (
          <section key={cat}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-1.5 pl-1">
              {CATEGORIA_PERGUNTA_LABEL[cat as CategoriaPergunta] ?? cat}
            </h2>
            <div className="space-y-2">
              {perguntasDaCategoria.map((p) => {
                const r = respostas[p.id] ?? { resposta: null, observacao: '', fotoBlob: null, fotoPreview: null };
                const precisaFoto = r.resposta === 'nao';
                const incompleto = precisaFoto && (!r.fotoBlob || !r.observacao.trim());
                return (
                  <div
                    key={p.id}
                    className={
                      'rounded-xl border p-3 ' +
                      (r.resposta === 'sim' ? 'border-[var(--color-success)]/40 bg-[var(--color-success-soft)]'
                        : r.resposta === 'nao' ? 'border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)]'
                        : r.resposta === 'nao_aplica' ? 'border-[var(--color-border)] bg-[var(--color-surface-2)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-1)]')
                    }
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[var(--color-fg)]">
                          {p.pergunta}
                          {p.critica && (
                            <span className="ml-1.5 inline-block text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-danger)] text-white align-middle">
                              CRÍTICA
                            </span>
                          )}
                        </p>
                        {p.descricao && (
                          <p className="text-[11px] text-[var(--color-fg-muted)] mt-0.5">{p.descricao}</p>
                        )}
                      </div>
                    </div>

                    {/* Botões de resposta */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2.5">
                      <button
                        type="button"
                        onClick={() => setResposta(p.id, { resposta: 'sim' })}
                        className={
                          'h-11 rounded-xl text-sm font-semibold border-2 transition-colors ' +
                          (r.resposta === 'sim'
                            ? 'bg-[var(--color-success)] text-white border-[var(--color-success)]'
                            : 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border-[var(--color-border)] active:bg-[var(--color-surface-2)]')
                        }
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setResposta(p.id, { resposta: 'nao' })}
                        className={
                          'h-11 rounded-xl text-sm font-semibold border-2 transition-colors ' +
                          (r.resposta === 'nao'
                            ? 'bg-[var(--color-danger)] text-white border-[var(--color-danger)]'
                            : 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border-[var(--color-border)] active:bg-[var(--color-surface-2)]')
                        }
                      >
                        Não
                      </button>
                      <button
                        type="button"
                        onClick={() => setResposta(p.id, { resposta: 'nao_aplica' })}
                        className={
                          'h-11 rounded-xl text-xs font-semibold border-2 transition-colors ' +
                          (r.resposta === 'nao_aplica'
                            ? 'bg-[var(--color-fg-muted)] text-white border-[var(--color-fg-muted)]'
                            : 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border-[var(--color-border)] active:bg-[var(--color-surface-2)]')
                        }
                      >
                        N/A
                      </button>
                    </div>

                    {/* Foto + obs (apenas se "Nao") */}
                    {precisaFoto && (
                      <div className="mt-2.5 space-y-2">
                        <div>
                          <label className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1">
                            Foto da não-conformidade <span className="text-[var(--color-danger)]">*</span>
                          </label>
                          {r.fotoPreview ? (
                            <div className="relative">
                              <img
                                src={r.fotoPreview}
                                alt="Foto"
                                className="w-full max-h-48 object-contain rounded-lg border border-[var(--color-border)] bg-black/30"
                              />
                              <button
                                type="button"
                                onClick={() => setFoto(p.id, null)}
                                className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1"
                                aria-label="Remover foto"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <label
                              className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-[var(--color-danger)]/40 bg-[var(--color-surface-1)] text-sm font-medium text-[var(--color-fg)] active:bg-[var(--color-surface-2)] cursor-pointer"
                            >
                              <Camera className="w-5 h-5" />
                              Tirar foto
                              <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="sr-only"
                                onChange={(e) => setFoto(p.id, e.target.files?.[0] ?? null)}
                              />
                            </label>
                          )}
                        </div>
                        <div>
                          <label htmlFor={`obs-${p.id}`} className="block text-[11px] font-medium text-[var(--color-fg-muted)] mb-1">
                            O que está errado? <span className="text-[var(--color-danger)]">*</span>
                          </label>
                          <textarea
                            id={`obs-${p.id}`}
                            rows={2}
                            value={r.observacao}
                            onChange={(e) => setResposta(p.id, { observacao: e.target.value })}
                            placeholder="Ex.: óleo vazando na lança"
                            className="w-full min-h-[60px] rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                          />
                        </div>
                        {incompleto && (
                          <p className="text-[11px] text-[var(--color-warning-fg)]">
                            Foto e descrição são obrigatórias quando responde "Não".
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Observações gerais */}
      <div>
        <label htmlFor="obsGerais" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
          Observações gerais (opcional)
        </label>
        <textarea
          id="obsGerais"
          rows={2}
          value={obsGerais}
          onChange={(e) => setObsGerais(e.target.value)}
          placeholder="Algo a comentar sobre o equipamento hoje?"
          className="w-full min-h-[56px] rounded-xl px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
      </div>

      {erro && (
        <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
          {erro}
        </div>
      )}

      {/* Botão flutuante de envio */}
      <div className="fixed bottom-0 left-0 right-0 z-20 p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
        <Button
          onClick={handleSubmit}
          disabled={!podeConcluir || submitting}
          className="w-full h-12 text-base font-semibold"
        >
          {submitting ? 'Enviando…' : (
            <>
              <CheckCircle2 className="w-5 h-5" />
              {stats.naoCriticas > 0 ? 'Concluir (BLOQUEAR equip.)' : 'Concluir checklist'}
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
