// Marco 2 / PR10 — Wizard simples de Nova OS.
//
// Campos essenciais: equipamento, tipo, prioridade, defeito reportado,
// sintomas (chips). Status inicial = 'aberta' (operador pode salvar como
// rascunho se quiser revisar depois). Diagnóstico, peças e mão de obra
// vêm no PR11 via tela de detalhe.

import { useState, useCallback, useMemo, type FormEvent } from 'react';
import type {
  Equipamento, OrdemServico, TipoOS, PrioridadeOS, StatusOS,
} from '../../../types';
import { TIPO_OS_LABEL, PRIORIDADE_OS_LABEL } from '../../../types';
import Modal from '../../ui/Modal';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import FilterCombobox from '../../ui/FilterCombobox';
import { useCriarOS } from '../../../hooks/useOrdensServico';
import { useMedicaoAtual } from '../../../hooks/useMedicoesEquipamento';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamentos: Equipamento[];
  equipamentoIdInicial?: string;
}

const SINTOMAS_SUGERIDOS = [
  'vazamento',
  'fumaça preta',
  'fumaça branca',
  'superaquecimento',
  'ruído anormal',
  'vibração',
  'perda de potência',
  'falha de partida',
  'alarme luminoso',
  'consumo alto',
];

const TIPO_OPTIONS: { value: TipoOS; label: string }[] =
  (Object.keys(TIPO_OS_LABEL) as TipoOS[]).map((k) => ({ value: k, label: TIPO_OS_LABEL[k] }));

const PRIORIDADE_OPTIONS: { value: PrioridadeOS; label: string }[] =
  (Object.keys(PRIORIDADE_OS_LABEL) as PrioridadeOS[]).map((k) => ({ value: k, label: PRIORIDADE_OS_LABEL[k] }));

