import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import type { Frete, Insumo } from '../../types';

interface UpdateRow {
  id: string;
  notaFiscal?: string;
  notaFiscal2?: string;
  valorMaterial?: number;
  resumo: string;
  erros: string[];
  valido: boolean;
}

interface Props {
  open: boolean;
  onClose: () => void;
  fretes: Frete[];
  insumos: Insumo[];
  onUpdate: (updates: Partial<Frete>[]) => void;
}

export default function ImportAtualizacaoFretesModal({ open, onClose, fretes, insumos, onUpdate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<UpdateRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importando, setImportando] = useState(false);

  const fretesMap = new Map(fretes.map((f) => [f.id, f]));
  const insumosMap = new Map(insumos.map((i) => [i.id, i.nome]));

  const handleFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setFileName(file.name);

      const reader = new FileReader();
      reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        // Preferir aba "Fretes" (padrão do export), senão usar a primeira
        const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'fretes') || wb.SheetNames[0];
        const ws = wb.Sheets[sheetName];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        // Find header row
        const headerIdx = raw.findIndex((r) =>
          r.some((cell) => String(cell).toUpperCase() === 'ID')
        );
        if (headerIdx === -1) {
          setRows([{ id: '', resumo: '', erros: ['Coluna "ID" não encontrada no cabeçalho'], valido: false }]);
          return;
        }

        const headers = (raw[headerIdx] as string[]).map((h) => String(h).trim().toUpperCase());
        const idCol = headers.indexOf('ID');
        const nfCol = headers.findIndex((h) => h === 'NOTA FISCAL' || h === 'NF');
        const nf2Col = headers.findIndex((h) => h === 'NOTA FISCAL 2' || h === 'NF 2' || h === 'NF2');
        const valorMatCol = headers.findIndex((h) => h.includes('MATERIAL') && h.includes('R$') || h === 'PREÇO MATERIAL (R$)' || h === 'VALOR MATERIAL');
        const valorUnitMatCol = headers.findIndex((h) => h.includes('UNIT') && h.includes('MATERIAL'));

        const parsed: UpdateRow[] = [];

        for (let i = headerIdx + 1; i < raw.length; i++) {
          const row = raw[i];
          if (!row || !row[idCol]) continue;

          const id = String(row[idCol]).trim();
          const erros: string[] = [];
          const frete = fretesMap.get(id);

          if (!frete) {
            erros.push('ID não encontrado no sistema');
            parsed.push({ id, resumo: `ID: ${id.slice(0, 8)}...`, erros, valido: false });
            continue;
          }

          const material = insumosMap.get(frete.insumoId) || '-';
          let notaFiscal: string | undefined;
          let notaFiscal2: string | undefined;
          let valorMaterial: number | undefined;

          if (nfCol >= 0 && row[nfCol] !== undefined && row[nfCol] !== null && String(row[nfCol]).trim() !== '') {
            notaFiscal = String(row[nfCol]).trim();
          }

          if (nf2Col >= 0 && row[nf2Col] !== undefined && row[nf2Col] !== null && String(row[nf2Col]).trim() !== '') {
            notaFiscal2 = String(row[nf2Col]).trim();
          }

          if (valorMatCol >= 0 && row[valorMatCol] !== undefined && row[valorMatCol] !== null && String(row[valorMatCol]).trim() !== '') {
            const val = typeof row[valorMatCol] === 'number' ? row[valorMatCol] : parseFloat(String(row[valorMatCol]).replace(',', '.'));
            if (isNaN(val as number)) {
              erros.push('Valor material inválido');
            } else {
              valorMaterial = val as number;
            }
          }

          if (valorUnitMatCol >= 0 && valorMaterial === undefined && row[valorUnitMatCol] !== undefined && row[valorUnitMatCol] !== null && String(row[valorUnitMatCol]).trim() !== '') {
            const val = typeof row[valorUnitMatCol] === 'number' ? row[valorUnitMatCol] : parseFloat(String(row[valorUnitMatCol]).replace(',', '.'));
            if (isNaN(val as number)) {
              erros.push('Valor unit. material inválido');
            } else {
              valorMaterial = (val as number) * frete.pesoToneladas;
            }
          }

          const changes: string[] = [];
          if (notaFiscal !== undefined && notaFiscal !== frete.notaFiscal) changes.push(`NF: "${frete.notaFiscal || '-'}" → "${notaFiscal}"`);
          if (notaFiscal2 !== undefined && notaFiscal2 !== frete.notaFiscal2) changes.push(`NF2: "${frete.notaFiscal2 || '-'}" → "${notaFiscal2}"`);
          if (valorMaterial !== undefined && valorMaterial !== frete.valorMaterial) changes.push(`Mat: ${frete.valorMaterial.toFixed(2)} → ${valorMaterial.toFixed(2)}`);

          if (changes.length === 0 && erros.length === 0) continue;

          const resumo = `${frete.data} | ${frete.transportadora} | ${material} | ${changes.join(' | ')}`;

          parsed.push({
            id,
            notaFiscal,
            notaFiscal2,
            valorMaterial,
            resumo,
            erros,
            valido: erros.length === 0 && changes.length > 0,
          });
        }

        setRows(parsed);
      };
      reader.readAsArrayBuffer(file);
    },
    [fretesMap, insumosMap]
  );

  const validos = rows.filter((r) => r.valido);
  const invalidos = rows.filter((r) => !r.valido);

  const handleImportar = useCallback(() => {
    setImportando(true);
    const updates = validos.map((r) => {
      const frete = fretesMap.get(r.id)!;
      const updated: Partial<Frete> & { id: string } = { id: r.id };
      if (r.notaFiscal !== undefined) updated.notaFiscal = r.notaFiscal;
      if (r.notaFiscal2 !== undefined) updated.notaFiscal2 = r.notaFiscal2;
      if (r.valorMaterial !== undefined) updated.valorMaterial = r.valorMaterial;
      // Merge with existing data for full update
      return { ...frete, ...updated };
    });
    onUpdate(updates as Frete[]);
    setImportando(false);
    setRows([]);
    setFileName('');
    onClose();
  }, [validos, fretesMap, onUpdate, onClose]);

  const handleClose = () => {
    setRows([]);
    setFileName('');
    onClose();
  };

  return (
    <Modal open={open} onClose={handleClose} title="Atualizar Fretes via Planilha" size="xl">
      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          <p className="font-medium mb-1">Como usar:</p>
          <ol className="list-decimal list-inside space-y-1 text-xs">
            <li>Exporte o Excel dos fretes (botão "Exportar Excel" na aba Fretes)</li>
            <li>Edite as colunas que deseja alterar: <strong>Nota Fiscal</strong>, <strong>Nota Fiscal 2</strong>, <strong>Preço Material (R$)</strong> ou <strong>Preço Unit. Material (R$/t)</strong></li>
            <li>Importe o arquivo editado aqui — somente as linhas alteradas serão atualizadas</li>
          </ol>
          <p className="text-xs mt-2 text-blue-600">A coluna <strong>ID</strong> é obrigatória para identificar cada frete.</p>
        </div>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={handleFile}
          />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            {fileName || 'Selecionar arquivo Excel'}
          </Button>
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex gap-4 text-sm">
              <span className="text-green-700 font-medium">{validos.length} alteração(ões) válida(s)</span>
              {invalidos.length > 0 && (
                <span className="text-red-600 font-medium">{invalidos.length} com erro(s)</span>
              )}
            </div>

            <div className="max-h-72 overflow-y-auto border rounded-lg divide-y">
              {rows.map((r, i) => (
                <div
                  key={i}
                  className={`px-3 py-2 text-xs ${r.valido ? 'bg-green-50' : 'bg-red-50'}`}
                >
                  <p className={r.valido ? 'text-green-800' : 'text-red-800'}>
                    {r.resumo}
                  </p>
                  {r.erros.length > 0 && (
                    <p className="text-red-600 mt-0.5">{r.erros.join(', ')}</p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleImportar}
                disabled={validos.length === 0 || importando}
              >
                {importando ? 'Atualizando...' : `Atualizar ${validos.length} frete(s)`}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
