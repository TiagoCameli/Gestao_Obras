// Marco 4 / PR18 — Modal de cadastro/edição de peça de manutenção.
//
// Cria/edita um insumo já marcando usado_em_manutencao=true. Foco nos
// campos relevantes pra peça (SKU, fabricante, part number, estoque
// mínimo/máximo, lead time, foto URL, aplicação técnica).

import { useState, type FormEvent } from 'react';
import type { Insumo } from '../../../types';
import Modal from '../../ui/Modal';
import Button from '../../ui/Button';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import { useAdicionarInsumo, useAtualizarInsumo } from '../../../hooks/useInsumos';
import { useUnidades } from '../../../hooks/useUnidades';
import { useAuth } from '../../../contexts/AuthContext';

interface Props {
  open: boolean;
  onClose: () => void;
  insumoExistente?: Insumo;
}

function gerarId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function numOrNull(s: string): number | null {
  const v = s.trim();
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function PecaFormModal({ open, onClose, insumoExistente }: Props) {
  const { usuario } = useAuth();
  const adicionar = useAdicionarInsumo();
  const atualizar = useAtualizarInsumo();
  const { data: unidades = [] } = useUnidades();

  const [nome, setNome] = useState(insumoExistente?.nome ?? '');
  const [unidade, setUnidade] = useState(insumoExistente?.unidade ?? 'un');
  const [codigoSku, setCodigoSku] = useState(insumoExistente?.codigoSku ?? '');
  const [codigoEan, setCodigoEan] = useState(insumoExistente?.codigoEan ?? '');
  const [fabricante, setFabricante] = useState(insumoExistente?.fabricante ?? '');
  const [codigoFabricante, setCodigoFabricante] = useState(insumoExistente?.codigoFabricante ?? '');
  const [estoqueMinimo, setEstoqueMinimo] = useState(insumoExistente?.estoqueMinimo?.toString() ?? '');
  const [estoqueMaximo, setEstoqueMaximo] = useState(insumoExistente?.estoqueMaximo?.toString() ?? '');
  const [leadTimeDias, setLeadTimeDias] = useState(insumoExistente?.leadTimeDias?.toString() ?? '');
  const [fotoUrl, setFotoUrl] = useState(insumoExistente?.fotoUrl ?? '');
  const [aplicacaoTecnica, setAplicacaoTecnica] = useState(insumoExistente?.aplicacaoTecnica ?? '');
  const [equipamentosCompativeisInput, setEquipamentosCompativeisInput] = useState(
    (insumoExistente?.equipamentosCompativeis ?? []).join(', ')
  );
  const [ativo, setAtivo] = useState(insumoExistente?.ativo ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const podeSalvar = !!nome.trim() && !!unidade.trim();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!podeSalvar || submitting) return;
    setErro(null);
    setSubmitting(true);
    try {
      const eqCompativeis = equipamentosCompativeisInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const insumo: Insumo = {
        id: insumoExistente?.id ?? gerarId(),
        nome: nome.trim(),
        tipo: insumoExistente?.tipo ?? 'peca',
        unidade: unidade.trim(),
        descricao: insumoExistente?.descricao ?? '',
        ativo,
        criadoPor: insumoExistente?.criadoPor ?? (usuario?.nome ?? ''),
        categoria: insumoExistente?.categoria,
        usadoEmManutencao: true,
        codigoSku: codigoSku.trim(),
        codigoEan: codigoEan.trim(),
        fabricante: fabricante.trim(),
        codigoFabricante: codigoFabricante.trim(),
        estoqueMinimo: numOrNull(estoqueMinimo),
        estoqueMaximo: numOrNull(estoqueMaximo),
        leadTimeDias: numOrNull(leadTimeDias),
        equipamentosCompativeis: eqCompativeis,
        fotoUrl: fotoUrl.trim(),
        aplicacaoTecnica: aplicacaoTecnica.trim(),
      };

      if (insumoExistente) {
        await atualizar.mutateAsync(insumo);
      } else {
        await adicionar.mutateAsync(insumo);
      }
      onClose();
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar peça');
    } finally {
      setSubmitting(false);
    }
  }

  const unidadeOptions = [
    { value: 'un', label: 'un — unidade' },
    { value: 'L', label: 'L — litro' },
    { value: 'kg', label: 'kg — quilograma' },
    { value: 'm', label: 'm — metro' },
    { value: 'pç', label: 'pç — peça' },
    ...unidades
      .map((u) => ({ value: u.sigla, label: `${u.sigla} — ${u.nome}` }))
      .filter((u) => !['un', 'L', 'kg', 'm', 'pç'].includes(u.value)),
  ];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={insumoExistente ? 'Editar peça' : 'Nova peça'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <Input
              label="Nome da peça"
              required
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Óleo motor 15W40 SAE CJ-4"
            />
          </div>
          <Select
            label="Unidade"
            id="unidade"
            value={unidade}
            onChange={(e) => setUnidade(e.target.value)}
            options={unidadeOptions}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="SKU (código interno)"
            value={codigoSku}
            onChange={(e) => setCodigoSku(e.target.value)}
            placeholder="Ex.: OL-15W40-CAT"
          />
          <Input
            label="EAN (código de barras)"
            value={codigoEan}
            onChange={(e) => setCodigoEan(e.target.value)}
            placeholder="Ex.: 7891234567890"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Fabricante"
            value={fabricante}
            onChange={(e) => setFabricante(e.target.value)}
            placeholder="Ex.: Caterpillar"
          />
          <Input
            label="Part number do fabricante"
            value={codigoFabricante}
            onChange={(e) => setCodigoFabricante(e.target.value)}
            placeholder="Ex.: 9X-7551"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Input
            label="Estoque mínimo"
            type="number"
            min="0"
            step="any"
            value={estoqueMinimo}
            onChange={(e) => setEstoqueMinimo(e.target.value)}
            placeholder="Ex.: 4"
          />
          <Input
            label="Estoque máximo"
            type="number"
            min="0"
            step="any"
            value={estoqueMaximo}
            onChange={(e) => setEstoqueMaximo(e.target.value)}
            placeholder="Ex.: 20"
          />
          <Input
            label="Lead time (dias)"
            type="number"
            min="0"
            step="1"
            value={leadTimeDias}
            onChange={(e) => setLeadTimeDias(e.target.value)}
            placeholder="Ex.: 7"
          />
        </div>

        <Input
          label="Equipamentos compatíveis (separar por vírgula)"
          value={equipamentosCompativeisInput}
          onChange={(e) => setEquipamentosCompativeisInput(e.target.value)}
          placeholder="Ex.: Escavadeira Hidráulica, Caminhão Basculante"
        />

        <Input
          label="Foto (URL)"
          type="url"
          value={fotoUrl}
          onChange={(e) => setFotoUrl(e.target.value)}
          placeholder="https://…"
        />

        <div>
          <label htmlFor="pecaAplic" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Aplicação técnica / observações
          </label>
          <textarea
            id="pecaAplic"
            rows={3}
            value={aplicacaoTecnica}
            onChange={(e) => setAplicacaoTecnica(e.target.value)}
            placeholder="Ex.: óleo motor diesel para escavadeiras Cat 320C, intervalo 250h. Capacidade carter 13L."
            className="w-full min-h-[80px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-[var(--color-fg-muted)] cursor-pointer">
          <input
            type="checkbox"
            checked={ativo}
            onChange={(e) => setAtivo(e.target.checked)}
            className="rounded border-[var(--color-border)]"
          />
          Peça ativa (aparece nas listas e formulários)
        </label>

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
            {submitting ? 'Salvando…' : insumoExistente ? 'Salvar alterações' : 'Cadastrar peça'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
