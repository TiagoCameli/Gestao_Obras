import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Drawer from '../../components/ui/Drawer';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import ImportExcelModal from '../../components/ui/ImportExcelModal';
import { useAuth } from '../../contexts/AuthContext';
import FieldRenderer from './FieldRenderer';
import { gerarId } from './utils';
import { validarCPF, validarCNPJ } from '../../utils/validators';
import type { EntityConfig, FieldConfig } from './types';

interface Props<T extends { id: string }> {
  config: EntityConfig<T>;
  autoOpenImport?: boolean;
}

export default function EntityCadastroPage<T extends { id: string }>({
  config,
  autoOpenImport = false,
}: Props<T>) {
  const { temAcao, usuario } = useAuth();
  const canCreate = !config.permissions?.create || temAcao(config.permissions.create);
  const canEdit = !config.permissions?.edit || temAcao(config.permissions.edit);
  const canDelete = !config.permissions?.delete || temAcao(config.permissions.delete);

  const { data: items = [], isLoading } = config.hooks.useList();
  const addMutation = config.hooks.useAdd();
  const updateMutation = config.hooks.useUpdate();
  const deleteMutation = config.hooks.useDelete();

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [formData, setFormData] = useState<Partial<T>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Import state
  const [importOpen, setImportOpen] = useState(false);
  useEffect(() => {
    if (autoOpenImport) setImportOpen(true);
  }, [autoOpenImport]);

  // Search
  const [search, setSearch] = useState('');

  // Dropdown filters (declared by the entity config). Holds the active value per filter key.
  const filterDefs = config.filters ?? [];
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  // Resolve option lists from hooks declared by each filter (stable order).
  const filterOptions: ReturnType<NonNullable<typeof filterDefs[number]['useOptions']>>[] = filterDefs.map(
    (f) => (f.useOptions ? f.useOptions() : (f.staticOptions ?? []))
  );

  const filteredItems = useMemo(() => {
    let list = items;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((item) => {
        const a = String((item as Record<string, unknown>)[config.searchKey] ?? '').toLowerCase();
        const b = config.searchKey2
          ? String((item as Record<string, unknown>)[config.searchKey2] ?? '').toLowerCase()
          : '';
        return a.includes(q) || b.includes(q);
      });
    }
    for (const f of filterDefs) {
      const v = filterValues[f.key];
      if (v) list = list.filter((row) => f.matches(row, v));
    }
    return list;
  }, [items, search, config.searchKey, config.searchKey2, filterDefs, filterValues]);

  const openCreate = useCallback(() => {
    setEditing(null);
    setFormData(config.defaultValues());
    setErrors({});
    setDrawerOpen(true);
  }, [config]);

  const openEdit = useCallback((item: T) => {
    setEditing(item);
    setFormData({ ...item });
    setErrors({});
    setDrawerOpen(true);
  }, []);

  const closeDrawer = useCallback(() => {
    if (submitting) return;
    setDrawerOpen(false);
    setTimeout(() => {
      setEditing(null);
      setFormData({});
      setErrors({});
    }, 220);
  }, [submitting]);

  const validate = useCallback((): boolean => {
    const errs: Record<string, string> = {};
    for (const f of config.fields) {
      const v = (formData as Record<string, unknown>)[f.key];
      const stringValue = typeof v === 'string' ? v : '';
      if (f.required) {
        const isEmpty =
          v === undefined ||
          v === null ||
          v === '' ||
          (f.type === 'number' && Number.isNaN(v as number));
        if (isEmpty) {
          errs[f.key] = 'Obrigatório';
          continue;
        }
      }
      // Validação de dígito verificador (somente quando o campo foi preenchido).
      if (f.type === 'cpf' && stringValue && !validarCPF(stringValue)) {
        errs[f.key] = 'CPF inválido';
      }
      if (f.type === 'cnpj' && stringValue && !validarCNPJ(stringValue)) {
        errs[f.key] = 'CNPJ inválido';
      }
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [config.fields, formData]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!validate()) return;
      setSubmitting(true);
      try {
        const base = editing
          ? { ...editing, ...formData }
          : {
              ...config.defaultValues(),
              ...formData,
              id: gerarId(),
              criadoPor: usuario?.email || usuario?.nome || 'sistema',
            };
        if (editing) {
          await updateMutation.mutateAsync(base as T);
        } else {
          await addMutation.mutateAsync(base as T);
        }
        setDrawerOpen(false);
        setTimeout(() => {
          setEditing(null);
          setFormData({});
          setErrors({});
        }, 220);
      } finally {
        setSubmitting(false);
      }
    },
    [validate, editing, formData, config, addMutation, updateMutation, usuario]
  );

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    await deleteMutation.mutateAsync(deleteId);
    setDeleteId(null);
  }, [deleteId, deleteMutation]);

  const handleImport = useCallback(
    async (rows: Record<string, unknown>[]) => {
      const criadoPor = usuario?.email || usuario?.nome || 'sistema';
      for (const row of rows) {
        const entity = config.excel.toEntity(
          { valido: true, erros: [], resumo: '', dados: row },
          gerarId,
          criadoPor
        );
        await addMutation.mutateAsync(entity);
      }
      setImportOpen(false);
    },
    [config.excel, addMutation, usuario]
  );

  const boundParser = config.excel.useBoundParser
    ? config.excel.useBoundParser()
    : config.excel.parseRow;

  // Per-column lookup maps (FK id -> display label). Hooks called in stable order.
  const columnLookups: (Map<string, string> | undefined)[] = config.columns.map((col) =>
    col.useLookup ? col.useLookup() : undefined
  );

  // Group fields with optional groupStart separator (rendered as section header)
  const fieldGroups = useMemo(() => {
    const groups: { title?: string; fields: FieldConfig<T>[] }[] = [];
    let current: { title?: string; fields: FieldConfig<T>[] } = { fields: [] };
    for (const f of config.fields) {
      if (f.groupStart) {
        if (current.fields.length > 0) groups.push(current);
        current = { title: f.groupStart, fields: [f] };
      } else {
        current.fields.push(f);
      }
    }
    if (current.fields.length > 0) groups.push(current);
    return groups;
  }, [config.fields]);

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--color-fg-muted)] mb-3">
        <Link to="/cadastros" className="hover:text-[var(--color-fg)] transition-colors">
          Cadastros
        </Link>
        <span>/</span>
        <span className="text-[var(--color-fg)]">{config.plural}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{config.plural}</h1>
          <p className="text-sm text-[var(--color-fg-muted)] mt-1">{config.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => setImportOpen(true)}>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" />
            </svg>
            Importar Excel
          </Button>
          {canCreate && (
            <Button onClick={openCreate}>
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Nov{config.genderFem ? 'a' : 'o'} {config.singular.toLowerCase()}
            </Button>
          )}
        </div>
      </div>

      {/* Search bar + dropdown filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-fg-subtle)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar ${config.plural.toLowerCase()}...`}
            className="w-full h-11 rounded-lg pl-9 pr-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)]"
          />
        </div>
        {filterDefs.map((f, idx) => (
          <select
            key={f.key}
            value={filterValues[f.key] ?? ''}
            onChange={(e) => setFilterValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            className="h-11 rounded-lg px-3 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-ring)] min-w-[160px]"
            aria-label={f.label}
          >
            <option value="">{f.allLabel ?? `Todos: ${f.label}`}</option>
            {filterOptions[idx].map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden shadow-[var(--shadow-xs)]">
        {isLoading ? (
          <div className="p-12 text-center text-sm text-[var(--color-fg-muted)]">Carregando...</div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-[var(--color-fg-muted)]">
              {search
                ? `Nenhum resultado para "${search}"`
                : `Nenhum${config.genderFem ? 'a' : ''} ${config.singular.toLowerCase()} cadastrad${config.genderFem ? 'a' : 'o'} ainda.`}
            </p>
            {!search && canCreate && (
              <Button className="mt-4" onClick={openCreate}>
                Cadastrar {config.singular.toLowerCase()}
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--color-surface-2)] text-[var(--color-fg-muted)] text-xs uppercase tracking-wider">
                  {config.columns.map((col) => (
                    <th
                      key={col.key}
                      className={`px-4 py-3 font-medium ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                      style={col.width ? { width: col.width } : undefined}
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right font-medium" style={{ width: 120 }}>
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--color-surface-2)]/60 transition-colors">
                    {config.columns.map((col, ci) => {
                      const raw = (item as Record<string, unknown>)[col.key];
                      const lookup = columnLookups[ci];
                      let cell: React.ReactNode;
                      if (col.render) {
                        cell = col.render(item, lookup);
                      } else if (lookup) {
                        cell = lookup.get(String(raw)) ?? '-';
                      } else {
                        cell = (raw as React.ReactNode) ?? '-';
                      }
                      return (
                        <td
                          key={col.key}
                          className={`px-4 py-3 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''} ${col.hideOnMobile ? 'hidden md:table-cell' : ''}`}
                        >
                          {cell}
                        </td>
                      );
                    })}
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
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {!isLoading && filteredItems.length > 0 && (
        <div className="mt-3 text-xs text-[var(--color-fg-subtle)]">
          {filteredItems.length} {filteredItems.length === 1 ? 'registro' : 'registros'}
          {search && items.length !== filteredItems.length && ` (de ${items.length})`}
        </div>
      )}

      {/* Drawer Form */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={editing ? `Editar ${config.singular}` : `Nov${config.genderFem ? 'a' : 'o'} ${config.singular}`}
        subtitle={editing ? `ID: ${editing.id.slice(0, 12)}` : undefined}
        footer={
          <div className="flex items-center justify-end gap-2">
            <Button variant="secondary" type="button" onClick={closeDrawer} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" form="entity-form" disabled={submitting}>
              {submitting ? 'Salvando...' : editing ? 'Salvar alterações' : 'Cadastrar'}
            </Button>
          </div>
        }
      >
        <form id="entity-form" onSubmit={handleSubmit} className="space-y-6">
          {fieldGroups.map((group, gi) => (
            <div key={gi} className="space-y-4">
              {group.title && (
                <div className="flex items-center gap-3 pt-2">
                  <span className="text-xs uppercase tracking-wider text-[var(--color-fg-subtle)] font-semibold">
                    {group.title}
                  </span>
                  <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {group.fields.map((field) => (
                  <div
                    key={field.key}
                    className={(field.colSpan === 2 ? 'sm:col-span-2' : '')}
                  >
                    <FieldRenderer
                      field={field}
                      value={(formData as Record<string, unknown>)[field.key]}
                      onChange={(v) =>
                        setFormData((prev) => ({ ...prev, [field.key]: v }) as Partial<T>)
                      }
                      error={errors[field.key]}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </form>
      </Drawer>

      {/* Delete confirmation (with password gate) */}
      <ConfirmDialog
        open={deleteId !== null}
        title={`Excluir ${config.singular.toLowerCase()}?`}
        message="Esta ação não pode ser desfeita. Confirme com sua senha."
        onConfirm={confirmDelete}
        onClose={() => setDeleteId(null)}
      />

      {/* Excel import */}
      <ImportExcelModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={handleImport}
        title={`Importar ${config.plural} via Excel`}
        entityLabel={config.singular.toLowerCase()}
        genderFem={config.genderFem}
        templateData={[config.excel.templateHeaders, config.excel.templateExample]}
        templateFileName={`template_${config.slug}.xlsx`}
        sheetName={config.singular}
        templateColWidths={config.excel.templateColWidths ?? config.excel.templateHeaders.map(() => 22)}
        formatHintHeaders={config.excel.templateHeaders}
        formatHintExample={config.excel.templateExample.map((v) => String(v ?? ''))}
        parseRow={boundParser}
        toEntity={(row) => {
          const criadoPor = usuario?.email || usuario?.nome || 'sistema';
          return config.excel.toEntity(row, gerarId, criadoPor) as unknown as Record<string, unknown>;
        }}
      />
    </div>
  );
}
