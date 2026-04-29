import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ImportExcelModal, {
  parseStr,
  parseNumero,
  type ParsedRow,
} from '../../components/ui/ImportExcelModal';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import { useObras } from '../../hooks/useObras';
import {
  useContractItemsByObra,
  useAdicionarContractItem,
  useAtualizarContractItem,
  useExcluirContractItem,
} from '../../hooks/useContractItems';
import type { ContractItem } from '../rodotracker/types/activity';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../../utils/formatters';
import { gerarId } from './utils';

type ItemType = 'etapa' | 'subetapa' | 'item';

const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
  { value: 'etapa', label: 'Etapa' },
  { value: 'subetapa', label: 'Subetapa' },
  { value: 'item', label: 'Item' },
];

const TYPE_BADGE: Record<ItemType, string> = {
  etapa: 'bg-[var(--color-accent-soft)] text-[var(--color-accent-fg)]',
  subetapa: 'bg-[var(--color-info-soft)] text-[var(--color-info-fg)]',
  item: 'bg-[var(--color-surface-3)] text-[var(--color-fg-muted)]',
};

interface FormState {
  type: ItemType;
  code: string;
  name: string;
  unit: string;
  contractedQty: string;
  unitPrice: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  type: 'item',
  code: '',
  name: '',
  unit: '',
  contractedQty: '',
  unitPrice: '',
  notes: '',
};

function detectTypeFromCode(code: string): ItemType {
  const trimmed = code.trim();
  if (!trimmed) return 'item';
  const depth = trimmed.split('.').filter(Boolean).length;
  if (depth === 1) return 'etapa';
  if (depth === 2) return 'subetapa';
  return 'item';
}

