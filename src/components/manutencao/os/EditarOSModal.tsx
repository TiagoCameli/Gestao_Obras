// Editar o cabeçalho de um serviço já lançado (máquina, data, tipo, horímetro,
// descrição). Espelho do NovaOSModal, pré-preenchido, gravando via useAtualizarOS.
// Peças/terceiros/óleos e custos são independentes (não passam por aqui).

import { useState, useCallback, useMemo, type FormEvent } from 'react';
import type { Equipamento, OrdemServico, TipoOS } from '../../../types';
import { TIPO_OS_LABEL } from '../../../types';
import Modal from '../../ui/Modal';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import FilterCombobox from '../../ui/FilterCombobox';
import { useAtualizarOS } from '../../../hooks/useOrdensServico';
import { useAuth } from '../../../contexts/AuthContext';
import { dataParaInput, montarOSEditada } from './editarOS';

interface Props {
  open: boolean;
  onClose: () => void;
  os: OrdemServico;
  equipamentos: Equipamento[];
}

const TIPO_OPTIONS: { value: TipoOS; label: string }[] =
  (Object.keys(TIPO_OS_LABEL) as TipoOS[]).map((k) => ({ value: k, label: TIPO_OS_LABEL[k] }));

export default function EditarOSModal({ open, onClose, os, equipamentos }: Props) {
  const { usuario, temAcao } = useAuth();
  const atualizarMutation = useAtualizarOS();

  const [equipamentoId, setEquipamentoId] = useState(os.equipamentoId);
  const [dataServico, setDataServico] = useState(() => dataParaInput(os.dataConclusao ?? os.dataInicioExecucao));
  const [tipo, setTipo] = useState<TipoOS>(os.tipo);
  const [medicaoAbertura, setMedicaoAbertura] = useState(
    os.medicaoAbertura != null ? String(os.medicaoAbertura) : ''
  );
  const [descricao, setDescricao] = useState(os.solucaoAplicada ?? '');
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const equipamentosOrdenados = useMemo(
    () => equipamentos
      .filter((e) => (e.ativo !== false && e.id !== 'desconhecido') || e.id === os.equipamentoId)
      .sort((a, b) => a.nome.localeCompare(b.nome)),
    [equipamentos, os.equipamentoId]
  );

  const podeSalvar = !!equipamentoId && !!tipo && !!descricao.trim();
  const canEditar = temAcao('editar_os');

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (!canEditar) { setErro('Sem permissão para editar o serviço.'); return; }
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      await atualizarMutation.mutateAsync(
        montarOSEditada(os, {
          equipamentoId,
          dataInput: dataServico,
          tipo,
          medicaoAbertura,
          descricao,
          usuarioNome: usuario?.nome ?? '',
        })
      );
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar alterações');
    } finally {
      setSubmitting(false);
    }
  }, [
    canEditar, podeSalvar, submitting, atualizarMutation, os, equipamentoId,
    dataServico, tipo, medicaoAbertura, descricao, usuario, onClose,
  ]);

  return (
    <Modal open={open} onClose={onClose} title="Editar serviço" size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Máquina */}
        <div>
          <label htmlFor="editSvcEquip" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
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
            id="editSvcData"
            type="date"
            value={dataServico}
            onChange={(e) => setDataServico(e.target.value)}
            required
          />

          {/* Tipo */}
          <Select
            label="Tipo"
            id="editSvcTipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoOS)}
            options={TIPO_OPTIONS}
            required
          />
        </div>

        {/* Horímetro / km */}
        <Input
          label="Horímetro / km (opcional)"
          id="editSvcMedicao"
          type="number"
          step="any"
          min="0"
          value={medicaoAbertura}
          onChange={(e) => setMedicaoAbertura(e.target.value)}
          placeholder="Ex.: 4523"
        />

        {/* Descrição do serviço */}
        <div>
          <label htmlFor="editSvcDescricao" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Descrição do serviço <span className="text-[var(--color-danger)]">*</span>
          </label>
          <textarea
            id="editSvcDescricao"
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
            {submitting ? 'Salvando…' : 'Salvar alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
