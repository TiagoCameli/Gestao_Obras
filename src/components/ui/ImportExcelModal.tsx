import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Button from './Button';

export interface ParsedRow {
  valido: boolean;
  erros: string[];
  resumo: string;
  dados: Record<string, unknown>;
}

export interface ImportExcelModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (items: Record<string, unknown>[]) => void;
  title: string;
  entityLabel: string;
  genderFem?: boolean;
  templateData: unknown[][];
  templateFileName: string;
  sheetName: string;
  templateColWidths: number[];
  formatHintHeaders: string[];
  formatHintExample: string[];
  parseRow: (row: unknown[], index: number) => ParsedRow;
  toEntity: (row: ParsedRow) => Record<string, unknown>;
}

export function parseNumero(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

export function parseData(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  if (typeof raw === 'number') {
    const date = XLSX.SSF.parse_date_code(raw);
    if (date) {
      const y = date.y;
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const str = String(raw).trim();
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  return str;
}

export function parseStr(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  return String(raw).trim();
}

export default function ImportExcelModal({
  open,
  onClose,
  onImport,
  title,
  entityLabel,
  genderFem = false,
  templateData,
  templateFileName,
  sheetName,
  templateColWidths,
  formatHintHeaders,
  formatHintExample,
  parseRow,
  toEntity,
}: ImportExcelModalProps) {
  const [parseados, setParseados] = useState<ParsedRow[] | null>(null);
  const [dragAtivo, setDragAtivo] = useState(false);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetar = useCallback(() => {
    setParseados(null);
    setDragAtivo(false);
    setErro('');
    setProcessando(false);
  }, []);

  const fechar = useCallback(() => {
    resetar();
    onClose();
  }, [onClose, resetar]);

  const baixarTemplate = useCallback(() => {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(templateData);
    ws['!cols'] = templateColWidths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, templateFileName);
  }, [templateData, templateColWidths, sheetName, templateFileName]);

  const processarArquivo = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'xlsx' && ext !== 'xls') {
        setErro('Formato invalido. Use arquivos .xlsx ou .xls');
        return;
      }

      setProcessando(true);
      setErro('');

      try {
        const buffer = await file.arrayBuffer();
        const wb = XLSX.read(buffer, { type: 'array', cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

        if (rows.length < 2) {
          setErro(`Nenhum${genderFem ? 'a' : ''} ${entityLabel.toLowerCase()} encontrad${genderFem ? 'a' : 'o'} no arquivo. Verifique se o formato esta correto.`);
          setProcessando(false);
          return;
        }

        const resultado = rows
          .slice(1)
          .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
          .map((row, i) => parseRow(row, i));

        if (resultado.length === 0) {
          setErro(`Nenhum${genderFem ? 'a' : ''} ${entityLabel.toLowerCase()} encontrad${genderFem ? 'a' : 'o'} no arquivo. Verifique se o formato esta correto.`);
          setProcessando(false);
          return;
        }

        setParseados(resultado);
      } catch {
        setErro('Erro ao processar o arquivo. Verifique se e um Excel valido.');
      }
      setProcessando(false);
    },
    [entityLabel, genderFem, parseRow]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragAtivo(false);
      const file = e.dataTransfer.files[0];
      if (file) processarArquivo(file);
    },
    [processarArquivo]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processarArquivo(file);
      if (inputRef.current) inputRef.current.value = '';
    },
    [processarArquivo]
  );

  const confirmarImportacao = useCallback(() => {
    if (!parseados) return;
    const validos = parseados.filter((r) => r.valido);
    const entities = validos.map((r) => toEntity(r));
    onImport(entities);
    fechar();
  }, [parseados, toEntity, onImport, fechar]);

  if (!open) return null;

  const validos = parseados?.filter((r) => r.valido).length ?? 0;
  const invalidos = parseados?.filter((r) => !r.valido).length ?? 0;
  const total = parseados?.length ?? 0;
  const sufGen = genderFem ? 'a' : 'o';
  const sufGenPlur = genderFem ? 'a(s)' : 'o(s)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={fechar} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {parseados
                ? `Preview - ${total} ${entityLabel.toLowerCase()}${total !== 1 ? 's' : ''} encontrad${total !== 1 ? sufGenPlur : sufGen}`
                : title}
            </h2>
            {parseados && (
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-green-700">{validos} valid{genderFem ? 'a' : 'o'}{validos !== 1 ? 's' : ''}</span>
                {invalidos > 0 && (
                  <span className="text-red-600">{invalidos} com erro</span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={fechar}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {!parseados ? (
            <div className="space-y-4">
              <button
                type="button"
                onClick={baixarTemplate}
                className="inline-flex items-center gap-2 text-sm text-emt-verde hover:text-emt-verde-escuro font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Baixar Template Excel
              </button>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragAtivo
                    ? 'border-emt-verde bg-emt-verde-claro/20'
                    : 'border-gray-300 hover:border-gray-400 bg-gray-50'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragAtivo(true);
                }}
                onDragLeave={() => setDragAtivo(false)}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileChange}
                />
                {processando ? (
                  <div className="space-y-2">
                    <div className="inline-block w-8 h-8 border-4 border-emt-verde-claro border-t-emt-verde rounded-full animate-spin" />
                    <p className="text-sm text-gray-500">Processando arquivo...</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <svg className="w-12 h-12 mx-auto text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-sm font-medium text-gray-700">
                      Arraste o arquivo aqui ou clique para selecionar
                    </p>
                    <p className="text-xs text-gray-500">
                      Formatos aceitos: .xlsx, .xls
                    </p>
                  </div>
                )}
              </div>

              {erro && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                  {erro}
                </div>
              )}

              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
                <p className="text-xs font-medium text-gray-600 mb-1">
                  Formato esperado ({formatHintHeaders.length} colunas):
                </p>
                <div className="text-xs text-gray-500 font-mono overflow-x-auto">
                  <div
                    className="font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-1 min-w-[500px]"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${formatHintHeaders.length}, 1fr)`, gap: '0.25rem' }}
                  >
                    {formatHintHeaders.map((h, i) => (
                      <span key={i}>{h}</span>
                    ))}
                  </div>
                  <div
                    className="min-w-[500px]"
                    style={{ display: 'grid', gridTemplateColumns: `repeat(${formatHintExample.length}, 1fr)`, gap: '0.25rem' }}
                  >
                    {formatHintExample.map((v, i) => (
                      <span key={i}>{v}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {parseados.map((item, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    item.valido
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <span className="shrink-0 text-base">
                    {item.valido ? '\u2705' : '\u274C'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${item.valido ? 'text-gray-800' : 'text-red-800'}`}>
                        {item.resumo || '(vazio)'}
                      </span>
                    </div>
                    {item.erros.length > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {item.erros.join(' \u00b7 ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50 rounded-b-xl shrink-0">
          {parseados ? (
            <>
              <Button type="button" variant="ghost" onClick={resetar} className="text-sm">
                Voltar
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={fechar}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmarImportacao}
                  disabled={validos === 0}
                >
                  Importar {validos > 0 ? `${validos} ${entityLabel}${validos !== 1 ? 's' : ''}` : ''}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex justify-end w-full">
              <Button type="button" variant="secondary" onClick={fechar}>
                Cancelar
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
