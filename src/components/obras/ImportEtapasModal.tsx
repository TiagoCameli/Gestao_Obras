import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import type { EtapaObra } from '../../types';
import Button from '../ui/Button';

interface ImportEtapasModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (etapas: EtapaObra[]) => void;
  etapasExistentes: EtapaObra[];
  obraId: string;
}

interface EtapaParseada {
  nome: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valida: boolean;
  erros: string[];
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const TEMPLATE_DATA = [
  ['Nome da Etapa', 'Unidade de Medida', 'Quantidade', 'Valor Unitario'],
  ['Escavacao', 'm3', 150.0, 45.0],
  ['Fundacao (sapata)', 'm3', 80.0, 380.0],
  ['Impermeabilizacao', 'm2', 200.0, 25.0],
  ['Concreto estrutural', 'm3', 120.0, 450.0],
  ['Alvenaria', 'm2', 500.0, 65.0],
  ['Reboco interno', 'm2', 450.0, 35.0],
  ['Reboco externo', 'm2', 300.0, 40.0],
  ['Contrapiso', 'm2', 250.0, 28.0],
  ['Instalacao eletrica', 'm', 800.0, 18.0],
  ['Instalacao hidraulica', 'm', 400.0, 22.0],
  ['Pintura interna', 'm2', 450.0, 15.0],
  ['Pintura externa', 'm2', 300.0, 18.0],
  ['Ceramica piso', 'm2', 180.0, 45.0],
  ['Ceramica parede', 'm2', 120.0, 55.0],
  ['Telhado', 'm2', 200.0, 85.0],
];

function baixarTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(TEMPLATE_DATA);
  ws['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 15 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Etapas');
  XLSX.writeFile(wb, 'template_etapas.xlsx');
}

function parsePlanilha(data: ArrayBuffer): EtapaParseada[] {
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

  if (rows.length < 2) return [];

  // Pular header (primeira linha)
  return rows.slice(1)
    .filter((row) => row.some((cell) => cell !== undefined && cell !== null && String(cell).trim() !== ''))
    .map((row) => {
      const erros: string[] = [];
      const nome = String(row[0] ?? '').trim();
      const unidade = String(row[1] ?? '').trim();
      const qtdRaw = row[2];
      const valorRaw = row[3];
      let quantidade = 0;
      let valorUnitario = 0;

      if (!nome) erros.push('Nome vazio');

      if (qtdRaw === undefined || qtdRaw === null || String(qtdRaw).trim() === '') {
        erros.push('Falta quantidade');
      } else {
        const parsed = typeof qtdRaw === 'number' ? qtdRaw : parseFloat(String(qtdRaw).replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) {
          erros.push('Quantidade invalida');
        } else {
          quantidade = parsed;
        }
      }

      if (valorRaw === undefined || valorRaw === null || String(valorRaw).trim() === '') {
        erros.push('Falta valor');
      } else {
        const parsed = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw).replace(',', '.'));
        if (isNaN(parsed) || parsed <= 0) {
          erros.push('Valor invalido');
        } else {
          valorUnitario = parsed;
        }
      }

      return { nome, unidade, quantidade, valorUnitario, valida: erros.length === 0, erros };
    });
}

function resolverDuplicatas(novas: EtapaParseada[], existentes: EtapaObra[]): EtapaParseada[] {
  const nomesUsados = new Map<string, number>();
  for (const e of existentes) {
    const key = e.nome.toLowerCase();
    nomesUsados.set(key, (nomesUsados.get(key) || 0) + 1);
  }

  return novas.map((etapa) => {
    const key = etapa.nome.toLowerCase();
    const count = nomesUsados.get(key) || 0;
    if (count > 0) {
      const novoNome = `${etapa.nome} ${count + 1}`;
      nomesUsados.set(key, count + 1);
      return { ...etapa, nome: novoNome };
    }
    nomesUsados.set(key, 1);
    return etapa;
  });
}

