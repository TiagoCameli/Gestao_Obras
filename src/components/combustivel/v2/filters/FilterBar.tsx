// Barra global de filtros — sticky abaixo do header da página.
// Cada controle é um botão que abre Popover com seu painel.
// Tipos de combustível ficam como chips inline (toggle direto).

import { useEffect, useMemo, useState } from 'react';
import { Bookmark, Calendar, ChevronDown, Filter as FilterIcon } from 'lucide-react';
import type { Deposito, Equipamento, Fornecedor, Insumo, Obra } from '../../../../types';
import type { CombustivelTabId } from '../CombustivelTabsNav';
import { useCombustivelFilter } from './FilterContext';
import Popover from './Popover';
import PeriodoPanel from './PeriodoPanel';
import MultiSelectPanel from './MultiSelectPanel';
import SavedViewsPopover from './SavedViewsPopover';
import { loadSavedViews } from './savedViews';
import type { SavedView } from './types';
import { fmtPeriodo } from '../shared/formatters';

interface Props {
  obras: Obra[];
  equipamentos: Equipamento[];
  combustiveis: Insumo[];
  /** Lista de fornecedores derivada das entradas (text livre, distinct). */
  fornecedoresDisponiveis: string[];
  /** Lista de motoristas/operadores derivada das saídas. */
  operadoresDisponiveis: string[];
  /** Transportadoras (Fornecedor.ehTransportadora=true) — só usado em mode='carretas'. */
  transportadoras: Fornecedor[];
  /** Lista de placas distinct das saídas — só usado em mode='carretas'. */
  placasDisponiveis: string[];
  /** Mapa de empresas pra exibir nome se necessário (não obrigatório). */
  fornecedoresEntities?: Fornecedor[];
  /** Tanques disponíveis — alimenta filtros condicionais (Transferências). */
  depositos?: Deposito[];
  /** Aba ativa — controla quais filtros aparecem (ex: tanque só em
   *  Transferências; equipamento/transportadora respeitam mode em qualquer aba). */
  activeTab?: CombustivelTabId;
}

function counted(label: string, n: number): string {
  return n > 0 ? `${label} (${n})` : label;
}

