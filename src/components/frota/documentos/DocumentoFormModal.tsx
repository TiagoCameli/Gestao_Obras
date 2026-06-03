// Marco 0 / PR3 — Form modal para criar/editar documento do equipamento.
//
// Campos: tipo (select), número, emissão (date), vencimento (date), valor,
// fornecedor opcional, observações, anexos (fotos + arquivos).
//
// Validação mínima: tipo é required. Demais opcionais — alguns docs (manual)
// não têm número/vencimento.

import { useState, useCallback, type FormEvent } from 'react';
import type {
  DocumentoEquipamento,
  TipoDocumentoEquipamento,
  Fornecedor,
} from '../../../types';
import { TIPO_DOCUMENTO_LABEL } from '../../../types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import SubmitButton from '../../ui/SubmitButton';
import AnexosUploader from '../../combustivel/AnexosUploader';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamentoId: string;
  fornecedores: Fornecedor[];
  initial?: DocumentoEquipamento | null;
  onSubmit: (doc: DocumentoEquipamento) => Promise<void>;
  usuarioNome: string;
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TIPO_OPTIONS = (Object.keys(TIPO_DOCUMENTO_LABEL) as TipoDocumentoEquipamento[]).map((k) => ({
  value: k,
  label: TIPO_DOCUMENTO_LABEL[k],
}));

export default function DocumentoFormModal({
  open,
  onClose,
  equipamentoId,
  fornecedores,
  initial,
  onSubmit,
  usuarioNome,
}: Props) {
  const [tipo, setTipo] = useState<TipoDocumentoEquipamento>(initial?.tipo ?? 'crlv');
  const [numero, setNumero] = useState(initial?.numero ?? '');
  const [emissao, setEmissao] = useState(initial?.emissao ?? '');
  const [vencimento, setVencimento] = useState(initial?.vencimento ?? '');
  const [valor, setValor] = useState(initial?.valor != null ? String(initial.valor) : '');
  const [fornecedorId, setFornecedorId] = useState(initial?.fornecedorId ?? '');
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
  const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
  const [submitting, setSubmitting] = useState(false);

  const docId = initial?.id ?? gerarId();

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      try {
        const payload: DocumentoEquipamento = {
          id: docId,
          equipamentoId,
          tipo,
          numero: numero.trim(),
          emissao: emissao || null,
          vencimento: vencimento || null,
          valor: parseFloat(valor.replace(',', '.')) || 0,
          fornecedorId: fornecedorId || null,
          observacoes: observacoes.trim(),
          fotoUrls,
          arquivoUrls,
          createdAt: initial?.createdAt ?? new Date().toISOString(),
          createdBy: initial?.createdBy ?? usuarioNome,
          updatedAt: new Date().toISOString(),
          updatedBy: usuarioNome,
        };
        await onSubmit(payload);
        onClose();
      } finally {
        setSubmitting(false);
      }
    },
    [
      submitting, docId, equipamentoId, tipo, numero, emissao, vencimento,
      valor, fornecedorId, observacoes, fotoUrls, arquivoUrls, initial,
      usuarioNome, onSubmit, onClose,
    ]
  );

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar documento' : 'Novo documento'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Tipo"
            id="docTipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as TipoDocumentoEquipamento)}
            options={TIPO_OPTIONS}
            required
          />
          <Input
            label="Número / Apólice"
            id="docNumero"
            type="text"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Ex.: 12345-6 ou APO-2025/00432"
          />
          <Input
            label="Emissão"
            id="docEmissao"
            type="date"
            value={emissao}
            onChange={(e) => setEmissao(e.target.value)}
          />
          <Input
            label="Vencimento"
            id="docVencimento"
            type="date"
            value={vencimento}
            onChange={(e) => setVencimento(e.target.value)}
          />
          <Input
            label="Valor (R$)"
            id="docValor"
            type="number"
            step="0.01"
            min="0"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="0,00"
          />
          <Select
            label="Fornecedor / Emissor"
            id="docFornecedor"
            value={fornecedorId}
            onChange={(e) => setFornecedorId(e.target.value)}
            options={fornecedores.map((f) => ({ value: f.id, label: f.nome }))}
            placeholder="— (opcional)"
          />
        </div>

        <div>
          <label
            htmlFor="docObs"
            className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide"
          >
            Observações
          </label>
          <textarea
            id="docObs"
            className="w-full min-h-[72px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-2 tracking-wide">
            Anexos (PDF, foto, planilha)
          </label>
          <AnexosUploader
            fotoUrls={fotoUrls}
            arquivoUrls={arquivoUrls}
            onChangeFotos={setFotoUrls}
            onChangeArquivos={setArquivoUrls}
            pastaId={`documento-equipamento/${docId}`}
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <SubmitButton loading={submitting}>
            {initial ? 'Salvar alterações' : 'Cadastrar documento'}
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
