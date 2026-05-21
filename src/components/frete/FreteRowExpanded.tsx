import type { Frete, Obra, Insumo, PagamentoFrete } from '../../types';
import FreteFotoChegadaBlock from './FreteFotoChegadaBlock';

interface Props {
  frete: Frete;
  obras: Obra[];
  insumos: Insumo[];
  pagamentosFrete: PagamentoFrete[];
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

export default function FreteRowExpanded({ frete, obras: _obras, insumos: _insumos, pagamentosFrete, canEdit }: Props) {
  const tkmCalc = frete.kmRodados * frete.pesoToneladas;
  // Heurística: existe algum pagamento da mesma transportadora que cobre o
  // período deste frete? Sem FK direta frete→pagamento no modelo atual.
  const pagto = pagamentosFrete.find(
    (p) => p.transportadora === frete.transportadora && p.data >= frete.data,
  );
  const statusPagto = pagto ? 'Pago' : 'Pendente';

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
          <Field label="Data chegada" value={fmtData(frete.dataChegada || '')} />
        </div>

        {/* Coluna 3: Financeiro */}
        <div className="space-y-2 text-xs">
          <Field label="R$ / TKM" value={`${fmtBRL(frete.valorTkm)} (TKM=${tkmCalc.toLocaleString('pt-BR')})`} />
          <Field label="Valor frete" value={fmtBRL(frete.valorTotal)} />
          <Field label="Valor material" value={fmtBRL(frete.valorMaterial || 0)} />
          <Field label="Pagamento" value={
            <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              statusPagto === 'Pago'
                ? 'bg-[color:color-mix(in_srgb,#10b981_22%,transparent)] text-emerald-700 dark:text-emerald-300'
                : 'bg-[color:color-mix(in_srgb,#f59e0b_22%,transparent)] text-amber-700 dark:text-amber-300'
            }`}>{statusPagto}</span>
          } />
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
