import type { Equipamento, Empresa, Fornecedor } from '../../types';
import { STATUS_EQUIPAMENTO_LABEL } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';
import Button from '../ui/Button';
import { Pencil, Building2, Hash, Calendar, Gauge, Tag, Key, Trash2 } from 'lucide-react';
import { getStatusOption } from './StatusDropdown';
import DocumentosEquipamentoSection from './documentos/DocumentosEquipamentoSection';
import FotosEquipamentoGaleria from './FotosEquipamentoGaleria';
import EspecificacoesEquipamentoSection from './especificacoes/EspecificacoesEquipamentoSection';
import FinanceiroEquipamentoSection from './financeiro/FinanceiroEquipamentoSection';

interface FrotaDetalheProps {
  equipamento: Equipamento;
  empresas: Empresa[];
  fornecedores: Fornecedor[];
  onEditar?: () => void;
  onExcluir?: () => void;
}

const TIPO_MEDICAO_LABEL: Record<string, string> = {
  horimetro: 'Horímetro',
  odometro: 'Odômetro',
  km: 'Quilometragem',
};

function formatarData(s: string): string {
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [a, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${a}`;
  }
  return s;
}

function Campo({
  label,
  valor,
  icon: Icon,
  mono,
}: {
  label: string;
  valor: string;
  icon?: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)] mb-1">
        {Icon && <Icon aria-hidden className="w-3.5 h-3.5" />}
        {label}
      </div>
      <p className={'text-sm font-medium text-[var(--color-fg)] ' + (mono ? 'font-mono break-all' : '')}>
        {valor || <span className="text-[var(--color-fg-subtle)] font-normal">—</span>}
      </p>
    </div>
  );
}

export default function FrotaDetalhe({ equipamento: eq, empresas, fornecedores, onEditar, onExcluir }: FrotaDetalheProps) {
  const cat = getCategoriaFrota(eq.tipo);
  const empresaNome = empresas.find((e) => e.id === eq.empresaId)?.nome ?? '—';
  const alugada = eq.propriedade === 'alugada';

  return (
    <div className="p-4 sm:p-5 space-y-5">
      {/* Header com hero do tipo */}
      <header className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden">
        <div aria-hidden className={`h-1.5 ${cat.cor}`} />
        <div className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-start gap-3 min-w-0 flex-1">
              <span
                aria-hidden
                className={`shrink-0 inline-flex items-center justify-center w-12 h-12 rounded-xl ${cat.corBg}`}
              >
                <span className={`text-xs font-bold ${cat.corTexto}`}>{cat.codigo}</span>
              </span>
              <div className="min-w-0">
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--color-fg)] leading-tight">
                  {eq.nome}
                </h2>
                <p className="text-sm text-[var(--color-fg-muted)] mt-0.5">
                  {cat.label}
                  {eq.modelo && (
                    <>
                      <span className="text-[var(--color-fg-subtle)]"> · </span>
                      {eq.modelo}
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {(() => {
                const so = getStatusOption(eq.status);
                return (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border"
                    style={{
                      backgroundColor: so.bg,
                      color: so.fg,
                      borderColor: `color-mix(in srgb, ${so.border} 30%, transparent)`,
                    }}
                  >
                    <span
                      aria-hidden
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: so.dot }}
                    />
                    {STATUS_EQUIPAMENTO_LABEL[eq.status]}
                  </span>
                );
              })()}
              <span
                className={
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ' +
                  (alugada
                    ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning-fg)] border-[var(--color-warning)]/30'
                    : 'bg-[var(--color-info-soft)] text-[var(--color-info-fg)] border-[var(--color-info)]/30')
                }
              >
                {alugada ? <Key aria-hidden className="w-3.5 h-3.5" /> : <Building2 aria-hidden className="w-3.5 h-3.5" />}
                {alugada ? 'Alugado' : 'Próprio'}
              </span>
              {onEditar && (
                <Button onClick={onEditar} variant="secondary" size="sm">
                  <Pencil aria-hidden className="w-3.5 h-3.5" />
                  Editar
                </Button>
              )}
              {onExcluir && (
                <Button onClick={onExcluir} variant="danger" size="sm">
                  <Trash2 aria-hidden className="w-3.5 h-3.5" />
                  Excluir
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Galeria de fotos */}
      <FotosEquipamentoGaleria fotoUrls={eq.fotoUrls ?? []} nomeEquipamento={eq.nome} />

      {/* Grid de campos */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
          Identificação
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Campo label="Patrimônio" valor={eq.codigoPatrimonio} icon={Hash} mono />
          <Campo label="Número de série" valor={eq.numeroSerie} icon={Hash} mono />
          <Campo label="Empresa" valor={empresaNome} icon={Building2} />
          <Campo label="Marca" valor={eq.marca} icon={Tag} />
          <Campo label="Modelo" valor={eq.modelo} icon={Tag} />
          <Campo label="Ano" valor={eq.ano} icon={Calendar} />
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] mb-2">
          Operação
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <Campo label="Tipo de medição" valor={TIPO_MEDICAO_LABEL[eq.tipoMedicao] ?? eq.tipoMedicao} icon={Gauge} />
          <Campo
            label="Medição inicial"
            valor={eq.medicaoInicial ? `${eq.medicaoInicial.toLocaleString('pt-BR')} ${eq.tipoMedicao === 'horimetro' ? 'h' : 'km'}` : '0'}
            icon={Gauge}
          />
          <Campo label="Data de aquisição" valor={formatarData(eq.dataAquisicao)} icon={Calendar} />
          {eq.dataVenda && <Campo label="Data de venda" valor={formatarData(eq.dataVenda)} icon={Calendar} />}
        </div>
      </section>

      <EspecificacoesEquipamentoSection equipamento={eq} />

      <FinanceiroEquipamentoSection equipamento={eq} fornecedores={fornecedores} />

      <DocumentosEquipamentoSection
        equipamentoId={eq.id}
        fornecedores={fornecedores}
      />
    </div>
  );
}
