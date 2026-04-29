import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { ENTITY_CONFIGS, EXTERNAL_ENTITIES } from './configs';
import type { AnyEntityConfig, EntityCategory } from './types';
import UniversalImporter from './UniversalImporter';

const CATEGORIES: { id: EntityCategory; label: string; description: string }[] = [
  { id: 'obra',      label: 'Obra & Estrutura',      description: 'Obras, etapas e localidades' },
  { id: 'pessoas',   label: 'Pessoas',                description: 'Funcionários, colaboradores e empresas' },
  { id: 'materiais', label: 'Materiais & Insumos',    description: 'Insumos, fornecedores e categorias' },
  { id: 'frota',     label: 'Frota & Combustível',    description: 'Equipamentos e tanques' },
];

const ACCENT_RING: Record<string, string> = {
  green:  'group-hover:ring-[var(--color-accent)]/40 group-hover:bg-[var(--color-accent-soft)]',
  amber:  'group-hover:ring-[var(--color-accent-amber)]/40 group-hover:bg-[var(--color-accent-amber-soft)]',
  blue:   'group-hover:ring-[var(--color-info)]/40 group-hover:bg-[var(--color-info-soft)]',
  purple: 'group-hover:ring-purple-500/40 group-hover:bg-purple-500/10',
  rose:   'group-hover:ring-rose-500/40 group-hover:bg-rose-500/10',
};

const ACCENT_ICON: Record<string, string> = {
  green:  'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]',
  amber:  'bg-[var(--color-accent-amber-soft)] text-[var(--color-accent-amber-fg)]',
  blue:   'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
  purple: 'bg-purple-500/10 text-purple-500 dark:text-purple-400',
  rose:   'bg-rose-500/10 text-rose-500 dark:text-rose-400',
};

interface HubItem {
  kind: 'config' | 'external';
  slug: string;
  href: string;
  singular: string;
  plural: string;
  description: string;
  category: EntityCategory;
  accent: string;
  icon: React.ReactNode;
  permission?: string;
  badge?: string;
  config?: AnyEntityConfig;
}

export default function CadastrosHub() {
  const { temAcao } = useAuth();
  const [search, setSearch] = useState('');
  const [importerOpen, setImporterOpen] = useState(false);

  const allItems: HubItem[] = useMemo(() => {
    const fromConfigs: HubItem[] = ENTITY_CONFIGS.map((c) => ({
      kind: 'config',
      slug: c.slug,
      href: `/cadastros/${c.slug}`,
      singular: c.singular,
      plural: c.plural,
      description: c.description,
      category: c.category,
      accent: c.accent ?? 'green',
      icon: c.icon,
      permission: c.permissions?.create,
      config: c,
    }));
    const fromExternal: HubItem[] = EXTERNAL_ENTITIES.map((e) => ({
      kind: 'external',
      slug: e.slug,
      href: e.href,
      singular: e.singular,
      plural: e.plural,
      description: e.description,
      category: e.category,
      accent: e.accent ?? 'green',
      icon: e.icon,
      permission: e.permission,
      badge: e.badge,
    }));
    return [...fromConfigs, ...fromExternal];
  }, []);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((it) => {
      if (it.permission && !temAcao(it.permission)) return false;
      if (!q) return true;
      return (
        it.plural.toLowerCase().includes(q) ||
        it.singular.toLowerCase().includes(q) ||
        it.description.toLowerCase().includes(q)
      );
    });
  }, [allItems, search, temAcao]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-gradient-to-br from-[var(--color-surface-1)] via-[var(--color-surface-1)] to-[var(--color-accent-soft)] p-6 sm:p-8 mb-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--color-accent-soft),transparent_60%)] pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.18em] text-[var(--color-accent-fg)] font-semibold mb-2">
              Cadastros
            </p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
              Tudo que sustenta sua obra, em um só lugar.
            </h1>
            <p className="mt-2 text-sm text-[var(--color-fg-muted)] max-w-xl">
              Cadastre obras, pessoas, materiais, fornecedores, frota e mais.
              Use o importador universal para subir qualquer cadastro a partir de uma planilha Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setImporterOpen(true)}
            className="shrink-0 inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[var(--color-fg)] text-[var(--color-surface-1)] font-medium text-sm shadow-[var(--shadow-md)] hover:opacity-90 transition-opacity"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Importar Excel
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-8 max-w-md">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar cadastro..."
          className="w-full h-11 rounded-lg pl-9 pr-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
        />
      </div>

      {/* Categories */}
      <div className="space-y-10">
        {CATEGORIES.map((cat) => {
          const items = visibleItems.filter((it) => it.category === cat.id);
          if (items.length === 0) return null;
          return (
            <section key={cat.id}>
              <div className="mb-3">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-fg-muted)]">
                  {cat.label}
                </h2>
                <p className="text-xs text-[var(--color-fg-subtle)] mt-0.5">{cat.description}</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((it) => (
                  <EntityCard key={it.slug} item={it} />
                ))}
              </div>
            </section>
          );
        })}
        {visibleItems.length === 0 && (
          <div className="text-center py-12 text-sm text-[var(--color-fg-muted)]">
            Nenhum cadastro encontrado para "{search}".
          </div>
        )}
      </div>

      <UniversalImporter open={importerOpen} onClose={() => setImporterOpen(false)} />
    </div>
  );
}

function EntityCard({ item }: { item: HubItem }) {
  const { data, isLoading } = item.config?.hooks.useList() ?? { data: undefined, isLoading: false };
  const count = Array.isArray(data) ? data.length : null;
  const accent = item.accent ?? 'green';
  return (
    <Link
      to={item.href}
      className={
        'group relative block rounded-xl border border-[var(--color-border)] ' +
        'bg-[var(--color-surface-1)] p-5 ' +
        'transition-all duration-[var(--dur-base)] ease-[var(--ease-out)] ' +
        'hover:border-[var(--color-border-strong)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] ' +
        'ring-1 ring-transparent ' +
        ACCENT_RING[accent]
      }
    >
      <div className="flex items-start gap-4">
        <span
          className={
            'shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl ' +
            ACCENT_ICON[accent]
          }
        >
          <span className="w-5 h-5 inline-block">{item.icon}</span>
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-[var(--color-fg)] truncate">
              {item.plural}
            </h3>
            {item.config && (
              <span className="text-xs font-medium tabular-nums text-[var(--color-fg-subtle)]">
                {isLoading ? '…' : count !== null ? count : '—'}
              </span>
            )}
          </div>
          <p className="text-xs text-[var(--color-fg-muted)] mt-1 line-clamp-2">
            {item.description}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between text-xs">
        <span className="text-[var(--color-fg-subtle)]">
          {item.badge
            ? `Vai para ${item.badge}`
            : item.kind === 'external'
              ? 'Página dedicada'
              : 'Cadastro rápido'}
        </span>
        <span className="inline-flex items-center gap-1 text-[var(--color-fg-muted)] group-hover:text-[var(--color-fg)] transition-colors">
          Abrir
          <svg className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14m-6-6 6 6-6 6" />
          </svg>
        </span>
      </div>
    </Link>
  );
}
