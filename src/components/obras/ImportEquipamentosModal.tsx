import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { Equipamento } from '../../types';
import Button from '../ui/Button';

interface ImportEquipamentosModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (equipamentos: Equipamento[]) => void;
  equipamentosExistentes: Equipamento[];
}

interface EquipParseado {
  nome: string;
  codigoPatrimonio: string;
  numeroSerie: string;
  marca: string;
  ano: string;
  tipoMedicao: string;
  medicaoInicial: number;
  dataAquisicao: string;
  valido: boolean;
  erros: string[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TEMPLATE_DATA = [
  ['Nome', 'Codigo Patrimonio', 'Numero de Serie', 'Marca', 'Ano', 'Tipo Medicao', 'Medicao Inicial', 'Data Aquisicao'],
  ['Escavadeira CAT 320', 'PAT-001', 'CAT320-2024-001', 'Caterpillar', '2024', 'horimetro', 0, '2024-01-15'],
  ['Retroescavadeira JCB 3CX', 'PAT-002', 'JCB3CX-2023-045', 'JCB', '2023', 'horimetro', 150, '2023-06-20'],
  ['Caminhao Basculante', 'PAT-003', 'VW-2022-123', 'Volkswagen', '2022', 'odometro', 45000, '2022-03-10'],
  ['Pa Carregadeira', 'PAT-004', 'CAT950-2024-007', 'Caterpillar', '2024', 'horimetro', 0, '2024-02-01'],
  ['Rolo Compactador', 'PAT-005', 'BOMAG-2023-033', 'Bomag', '2023', 'horimetro', 320, '2023-09-05'],
  ['Caminhao Pipa', 'PAT-006', 'MB-2021-456', 'Mercedes-Benz', '2021', 'odometro', 82000, '2021-11-20'],
  ['Miniescavadeira', 'PAT-007', 'BOB-2024-012', 'Bobcat', '2024', 'horimetro', 0, '2024-04-10'],
  ['Betoneira 400L', 'PAT-008', 'CSM-2023-089', 'CSM', '2023', 'horimetro', 500, '2023-01-15'],
  ['Guincho', 'PAT-009', 'LIE-2022-034', 'Liebherr', '2022', 'horimetro', 1200, '2022-07-25'],
  ['Caminhao Munck', 'PAT-010', 'FORD-2023-078', 'Ford', '2023', 'odometro', 35000, '2023-05-12'],
];

function baixarTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_DATA);
  ws['!cols'] = [
    { wch: 28 }, { wch: 18 }, { wch: 22 }, { wch: 16 },
    { wch: 6 }, { wch: 14 }, { wch: 15 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Equipamentos');
  XLSX.writeFile(wb, 'template_equipamentos.xlsx');
}

function parseNumero(raw: unknown): number | null {
  if (raw === undefined || raw === null || String(raw).trim() === '') return null;
  const parsed = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(',', '.'));
  return isNaN(parsed) ? null : parsed;
}

function parseData(raw: unknown): string {
  if (raw === undefined || raw === null) return '';
  // Excel pode enviar como number (serial date)
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
  // Aceita yyyy-mm-dd ou dd/mm/yyyy
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  const brMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) return `${brMatch[3]}-${brMatch[2].padStart(2, '0')}-${brMatch[1].padStart(2, '0')}`;
  return str;
}

