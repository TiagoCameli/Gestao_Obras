import { useState } from 'react';
import type { DepositoMaterial, EntradaMaterial, Obra, SaidaMaterial, TransferenciaMaterial } from '../../types';
import { exportarEntradasMaterialPDF, exportarSaidasMaterialPDF, exportarTransferenciasMaterialPDF } from '../../utils/insumosPdfExport';
import { exportarEntradasMaterialExcel, exportarSaidasMaterialExcel, exportarTransferenciasMaterialExcel } from '../../utils/insumosExcelExport';
import { useInsumos } from '../../hooks/useInsumos';
import { useFornecedores } from '../../hooks/useFornecedores';
import { useEtapas } from '../../hooks/useEtapas';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

type TipoRelatorio = '' | 'entradas' | 'saidas' | 'transferencias';
type FiltroTipo = '' | 'todos' | 'obra' | 'deposito';
type Formato = '' | 'pdf' | 'excel';

interface ExportarInsumosModalProps {
  open: boolean;
  onClose: () => void;
  entradas: EntradaMaterial[];
  saidas: SaidaMaterial[];
  transferencias: TransferenciaMaterial[];
  obras: Obra[];
  depositos: DepositoMaterial[];
}

export default function ExportarInsumosModal({
  open,
  onClose,
  entradas,
  saidas,
  transferencias,
  obras,
  depositos,
}: ExportarInsumosModalProps) {
  const [tipo, setTipo] = useState<TipoRelatorio>('');
  const [formato, setFormato] = useState<Formato>('');
  const [filtro, setFiltro] = useState<FiltroTipo>('');
  const [obraIds, setObraIds] = useState<string[]>([]);
  const [depositoIds, setDepositoIds] = useState<string[]>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const { data: insumos = [] } = useInsumos();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: etapas = [] } = useEtapas();

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
    const depFiltro = filtro === 'deposito' && depositoIds.length > 0 ? depositoIds : undefined;
    const args = [obraFiltro, depFiltro, dataInicio || undefined, dataFim || undefined] as const;

    if (formato === 'pdf') {
      if (tipo === 'entradas') {
        exportarEntradasMaterialPDF(filtrarPorData(entradas), obras, depositos, { insumos, fornecedores }, ...args);
      } else if (tipo === 'saidas') {
        exportarSaidasMaterialPDF(filtrarPorData(saidas), obras, depositos, { insumos, etapas }, ...args);
      } else if (tipo === 'transferencias') {
        exportarTransferenciasMaterialPDF(filtrarPorData(transferencias), obras, depositos, { insumos }, ...args);
      }
    } else if (formato === 'excel') {
      if (tipo === 'entradas') {
        exportarEntradasMaterialExcel(filtrarPorData(entradas), obras, depositos, { insumos, fornecedores }, ...args);
      } else if (tipo === 'saidas') {
        exportarSaidasMaterialExcel(filtrarPorData(saidas), obras, depositos, { insumos, etapas }, ...args);
      } else if (tipo === 'transferencias') {
        exportarTransferenciasMaterialExcel(filtrarPorData(transferencias), obras, depositos, { insumos }, ...args);
      }
    }
    resetAndClose();
  }

  const filtroIncompleto =
    (filtro === 'obra' && obraIds.length === 0) ||
    (filtro === 'deposito' && depositoIds.length === 0);

  const podeExportar = !!tipo && !!formato && !filtroIncompleto;

  const nomesSelecionados = (() => {
    if (filtro === 'obra' && obraIds.length > 0) {
      return obraIds.map((id) => obras.find((o) => o.id === id)?.nome).filter(Boolean);
    }
    if (filtro === 'deposito' && depositoIds.length > 0) {
      return depositoIds.map((id) => depositos.find((d) => d.id === id)?.nome).filter(Boolean);
    }
    return [];
  })();

  return (
    <Modal open={open} onClose={resetAndClose} title="Exportar Relatorio">
      <div className="space-y-4">
        {/* Tipo de relatorio */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Tipo de relatorio
          </label>
          <div className="flex gap-2">
            {([
              { key: 'entradas', label: 'Entradas' },
              { key: 'saidas', label: 'Saidas' },
              { key: 'transferencias', label: 'Transferencias' },
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

        {/* Formato */}
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

        {/* Filtro por obra/deposito */}
        {tipo && formato && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Filtrar por <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="flex gap-2">
              {([
                { key: 'todos', label: 'Todos' },
                { key: 'obra', label: 'Por obras' },
                { key: 'deposito', label: 'Por depositos' },
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

        {/* Selecionar obras */}
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

        {/* Selecionar depositos */}
        {tipo && formato && filtro === 'deposito' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Selecione os depositos
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
                <p className="px-3 py-2.5 text-sm text-gray-400">Nenhum deposito cadastrado</p>
              )}
            </div>
            {depositoIds.length > 0 && (
              <p className="text-xs text-emt-verde mt-1">
                {depositoIds.length} deposito{depositoIds.length > 1 ? 's' : ''} selecionado{depositoIds.length > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )}

        {/* Periodo */}
        {tipo && formato && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Periodo <span className="text-gray-400 font-normal">(opcional)</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="insDataInicio" className="block text-xs text-gray-500 mb-1">
                  De
                </label>
                <input
                  id="insDataInicio"
                  type="date"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emt-verde"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>
              <div>
                <label htmlFor="insDataFim" className="block text-xs text-gray-500 mb-1">
                  Ate
                </label>
                <input
                  id="insDataFim"
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
            ? ` | Periodo: ${dataInicio || '...'} a ${dataFim || '...'}`
            : '';

          const tipoLabel =
            tipo === 'entradas' ? 'Entradas' :
            tipo === 'saidas' ? 'Saidas' : 'Transferencias';

          const formatoLabel = formato === 'pdf' ? 'PDF' : 'Excel';

          let filtroTexto = ' de todos os depositos e obras';
          if (nomesSelecionados.length > 0) {
            const labelTipo = filtro === 'obra' ? 'obras' : 'depositos';
            filtroTexto = ` - ${labelTipo}: ${nomesSelecionados.join(', ')}`;
          }

          return (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500">
                {formatoLabel} — {tipoLabel} de material{filtroTexto}{periodoTexto}
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
