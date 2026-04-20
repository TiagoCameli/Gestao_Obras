import type { Equipamento, Empresa } from '../../types';
import { getCategoriaFrota } from '../../lib/frotaConstants';
import Button from '../ui/Button';

interface FrotaDetalheProps {
  equipamento: Equipamento;
  empresas: Empresa[];
  onEditar?: () => void;
}

function Campo({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-800 dark:text-slate-200">{valor || '—'}</p>
    </div>
  );
}

export default function FrotaDetalhe({ equipamento: eq, empresas, onEditar }: FrotaDetalheProps) {
  const cat = getCategoriaFrota(eq.tipo);
  const empresaNome = empresas.find((e) => e.id === eq.empresaId)?.nome ?? '—';

  const tipoMedicaoLabel: Record<string, string> = {
    horimetro: 'Horímetro',
    odometro: 'Odômetro',
    km: 'Quilometragem',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold ${cat.corBg} ${cat.corTexto}`}>
            <span className={`w-2 h-2 rounded-full ${cat.cor}`} />
            {cat.label}
          </span>
          <span className={`text-sm font-medium px-3 py-1 rounded-full ${
            eq.ativo
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
              : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
          }`}>
            {eq.ativo ? 'Ativo' : 'Inativo'}
          </span>
        </div>
        {onEditar && (
          <Button onClick={onEditar} variant="secondary" className="text-sm">
            Editar
          </Button>
        )}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Campo label="Nome" valor={eq.nome} />
        <Campo label="Tipo" valor={eq.tipo || 'Não definido'} />
        <Campo label="Marca" valor={eq.marca} />
        <Campo label="Ano" valor={eq.ano} />
        <Campo label="Código Patrimônio" valor={eq.codigoPatrimonio} />
        <Campo label="Número de Série" valor={eq.numeroSerie} />
        <Campo label="Empresa" valor={empresaNome} />
        <Campo label="Tipo de Medição" valor={tipoMedicaoLabel[eq.tipoMedicao] ?? eq.tipoMedicao} />
        <Campo label="Medição Inicial" valor={eq.medicaoInicial ? String(eq.medicaoInicial) : '0'} />
        <Campo label="Data de Aquisição" valor={eq.dataAquisicao ? new Date(eq.dataAquisicao).toLocaleDateString('pt-BR') : ''} />
        {eq.dataVenda && (
          <Campo label="Data de Venda" valor={new Date(eq.dataVenda).toLocaleDateString('pt-BR')} />
        )}
      </div>
    </div>
  );
}
