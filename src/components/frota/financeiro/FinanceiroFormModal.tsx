// Marco 1 / PR7 — Modal de edição do financeiro.
//
// Form adaptativo: render diferente conforme equipamento.propriedade.
// Aceita preenchimento parcial.

import { useState, useCallback, type FormEvent } from 'react';
import type {
  Equipamento, FinanceiroEquipamento, FormaAquisicao, IndexadorContrato, Fornecedor,
} from '../../../types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Select from '../../ui/Select';
import Button from '../../ui/Button';
import SubmitButton from '../../ui/SubmitButton';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamento: Equipamento;
  fornecedores: Fornecedor[];
  initial: FinanceiroEquipamento | null;
  onSubmit: (fin: FinanceiroEquipamento) => Promise<void>;
}

const FORMA_OPTIONS: { value: FormaAquisicao; label: string }[] = [
  { value: 'a_vista', label: 'À vista' },
  { value: 'financiado', label: 'Financiado' },
  { value: 'consorcio', label: 'Consórcio' },
  { value: 'leasing', label: 'Leasing' },
  { value: 'outro', label: 'Outro' },
];

const INDEXADOR_OPTIONS: { value: IndexadorContrato; label: string }[] = [
  { value: 'IPCA', label: 'IPCA' },
  { value: 'IGPM', label: 'IGP-M' },
  { value: 'INPC', label: 'INPC' },
  { value: 'prefixado', label: 'Prefixado' },
  { value: 'outro', label: 'Outro' },
];

function toStr(v: number | null | undefined): string {
  return v == null ? '' : String(v);
}