export default function EtapasPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { temAcao, usuario: _usuario } = useAuth();
  const canCreate = temAcao('criar_etapas');
  const canEdit = temAcao('editar_etapas');
  const canDelete = temAcao('excluir_etapas');

  const { data: obras = [] } = useObras();

  // Persist obra selection in URL so refresh keeps state
  const obraId = searchParams.get('obra') ?? '';
  const setObraId = useCallback(
    (id: string) => {
      const next = new URLSearchParams(searchParams);
      if (id) next.set('obra', id);
      else next.delete('obra');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  // Auto-select first obra if none chosen
  useEffect(() => {
    if (!obraId && obras.length > 0) {
      setObraId(obras[0].id);
    }
  }, [obraId, obras, setObraId]);

  const obraSelecionada = obras.find((o) => o.id === obraId);

  const { data: items = [], isLoading } = useContractItemsByObra(obraId);
  const addMutation = useAdicionarContractItem(obraId);
  const updateMutation = useAtualizarContractItem(obraId);
  const deleteMutation = useExcluirContractItem(obraId);

  // Search + type filter
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'' | ItemType>('');

  const filteredItems = useMemo(() => {
    let list = items;
    if (typeFilter) list = list.filter((i) => i.type === typeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          (i.code ?? '').toLowerCase().includes(q) ||
          i.unit.toLowerCase().includes(q)
      );
    }
    return list;
  }, [items, search, typeFilter]);

  // Stats
  const stats = useMemo(() => {
    const totalContratado = items
      .filter((i) => (i.type ?? 'item') === 'item')
      .reduce((acc, i) => acc + (i.contractedQty || 0) * (i.unitPrice || 0), 0);
    const totalMedido = items
      .filter((i) => (i.type ?? 'item') === 'item')
      .reduce((acc, i) => acc + (i.measuredQty || 0) * (i.unitPrice || 0), 0);
    return { totalContratado, totalMedido, count: items.length };
  }, [items]);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<ContractItem | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDrawerOpen(true);
  }

  function openEdit(item: ContractItem) {
    setEditing(item);
    setForm({
      type: (item.type ?? 'item') as ItemType,
      code: item.code ?? '',
      name: item.name,
      unit: item.unit,
      contractedQty: String(item.contractedQty ?? ''),
      unitPrice: String(item.unitPrice ?? ''),
      notes: item.notes ?? '',
    });
    setDrawerOpen(true);
  }

  function closeDrawer() {
    if (submitting) return;
    setDrawerOpen(false);
  }

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!obraId) return;
      if (!form.name.trim() || !form.unit.trim()) return;
      setSubmitting(true);
      try {
        const now = Date.now();
        if (editing) {
          const updated: ContractItem = {
            ...editing,
            type: form.type,
            code: form.code.trim() || undefined,
            name: form.name.trim(),
            unit: form.unit.trim(),
            contractedQty: Number(form.contractedQty) || 0,
            unitPrice: Number(form.unitPrice) || 0,
            notes: form.notes.trim() || undefined,
            updatedAt: now,
          };
          await updateMutation.mutateAsync(updated);
        } else {
          const created: ContractItem = {
            id: gerarId(),
            obraId,
            type: form.type,
            code: form.code.trim() || undefined,
            name: form.name.trim(),
            unit: form.unit.trim(),
            contractedQty: Number(form.contractedQty) || 0,
            unitPrice: Number(form.unitPrice) || 0,
            notes: form.notes.trim() || undefined,
            createdAt: now,
            updatedAt: now,
          };
          await addMutation.mutateAsync(created);
        }
        setDrawerOpen(false);
      } finally {
        setSubmitting(false);
      }
    },
    [obraId, form, editing, addMutation, updateMutation]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  }, [deleteId, deleteMutation]);

  // Excel import
  const handleImport = useCallback(
    async (rows: Record<string, unknown>[]) => {
      if (!obraId) return;
      const now = Date.now();
      for (const row of rows) {
        const item: ContractItem = {
          id: gerarId(),
          obraId,
          type: (row.type as ItemType) || 'item',
          code: (row.code as string) || undefined,
          name: String(row.name ?? ''),
          unit: String(row.unit ?? ''),
          contractedQty: Number(row.contractedQty) || 0,
          unitPrice: Number(row.unitPrice) || 0,
          notes: (row.notes as string) || undefined,
          createdAt: now,
          updatedAt: now,
        };
        await addMutation.mutateAsync(item);
      }
      setImportOpen(false);
    },
    [obraId, addMutation]
  );

  const parseRow = useCallback((row: unknown[], index: number): ParsedRow => {
    const erros: string[] = [];
    const code = parseStr(row[0]);
    const name = parseStr(row[1]);
    const unit = parseStr(row[2]);
    const contractedQty = parseNumero(row[3]) ?? 0;
    const unitPrice = parseNumero(row[4]) ?? 0;
    const typeRaw = parseStr(row[5]).toLowerCase();
    const notes = parseStr(row[6]);

    if (!name) erros.push('Nome obrigatório');
    if (!unit) erros.push('Unidade obrigatória');

    let type: ItemType;
    if (['etapa', 'subetapa', 'item'].includes(typeRaw)) {
      type = typeRaw as ItemType;
    } else {
      type = detectTypeFromCode(code);
    }

    return {
      valido: erros.length === 0,
      erros,
      resumo: name || `(linha ${index + 2})`,
      dados: { code, name, unit, contractedQty, unitPrice, type, notes },
    };
  }, []);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] mb-3">
        <Link to="/cadastros" className="hover:text-[var(--color-fg)] transition-colors">
          Cadastros
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">Etapas de obra</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Etapas de obra</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">
            Itens contratados — mesmos dados da Medição de Contrato.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)} disabled={!obraId}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            Importar Excel
          </Button>
          {canCreate && (
            <Button onClick={openCreate} disabled={!obraId}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nova etapa
            </Button>
          )}
        </div>
      </div>

      {/* Obra selector */}
      <div className="bg-gradient-to-br from-[var(--color-surface-1)] to-[var(--color-accent-soft)] border border-[var(--color-border)] rounded-xl p-5 mb-5">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
              Obra
            </label>
            <select
              value={obraId}
              onChange={(e) => setObraId(e.target.value)}
              className="w-full h-[42px] rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] text-[var(--color-fg)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            >
              <option value="">Selecione uma obra...</option>
              {obras.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nome}
                </option>
              ))}
            </select>
          </div>
          <Stat label="Itens" value={stats.count.toString()} />
          <Stat label="Contratado" value={formatCurrency(stats.totalContratado)} />
        </div>
        {obraSelecionada && (
          <div className="mt-3 flex items-center gap-3 text-xs text-[var(--color-fg-muted)]">
            <span className="inline-flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-success)]" />
              Medido: <strong className="text-[var(--color-fg)]">{formatCurrency(stats.totalMedido)}</strong>
            </span>
            {stats.totalContratado > 0 && (
              <span>
                {((stats.totalMedido / stats.totalContratado) * 100).toFixed(1)}% executado
              </span>
            )}
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por código, nome ou unidade..."
            className="w-full h-11 rounded-lg pl-9 pr-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
            disabled={!obraId}
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as '' | ItemType)}
          className="h-11 rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] sm:w-44"
          disabled={!obraId}
        >
          <option value="">Todos os tipos</option>
          {TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-[var(--shadow-xs)]">
        {!obraId ? (
          <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">
            Selecione uma obra para ver as etapas.
          </div>
        ) : isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Carregando...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              {search || typeFilter
                ? 'Nenhum resultado para os filtros atuais.'
                : 'Esta obra ainda não tem etapas cadastradas.'}
            </p>
            {!search && !typeFilter && canCreate && (
              <Button className="mt-4" onClick={openCreate}>
                Cadastrar primeira etapa
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] text-xs uppercase tracking-wider">
                  <th className="px-4 py-3 text-left font-medium" style={{ width: 110 }}>Tipo</th>
                  <th className="px-4 py-3 text-left font-medium" style={{ width: 100 }}>Código</th>
                  <th className="px-4 py-3 text-left font-medium">Nome</th>
                  <th className="px-4 py-3 text-left font-medium hidden md:table-cell" style={{ width: 80 }}>Un.</th>
                  <th className="px-4 py-3 text-right font-medium hidden md:table-cell" style={{ width: 130 }}>Qtd contratada</th>
                  <th className="px-4 py-3 text-right font-medium hidden lg:table-cell" style={{ width: 130 }}>Vlr unitário</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ width: 130 }}>Total</th>
                  <th className="px-4 py-3 text-right font-medium" style={{ width: 100 }}>Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredItems.map((item) => {
                  const t = (item.type ?? 'item') as ItemType;
                  const total = (item.contractedQty || 0) * (item.unitPrice || 0);
                  return (
                    <tr key={item.id} className="hover:bg-[var(--color-surface-2)]/60 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_BADGE[t]}`}>
                          {t === 'etapa' ? 'Etapa' : t === 'subetapa' ? 'Subetapa' : 'Item'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-[var(--color-fg-muted)]">
                        {item.code ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-[var(--color-fg)]">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-[var(--color-fg-muted)]">
                        {item.unit}
                      </td>
                      <td className="px-4 py-3 text-right hidden md:table-cell tabular-nums">
                        {(item.contractedQty || 0).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-3 text-right hidden lg:table-cell tabular-nums text-[var(--color-fg-muted)]">
                        {t === 'item' ? formatCurrency(item.unitPrice || 0) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {t === 'item' ? formatCurrency(total) : '-'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {canEdit && (
                            <button
                              onClick={() => openEdit(item)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-surface-2)] transition-colors"
                              aria-label="Editar"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                          )}
                          {canDelete && (
                            <button
                              onClick={() => setDeleteId(item.id)}
                              className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[var(--color-fg-muted)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] transition-colors"
                              aria-label="Excluir"
                            >
                              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6h14z" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && filteredItems.length > 0 && (
        <div className="mt-3 text-xs text-[var(--color-fg-subtle)]">
          {filteredItems.length} {filteredItems.length === 1 ? 'item' : 'itens'}
          {(search || typeFilter) && items.length !== filteredItems.length && ` (de ${items.length})`}
        </div>
      )}

      {/* Drawer Form */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? 'Editar etapa' : 'Nova etapa'}
        subtitle={obraSelecionada?.nome}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" type="button" onClick={closeDrawer} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="etapa-form" disabled={submitting}>
              {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </div>
        }
      >
        <form id="etapa-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              id="type"
              label="Tipo"
              required
              options={TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ItemType }))}
            />
            <Input
              id="code"
              label="Código"
              placeholder="Ex.: 2.1.3"
              value={form.code}
              onChange={(e) => {
                const code = e.target.value;
                setForm((f) => ({
                  ...f,
                  code,
                  // Auto-detect type from code depth, only when user hasn't deviated
                  type: code ? detectTypeFromCode(code) : f.type,
                }));
              }}
            />
            <div className="sm:col-span-2">
              <Input
                id="name"
                label="Nome"
                required
                placeholder="Ex.: Terraplenagem"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <Input
              id="unit"
              label="Unidade"
              required
              placeholder="m³, m², t, un..."
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
            />
            <Input
              id="contractedQty"
              label="Quantidade contratada"
              type="number"
              inputMode="decimal"
              step="any"
              value={form.contractedQty}
              onChange={(e) => setForm((f) => ({ ...f, contractedQty: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Input
                id="unitPrice"
                label="Valor unitário (R$)"
                type="number"
                inputMode="decimal"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[var(--color-fg-muted)] mb-1.5 tracking-wide">
                Observações
              </label>
              <textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full rounded-lg px-3 py-2 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
              />
            </div>
          </div>
          {form.type !== 'item' && (
            <div className="text-xs text-[var(--color-fg-subtle)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md px-3 py-2">
              Etapas e subetapas são agrupadores — o valor total é somado a partir dos itens-filhos pelo código (ex.: 2.1, 2.1.3).
            </div>
          )}
        </form>
      </Drawer>

      {/* Delete confirmation (with password gate) */}
      <ConfirmDialog
        open={deleteId !== null}
        title="Excluir etapa?"
        message="Esta ação não pode ser desfeita. Confirme com sua senha."
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Excel import */}
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        title="Importar etapas via Excel"
        entityLabel="etapa"
        genderFem
        templateData={[
          ['Código', 'Nome', 'Unidade', 'Qtd contratada', 'Valor unitário (R$)', 'Tipo (etapa|subetapa|item)', 'Observações'],
          ['2.1.3', 'Terraplenagem', 'm³', 1500, 45.5, 'item', ''],
        ]}
        templateFileName="template_etapas.xlsx"
        sheetName="Etapas"
        templateColWidths={[14, 32, 12, 16, 18, 26, 28]}
        formatHintHeaders={['Código', 'Nome', 'Unidade', 'Qtd', 'Vlr unit.', 'Tipo', 'Obs.']}
        formatHintExample={['2.1.3', 'Terraplenagem', 'm³', '1500', '45.5', 'item', '']}
        parseRow={parseRow}
        toEntity={(row) => row.dados as Record<string, unknown>}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
        {label}
      </span>
      <span className="text-lg font-semibold tracking-tight tabular-nums mt-1">{value}</span>
    </div>
  );
}
