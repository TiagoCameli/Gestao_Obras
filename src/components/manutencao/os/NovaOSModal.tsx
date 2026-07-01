// Task 2.4 — Registrar serviço (form de cabeçalho).
//
// Cria apenas o cabeçalho do serviço. Ao salvar, navega pro detalhe (OSDetalhe)
// onde peças, terceiros e óleos são adicionados. Status fixo: 'concluida'.

import { useState, useCallback, useMemo, type FormEvent } from 'react';
import type { Equipamento, TipoOS } from '../../../types';
import { TIPO_OS_LABEL } from '../../../types';
import Modal from '../../ui/Modal';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import FilterCombobox from '../../ui/FilterCombobox';
import { useCriarOS } from '../../../hooks/useOrdensServico';
import { useAuth } from '../../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamentos: Equipamento[];
  equipamentoIdInicial?: string;
}

const TIPO_OPTIONS: { value: TipoOS; label: string }[] =
  (Object.keys(TIPO_OS_LABEL) as TipoOS[]).map((k) => ({ value: k, label: TIPO_OS_LABEL[k] }));

export default function NovaOSModal({ open, onClose, equipamentos, equipamentoIdInicial }: Props) {
  const { usuario, temAcao } = useAuth();
  const navigate = useNavigate();
  const criarMutation = useCriarOS();

  const [equipamentoId, setEquipamentoId] = useState(equipamentoIdInicial ?? '');
  const [dataServico, setDataServico] = useState(() => new Date().toISOString().slice(0, 10));
  const [tipo, setTipo] = useState<TipoOS>('corretiva');
  const [medicaoAbertura, setMedicaoAbertura] = useState('');
  const [descricao, setDescricao] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const equipamentosOrdenados = useMemo(
    () => equipamentos
      .filter((e) => e.ativo !== false && e.id !== 'desconhecido')
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [equipamentos]
  );

  const medicaoNum = medicaoAbertura ? parseFloat(medicaoAbertura.replace(',', '.')) || null : null;

  const podeSalvar = !!equipamentoId && !!tipo && !!descricao.trim();

  const canCriar = temAcao('criar_os');

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canCriar) { setErro('Sem permissão para registrar serviço.'); return; }
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      const agora = new Date().toISOString();
      const dataConclusao = dataServico
        ? new Date(dataServico + 'T12:00:00').toISOString()
        : agora;

      const os = await criarMutation.mutateAsync({
        os: {
          id: '',
          equipamentoId,
          tipo,
          prioridade: 'media',
          status: 'concluida',
          origem: 'manual',
          origemId: null,
          atividadeId: null,
          obraId: null,
          solicitanteId: '',
          responsavelId: '',
          fornecedorServicoId: null,
          dataPrevistaInicio: null,
          dataInicioExecucao: dataConclusao,
          dataConclusao,
          prazoAtendimento: null,
          medicaoAbertura: medicaoNum,
          medicaoConclusao: null,
          paradaInicio: null,
          paradaFim: null,
          defeitoReportado: descricao.trim(),
          sintomas: [],
          sistemasAfetados: [],
          causaRaiz: '',
          solucaoAplicada: descricao.trim(),
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
          createdAt: agora,
          createdBy: usuario?.nome ?? '',
          updatedBy: usuario?.nome ?? '',
          updatedAt: agora,
        },
      });
      onClose();
      navigate(`/manutencao/os/${os.numero}`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar serviço');
    } finally {
      setSubmitting(false);
    }
  }, [
    canCriar, podeSalvar, submitting, criarMutation, equipamentoId, tipo,
    dataServico, medicaoNum, descricao, usuario, onClose, navigate,
  ]);

  return (
    <Modal open={open} onClose={onClose} title="Registrar serviço" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Máquina */}
        <div>
          <label htmlFor="svcEquip" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Máquina <span className="text-[var(--color-danger)]">*</span>
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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Data do serviço */}
          <Input
            label="Data do serviço"
            id="svcData"
            type="date"
            value={dataServico}
            onChange={(e) => setDataServico(e.target.value)}
            required
          />

          {/* Tipo */}
          <Select
            label="Tipo"
            id="svcTipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoOS)}
            options={TIPO_OPTIONS}
            required
          />
        </div>

        {/* Horímetro / km */}
        <Input
          label="Horímetro / km (opcional)"
          id="svcMedicao"
          type="number"
          step="any"
          min="0"
          value={medicaoAbertura}
          onChange={(e) => setMedicaoAbertura(e.target.value)}
          placeholder="Ex.: 4523"
        />

        {/* Descrição do serviço */}
        <div>
          <label htmlFor="svcDescricao" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Descrição do serviço <span className="text-[var(--color-danger)]">*</span>
          </label>
          <textarea
            id="svcDescricao"
            rows={3}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="O que foi feito? Ex.: troca de filtro de óleo e óleo motor 15W40."
            className="w-full min-h-[80px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            required
          />
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
            {submitting ? 'Registrando…' : 'Registrar serviço'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