function parsePlanilha(data: ArrayBuffer): EquipParseado[] {
  const wb = XLSX.read(data, { type: 'array', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

  if (rows.length < 2) return [];

  return rows.slice(1)
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
    .map((row) => {
      const erros: string[] = [];
      const nome = String(row[0] ?? '').trim();
      const codigoPatrimonio = String(row[1] ?? '').trim();
      const numeroSerie = String(row[2] ?? '').trim();
      const marca = String(row[3] ?? '').trim();
      const ano = String(row[4] ?? '').trim();
      const tipoMedicaoRaw = String(row[5] ?? '').trim().toLowerCase();
      const medicaoRaw = row[6];
      const dataRaw = row[7];

      if (!nome) erros.push('Nome vazio');

      let tipoMedicao = '';
      if (!tipoMedicaoRaw) {
        erros.push('Falta tipo medicao');
      } else if (tipoMedicaoRaw === 'horimetro' || tipoMedicaoRaw === 'horímetro') {
        tipoMedicao = 'horimetro';
      } else if (tipoMedicaoRaw === 'odometro' || tipoMedicaoRaw === 'odômetro' || tipoMedicaoRaw === 'km') {
        tipoMedicao = 'odometro';
      } else {
        erros.push('Tipo medicao invalido (use horimetro ou odometro)');
      }

      const medicaoInicial = parseNumero(medicaoRaw);
      if (medicaoInicial === null) {
        erros.push('Falta medicao inicial');
      }

      const dataAquisicao = parseData(dataRaw);
      if (!dataAquisicao) {
        erros.push('Falta data aquisicao');
      }

      return {
        nome,
        codigoPatrimonio,
        numeroSerie,
        marca,
        ano,
        tipoMedicao,
        medicaoInicial: medicaoInicial ?? 0,
        dataAquisicao,
        valido: erros.length === 0,
        erros,
      };
    });
}

function resolverDuplicatas(novos: EquipParseado[], existentes: Equipamento[]): EquipParseado[] {
  const nomesUsados = new Map<string, number>();
  for (const e of existentes) {
    const key = e.nome.toLowerCase();
    nomesUsados.set(key, (nomesUsados.get(key) || 0) + 1);
  }

  return novos.map((eq) => {
    const key = eq.nome.toLowerCase();
    const count = nomesUsados.get(key) || 0;
    if (count > 0) {
      const novoNome = `${eq.nome} ${count + 1}`;
      nomesUsados.set(key, count + 1);
      return { ...eq, nome: novoNome };
    }
    nomesUsados.set(key, 1);
    return eq;
  });
}

export default function ImportEquipamentosModal({
  open,
  onClose,
  onImport,
  equipamentosExistentes,
}: ImportEquipamentosModalProps) {
  const [parseados, setParseados] = useState<EquipParseado[] | null>(null);
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
        const resultado = parsePlanilha(buffer);

        if (resultado.length === 0) {
          setErro('Nenhum equipamento encontrado no arquivo. Verifique se o formato esta correto.');
          setProcessando(false);
          return;
        }

        const comDuplicatas = resolverDuplicatas(resultado, equipamentosExistentes);
        setParseados(comDuplicatas);
      } catch {
        setErro('Erro ao processar o arquivo. Verifique se e um Excel valido.');
      }
      setProcessando(false);
    },
    [equipamentosExistentes]
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

    const validos = parseados.filter((e) => e.valido);
    const novos: Equipamento[] = validos.map((e) => ({
      id: gerarId(),
      nome: e.nome,
      codigoPatrimonio: e.codigoPatrimonio,
      numeroSerie: e.numeroSerie,
      marca: e.marca,
      ano: e.ano,
      tipoMedicao: e.tipoMedicao as Equipamento['tipoMedicao'],
      medicaoInicial: e.medicaoInicial,
      ativo: true,
      dataAquisicao: e.dataAquisicao,
      dataVenda: '',
    }));

    onImport(novos);
    fechar();
  }, [parseados, onImport, fechar]);

  if (!open) return null;

  const validos = parseados?.filter((e) => e.valido).length ?? 0;
  const invalidos = parseados?.filter((e) => !e.valido).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={fechar} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {parseados
                ? `Preview - ${parseados.length} equipamento${parseados.length !== 1 ? 's' : ''} encontrado${parseados.length !== 1 ? 's' : ''}`
                : 'Importar Equipamentos do Excel'}
            </h2>
            {parseados && (
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-green-700">{validos} valido{validos !== 1 ? 's' : ''}</span>
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
                <p className="text-xs font-medium text-gray-600 mb-1">Formato esperado (8 colunas):</p>
                <div className="text-xs text-gray-500 font-mono overflow-x-auto">
                  <div className="grid grid-cols-8 gap-1 font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-1 min-w-[500px]">
                    <span>Nome</span>
                    <span>Patrimonio</span>
                    <span>N. Serie</span>
                    <span>Marca</span>
                    <span>Ano</span>
                    <span>Tipo Med.</span>
                    <span>Med. Ini.</span>
                    <span>Dt. Aquis.</span>
                  </div>
                  <div className="grid grid-cols-8 gap-1 min-w-[500px]">
                    <span>Escavadeira</span>
                    <span>PAT-001</span>
                    <span>CAT-001</span>
                    <span>CAT</span>
                    <span>2024</span>
                    <span>horimetro</span>
                    <span>0</span>
                    <span>2024-01-15</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {parseados.map((eq, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    eq.valido
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <span className="shrink-0 text-base">
                    {eq.valido ? '\u2705' : '\u274C'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${eq.valido ? 'text-gray-800' : 'text-red-800'}`}>
                        {eq.nome || '(sem nome)'}
                      </span>
                      {eq.marca && (
                        <>
                          <span className="text-gray-400">|</span>
                          <span className="text-gray-600">{eq.marca}</span>
                        </>
                      )}
                      <span className="text-gray-400">|</span>
                      <span className={eq.tipoMedicao ? 'text-gray-600' : 'text-red-500'}>
                        {eq.tipoMedicao || '(sem tipo)'}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className="text-gray-600">
                        {eq.medicaoInicial} {eq.tipoMedicao === 'horimetro' ? 'h' : 'km'}
                      </span>
                      <span className="text-gray-400">|</span>
                      <span className={eq.dataAquisicao ? 'text-gray-600' : 'text-red-500'}>
                        {eq.dataAquisicao || '(sem data)'}
                      </span>
                    </div>
                    {eq.erros.length > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {eq.erros.join(' · ')}
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
                  Importar {validos > 0 ? `${validos} Equipamento${validos !== 1 ? 's' : ''}` : ''}
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
