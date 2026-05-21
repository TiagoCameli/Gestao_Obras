import type { Frete, Insumo } from '../../types';
import FreteFotoChegadaBlock from './FreteFotoChegadaBlock';
import { useAtualizarFrete } from '../../hooks/useFretes';
import { useToast } from '../ui/Toast';

interface Props {
  frete: Frete;
  insumos: Insumo[];
  canEdit: boolean;
}

function fmtBRL(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtData(iso: string): string {
  if (!iso) return '—';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

export default function FreteRowExpanded({ frete, insumos: _insumos, canEdit }: Props) {
  const tkmCalc = frete.kmRodados * frete.pesoToneladas;
  const valorMaterialUnit = frete.valorMaterial && frete.pesoToneladas > 0
    ? frete.valorMaterial / frete.pesoToneladas
    : 0;
  const atualizarMutation = useAtualizarFrete();
  const { showToast } = useToast();

  const handleDataChegadaChange = (novaData: string) => {
    atualizarMutation.mutate(
      { ...frete, dataChegada: novaData },
      {
        onSuccess: () => showToast({ kind: 'success', message: 'Data de chegada atualizada.' }),
        onError: (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          showToast({ kind: 'error', message: `Falha ao salvar: ${msg}` });
        },
      },
    );
  };

  return (
    <div className="bg-[var(--color-surface-1)] border-t border-[var(--color-border)] p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Coluna 1: Fotos de chegada (reusa Fase A) */}
        <div>
          <FreteFotoChegadaBlock frete={frete} canEdit={canEdit} variant="compact" />
        </div>

        {/* Coluna 2: Motorista + NF + Datas */}
        <div className="space-y-2 text-xs">
          <Field label="Motorista" value={frete.motorista || '—'} />
          <Field label="Placa" value={frete.placaCarreta || '—'} />
          <Field label="NF" value={frete.notaFiscal || '—'} />
          {frete.notaFiscal2 && <Field label="NF 2" value={frete.notaFiscal2} />}
          <Field
            label="Data chegada"
            value={canEdit ? (
              <input
                type="date"
                value={frete.dataChegada || ''}
                onChange={(e) => handleDataChegadaChange(e.target.value)}
                disabled={atualizarMutation.isPending}
                className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-2 py-0.5 text-xs text-[var(--color-fg)] focus:outline-none focus:border-[var(--color-accent)] disabled:opacity-50"
              />
            ) : (
              fmtData(frete.dataChegada || '')
            )}
          />
        </div>

        {/* Coluna 3: Financeiro */}
        <div className="space-y-2 text-xs">
          <Field label="KM rodados" value={`${(frete.kmRodados ?? 0).toLocaleString('pt-BR')} km`} />
          <Field label="R$ / TKM" value={`${fmtBRL(frete.valorTkm)} (TKM=${tkmCalc.toLocaleString('pt-BR')})`} />
          <Field label="Valor frete" value={fmtBRL(frete.valorTotal)} />
          <Field label="Valor material (total)" value={fmtBRL(frete.valorMaterial || 0)} />
          {valorMaterialUnit > 0 && (
            <Field label="Valor material (R$/t)" value={fmtBRL(valorMaterialUnit) + '/t'} />
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-[var(--color-fg-muted)] font-semibold">{label}</div>
      <div className="text-sm text-[var(--color-fg)] mt-0.5">{value}</div>
    </div>
  );
}
