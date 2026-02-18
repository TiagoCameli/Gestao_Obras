import { useState } from 'react';
import type { Abastecimento, Deposito, EntradaCombustivel, Obra, TransferenciaCombustivel } from '../../types';
import { exportarSaidasPDF, exportarEntradasPDF, exportarTransferenciasPDF } from '../../utils/pdfExport';
import { exportarSaidasExcel, exportarEntradasExcel, exportarTransferenciasExcel } from '../../utils/excelExport';
import { useInsumos } from '../../hooks/useInsumos';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useEtapas } from '../../hooks/useEtapas';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

type TipoRelatorio = '' | 'saidas' | 'entradas' | 'transferencias';
type FiltroTipo = '' | 'todos' | 'obra' | 'tanque';
type Formato = '' | 'pdf' | 'excel';

interface ExportarPDFModalProps {
  open: boolean;
  onClose: () => void;
  abastecimentos: Abastecimento[];
  entradas: EntradaCombustivel[];
  transferencias: TransferenciaCombustivel[];
  obras: Obra[];
  depositos: Deposito[];
}

export default function ExportarPDFModal({
  open,
  onClose,
  abastecimentos,
  entradas,
  transferencias,
  obras,
  depositos,
}: ExportarPDFModalProps) {
  const { data: insumos = [] } = useInsumos();
  const { data: equipamentos = [] } = useEquipamentos();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: etapas = [] } = useEtapas();

  const [tipo, setTipo] = useState<TipoRelatorio>('');
  const [formato, setFormato] = useState<Formato>('');
  const [filtro, setFiltro] = useState<FiltroTipo>('');
  const [obraIds, setObraIds] = useState<string[]>([]);
  const [depositoIds, setDepositoIds] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  function resetAndClose() {
    setTipo('');
    setFormato('');
    setFiltro('');
    setObraIds([]);
    setDepositoIds([]);
    setDataInicio('');
    setDataFim('');
    onClose();
  }

  function toggleObra(id: string) {
    setObraIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleDeposito(id: string) {
    setDepositoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function filtrarPorData<T extends { dataHora: string }>(lista: T[]): T[] {
    return lista.filter((item) => {
      if (dataInicio && new Date(item.dataHora) < new Date(dataInicio)) return false;
      if (dataFim && new Date(item.dataHora) > new Date(dataFim + 'T23:59:59')) return false;
      return true;
    });
  }

  function handleExportar() {
    const obraFiltro = filtro === 'obra' && obraIds.length > 0 ? obraIds : undefined;
    const tanqueFiltro = filtro === 'tanque' && depositoIds.length > 0 ? depositoIds : undefined;
    const args = [obraFiltro, tanqueFiltro, dataInicio || undefined, dataFim || undefined] as const;

    if (formato === 'pdf') {
      if (tipo === 'saidas') {
        exportarSaidasPDF(filtrarPorData(abastecimentos), obras, depositos, { insumos, equipamentos, etapas }, ...args);
      } else if (tipo === 'entradas') {
        exportarEntradasPDF(filtrarPorData(entradas), obras, depositos, { insumos, fornecedores }, ...args);
      } else if (tipo === 'transferencias') {
        exportarTransferenciasPDF(filtrarPorData(transferencias), obras, depositos, ...args);
      }
    } else if (formato === 'excel') {
      if (tipo === 'saidas') {
        exportarSaidasExcel(filtrarPorData(abastecimentos), obras, depositos, { insumos, equipamentos, etapas }, ...args);
      } else if (tipo === 'entradas') {
        exportarEntradasExcel(filtrarPorData(entradas), obras, depositos, { insumos, fornecedores }, ...args);
      } else if (tipo === 'transferencias') {
        exportarTransferenciasExcel(filtrarPorData(transferencias), obras, depositos, ...args);
      }
    }
    resetAndClose();
  }

  const filtroIncompleto =
    (filtro === 'obra' && obraIds.length === 0) ||
    (filtro === 'tanque' && depositoIds.length === 0);

  const podeExportar = !!tipo && !!formato && !filtroIncompleto;

  const nomesSelecionados = (() => {
    if (filtro === 'obra' && obraIds.length > 0) {
      return obraIds.map((id) => obras.find((o) => o.id === id)?.nome).filter(Boolean);
    }
    if (filtro === 'tanque' && depositoIds.length > 0) {
      return depositoIds.map((id) => depositos.find((d) => d.id === id)?.nome).filter(Boolean);
    }
    return [];
  })();

  return (
    <Modal open={open} onClose={resetAndClose} title="Exportar Relatório">
      <div className="space-y-4">
        {/* Passo 1: Tipo de relatorio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de relatório
          </label>
          <div className="flex gap-2">
            {([
              { key: 'saidas', label: 'Saídas' },
              { key: 'entradas', label: 'Entradas' },
              { key: 'transferencias', label: 'Transferências' },
            ] as const).map((opt) => (
              <button
                key={opt.key}
                type="button"
                className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  tipo === opt.key
                    ? 'bg-emt-verde text-white border-emt-verde'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => {
                  setTipo(opt.key);
                  setFiltro('');
                  setObraIds([]);
                  setDepositoIds([]);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Passo 2: Formato */}
        {tipo && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Formato
            </label>
            <div className="flex gap-2">
              {([
                { key: 'pdf', label: 'PDF' },
                { key: 'excel', label: 'Excel' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    formato === opt.key
                      ? 'bg-emt-verde text-white border-emt-verde'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => setFormato(opt.key)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Passo 3: Filtro por obra/tanque */}
        {tipo && formato && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex gap-2">
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'obra', label: 'Por obras' },
                { key: 'tanque', label: 'Por tanques' },
              ] as const).map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    filtro === opt.key
                      ? 'bg-emt-verde text-white border-emt-verde'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setFiltro(opt.key);
                    setObraIds([]);
                    setDepositoIds([]);
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Selecionar obras (checkboxes) */}
        {tipo && formato && filtro === 'obra' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione as obras
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg divide-y divide-gray-100">
              {obras.map((o) => (
                <label
                  key={o.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={obraIds.includes(o.id)}
                    onChange={() => toggleObra(o.id)}
                    className="h-4 w-4 rounded border-gray-300 text-emt-verde focus:ring-emt-verde"
                  />
                  <span className="text-sm text-gray-700">{o.nome}</span>
                </label>
              ))}
              {obras.length === 0 && (
                <p className="px-3 py-2.5 text-sm text-gray-400">Nenhuma obra cadastrada</p>
              )}
            </div>
            {obraIds.length > 0 && (
              <p className="text-xs text-emt-verde mt-1">
                {obraIds.length} obra{obraIds.length > 1 ? 's' : ''} selecionada{obraIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Selecionar tanques (checkboxes) */}
        {tipo && formato && filtro === 'tanque' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione os tanques
            </label>
            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg divide-y divide-gray-100">
              {depositos.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={depositoIds.includes(d.id)}
                    onChange={() => toggleDeposito(d.id)}
                    className="h-4 w-4 rounded border-gray-300 text-emt-verde focus:ring-emt-verde"
                  />
                  <span className="text-sm text-gray-700">{d.nome}</span>
                </label>
              ))}
              {depositos.length === 0 && (
                <p className="px-3 py-2.5 text-sm text-gray-400">Nenhum tanque cadastrado</p>
              )}
            </div>
            {depositoIds.length > 0 && (
              <p className="text-xs text-emt-verde mt-1">
                {depositoIds.length} tanque{depositoIds.length > 1 ? 's' : ''} selecionado{depositoIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Período (opcional) */}
        {tipo && formato && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Período <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pdfDataInicio" className="block text-xs text-gray-500 mb-1">
                  De
                </label>
                <input
                  id="pdfDataInicio"
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="pdfDataFim" className="block text-xs text-gray-500 mb-1">
                  Até
                </label>
                <input
                  id="pdfDataFim"
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>
            </div>
          </div>
        )}

        {/* Resumo */}
        {tipo && podeExportar && (() => {
          const periodoTexto = dataInicio || dataFim
            ? ` | Período: ${dataInicio || '...'} a ${dataFim || '...'}`
            : '';

          const tipoLabel =
            tipo === 'saidas' ? 'Saídas' :
            tipo === 'entradas' ? 'Entradas' : 'Transferências';

          const formatoLabel = formato === 'pdf' ? 'PDF' : 'Excel';

          let filtroTexto = ' de todos os tanques e obras';
          if (nomesSelecionados.length > 0) {
            const labelTipo = filtro === 'obra' ? 'obras' : 'tanques';
            filtroTexto = ` - ${labelTipo}: ${nomesSelecionados.join(', ')}`;
          }

          return (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">
                {formatoLabel} — {tipoLabel}{filtroTexto}{periodoTexto}
              </p>
            </div>
          );
        })()}

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={resetAndClose}>
            Cancelar
          </Button>
          <Button disabled={!podeExportar} onClick={handleExportar}>
            Exportar {formato === 'excel' ? 'Excel' : formato === 'pdf' ? 'PDF' : ''}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