function parseNumOrNull(s: string): number | null {
  const n = parseFloat(s.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function parseIntOrNull(s: string): number | null {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export default function FinanceiroFormModal({
  open, onClose, equipamento, fornecedores, initial, onSubmit,
}: Props) {
  const isAlugada = equipamento.propriedade === 'alugada';

  // Próprios
  const [valorAquisicao, setValorAquisicao] = useState(toStr(initial?.valorAquisicao));
  const [fornecedorAquisicaoId, setFornecedorAquisicaoId] = useState(initial?.fornecedorAquisicaoId ?? '');
  const [nfAquisicao, setNfAquisicao] = useState(initial?.nfAquisicao ?? '');
  const [formaAquisicao, setFormaAquisicao] = useState<FormaAquisicao | ''>(initial?.formaAquisicao ?? '');
  const [bancoFinanciador, setBancoFinanciador] = useState(initial?.bancoFinanciador ?? '');
  const [valorParcela, setValorParcela] = useState(toStr(initial?.valorParcela));
  const [prestacoesTotal, setPrestacoesTotal] = useState(toStr(initial?.prestacoesTotal));
  const [prestacoesPagas, setPrestacoesPagas] = useState(toStr(initial?.prestacoesPagas));
  const [valorMercadoAtual, setValorMercadoAtual] = useState(toStr(initial?.valorMercadoAtual));
  const [vidaUtilMeses, setVidaUtilMeses] = useState(toStr(initial?.vidaUtilMeses));
  const [valorResidualEstimado, setValorResidualEstimado] = useState(toStr(initial?.valorResidualEstimado));

  // Alugados
  const [locadoraId, setLocadoraId] = useState(initial?.locadoraId ?? '');
  const [contratoNumero, setContratoNumero] = useState(initial?.contratoNumero ?? '');
  const [valorMensal, setValorMensal] = useState(toStr(initial?.valorMensal));
  const [vigenciaInicio, setVigenciaInicio] = useState(initial?.vigenciaInicio ?? '');
  const [vigenciaFim, setVigenciaFim] = useState(initial?.vigenciaFim ?? '');
  const [indexador, setIndexador] = useState<IndexadorContrato | ''>(initial?.indexador ?? '');
  const [manutencaoInclusa, setManutencaoInclusa] = useState(initial?.manutencaoInclusa ?? false);
  const [combustivelIncluso, setCombustivelIncluso] = useState(initial?.combustivelIncluso ?? false);
  const [operadorIncluso, setOperadorIncluso] = useState(initial?.operadorIncluso ?? false);
  const [horasMinimasMensais, setHorasMinimasMensais] = useState(toStr(initial?.horasMinimasMensais));

  // Comum
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? '');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const payload: FinanceiroEquipamento = {
        equipamentoId: equipamento.id,
        valorAquisicao: parseNumOrNull(valorAquisicao),
        fornecedorAquisicaoId: fornecedorAquisicaoId || null,
        nfAquisicao: nfAquisicao.trim(),
        formaAquisicao: formaAquisicao || null,
        bancoFinanciador: bancoFinanciador.trim(),
        valorParcela: parseNumOrNull(valorParcela),
        prestacoesTotal: parseIntOrNull(prestacoesTotal),
        prestacoesPagas: parseIntOrNull(prestacoesPagas),
        valorMercadoAtual: parseNumOrNull(valorMercadoAtual),
        vidaUtilMeses: parseIntOrNull(vidaUtilMeses),
        valorResidualEstimado: parseNumOrNull(valorResidualEstimado),
        locadoraId: locadoraId || null,
        contratoNumero: contratoNumero.trim(),
        valorMensal: parseNumOrNull(valorMensal),
        vigenciaInicio: vigenciaInicio || null,
        vigenciaFim: vigenciaFim || null,
        indexador: indexador || null,
        manutencaoInclusa,
        combustivelIncluso,
        operadorIncluso,
        horasMinimasMensais: parseNumOrNull(horasMinimasMensais),
        observacoes: observacoes.trim(),
        arquivoUrls: initial?.arquivoUrls ?? [],
        createdAt: initial?.createdAt ?? new Date().toISOString(),
        createdBy: initial?.createdBy ?? '',
        updatedAt: new Date().toISOString(),
        updatedBy: initial?.updatedBy ?? '',
      };
      await onSubmit(payload);
      onClose();
    } finally {
      setSubmitting(false);
    }
  }, [
    submitting, equipamento.id, valorAquisicao, fornecedorAquisicaoId, nfAquisicao,
    formaAquisicao, bancoFinanciador, valorParcela, prestacoesTotal, prestacoesPagas,
    valorMercadoAtual, vidaUtilMeses, valorResidualEstimado,
    locadoraId, contratoNumero, valorMensal, vigenciaInicio, vigenciaFim, indexador,
    manutencaoInclusa, combustivelIncluso, operadorIncluso, horasMinimasMensais,
    observacoes, initial, onSubmit, onClose,
  ]);

  const mostrarFinanciamento = formaAquisicao === 'financiado' || formaAquisicao === 'consorcio' || formaAquisicao === 'leasing';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAlugada ? 'Financeiro — Locação' : 'Financeiro — Aquisição'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {isAlugada ? (
          <>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                Contrato de locação
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Select
                  label="Locadora"
                  id="locadora"
                  value={locadoraId}
                  onChange={(e) => setLocadoraId(e.target.value)}
                  options={fornecedores.map((f) => ({ value: f.id, label: f.nome }))}
                  placeholder="— Selecione"
                />
                <Input label="Nº contrato" id="contrato" value={contratoNumero} onChange={(e) => setContratoNumero(e.target.value)} />
                <Input label="Valor mensal (R$)" id="valorMensal" type="number" step="0.01" value={valorMensal} onChange={(e) => setValorMensal(e.target.value)} />
                <Select
                  label="Indexador"
                  id="indexador"
                  value={indexador}
                  onChange={(e) => setIndexador(e.target.value as IndexadorContrato | '')}
                  options={INDEXADOR_OPTIONS}
                  placeholder="—"
                />
                <Input label="Vigência início" id="vigIni" type="date" value={vigenciaInicio} onChange={(e) => setVigenciaInicio(e.target.value)} />
                <Input label="Vigência fim" id="vigFim" type="date" value={vigenciaFim} onChange={(e) => setVigenciaFim(e.target.value)} />
                <Input
                  label={`Horas mínimas/mês (${equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km'})`}
                  id="horasMin"
                  type="number"
                  step="0.1"
                  value={horasMinimasMensais}
                  onChange={(e) => setHorasMinimasMensais(e.target.value)}
                />
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                O que está incluso no contrato
              </legend>
              <div className="rounded-xl bg-[var(--color-surface-2)] p-3 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={manutencaoInclusa}
                    onChange={(e) => setManutencaoInclusa(e.target.checked)}
                  />
                  <span className="text-sm text-[var(--color-fg)]">
                    <strong>Manutenção</strong>
                    <span className="text-[var(--color-fg-muted)] ml-1 text-xs">
                      (se sim, OS deste equipamento não entra no R$/hora — locadora paga)
                    </span>
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={combustivelIncluso}
                    onChange={(e) => setCombustivelIncluso(e.target.checked)}
                  />
                  <span className="text-sm text-[var(--color-fg)]">Combustível</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4"
                    checked={operadorIncluso}
                    onChange={(e) => setOperadorIncluso(e.target.checked)}
                  />
                  <span className="text-sm text-[var(--color-fg)]">Operador</span>
                </label>
              </div>
            </fieldset>
          </>
        ) : (
          <>
            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                Aquisição
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input label="Valor de aquisição (R$)" id="vlrAq" type="number" step="0.01" value={valorAquisicao} onChange={(e) => setValorAquisicao(e.target.value)} />
                <Select
                  label="Forma de pagamento"
                  id="formaAq"
                  value={formaAquisicao}
                  onChange={(e) => setFormaAquisicao(e.target.value as FormaAquisicao | '')}
                  options={FORMA_OPTIONS}
                  placeholder="—"
                />
                <Select
                  label="Fornecedor / vendedor"
                  id="fornAq"
                  value={fornecedorAquisicaoId}
                  onChange={(e) => setFornecedorAquisicaoId(e.target.value)}
                  options={fornecedores.map((f) => ({ value: f.id, label: f.nome }))}
                  placeholder="—"
                />
                <Input label="NF aquisição" id="nfAq" value={nfAquisicao} onChange={(e) => setNfAquisicao(e.target.value)} />
              </div>
            </fieldset>

            {mostrarFinanciamento && (
              <fieldset>
                <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                  Financiamento
                </legend>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Input label="Banco / financiador" id="banco" value={bancoFinanciador} onChange={(e) => setBancoFinanciador(e.target.value)} placeholder="Ex.: Banco do Brasil" />
                  <Input label="Valor da parcela (R$)" id="valorParcela" type="number" step="0.01" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <Input label="Pagas" id="prestPagas" type="number" min="0" step="1" value={prestacoesPagas} onChange={(e) => setPrestacoesPagas(e.target.value)} />
                    <Input label="Total" id="prestTotal" type="number" min="0" step="1" value={prestacoesTotal} onChange={(e) => setPrestacoesTotal(e.target.value)} />
                  </div>
                </div>
              </fieldset>
            )}

            <fieldset>
              <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
                Valor de mercado & vida útil (depreciação linear)
              </legend>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Input label="Valor de mercado atual (R$)" id="vlrMerc" type="number" step="0.01" value={valorMercadoAtual} onChange={(e) => setValorMercadoAtual(e.target.value)} />
                <Input label="Vida útil (meses)" id="vidaUtil" type="number" min="1" step="1" value={vidaUtilMeses} onChange={(e) => setVidaUtilMeses(e.target.value)} placeholder="Ex.: 120 (10 anos)" />
                <Input label="Valor residual estimado (R$)" id="vlrRes" type="number" step="0.01" value={valorResidualEstimado} onChange={(e) => setValorResidualEstimado(e.target.value)} />
              </div>
            </fieldset>
          </>
        )}

        <div>
          <label htmlFor="finObs" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Observações
          </label>
          <textarea
            id="finObs"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Opcional"
            className="w-full min-h-[72px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <SubmitButton loading={submitting}>
            Salvar
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
