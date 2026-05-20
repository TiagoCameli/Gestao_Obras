// Marco 5 PR27 + PR34 — Abertura rápida de OS pelo mobile.
//
// Operador relata defeito + até 5 fotos. Cria OS tipo='corretiva',
// status='aberta'. Online: chama RPC gerar_numero_os + upload paralelo
// de fotos + insert. Offline: enfileira na fila offline com array de
// blobs e sincroniza depois.

import { useState, type FormEvent } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Camera, X, AlertTriangle, FilePlus, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/ui/Button';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { enqueueOSNova } from '../../lib/offlineQueue';
import { indexedDBSuportado } from '../../lib/checklistsQueue';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/ui/Toast';
import type { PrioridadeOS } from '../../types';

const MAX_FOTOS = 5;

function gerarId(prefix: string) {
  return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const SINTOMAS_SUGERIDOS = [
  'vazamento', 'fumaça', 'superaquecimento', 'ruído anormal',
  'vibração', 'perda de potência', 'falha de partida', 'alarme',
];

interface FotoItem {
  file: File;
  preview: string;
}

export default function MAbrirOSPage() {
  const { equipamentoId } = useParams<{ equipamentoId: string }>();
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const { data: equipamentos = [] } = useEquipamentos();
  const equipamento = equipamentos.find((e) => e.id === equipamentoId);
  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId ?? null);

  const [defeito, setDefeito] = useState('');
  const [prioridade, setPrioridade] = useState<PrioridadeOS>('media');
  const [sintomas, setSintomas] = useState<string[]>([]);
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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

  function toggleSintoma(s: string) {
    setSintomas((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  }

  function adicionarFotos(files: FileList | null) {
    if (!files || files.length === 0) return;
    const novas: FotoItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue;
      novas.push({ file, preview: URL.createObjectURL(file) });
    }
    setFotos((curr) => {
      const combinado = [...curr, ...novas].slice(0, MAX_FOTOS);
      // Se truncou, revoga as URLs descartadas
      novas.slice(combinado.length - curr.length).forEach((f) => URL.revokeObjectURL(f.preview));
      return combinado;
    });
  }

  function removerFoto(index: number) {
    setFotos((curr) => {
      const removida = curr[index];
      if (removida) URL.revokeObjectURL(removida.preview);
      return curr.filter((_, i) => i !== index);
    });
  }

  const podeSalvar = !!defeito.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting || !equipamentoId || !equipamento) return;
    setErro(null);
    setSubmitting(true);
    try {
      const online = typeof navigator !== 'undefined' ? navigator.onLine : true;
      let usouFila = false;
      let numeroExibir: string | null = null;

      if (online) {
        try {
          const { data: numero, error: numErr } = await supabase.rpc('gerar_numero_os');
          if (numErr) throw numErr;

          const osId = gerarId('os');

          // Upload paralelo de todas as fotos
          const uploadResults = await Promise.all(
            fotos.map(async (foto, i) => {
              const ext = (foto.file.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
              const path = `os/${osId}-${i}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from('apontamento-fotos')
                .upload(path, foto.file, { contentType: foto.file.type });
              if (upErr) return null;
              const { data: signed } = await supabase.storage
                .from('apontamento-fotos')
                .createSignedUrl(path, 60 * 60);
              return signed?.signedUrl ?? null;
            })
          );
          const fotoUrls = uploadResults.filter((u): u is string => !!u);

          const now = new Date().toISOString();
          const { error: osErr } = await supabase.from('ordens_servico').insert({
            id: osId,
            numero,
            equipamento_id: equipamentoId,
            tipo: 'corretiva',
            prioridade,
            status: 'aberta',
            origem: 'manual',
            origem_id: null,
            atividade_id: null,
            obra_id: null,
            solicitante_id: '',
            responsavel_id: '',
            fornecedor_servico_id: null,
            data_prevista_inicio: null,
            data_inicio_execucao: null,
            data_conclusao: null,
            prazo_atendimento: null,
            medicao_abertura: medicaoAtual?.medicaoAtual ?? null,
            medicao_conclusao: null,
            parada_inicio: null,
            parada_fim: null,
            defeito_reportado: defeito.trim(),
            sintomas,
            sistemas_afetados: [],
            causa_raiz: '',
            solucao_aplicada: '',
            recomendacoes: '',
            custo_pecas: 0,
            custo_servico_terceiro: 0,
            custo_mao_obra_propria: 0,
            aprovado_por: '',
            aprovado_em: null,
            garantia_acionada: false,
            foto_urls: fotoUrls,
            arquivo_urls: [],
            observacoes: `Aberta via mobile por ${usuario?.nome ?? ''}`,
            data_abertura: now,
            created_by: usuario?.nome ?? '',
            updated_by: usuario?.nome ?? '',
          });
          if (osErr) throw osErr;
          numeroExibir = numero as string;
        } catch (err) {
          if (indexedDBSuportado()) {
            await enqueueOSNova({
              equipamentoId,
              equipamentoNome: equipamento.nome,
              tipo: 'corretiva',
              prioridade,
              defeitoReportado: defeito.trim(),
              sintomas,
              observacoes: '',
              fotoBlobs: fotos.map((f) => f.file),
              medicaoAbertura: medicaoAtual?.medicaoAtual ?? null,
              operadorFuncionarioId: usuario?.funcionarioId ?? null,
              operadorNome: usuario?.nome ?? '',
            });
            usouFila = true;
          } else {
            throw err;
          }
        }
      } else if (indexedDBSuportado()) {
        await enqueueOSNova({
          equipamentoId,
          equipamentoNome: equipamento.nome,
          tipo: 'corretiva',
          prioridade,
          defeitoReportado: defeito.trim(),
          sintomas,
          observacoes: '',
          fotoBlobs: fotos.map((f) => f.file),
          medicaoAbertura: medicaoAtual?.medicaoAtual ?? null,
          operadorFuncionarioId: usuario?.funcionarioId ?? null,
          operadorNome: usuario?.nome ?? '',
        });
        usouFila = true;
      } else {
        throw new Error('Sem internet e navegador sem suporte a fila offline.');
      }

      // Limpa previews
      fotos.forEach((f) => URL.revokeObjectURL(f.preview));

      showToast({
        kind: 'success',
        message: usouFila
          ? 'OS criada e salva localmente (sincronizará depois).'
          : `OS ${numeroExibir ?? 'criada'} aberta com sucesso.`,
      });
      navigate('/m');
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao abrir OS');
    } finally {
      setSubmitting(false);
    }
  }

  const podeAdicionarFoto = fotos.length < MAX_FOTOS;

  return (
    <div className="space-y-4 pb-24">
      <Link to={`/m/eq/${equipamento.id}`} className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
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
          Abrir ordem de serviço corretiva
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="osDefeito" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            O que está acontecendo? <span className="text-[var(--color-danger)]">*</span>
          </label>
          <textarea
            id="osDefeito"
            rows={4}
            value={defeito}
            onChange={(e) => setDefeito(e.target.value)}
            placeholder="Ex.: máquina travando com motor quente, fumaça branca pela manhã, freio fazendo barulho ao frear"
            className="w-full min-h-[100px] rounded-xl px-3 py-2 text-base bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Sintomas (toque pra marcar)
          </label>
          <div className="flex flex-wrap gap-1.5">
            {SINTOMAS_SUGERIDOS.map((s) => {
              const ativo = sintomas.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSintoma(s)}
                  className={
                    'text-xs px-3 py-1.5 rounded-full border transition-colors ' +
                    (ativo
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)]')
                  }
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1">
            Prioridade
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['baixa', 'media', 'alta'] as PrioridadeOS[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPrioridade(p)}
                className={
                  'h-11 rounded-xl text-sm font-medium border-2 transition-colors ' +
                  (prioridade === p
                    ? p === 'alta'
                      ? 'bg-[var(--color-danger)] text-white border-[var(--color-danger)]'
                      : p === 'media'
                      ? 'bg-[var(--color-warning)] text-white border-[var(--color-warning)]'
                      : 'bg-[var(--color-info)] text-white border-[var(--color-info)]'
                    : 'bg-[var(--color-surface-1)] text-[var(--color-fg)] border-[var(--color-border)]')
                }
              >
                {p === 'baixa' ? 'Baixa' : p === 'media' ? 'Média' : 'Alta'}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-xs font-medium text-[var(--color-fg-muted)]">
              Fotos do problema (até {MAX_FOTOS})
            </label>
            <span className="text-[11px] text-[var(--color-fg-subtle)]">
              {fotos.length}/{MAX_FOTOS}
            </span>
          </div>
          {fotos.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mb-2">
              {fotos.map((foto, i) => (
                <div key={foto.preview} className="relative aspect-square rounded-lg overflow-hidden bg-black/30 border border-[var(--color-border)]">
                  <img src={foto.preview} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removerFoto(i)}
                    className="absolute top-1 right-1 bg-black/70 text-white rounded-full p-1"
                    aria-label="Remover foto"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {podeAdicionarFoto && (
            <div className="grid grid-cols-2 gap-2">
              <label className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] text-sm font-medium text-[var(--color-fg)] cursor-pointer active:bg-[var(--color-surface-2)]">
                <Camera className="w-5 h-5" />
                Câmera
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="sr-only"
                  onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }}
                />
              </label>
              <label className="flex items-center justify-center gap-2 h-12 rounded-xl border-2 border-dashed border-[var(--color-border)] bg-[var(--color-surface-1)] text-sm font-medium text-[var(--color-fg)] cursor-pointer active:bg-[var(--color-surface-2)]">
                <ImageIcon className="w-5 h-5" />
                Galeria
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => { adicionarFotos(e.target.files); e.target.value = ''; }}
                />
              </label>
            </div>
          )}
        </div>

        {erro && (
          <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)] flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        <div className="fixed bottom-0 left-0 right-0 z-20 p-3 bg-[var(--color-bg)] border-t border-[var(--color-border)]">
          <Button type="submit" disabled={!podeSalvar || submitting} className="w-full h-12 text-base font-semibold">
            <FilePlus className="w-5 h-5" />
            {submitting ? 'Abrindo OS…' : 'Abrir ordem de serviço'}
          </Button>
        </div>
      </form>
    </div>
  );
}
