import type { ReactNode } from 'react';
import type { ParsedRow } from '../../components/ui/ImportExcelModal';

export type FieldType =
  | 'text'
  | 'number'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'select'
  | 'date'
  | 'checkbox'
  | 'currency'
  | 'cnpj'
  | 'cpf';

export interface FieldOption {
  value: string;
  label: string;
}

export interface FieldConfig<T> {
  key: keyof T & string;
  label: string;
  type: FieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  /** colSpan in a 2-column grid. Default: 1. */
  colSpan?: 1 | 2;
  /** For select: static option list. */
  staticOptions?: FieldOption[];
  /** For select: hook that returns options at render time. Will be called inside the form. */
  useOptions?: () => FieldOption[];
  /** For text-like: format the input as the user types (e.g. CPF mask). */
  format?: (raw: string) => string;
  /** Optional extra: when true, render after a horizontal divider (group separator above). */
  groupStart?: string;
}

export interface ColumnConfig<T> {
  key: keyof T & string;
  label: string;
  /** Render the cell. Receives the row plus an optional lookup map (when `useLookup` is set). */
  render?: (row: T, lookup?: Map<string, string>) => ReactNode;
  /** Hook returning a Map<id, label> used by `render` to display the name behind a foreign-key id. */
  useLookup?: () => Map<string, string>;
  width?: string;
  hideOnMobile?: boolean;
  align?: 'left' | 'right' | 'center';
}

export interface EntityHooks<T> {
  useList: () => { data?: T[]; isLoading: boolean; error?: unknown };
  useAdd: () => { mutateAsync: (item: T) => Promise<unknown>; isPending?: boolean };
  useUpdate: () => { mutateAsync: (item: T) => Promise<unknown>; isPending?: boolean };
  useDelete: () => { mutateAsync: (id: string) => Promise<unknown>; isPending?: boolean };
}

export interface ExcelSpec<T> {
  templateHeaders: string[];
  templateExample: unknown[];
  /** Width per column in the template file. */
  templateColWidths?: number[];
  /** Pure parser: row -> ParsedRow (with valido/erros/resumo/dados). */
  parseRow: (row: unknown[], index: number) => ParsedRow;
  /** Build the final entity from a valid parsed row. ID is auto-generated upstream. */
  toEntity: (row: ParsedRow, gerarId: () => string, criadoPor: string) => T;
  /**
   * Optional: hook called inside the page that returns the parser bound to live data
   * (e.g. when Excel needs to look up a foreign-key like "Obra Nome" → obraId).
   * Falls back to the static `parseRow` above.
   */
  useBoundParser?: () => (row: unknown[], index: number) => ParsedRow;
}

export type EntityCategory = 'obra' | 'pessoas' | 'materiais' | 'frota';

export interface EntityConfig<T extends { id: string }> {
  /** URL slug under /cadastros/<slug> */
  slug: string;
  singular: string;
  plural: string;
  description: string;
  category: EntityCategory;
  genderFem?: boolean;
  /** lucide-react icon name OR a custom node */
  icon: ReactNode;
  /** Accent class for the category card hover ring. */
  accent?: 'green' | 'amber' | 'blue' | 'purple' | 'rose';

  /** Field used to filter the list with the search input. */
  searchKey: keyof T & string;
  /** Optional secondary search field. */
  searchKey2?: keyof T & string;

  columns: ColumnConfig<T>[];
  fields: FieldConfig<T>[];
  defaultValues: () => Partial<T>;

  hooks: EntityHooks<T>;
  excel: ExcelSpec<T>;

  /** Permission action keys. If undefined, action is allowed. */
  permissions?: {
    create?: string;
    edit?: string;
    delete?: string;
  };
}

/** Type-erased config for use in registry / hub. */
export type AnyEntityConfig = EntityConfig<{ id: string }>;