export default function ImportEtapasModal({
  open,
  onClose,
  onImport,
  etapasExistentes,
  obraId,
}: ImportEtapasModalProps) {
  const [etapasParseadas, setEtapasParseadas] = useState<EtapaParseada[] | null>(null);
  const [dragAtivo, setDragAtivo] = useState(false);
  const [erro, setErro] = useState('');
  const [processando, setProcessando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const resetar = useCallback(() => {
    setEtapasParseadas(null);
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
          setErro('Nenhuma etapa encontrada no arquivo. Verifique se o formato esta correto.');
          setProcessando(false);
          return;
        }

        const comDuplicatas = resolverDuplicatas(resultado, etapasExistentes);
        setEtapasParseadas(comDuplicatas);
      } catch {
        setErro('Erro ao processar o arquivo. Verifique se e um Excel valido.');
      }
      setProcessando(false);
    },
    [etapasExistentes]
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
    if (!etapasParseadas) return;

    const validas = etapasParseadas.filter((e) => e.valida);
    const novasEtapas: EtapaObra[] = validas.map((e) => ({
      id: gerarId(),
      nome: e.nome,
      obraId,
      unidade: e.unidade,
      quantidade: e.quantidade,
      valorUnitario: e.valorUnitario,
    }));

    onImport(novasEtapas);
    fechar();
  }, [etapasParseadas, obraId, onImport, fechar]);

  if (!open) return null;

  const validas = etapasParseadas?.filter((e) => e.valida).length ?? 0;
  const invalidas = etapasParseadas?.filter((e) => !e.valida).length ?? 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/50" onClick={fechar} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              {etapasParseadas
                ? `Preview - ${etapasParseadas.length} etapa${etapasParseadas.length !== 1 ? 's' : ''} encontrada${etapasParseadas.length !== 1 ? 's' : ''}`
                : 'Importar Etapas do Excel'}
            </h2>
            {etapasParseadas && (
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-green-700">{validas} valida{validas !== 1 ? 's' : ''}</span>
                {invalidas > 0 && (
                  <span className="text-red-600">{invalidas} com erro</span>
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
          {!etapasParseadas ? (
            /* Tela de upload */
            <div className="space-y-4">
              <button
                type="button"
                onClick={baixarTemplate}
                className="inline-flex items-center gap-2 text-sm text-blue-700 hover:text-blue-900 font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Baixar Template Excel
              </button>

              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragAtivo
                    ? 'border-blue-500 bg-blue-50'
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
                    <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
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
                <p className="text-xs font-medium text-gray-600 mb-1">Formato esperado (4 colunas):</p>
                <div className="text-xs text-gray-500 font-mono">
                  <div className="grid grid-cols-4 gap-2 font-semibold text-gray-700 border-b border-gray-200 pb-1 mb-1">
                    <span>Nome da Etapa</span>
                    <span>Unidade</span>
                    <span>Quantidade</span>
                    <span>Valor Unitario</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <span>Escavacao</span>
                    <span>m3</span>
                    <span>150.00</span>
                    <span>45.00</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <span>Alvenaria</span>
                    <span>m2</span>
                    <span>500.00</span>
                    <span>65.00</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Tela de preview */
            <div className="space-y-3">
              {etapasParseadas.map((etapa, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm ${
                    etapa.valida
                      ? 'bg-green-50 border border-green-200'
                      : 'bg-red-50 border border-red-200'
                  }`}
                >
                  <span className="shrink-0 text-base">
                    {etapa.valida ? '\u2705' : '\u274C'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`font-medium ${etapa.valida ? 'text-gray-800' : 'text-red-800'}`}>
                        {etapa.nome || '(sem nome)'}
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-600">
                        {etapa.unidade || '-'}
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className={etapa.quantidade > 0 ? 'text-gray-600' : 'text-red-500'}>
                        Qtd: {etapa.quantidade > 0 ? etapa.quantidade : '0'}
                      </span>
                      <span className="text-gray-500">|</span>
                      <span className={etapa.valorUnitario > 0 ? 'text-gray-600' : 'text-red-500'}>
                        R$ {etapa.valorUnitario > 0 ? etapa.valorUnitario.toFixed(2) : '0,00'}
                      </span>
                    </div>
                    {etapa.erros.length > 0 && (
                      <p className="text-xs text-red-600 mt-0.5">
                        {etapa.erros.join(' · ')}
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
          {etapasParseadas ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={resetar}
                className="text-sm"
              >
                Voltar
              </Button>
              <div className="flex gap-3">
                <Button type="button" variant="secondary" onClick={fechar}>
                  Cancelar
                </Button>
                <Button
                  type="button"
                  onClick={confirmarImportacao}
                  disabled={validas === 0}
                >
                  Importar {validas > 0 ? `${validas} Etapa${validas !== 1 ? 's' : ''}` : ''}
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
