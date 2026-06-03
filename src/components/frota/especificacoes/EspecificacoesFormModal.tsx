// Marco 1 / PR6 — Modal de edição de especificações técnicas do equipamento.
//
// Form longo organizado em fieldsets. Aceita parcial — operador pode salvar
// só o que sabe e voltar depois pra completar. Filtros viram pares
// chave/valor (chave fixa: oleo/ar/combustivel/hidraulico/cabine/separador)
// com possibilidade de adicionar chaves customizadas.

import { useState, useCallback, type FormEvent } from 'react';
import type { Equipamento, EspecificacoesEquipamento, FiltrosEquipamento } from '../../../types';
import Modal from '../../ui/Modal';
import Input from '../../ui/Input';
import Button from '../../ui/Button';
import SubmitButton from '../../ui/SubmitButton';
import { Plus, Trash2 } from 'lucide-react';

interface Props {
  open: boolean;
  onClose: () => void;
  equipamento: Equipamento;
  initial: EspecificacoesEquipamento | null;
  onSubmit: (spec: EspecificacoesEquipamento) => Promise<void>;
}

const FILTROS_PADRAO: { chave: string; label: string }[] = [
  { chave: 'oleo', label: 'Óleo' },
  { chave: 'ar', label: 'Ar' },
  { chave: 'combustivel', label: 'Combustível' },
  { chave: 'hidraulico', label: 'Hidráulico' },
  { chave: 'cabine', label: 'Cabine' },
  { chave: 'separador', label: 'Separador de água' },
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

export default function EspecificacoesFormModal({
  open, onClose, equipamento, initial, onSubmit,
}: Props) {
  // Capacidades
  const [tanqueL, setTanqueL] = useState(toStr(initial?.capacidadeTanqueL));
  const [oleoMotorL, setOleoMotorL] = useState(toStr(initial?.capacidadeOleoMotorL));
  const [oleoMotorTipo, setOleoMotorTipo] = useState(initial?.tipoOleoMotor ?? '');
  const [oleoHidL, setOleoHidL] = useState(toStr(initial?.capacidadeOleoHidraulicoL));
  const [oleoHidTipo, setOleoHidTipo] = useState(initial?.tipoOleoHidraulico ?? '');
  const [oleoTransL, setOleoTransL] = useState(toStr(initial?.capacidadeOleoTransmissaoL));
  const [oleoTransTipo, setOleoTransTipo] = useState(initial?.tipoOleoTransmissao ?? '');
  const [oleoDifL, setOleoDifL] = useState(toStr(initial?.capacidadeOleoDiferencialL));
  const [arrefecedorL, setArrefecedorL] = useState(toStr(initial?.capacidadeArrefecedorL));

  // Pneus + Bateria
  const [pneuMedida, setPneuMedida] = useState(initial?.pneuMedida ?? '');
  const [pneuQtd, setPneuQtd] = useState(toStr(initial?.pneuQtd));
  const [bateriaEspec, setBateriaEspec] = useState(initial?.bateriaEspecificacao ?? '');
  const [bateriaQtd, setBateriaQtd] = useState(toStr(initial?.bateriaQtd));

  // Filtros — mantém ordem dos padrões + extras adicionados
  const filtrosIniciais = initial?.filtros ?? {};
  const [filtrosLista, setFiltrosLista] = useState<{ chave: string; label: string; valor: string }[]>(() => {
    const lista: { chave: string; label: string; valor: string }[] = FILTROS_PADRAO.map((f) => ({
      ...f,
      valor: filtrosIniciais[f.chave] ?? '',
    }));
    // Adiciona chaves customizadas (que não estão nos padrões)
    for (const [chave, valor] of Object.entries(filtrosIniciais)) {
      if (!FILTROS_PADRAO.some((f) => f.chave === chave)) {
        lista.push({ chave, label: chave.charAt(0).toUpperCase() + chave.slice(1), valor });
      }
    }
    return lista;
  });
  const [novoFiltroChave, setNovoFiltroChave] = useState('');

  // Consumo + Garantia
  const [consumoLH, setConsumoLH] = useState(toStr(initial?.consumoEsperadoLH));
  const [consumoKmL, setConsumoKmL] = useState(toStr(initial?.consumoEsperadoKmL));
  const [garantiaData, setGarantiaData] = useState(initial?.garantiaFimData ?? '');
  const [garantiaMedicao, setGarantiaMedicao] = useState(toStr(initial?.garantiaFimMedicao));

  // Notas
  const [observacoes, setObservacoes] = useState(initial?.observacoesTecnicas ?? '');

  const [submitting, setSubmitting] = useState(false);

  function adicionarFiltroCustom() {
    const chave = novoFiltroChave.trim().toLowerCase().replace(/\s+/g, '_');
    if (!chave || filtrosLista.some((f) => f.chave === chave)) return;
    setFiltrosLista([
      ...filtrosLista,
      { chave, label: chave.charAt(0).toUpperCase() + chave.slice(1), valor: '' },
    ]);
    setNovoFiltroChave('');
  }

  function removerFiltro(chave: string) {
    // Não pode remover os padrões — só zera o valor. Customizados removem da lista.
    if (FILTROS_PADRAO.some((f) => f.chave === chave)) {
      setFiltrosLista(filtrosLista.map((f) => (f.chave === chave ? { ...f, valor: '' } : f)));
    } else {
      setFiltrosLista(filtrosLista.filter((f) => f.chave !== chave));
    }
  }

  function setFiltroValor(chave: string, valor: string) {
    setFiltrosLista(filtrosLista.map((f) => (f.chave === chave ? { ...f, valor } : f)));
  }

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      // Reduz lista pra objeto (só chaves com valor)
      const filtros: FiltrosEquipamento = {};
      for (const f of filtrosLista) {
        if (f.valor.trim()) filtros[f.chave] = f.valor.trim();
      }

      const payload: EspecificacoesEquipamento = {
        equipamentoId: equipamento.id,
        capacidadeTanqueL: parseNumOrNull(tanqueL),
        capacidadeOleoMotorL: parseNumOrNull(oleoMotorL),
        tipoOleoMotor: oleoMotorTipo.trim(),
        capacidadeOleoHidraulicoL: parseNumOrNull(oleoHidL),
        tipoOleoHidraulico: oleoHidTipo.trim(),
        capacidadeOleoTransmissaoL: parseNumOrNull(oleoTransL),
        tipoOleoTransmissao: oleoTransTipo.trim(),
        capacidadeOleoDiferencialL: parseNumOrNull(oleoDifL),
        capacidadeArrefecedorL: parseNumOrNull(arrefecedorL),
        pneuMedida: pneuMedida.trim(),
        pneuQtd: parseIntOrNull(pneuQtd),
        bateriaEspecificacao: bateriaEspec.trim(),
        bateriaQtd: parseIntOrNull(bateriaQtd),
        filtros,
        consumoEsperadoLH: parseNumOrNull(consumoLH),
        consumoEsperadoKmL: parseNumOrNull(consumoKmL),
        garantiaFimData: garantiaData || null,
        garantiaFimMedicao: parseNumOrNull(garantiaMedicao),
        observacoesTecnicas: observacoes.trim(),
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
    submitting, equipamento.id, tanqueL, oleoMotorL, oleoMotorTipo, oleoHidL,
    oleoHidTipo, oleoTransL, oleoTransTipo, oleoDifL, arrefecedorL,
    pneuMedida, pneuQtd, bateriaEspec, bateriaQtd, filtrosLista,
    consumoLH, consumoKmL, garantiaData, garantiaMedicao, observacoes,
    initial, onSubmit, onClose,
  ]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initial ? 'Editar especificações técnicas' : 'Cadastrar especificações técnicas'}
      size="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Capacidades */}
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Capacidades (litros)
          </legend>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Input label="Tanque combustível" id="capTanque" type="number" step="0.1" value={tanqueL} onChange={(e) => setTanqueL(e.target.value)} />
            <Input label="Óleo motor" id="capMotor" type="number" step="0.1" value={oleoMotorL} onChange={(e) => setOleoMotorL(e.target.value)} />
            <Input label="Óleo hidráulico" id="capHid" type="number" step="0.1" value={oleoHidL} onChange={(e) => setOleoHidL(e.target.value)} />
            <Input label="Óleo transmissão" id="capTrans" type="number" step="0.1" value={oleoTransL} onChange={(e) => setOleoTransL(e.target.value)} />
            <Input label="Óleo diferencial" id="capDif" type="number" step="0.1" value={oleoDifL} onChange={(e) => setOleoDifL(e.target.value)} />
            <Input label="Arrefecedor" id="capArref" type="number" step="0.1" value={arrefecedorL} onChange={(e) => setArrefecedorL(e.target.value)} />
          </div>
        </fieldset>

        {/* Tipos de óleo */}
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Lubrificantes (tipo)
          </legend>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Óleo motor" id="tipoMotor" value={oleoMotorTipo} onChange={(e) => setOleoMotorTipo(e.target.value)} placeholder="Ex.: 15W40 CI-4" />
            <Input label="Óleo hidráulico" id="tipoHid" value={oleoHidTipo} onChange={(e) => setOleoHidTipo(e.target.value)} placeholder="Ex.: ISO 68" />
            <Input label="Óleo transmissão" id="tipoTrans" value={oleoTransTipo} onChange={(e) => setOleoTransTipo(e.target.value)} placeholder="Ex.: SAE 30" />
          </div>
        </fieldset>

        {/* Filtros */}
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Filtros (códigos OEM)
          </legend>
          <div className="space-y-2">
            {filtrosLista.map((f) => (
              <div key={f.chave} className="grid grid-cols-[120px_1fr_auto] gap-2 items-center">
                <span className="text-sm text-[var(--color-fg-muted)]">{f.label}</span>
                <input
                  type="text"
                  value={f.valor}
                  onChange={(e) => setFiltroValor(f.chave, e.target.value)}
                  placeholder="Ex.: P550425"
                  className="font-mono text-sm w-full h-[38px] rounded-lg px-3 py-2 bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
                />
                <button
                  type="button"
                  onClick={() => removerFiltro(f.chave)}
                  className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-[var(--color-fg-subtle)] hover:text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]"
                  aria-label={`Remover filtro ${f.label}`}
                  title={FILTROS_PADRAO.some((p) => p.chave === f.chave) ? 'Limpar valor' : 'Remover filtro'}
                >
                  <Trash2 aria-hidden className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
            <div className="grid grid-cols-[120px_1fr_auto] gap-2 items-center pt-1">
              <span className="text-xs text-[var(--color-fg-subtle)]">Adicionar:</span>
              <input
                type="text"
                value={novoFiltroChave}
                onChange={(e) => setNovoFiltroChave(e.target.value)}
                placeholder="Nome do filtro (ex.: ureia)"
                className="text-sm w-full h-[38px] rounded-lg px-3 py-2 bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
              <Button type="button" variant="secondary" size="sm" onClick={adicionarFiltroCustom} disabled={!novoFiltroChave.trim()}>
                <Plus aria-hidden className="w-3.5 h-3.5" />
                Adicionar
              </Button>
            </div>
          </div>
        </fieldset>

        {/* Pneus + Bateria */}
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Pneus e Bateria
          </legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label="Medida pneu" id="pneuMedida" value={pneuMedida} onChange={(e) => setPneuMedida(e.target.value)} placeholder="Ex.: 275/80 R22.5" />
            <Input label="Qtd pneus" id="pneuQtd" type="number" min="0" step="1" value={pneuQtd} onChange={(e) => setPneuQtd(e.target.value)} />
            <Input label="Bateria" id="bat" value={bateriaEspec} onChange={(e) => setBateriaEspec(e.target.value)} placeholder="Ex.: 12V 150Ah" />
            <Input label="Qtd baterias" id="batQtd" type="number" min="0" step="1" value={bateriaQtd} onChange={(e) => setBateriaQtd(e.target.value)} />
          </div>
        </fieldset>

        {/* Consumo + Garantia */}
        <fieldset>
          <legend className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
            Consumo esperado e garantia
          </legend>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Input label="Consumo (L/h)" id="conLH" type="number" step="0.1" value={consumoLH} onChange={(e) => setConsumoLH(e.target.value)} />
            <Input label="Consumo (km/L)" id="conKmL" type="number" step="0.1" value={consumoKmL} onChange={(e) => setConsumoKmL(e.target.value)} />
            <Input label="Garantia fim (data)" id="garData" type="date" value={garantiaData} onChange={(e) => setGarantiaData(e.target.value)} />
            <Input
              label={`Garantia fim (${equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km'})`}
              id="garMed"
              type="number"
              step="1"
              min="0"
              value={garantiaMedicao}
              onChange={(e) => setGarantiaMedicao(e.target.value)}
            />
          </div>
        </fieldset>

        {/* Notas */}
        <div>
          <label htmlFor="obsTec" className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
            Notas técnicas
          </label>
          <textarea
            id="obsTec"
            rows={3}
            value={observacoes}
            onChange={(e) => setObservacoes(e.target.value)}
            placeholder="Torque de aperto, peculiaridades, dicas do mecânico anterior..."
            className="w-full min-h-[80px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <SubmitButton loading={submitting}>
            Salvar especificações
          </SubmitButton>
        </div>
      </form>
    </Modal>
  );
}