export default function NovaOSModal({ open, onClose, equipamentos, equipamentoIdInicial }: Props) {
  const { usuario } = useAuth();
  const criarMutation = useCriarOS();

  const [equipamentoId, setEquipamentoId] = useState(equipamentoIdInicial ?? '');
  const [tipo, setTipo] = useState<TipoOS>('corretiva');
  const [prioridade, setPrioridade] = useState<PrioridadeOS>('media');
  const [defeitoReportado, setDefeitoReportado] = useState('');
  const [sintomas, setSintomas] = useState<string[]>([]);
  const [sintomaCustom, setSintomaCustom] = useState('');
  const [statusInicial, setStatusInicial] = useState<StatusOS>('aberta');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const equipamentosOrdenados = useMemo(
    () => equipamentos
      .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [equipamentos]
  );

  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId || null);

  function toggleSintoma(s: string) {
    setSintomas((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]);
  }

  function adicionarSintomaCustom() {
    const v = sintomaCustom.trim().toLowerCase();
    if (!v || sintomas.includes(v)) return;
    setSintomas([...sintomas, v]);
    setSintomaCustom('');
  }

  const podeSalvar = !!equipamentoId && !!tipo && !!prioridade && !!defeitoReportado.trim();

  const { temAcao } = useAuth();
  const canCriarOS = temAcao('criar_os');
  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canCriarOS) { setErro('Sem permissão para criar OS.'); return; }
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      await criarMutation.mutateAsync({
        os: {
          id: '',  // será preenchido no hook
          equipamentoId,
          tipo,
          prioridade,
          status: statusInicial,
          origem: 'manual',
          origemId: null,
          atividadeId: null,
          obraId: null,
          solicitanteId: '',
          responsavelId: '',
          fornecedorServicoId: null,
          dataPrevistaInicio: null,
          dataInicioExecucao: null,
          dataConclusao: null,
          prazoAtendimento: null,
          medicaoAbertura: medicaoAtual?.medicaoAtual ?? null,
          medicaoConclusao: null,
          paradaInicio: null,
          paradaFim: null,
          defeitoReportado: defeitoReportado.trim(),
          sintomas,
          sistemasAfetados: [],
          causaRaiz: '',
          solucaoAplicada: '',
          recomendacoes: '',
          custoPecas: 0,
          custoServicoTerceiro: 0,
          custoMaoObraPropria: 0,
          custoTerceiros: 0,
          custoOleos: 0,
          aprovadoPor: '',
          aprovadoEm: null,
          garantiaAcionada: false,
          fotoUrls: [],
          arquivoUrls: [],
          observacoes: '',
          createdAt: new Date().toISOString(),
          createdBy: usuario?.nome ?? '',
          updatedBy: usuario?.nome ?? '',
          updatedAt: new Date().toISOString(),
        } as Omit<OrdemServico, 'numero' | 'custoTotal' | 'dataAbertura'>,
      });
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao criar OS');
    } finally {
      setSubmitting(false);
    }
  }, [
    podeSalvar, submitting, criarMutation, equipamentoId, tipo, prioridade,
    statusInicial, defeitoReportado, sintomas, medicaoAtual, usuario, onClose,
  ]);

  return (
    <Modal open={open} onClose={onClose} title="Nova ordem de serviço" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label htmlFor="osEquip" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
              Equipamento <span className="text-[var(--color-danger)]">*</span>
            </label>
            <FilterCombobox
              value={equipamentoId}
              onChange={setEquipamentoId}
              options={equipamentosOrdenados.map((eq) => ({
                value: eq.id,
                label: eq.codigoPatrimonio ? `${eq.codigoPatrimonio} — ${eq.nome}` : eq.nome,
              }))}
              placeholder="Buscar por código ou nome"
            />
            {medicaoAtual && (
              <p className="mt-1 text-xs text-[var(--color-fg-subtle)]">
                Medição atual: {medicaoAtual.medicaoAtual.toLocaleString('pt-BR')}{' '}
                {medicaoAtual.tipoMedicao === 'horimetro' ? 'h' : 'km'} (será registrada na abertura)
              </p>
            )}
          </div>

          <Select
            label="Tipo"
            id="osTipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoOS)}
            options={TIPO_OPTIONS}
            required
          />

          <Select
            label="Prioridade"
            id="osPrio"
            value={prioridade}
            onChange={(e) => setPrioridade(e.target.value as PrioridadeOS)}
            options={PRIORIDADE_OPTIONS}
            required
          />
        </div>

        <div>
          <label htmlFor="osDefeito" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Defeito reportado <span className="text-[var(--color-danger)]">*</span>
          </label>
          <textarea
            id="osDefeito"
            rows={3}
            value={defeitoReportado}
            onChange={(e) => setDefeitoReportado(e.target.value)}
            placeholder="O que o operador relatou? Ex.: vazamento de óleo na lança ao operar."
            className="w-full min-h-[80px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Sintomas
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
                    'text-xs px-2.5 py-1 rounded-full border transition-colors ' +
                    (ativo
                      ? 'border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]'
                      : 'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:bg-[var(--color-surface-2)]')
                  }
                >
                  {s}
                </button>
              );
            })}
            {sintomas.filter((s) => !SINTOMAS_SUGERIDOS.includes(s)).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toggleSintoma(s)}
                className="text-xs px-2.5 py-1 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-fg)]"
              >
                {s} ✕
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-2">
            <input
              type="text"
              value={sintomaCustom}
              onChange={(e) => setSintomaCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); adicionarSintomaCustom(); }
              }}
              placeholder="Adicionar outro sintoma…"
              className="flex-1 h-[34px] rounded-lg px-3 py-1.5 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            />
            <Button type="button" variant="secondary" size="sm" onClick={adicionarSintomaCustom} disabled={!sintomaCustom.trim()}>
              Adicionar
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] cursor-pointer">
            <input
              type="radio"
              name="statusInicial"
              value="aberta"
              checked={statusInicial === 'aberta'}
              onChange={() => setStatusInicial('aberta')}
            />
            Abrir agora
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] cursor-pointer">
            <input
              type="radio"
              name="statusInicial"
              value="rascunho"
              checked={statusInicial === 'rascunho'}
              onChange={() => setStatusInicial('rascunho')}
            />
            Salvar como rascunho
          </label>
        </div>

        {erro && (
          <div className="rounded-lg border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-3 text-sm text-[var(--color-danger-fg)]">
            {erro}
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" disabled={!podeSalvar || submitting}>
            {submitting ? 'Criando…' : statusInicial === 'aberta' ? 'Criar e abrir' : 'Salvar rascunho'}
          </Button>
        </div>
      </form>

    </Modal>
  );
}