export default function FilterBar({
  obras,
  equipamentos,
  combustiveis,
  fornecedoresDisponiveis,
  operadoresDisponiveis,
  transportadoras,
  placasDisponiveis,
  depositos = [],
  activeTab,
}: Props) {
  const f = useCombustivelFilter();
  const [savedViews, setSavedViews] = useState<SavedView[]>([]);
  const isProprios = f.state.mode === 'proprios';
  const isCarretas = f.state.mode === 'carretas';
  const isTransferencias = activeTab === 'transferencias';

  useEffect(() => {
    setSavedViews(loadSavedViews());
  }, []);

  // Ordena obras por nome
  const obraOptions = useMemo(
    () =>
      [...obras]
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((o) => ({ id: o.id, label: o.nome })),
    [obras],
  );

  // Equipamentos agrupados por tipo (ESC, MOTONIVELADORA, etc)
  const equipOptions = useMemo(() => {
    const sorted = [...equipamentos]
      .filter((e) => e.ativo !== false)
      .sort((a, b) => (a.tipo || '').localeCompare(b.tipo || '') || a.nome.localeCompare(b.nome));
    return sorted.map((e) => ({
      id: e.id,
      label: e.nome,
      grupo: e.tipo || 'Outros',
      badge: e.codigoPatrimonio || undefined,
    }));
  }, [equipamentos]);

  const combOptions = useMemo(
    () => combustiveis.map((c) => ({ id: c.id, label: c.nome })),
    [combustiveis],
  );

  const transpOptions = useMemo(
    () =>
      [...transportadoras]
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((t) => ({ id: t.id, label: t.nome })),
    [transportadoras],
  );

  const placaOptions = useMemo(
    () => placasDisponiveis.map((p) => ({ id: p, label: p })),
    [placasDisponiveis],
  );

  const tanqueOptions = useMemo(
    () =>
      [...depositos]
        .filter((d) => d.ativo !== false)
        .sort((a, b) => a.nome.localeCompare(b.nome))
        .map((d) => ({ id: d.id, label: d.nome })),
    [depositos],
  );

  const fornOptions = useMemo(
    () =>
      fornecedoresDisponiveis.map((nome) => ({ id: nome, label: nome })),
    [fornecedoresDisponiveis],
  );

  const opOptions = useMemo(
    () => operadoresDisponiveis.map((nome) => ({ id: nome, label: nome })),
    [operadoresDisponiveis],
  );

  const triggerBase =
    'inline-flex items-center gap-1.5 h-9 px-3 text-sm rounded-lg border transition-colors';
  const triggerIdle =
    'border-[var(--color-border)] bg-[var(--color-surface-1)] text-[var(--color-fg-muted)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-fg)]';
  const triggerActive =
    'border-[var(--color-accent)] bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)] font-medium';

  return (
    <div className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/85 backdrop-blur supports-[backdrop-filter]:bg-[var(--color-surface-1)]/70">
      <div className="px-3 sm:px-4 py-2.5 flex flex-wrap items-center gap-2">
        {/* Período */}
        <Popover
          trigger={(open) => (
            <span className={`${triggerBase} ${f.state.preset !== 'ultimos_30' || open ? triggerActive : triggerIdle}`}>
              <Calendar className="w-3.5 h-3.5" />
              <span className="whitespace-nowrap">{fmtPeriodo(f.state.periodo.from, f.state.periodo.to)}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </span>
          )}
          minWidth={460}
        >
          {(close) => (
            <PeriodoPanel
              preset={f.state.preset}
              from={f.state.periodo.from}
              to={f.state.periodo.to}
              onApply={(preset, from, to) => {
                if (preset === 'custom') f.setPeriodoCustom(from, to);
                else f.setPreset(preset);
              }}
              onClose={close}
            />
          )}
        </Popover>

        {/* Obra */}
        <Popover
          trigger={(open) => (
            <span className={`${triggerBase} ${f.state.obraIds.length > 0 || open ? triggerActive : triggerIdle}`}>
              <span className="whitespace-nowrap">{counted('Obra', f.state.obraIds.length) || 'Obra'}</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </span>
          )}
          minWidth={320}
        >
          {(close) => (
            <MultiSelectPanel
              options={obraOptions}
              selected={f.state.obraIds}
              onApply={f.setObraIds}
              onClose={close}
              placeholder="Buscar obra..."
            />
          )}
        </Popover>

        {/* Equipamento — só em mode='proprios' */}
        {isProprios && (
          <Popover
            trigger={(open) => (
              <span className={`${triggerBase} ${f.state.equipamentoIds.length > 0 || open ? triggerActive : triggerIdle}`}>
                <span className="whitespace-nowrap">{counted('Equipamento', f.state.equipamentoIds.length) || 'Equipamento'}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </span>
            )}
            minWidth={320}
          >
            {(close) => (
              <MultiSelectPanel
                options={equipOptions}
                selected={f.state.equipamentoIds}
                onApply={f.setEquipamentoIds}
                onClose={close}
                placeholder="Buscar equipamento..."
              />
            )}
          </Popover>
        )}

        {/* Transportadora — só em mode='carretas' */}
        {isCarretas && transpOptions.length > 0 && (
          <Popover
            trigger={(open) => (
              <span className={`${triggerBase} ${f.state.transportadoraIds.length > 0 || open ? triggerActive : triggerIdle}`}>
                <span className="whitespace-nowrap">{counted('Transportadora', f.state.transportadoraIds.length) || 'Transportadora'}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </span>
            )}
            minWidth={320}
          >
            {(close) => (
              <MultiSelectPanel
                options={transpOptions}
                selected={f.state.transportadoraIds}
                onApply={f.setTransportadoraIds}
                onClose={close}
                placeholder="Buscar transportadora..."
              />
            )}
          </Popover>
        )}

        {/* Placa — só em mode='carretas' */}
        {isCarretas && placaOptions.length > 0 && (
          <Popover
            trigger={(open) => (
              <span className={`${triggerBase} ${f.state.placas.length > 0 || open ? triggerActive : triggerIdle}`}>
                <span className="whitespace-nowrap">{counted('Placa', f.state.placas.length) || 'Placa'}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </span>
            )}
            minWidth={280}
          >
            {(close) => (
              <MultiSelectPanel
                options={placaOptions}
                selected={f.state.placas}
                onApply={f.setPlacas}
                onClose={close}
                placeholder="Buscar placa..."
              />
            )}
          </Popover>
        )}

        {/* Tanque (genérico) — visível em todas as abas exceto Transferências
            (que tem origem/destino próprios). Aplica em saídas (s.tanqueId)
            e em entradas (e.depositoId). */}
        {!isTransferencias && tanqueOptions.length > 0 && (
          <Popover
            trigger={(open) => (
              <span className={`${triggerBase} ${f.state.tanqueIds.length > 0 || open ? triggerActive : triggerIdle}`}>
                <span className="whitespace-nowrap">{counted('Tanque', f.state.tanqueIds.length) || 'Tanque'}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </span>
            )}
            minWidth={280}
          >
            {(close) => (
              <MultiSelectPanel
                options={tanqueOptions}
                selected={f.state.tanqueIds}
                onApply={f.setTanqueIds}
                onClose={close}
                placeholder="Buscar tanque..."
              />
            )}
          </Popover>
        )}

        {/* Tanque origem / destino — só na aba Transferências (filtro
            específico daquela operação; em outras abas não faz sentido). */}
        {isTransferencias && tanqueOptions.length > 0 && (
          <>
            <Popover
              trigger={(open) => (
                <span className={`${triggerBase} ${f.state.tanqueOrigemIds.length > 0 || open ? triggerActive : triggerIdle}`}>
                  <span className="whitespace-nowrap">{counted('Tanque origem', f.state.tanqueOrigemIds.length) || 'Tanque origem'}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </span>
              )}
              minWidth={280}
            >
              {(close) => (
                <MultiSelectPanel
                  options={tanqueOptions}
                  selected={f.state.tanqueOrigemIds}
                  onApply={f.setTanqueOrigemIds}
                  onClose={close}
                  placeholder="Buscar tanque..."
                />
              )}
            </Popover>
            <Popover
              trigger={(open) => (
                <span className={`${triggerBase} ${f.state.tanqueDestinoIds.length > 0 || open ? triggerActive : triggerIdle}`}>
                  <span className="whitespace-nowrap">{counted('Tanque destino', f.state.tanqueDestinoIds.length) || 'Tanque destino'}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </span>
              )}
              minWidth={280}
            >
              {(close) => (
                <MultiSelectPanel
                  options={tanqueOptions}
                  selected={f.state.tanqueDestinoIds}
                  onApply={f.setTanqueDestinoIds}
                  onClose={close}
                  placeholder="Buscar tanque..."
                />
              )}
            </Popover>
          </>
        )}

        {/* Tipo combustível — chips inline (mais rápido que popover pra 4-5 itens) */}
        <div className="flex items-center gap-1 ml-1">
          {combOptions.map((c) => {
            const ativo = f.state.tipoCombustiveis.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => f.toggleTipoCombustivel(c.id)}
                className={`px-2.5 h-9 text-xs rounded-lg border transition-colors ${
                  ativo
                    ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)] text-[var(--color-accent-fg)] font-medium'
                    : 'bg-[var(--color-surface-1)] border-[var(--color-border)] text-[var(--color-fg-muted)] hover:text-[var(--color-fg)] hover:border-[var(--color-border-strong)]'
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Fornecedor (entradas) */}
        {fornOptions.length > 0 && (
          <Popover
            trigger={(open) => (
              <span className={`${triggerBase} ${f.state.fornecedores.length > 0 || open ? triggerActive : triggerIdle}`}>
                <span className="whitespace-nowrap">{counted('Fornecedor', f.state.fornecedores.length) || 'Fornecedor'}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </span>
            )}
            minWidth={300}
          >
            {(close) => (
              <MultiSelectPanel
                options={fornOptions}
                selected={f.state.fornecedores}
                onApply={f.setFornecedores}
                onClose={close}
                placeholder="Buscar fornecedor..."
              />
            )}
          </Popover>
        )}

        {/* Operador (mode='proprios') / Motorista (mode='carretas') */}
        {opOptions.length > 0 && (
          <Popover
            trigger={(open) => {
              const label = isCarretas ? 'Motorista' : 'Operador';
              return (
                <span className={`${triggerBase} ${f.state.operadores.length > 0 || open ? triggerActive : triggerIdle}`}>
                  <span className="whitespace-nowrap">{counted(label, f.state.operadores.length) || label}</span>
                  <ChevronDown className="w-3 h-3 opacity-60" />
                </span>
              );
            }}
            minWidth={300}
          >
            {(close) => (
              <MultiSelectPanel
                options={opOptions}
                selected={f.state.operadores}
                onApply={f.setOperadores}
                onClose={close}
                placeholder={isCarretas ? 'Buscar motorista...' : 'Buscar operador...'}
              />
            )}
          </Popover>
        )}

        {/* Spacer + ações à direita */}
        <div className="flex-1" />

        {/* Salvar visão */}
        <Popover
          align="end"
          trigger={(open) => (
            <span className={`${triggerBase} ${open ? triggerActive : triggerIdle}`}>
              <Bookmark className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Visões</span>
              {savedViews.length > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)]">
                  {savedViews.length}
                </span>
              )}
            </span>
          )}
          minWidth={280}
        >
          {(close) => (
            <SavedViewsPopover
              views={savedViews}
              currentFilters={f.state}
              onApplyView={f.setState}
              onChange={setSavedViews}
              onClose={close}
            />
          )}
        </Popover>

        {/* "Limpar tudo" vive na FilterChips abaixo (única fonte). Se a
            row de chips estiver oculta por overflow horizontal, ainda
            assim ela ocupa o flex layout e o botão fica visível. */}
      </div>
    </div>
  );
}

// Re-export pro caller usar o ícone (mobile drawer trigger no futuro)
export { FilterIcon };
