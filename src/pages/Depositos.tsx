/**
 * Depósitos — página principal (Fase D1).
 *
 * Mostra todos os depósitos como cards: depósitos de material + tanques de
 * combustível misturados (com chip diferenciador). Filtros por tipo, obra
 * vinculada e ativo. Click em card de material abre detalhe (Fase D2);
 * click em tanque leva pra /combustivel.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Filter } from 'lucide-react';
import {
  useDepositosMaterialV2,
  useVincularObrasDeposito,
  useResumoSaldosTodos,
} from '../hooks/useDepositosObras';
import { useAdicionarDepositoMaterial, useAtualizarDepositoMaterial } from '../hooks/useDepositosMaterial';
import { useDepositos } from '../hooks/useDepositos';
import { useQueryClient } from '@tanstack/react-query';
import { useObras } from '../hooks/useObras';
import { useEtapas } from '../hooks/useEtapas';
import { useInsumos } from '../hooks/useInsumos';
import { useFornecedores } from '../hooks/useFornecedores';
import { useAdicionarEntradaMaterial } from '../hooks/useEntradasMaterial';
import { useAdicionarSaidaMaterial } from '../hooks/useSaidasMaterial';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import DepositoCard from '../components/depositos/DepositoCard';
import DepositoMaterialForm from '../components/depositos/DepositoMaterialForm';
import DepositoDetalheModal from '../components/depositos/DepositoDetalheModal';
import EntradaMaterialForm from '../components/depositos/EntradaMaterialForm';
import SaidaMaterialForm from '../components/depositos/SaidaMaterialForm';
import type { DepositoMaterial, EntradaMaterial, SaidaMaterial } from '../types';

type FiltroTipo = '' | 'material' | 'combustivel';
type FiltroAtivo = '' | 'ativo' | 'inativo';

export default function Depositos() {
  const navigate = useNavigate();
  const { temAcao, usuario } = useAuth();
  const { showToast } = useToast();
  const podeCriar = temAcao('criar_deposito');
  const podeEditar = temAcao('editar_deposito');
  const podeEntrada = temAcao('criar_entrada_material_avulsa') || temAcao('criar_entrada_material');
  const podeSaida = temAcao('criar_saida_material');
  const podeTransferencia = temAcao('criar_transferencia_material');

  const { data: depositosMat = [], isLoading: loadingMat } = useDepositosMaterialV2();
  const { data: tanques = [], isLoading: loadingComb } = useDepositos();
  const { data: obras = [] } = useObras();
  const { data: etapas = [] } = useEtapas();
  const { data: insumos = [] } = useInsumos();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: resumoSaldos } = useResumoSaldosTodos();
  const adicionarEntradaMut = useAdicionarEntradaMaterial();
  const adicionarSaidaMut = useAdicionarSaidaMaterial();
  const qc = useQueryClient();
  const adicionarMut = useAdicionarDepositoMaterial();
  const atualizarMut = useAtualizarDepositoMaterial();
  const vincularObrasMut = useVincularObrasDeposito();

  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<FiltroTipo>('');
  const [filtroObra, setFiltroObra] = useState<string>('');
  const [filtroAtivo, setFiltroAtivo] = useState<FiltroAtivo>('ativo');

  const [modalAberto, setModalAberto] = useState(false);
  const [editando, setEditando] = useState<DepositoMaterial | null>(null);
  const [detalheDeposito, setDetalheDeposito] = useState<DepositoMaterial | null>(null);
  const [entradaPara, setEntradaPara] = useState<DepositoMaterial | null>(null);
  const [saidaPara, setSaidaPara] = useState<DepositoMaterial | null>(null);

  const insumosMap = useMemo(() => new Map(insumos.map((i) => [i.id, i])), [insumos]);

  const obrasOptions = useMemo(() => obras.map((o) => ({ value: o.id, label: o.nome })), [obras]);

  // Combina material + combustível em uma lista unificada de "itens" pra renderizar
  type Item =
    | { kind: 'material'; deposito: DepositoMaterial; sortKey: string }
    | { kind: 'combustivel'; tanque: typeof tanques[number]; sortKey: string };

  const itens = useMemo<Item[]>(() => {
    const list: Item[] = [];
    const q = busca.trim().toLowerCase();

    if (filtroTipo !== 'combustivel') {
      for (const d of depositosMat) {
        if (filtroAtivo === 'ativo' && !d.ativo) continue;
        if (filtroAtivo === 'inativo' && d.ativo) continue;
        if (filtroObra && !(d.obrasIds ?? []).includes(filtroObra)) continue;
        if (q && !d.nome.toLowerCase().includes(q) && !d.responsavel.toLowerCase().includes(q)) continue;
        list.push({ kind: 'material', deposito: d, sortKey: d.nome.toLowerCase() });
      }
    }
    if (filtroTipo !== 'material' && !filtroObra) {
      for (const t of tanques) {
        if (filtroAtivo === 'ativo' && !t.ativo) continue;
        if (filtroAtivo === 'inativo' && t.ativo) continue;
        const nome = (t.apelido || t.nome || '').toLowerCase();
        if (q && !nome.includes(q)) continue;
        list.push({ kind: 'combustivel', tanque: t, sortKey: nome });
      }
    }
    return list.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }, [depositosMat, tanques, filtroTipo, filtroObra, filtroAtivo, busca]);

  const handleSubmit = useCallback(
    async (dep: DepositoMaterial, obrasIds: string[]) => {
      const ehNovo = !editando;
      if (ehNovo) {
        await adicionarMut.mutateAsync(dep);
      } else {
        await atualizarMut.mutateAsync(dep);
      }
      // Sincroniza N:N
      await vincularObrasMut.mutateAsync({
        depositoId: dep.id,
        obrasIds,
        criadoPor: usuario?.nome || '',
      });
      setModalAberto(false);
      setEditando(null);
    },
    [editando, adicionarMut, atualizarMut, vincularObrasMut, usuario]
  );

  const handleAbrirMaterial = useCallback((d: DepositoMaterial) => {
    setDetalheDeposito(d);
  }, []);

  const handleAvisarEmConstrucao = useCallback((tipo: string) => {
    showToast({ kind: 'info', message: `Formulário de ${tipo} chega na próxima fase (D4).` });
  }, [showToast]);

  // Invalida queries de saldo após movimentação
  const invalidarSaldos = useCallback((depositoId: string) => {
    qc.invalidateQueries({ queryKey: ['saldos_deposito', depositoId] });
    qc.invalidateQueries({ queryKey: ['resumo_saldos_todos'] });
    qc.invalidateQueries({ queryKey: ['entradas_material'] });
    qc.invalidateQueries({ queryKey: ['saidas_material'] });
  }, [qc]);

  const handleSubmitEntrada = useCallback(async (entrada: EntradaMaterial) => {
    await adicionarEntradaMut.mutateAsync(entrada);
    invalidarSaldos(entrada.depositoMaterialId);
    setEntradaPara(null);
  }, [adicionarEntradaMut, invalidarSaldos]);

  const handleSubmitSaida = useCallback(async (saida: SaidaMaterial) => {
    await adicionarSaidaMut.mutateAsync(saida);
    invalidarSaldos(saida.depositoMaterialId);
    setSaidaPara(null);
  }, [adicionarSaidaMut, invalidarSaldos]);

  const handleAbrirCombustivel = useCallback((tanqueId: string) => {
    showToast({ kind: 'info', message: 'Abrindo no módulo Combustível…' });
    navigate(`/combustivel?tanque=${tanqueId}`);
  }, [navigate, showToast]);

  const carregando = loadingMat || loadingComb;

  return (
    <div>
      <header className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <h1 className="text-2xl sm:text-[28px] font-semibold tracking-tight text-[var(--color-fg)]">
          Depósitos
        </h1>
        {podeCriar && (
          <Button onClick={() => { setEditando(null); setModalAberto(true); }}>
            <Plus className="w-4 h-4" /> Novo depósito
          </Button>
        )}
      </header>

      {/* Busca + filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="relative max-w-md flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" />
          <input
            id="busca-depositos"
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg)] placeholder:text-[var(--color-fg-subtle)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]/40 focus:border-[var(--color-accent)]"
            placeholder="Buscar por nome ou responsável…"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>
        <FilterPill
          label="Tipo"
          value={filtroTipo}
          onChange={(v) => setFiltroTipo(v as FiltroTipo)}
          options={[
            { value: '', label: 'Todos' },
            { value: 'material', label: 'Material' },
            { value: 'combustivel', label: 'Combustível' },
          ]}
        />
        <FilterPill
          label="Obra"
          value={filtroObra}
          onChange={setFiltroObra}
          options={[{ value: '', label: 'Todas' }, ...obrasOptions]}
        />
        <FilterPill
          label="Status"
          value={filtroAtivo}
          onChange={(v) => setFiltroAtivo(v as FiltroAtivo)}
          options={[
            { value: 'ativo', label: 'Ativos' },
            { value: '', label: 'Todos' },
            { value: 'inativo', label: 'Inativos' },
          ]}
        />
        <span className="ml-auto text-xs text-[var(--color-fg-muted)]">
          {itens.length} depósito{itens.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid de cards */}
      {carregando ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] animate-pulse" />
          ))}
        </div>
      ) : itens.length === 0 ? (
        <EmptyState busca={busca} podeCriar={podeCriar} onCriar={() => { setEditando(null); setModalAberto(true); }} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {itens.map((it) =>
            it.kind === 'material' ? (
              <DepositoCard
                key={`m-${it.deposito.id}`}
                tipo="material"
                deposito={it.deposito}
                obras={obras}
                resumo={resumoSaldos?.get(it.deposito.id)}
                onAbrir={() => handleAbrirMaterial(it.deposito)}
              />
            ) : (
              <DepositoCard
                key={`c-${it.tanque.id}`}
                tipo="combustivel"
                tanque={it.tanque}
                insumoNome={it.tanque.combustivelAtualId ? insumosMap.get(it.tanque.combustivelAtualId)?.nome : undefined}
                onAbrir={() => handleAbrirCombustivel(it.tanque.id)}
              />
            )
          )}
        </div>
      )}

      {/* Modal de criar/editar depósito */}
      <Modal
        open={modalAberto}
        onClose={() => { setModalAberto(false); setEditando(null); }}
        title={editando ? `Editar depósito ${editando.nome}` : 'Novo depósito de material'}
        size="lg"
      >
        <DepositoMaterialForm
          initial={editando}
          obras={obras}
          onSubmit={handleSubmit}
          onCancel={() => { setModalAberto(false); setEditando(null); }}
        />
      </Modal>

      {/* Modal de detalhe do depósito (D2) */}
      <DepositoDetalheModal
        open={!!detalheDeposito}
        deposito={detalheDeposito}
        obras={obras}
        insumos={insumos}
        fornecedores={fornecedores}
        onClose={() => setDetalheDeposito(null)}
        onEditar={(d) => {
          setDetalheDeposito(null);
          setEditando(d);
          setModalAberto(true);
        }}
        onNovaEntrada={(d) => { setDetalheDeposito(null); setEntradaPara(d); }}
        onNovaSaida={(d) => { setDetalheDeposito(null); setSaidaPara(d); }}
        onNovaTransferencia={() => handleAvisarEmConstrucao('transferência')}
        canEdit={podeEditar}
        canEntrada={podeEntrada}
        canSaida={podeSaida}
        canTransferencia={podeTransferencia}
      />

      {/* Modal de Entrada de material (D3) */}
      <Modal
        open={!!entradaPara}
        onClose={() => setEntradaPara(null)}
        title={entradaPara ? `Nova entrada — ${entradaPara.nome}` : 'Nova entrada'}
        size="lg"
      >
        {entradaPara && (
          <EntradaMaterialForm
            deposito={entradaPara}
            insumos={insumos}
            fornecedores={fornecedores}
            onSubmit={handleSubmitEntrada}
            onCancel={() => setEntradaPara(null)}
          />
        )}
      </Modal>

      {/* Modal de Saída de material (D3) */}
      <Modal
        open={!!saidaPara}
        onClose={() => setSaidaPara(null)}
        title={saidaPara ? `Nova saída — ${saidaPara.nome}` : 'Nova saída'}
        size="lg"
      >
        {saidaPara && (
          <SaidaMaterialForm
            deposito={saidaPara}
            insumos={insumos}
            etapas={etapas}
            obras={obras}
            onSubmit={handleSubmitSaida}
            onCancel={() => setSaidaPara(null)}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── auxiliares ──────────────────────────────────────────────────────────

function FilterPill<T extends string>({
  label, value, onChange, options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const ativo = value !== '';
  return (
    <label className={
      'inline-flex items-center gap-1.5 pl-2.5 pr-1 h-8 rounded-md text-xs font-medium border transition-colors cursor-pointer ' +
      (ativo
        ? 'bg-[var(--color-accent)]/10 text-[var(--color-fg)] border-[var(--color-accent)]/30'
        : 'bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]')
    }>
      <Filter className="w-3 h-3 opacity-70" />
      <span>{label}:</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-transparent border-0 focus:outline-none text-xs font-medium pr-1 max-w-[180px]"
      >
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </label>
  );
}

function EmptyState({ busca, podeCriar, onCriar }: { busca: string; podeCriar: boolean; onCriar: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-border)] py-16 text-center">
      <h3 className="text-base font-semibold text-[var(--color-fg)] mb-1">
        {busca ? 'Nenhum depósito encontrado' : 'Nenhum depósito cadastrado ainda'}
      </h3>
      <p className="text-sm text-[var(--color-fg-muted)] max-w-md mx-auto mb-4">
        {busca
          ? 'Ajuste a busca ou os filtros para encontrar o depósito.'
          : podeCriar
            ? 'Crie seu primeiro depósito para começar a controlar materiais por obra ou central.'
            : 'Quando alguém criar um depósito, ele aparecerá aqui.'}
      </p>
      {!busca && podeCriar && (
        <Button onClick={onCriar}>
          <Plus className="w-4 h-4" /> Criar primeiro depósito
        </Button>
      )}
    </div>
  );
}
