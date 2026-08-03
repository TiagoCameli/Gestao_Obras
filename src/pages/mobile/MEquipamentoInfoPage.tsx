// Marco 7 / PR32 — Página de informações do equipamento no mobile.
//
// Mostra dados cadastrais essenciais pro operador conferir antes de operar.

import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Hash, Tag, Calendar, Gauge, Key, AlertTriangle } from 'lucide-react';
import { useEquipamentos } from '../../hooks/useEquipamentos';
import { useMedicaoAtual } from '../../hooks/useMedicoesEquipamento';
import { useEmpresas } from '../../hooks/useEmpresas';
import { getCategoriaFrota } from '../../lib/frotaConstants';
import { STATUS_EQUIPAMENTO_LABEL } from '../../types';
import FotoGaleria from '../../components/shared/FotoGaleria';

function Linha({
  icon: Icon, label, valor,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  valor: string;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[var(--color-border)] last:border-b-0">
      <Icon className="w-4 h-4 text-[var(--color-fg-subtle)] mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-[var(--color-fg-muted)]">{label}</div>
        <div className="text-sm text-[var(--color-fg)] mt-0.5">{valor || <span className="text-[var(--color-fg-subtle)]">—</span>}</div>
      </div>
    </div>
  );
}

export default function MEquipamentoInfoPage() {
  const { equipamentoId } = useParams<{ equipamentoId: string }>();
  const { data: equipamentos = [] } = useEquipamentos();
  const equipamento = equipamentos.find((e) => e.id === equipamentoId);
  const { data: medicaoAtual } = useMedicaoAtual(equipamentoId ?? null);
  const { data: empresas = [] } = useEmpresas();

  if (!equipamento) {
    return (
      <div className="space-y-3">
        <Link to="/m" className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </Link>
        <div className="rounded-xl border border-[var(--color-danger)]/40 bg-[var(--color-danger-soft)] p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-[var(--color-danger-fg)] mx-auto mb-2" />
          <p className="text-sm font-medium text-[var(--color-danger-fg)]">Equipamento não encontrado</p>
        </div>
      </div>
    );
  }

  const cat = getCategoriaFrota(equipamento.tipo);
  const empresaNome = empresas.find((e) => e.id === equipamento.empresaId)?.nome ?? '—';
  const unidade = equipamento.tipoMedicao === 'horimetro' ? 'h' : 'km';

  return (
    <div className="space-y-3">
      <Link to={`/m/eq/${equipamento.id}`} className="inline-flex items-center gap-1 text-sm text-[var(--color-fg-muted)]">
        <ArrowLeft className="w-4 h-4" /> Voltar
      </Link>

      {/* Header com ícone categoria */}
      <div className="rounded-2xl overflow-hidden border border-[var(--color-border)] bg-[var(--color-surface-1)]">
        <div aria-hidden className={`h-1.5 ${cat.cor}`} />
        <div className="p-3 flex items-start gap-3">
          <span className={`shrink-0 inline-flex items-center justify-center w-14 h-14 rounded-xl ${cat.corBg}`}>
            <span className={`text-sm font-bold ${cat.corTexto}`}>{cat.codigo}</span>
          </span>
          <div className="min-w-0 flex-1">
            {equipamento.codigoPatrimonio && (
              <div className="text-[11px] font-mono text-[var(--color-fg-muted)] truncate">
                {equipamento.codigoPatrimonio}
              </div>
            )}
            <h1 className="text-base font-semibold text-[var(--color-fg)]">{equipamento.nome}</h1>
            <p className="text-xs text-[var(--color-fg-muted)] mt-0.5">
              {equipamento.tipo}{equipamento.modelo && ` · ${equipamento.modelo}`}
            </p>
          </div>
        </div>
      </div>

      {/* Galeria de fotos (se houver) */}
      {(equipamento.fotoUrls ?? []).length > 0 && (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-2">
          <FotoGaleria
            fotoUrls={equipamento.fotoUrls ?? []}
            canDelete={false}
            canDownload
          />
        </div>
      )}

      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] pt-1 px-1">
        Identificação
      </h2>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3">
        <Linha icon={Hash} label="Patrimônio" valor={equipamento.codigoPatrimonio} />
        <Linha icon={Hash} label="Número de série" valor={equipamento.numeroSerie} />
        <Linha icon={Building2} label="Empresa" valor={empresaNome} />
        <Linha icon={Tag} label="Marca" valor={equipamento.marca} />
        <Linha icon={Tag} label="Modelo" valor={equipamento.modelo} />
        <Linha icon={Calendar} label="Ano" valor={equipamento.ano} />
      </div>

      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-fg-muted)] pt-1 px-1">
        Operação
      </h2>
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-3">
        <Linha
          icon={Gauge}
          label="Tipo de medição"
          valor={equipamento.tipoMedicao === 'horimetro' ? 'Horímetro' : 'Odômetro'}
        />
        <Linha
          icon={Gauge}
          label="Medição atual"
          valor={medicaoAtual
            ? `${medicaoAtual.medicaoAtual.toLocaleString('pt-BR')} ${unidade}`
            : `${equipamento.medicaoInicial.toLocaleString('pt-BR')} ${unidade} (inicial)`}
        />
        <Linha
          icon={Key}
          label="Propriedade"
          valor={equipamento.propriedade === 'alugada' ? 'Alugado' : 'Próprio'}
        />
        <Linha
          icon={AlertTriangle}
          label="Status"
          valor={STATUS_EQUIPAMENTO_LABEL[equipamento.status] ?? equipamento.status}
        />
      </div>
    </div>
  );
}
