# Import de peças em massa no Almoxarifado (Excel) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão "Importar Excel" na tela Almoxarifado que cadastra várias peças (insumos de manutenção) de uma vez a partir de uma planilha, pulando duplicados.

**Architecture:** Reusa o componente genérico `src/components/ui/ImportExcelModal.tsx` (template → upload → preview ✅/❌ → importar). Uma função pura de parse/validação (`importPecasAlmoxarifado.ts`), um wrapper fino (`ImportPecasModal.tsx`), um hook de insert em massa (`useImportarInsumos`), e o botão na `AlmoxarifadoPage`. Só cadastro de catálogo, sem estoque, sem migration, sem chave de permissão nova.

**Tech Stack:** React + TS + Vite, Supabase, React Query, `xlsx` (já usado pelo ImportExcelModal), Vitest.

## Global Constraints
- Peça = `Insumo` com `tipo='peca'`, `usadoEmManutencao=true`, `ativo=true`. Tabela `insumos` já existe. **Sem migration. Sem chave de permissão nova** (reusa `criar_peca_almoxarifado`).
- Dedup: casa por SKU (lower); se SKU vazio, por nome (lower). Contra o catálogo atual E dentro do próprio arquivo.
- Hook de mutação usa `.insert(...).select()` e lança erro se 0 linhas (pega RLS silencioso). Padrão de `src/hooks/useInsumos.ts`.
- `npx tsc -b`, `npx eslint <arquivos tocados>`, `npx vitest run` limpos antes do commit de fechamento. As 12 falhas de `src/utils/fifoCombustivel.test.ts` são dívida velha, não contam.
- `ImportExcelModal` já expõe helpers `parseNumero`, `parseStr` e a interface `ParsedRow { valido: boolean; erros: string[]; resumo: string; dados: Record<string, unknown> }`.
- Interface `Insumo` (de `src/types`), campos usados: `id, nome, tipo, unidade, descricao, ativo, criadoPor, categoria?, usadoEmManutencao, codigoSku, codigoEan, fabricante, codigoFabricante, estoqueMinimo (number|null), estoqueMaximo (number|null), leadTimeDias (number|null), equipamentosCompativeis (string[]), fotoUrl, aplicacaoTecnica`.

---

## Task 1: Função pura de parse/validação + template

**Files:**
- Create: `src/utils/importPecasAlmoxarifado.ts`
- Test: `src/utils/importPecasAlmoxarifado.test.ts`

**Interfaces:**
- Consumes: `parseNumero`, `parseStr`, `ParsedRow` de `../components/ui/ImportExcelModal`; `Insumo` de `../types`.
- Produces:
  - `interface DedupCtx { skusExistentes: Set<string>; nomesExistentes: Set<string>; vistosNoArquivo: Set<string> }`
  - `criarDedupCtx(insumos: { codigoSku?: string; nome: string }[]): DedupCtx`
  - `parseRowPeca(row: unknown[], index: number, ctx: DedupCtx): ParsedRow`
  - `pecaRowToInsumo(dados: Record<string, unknown>, criadoPor: string): Insumo`
  - `TEMPLATE_PECAS: { headers: string[]; exemplo: string[]; colWidths: number[] }`

- [ ] **Step 1: Escrever o teste (falhando)**

```ts
import { describe, it, expect } from 'vitest';
import { criarDedupCtx, parseRowPeca, pecaRowToInsumo, TEMPLATE_PECAS } from './importPecasAlmoxarifado';

// ordem das colunas: Nome, Unidade, SKU, EAN, Fabricante, Part number,
// Estoque mínimo, Estoque máximo, Lead time, Equipamentos compatíveis, Aplicação técnica
function ctx() {
  return criarDedupCtx([
    { nome: 'Filtro de Óleo 173-3511', codigoSku: 'FO-173' },
    { nome: 'Correia Sem SKU', codigoSku: '' },
  ]);
}

describe('parseRowPeca', () => {
  it('linha válida vira ParsedRow válido', () => {
    const r = parseRowPeca(['Óleo Motor 15W40', 'L', 'OL-15W40', '', 'Cat', '9X-7551', '4', '20', '7', 'Escavadeira, Pá', 'motor diesel'], 0, ctx());
    expect(r.valido).toBe(true);
    expect(r.erros).toEqual([]);
    expect(r.resumo).toContain('Óleo Motor 15W40');
    expect(r.dados.nome).toBe('Óleo Motor 15W40');
    expect(r.dados.estoqueMinimo).toBe(4);
    expect(r.dados.equipamentosCompativeis).toEqual(['Escavadeira', 'Pá']);
  });

  it('sem nome é inválida', () => {
    const r = parseRowPeca(['', 'un', 'X-1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/nome/i);
  });

  it('SKU já existente no catálogo é inválida', () => {
    const r = parseRowPeca(['Qualquer nome', 'un', 'FO-173'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/já existe/i);
  });

  it('nome já existente (SKU vazio) é inválida', () => {
    const r = parseRowPeca(['Correia Sem SKU', 'un', ''], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/já existe/i);
  });

  it('duplicado dentro do arquivo é inválido (2ª ocorrência)', () => {
    const c = ctx();
    const r1 = parseRowPeca(['Peça Nova', 'un', 'PN-1'], 0, c);
    const r2 = parseRowPeca(['Peça Nova', 'un', 'PN-1'], 1, c);
    expect(r1.valido).toBe(true);
    expect(r2.valido).toBe(false);
    expect(r2.erros.join(' ')).toMatch(/repetida/i);
  });

  it('index 0 reseta o acumulador do arquivo (novo upload)', () => {
    const c = ctx();
    parseRowPeca(['Peça Nova', 'un', 'PN-1'], 0, c);
    // novo upload: index 0 de novo, mesma peça deve ser válida (só catálogo conta)
    const r = parseRowPeca(['Peça Nova', 'un', 'PN-1'], 0, c);
    expect(r.valido).toBe(true);
  });

  it('unidade vazia cai no default un', () => {
    const r = parseRowPeca(['Peça X', '', 'PX-1'], 0, ctx());
    expect(r.dados.unidade).toBe('un');
  });
});

describe('pecaRowToInsumo', () => {
  it('monta Insumo com flags de peça de manutenção', () => {
    const dados = { nome: 'Peça X', unidade: 'un', codigoSku: 'PX-1', codigoEan: '', fabricante: '', codigoFabricante: '', estoqueMinimo: null, estoqueMaximo: null, leadTimeDias: null, equipamentosCompativeis: [], aplicacaoTecnica: '' };
    const insumo = pecaRowToInsumo(dados, 'Tiago');
    expect(insumo.tipo).toBe('peca');
    expect(insumo.usadoEmManutencao).toBe(true);
    expect(insumo.ativo).toBe(true);
    expect(insumo.criadoPor).toBe('Tiago');
    expect(insumo.nome).toBe('Peça X');
    expect(typeof insumo.id).toBe('string');
    expect(insumo.id.length).toBeGreaterThan(0);
  });
});

describe('TEMPLATE_PECAS', () => {
  it('tem 11 colunas com Nome primeiro', () => {
    expect(TEMPLATE_PECAS.headers.length).toBe(11);
    expect(TEMPLATE_PECAS.headers[0]).toBe('Nome');
    expect(TEMPLATE_PECAS.exemplo.length).toBe(11);
    expect(TEMPLATE_PECAS.colWidths.length).toBe(11);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar** — `npx vitest run src/utils/importPecasAlmoxarifado.test.ts` → FAIL (módulo não existe).

- [ ] **Step 3: Implementar `src/utils/importPecasAlmoxarifado.ts`**

```ts
// Import de peças (insumos de manutenção) em massa via Excel.
// Função pura de parse/validação usada pelo ImportPecasModal + ImportExcelModal genérico.

import { parseNumero, parseStr, type ParsedRow } from '../components/ui/ImportExcelModal';
import type { Insumo } from '../types';

// Ordem das colunas da planilha (índices de row[]).
const COL = {
  nome: 0, unidade: 1, sku: 2, ean: 3, fabricante: 4, partNumber: 5,
  estMin: 6, estMax: 7, leadTime: 8, equipamentos: 9, aplicacao: 10,
} as const;

export const TEMPLATE_PECAS = {
  headers: [
    'Nome', 'Unidade', 'SKU', 'EAN', 'Fabricante', 'Part number',
    'Estoque mínimo', 'Estoque máximo', 'Lead time (dias)',
    'Equipamentos compatíveis', 'Aplicação técnica',
  ],
  exemplo: [
    'Óleo Motor 15W40 SAE CJ-4', 'L', 'OL-15W40-CAT', '7891234567890', 'Caterpillar', '9X-7551',
    '4', '20', '7', 'Escavadeira Hidráulica, Caminhão Basculante', 'Intervalo 250h, cárter 13L',
  ],
  colWidths: [32, 8, 16, 16, 16, 16, 12, 12, 12, 32, 32],
};

export interface DedupCtx {
  skusExistentes: Set<string>;
  nomesExistentes: Set<string>;
  vistosNoArquivo: Set<string>;
}

export function criarDedupCtx(insumos: { codigoSku?: string | null; nome: string }[]): DedupCtx {
  const skusExistentes = new Set<string>();
  const nomesExistentes = new Set<string>();
  for (const i of insumos) {
    const sku = (i.codigoSku ?? '').trim().toLowerCase();
    if (sku) skusExistentes.add(sku);
    nomesExistentes.add((i.nome ?? '').trim().toLowerCase());
  }
  return { skusExistentes, nomesExistentes, vistosNoArquivo: new Set() };
}

function chaveDedup(nome: string, sku: string): string {
  return sku ? `sku:${sku.toLowerCase()}` : `nome:${nome.toLowerCase()}`;
}

export function parseRowPeca(row: unknown[], index: number, ctx: DedupCtx): ParsedRow {
  // Reseta o acumulador do arquivo a cada novo upload (o modal genérico
  // reindexa a partir de 0 em cada processamento de arquivo).
  if (index === 0) ctx.vistosNoArquivo.clear();

  const nome = parseStr(row[COL.nome]);
  const unidadeRaw = parseStr(row[COL.unidade]);
  const unidade = unidadeRaw || 'un';
  const codigoSku = parseStr(row[COL.sku]);
  const codigoEan = parseStr(row[COL.ean]);
  const fabricante = parseStr(row[COL.fabricante]);
  const codigoFabricante = parseStr(row[COL.partNumber]);
  const estoqueMinimo = parseNumero(row[COL.estMin]);
  const estoqueMaximo = parseNumero(row[COL.estMax]);
  const leadTimeDias = parseNumero(row[COL.leadTime]);
  const equipamentosCompativeis = parseStr(row[COL.equipamentos])
    .split(',').map((s) => s.trim()).filter(Boolean);
  const aplicacaoTecnica = parseStr(row[COL.aplicacao]);

  const erros: string[] = [];
  if (!nome) erros.push('Nome é obrigatório');

  if (nome) {
    const skuLower = codigoSku.toLowerCase();
    const nomeLower = nome.toLowerCase();
    const jaNoCatalogo = codigoSku
      ? ctx.skusExistentes.has(skuLower)
      : ctx.nomesExistentes.has(nomeLower);
    if (jaNoCatalogo) erros.push('Já existe no catálogo (SKU ou nome)');

    const chave = chaveDedup(nome, codigoSku);
    if (ctx.vistosNoArquivo.has(chave)) {
      erros.push('Linha repetida no arquivo');
    } else {
      ctx.vistosNoArquivo.add(chave);
    }
  }

  return {
    valido: erros.length === 0,
    erros,
    resumo: codigoSku ? `${nome} (${codigoSku})` : nome,
    dados: {
      nome, unidade, codigoSku, codigoEan, fabricante, codigoFabricante,
      estoqueMinimo, estoqueMaximo, leadTimeDias, equipamentosCompativeis, aplicacaoTecnica,
    },
  };
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function pecaRowToInsumo(dados: Record<string, unknown>, criadoPor: string): Insumo {
  return {
    id: gerarId(),
    nome: String(dados.nome ?? ''),
    tipo: 'peca',
    unidade: String(dados.unidade ?? 'un'),
    descricao: '',
    ativo: true,
    criadoPor,
    usadoEmManutencao: true,
    codigoSku: String(dados.codigoSku ?? ''),
    codigoEan: String(dados.codigoEan ?? ''),
    fabricante: String(dados.fabricante ?? ''),
    codigoFabricante: String(dados.codigoFabricante ?? ''),
    estoqueMinimo: (dados.estoqueMinimo as number | null) ?? null,
    estoqueMaximo: (dados.estoqueMaximo as number | null) ?? null,
    leadTimeDias: (dados.leadTimeDias as number | null) ?? null,
    equipamentosCompativeis: (dados.equipamentosCompativeis as string[]) ?? [],
    fotoUrl: '',
    aplicacaoTecnica: String(dados.aplicacaoTecnica ?? ''),
  };
}
```

Nota: se o `tsc` reclamar de campo faltando/sobrando em `Insumo`, ajustar ao tipo real (conferir `src/types` — `categoria` é opcional; não setar). NÃO inventar campos.

- [ ] **Step 4: Rodar e ver passar** — `npx vitest run src/utils/importPecasAlmoxarifado.test.ts` → PASS. `npx tsc -b` limpo.

- [ ] **Step 5: Commit**

```bash
git add src/utils/importPecasAlmoxarifado.ts src/utils/importPecasAlmoxarifado.test.ts
git commit -m "feat(manutencao): parse/validação do import de peças do almoxarifado (Excel)"
```

---

## Task 2: Hook de insert em massa `useImportarInsumos`

**Files:**
- Modify: `src/hooks/useInsumos.ts`

**Interfaces:**
- Consumes: `insumoToDb` de `../lib/mappers`, `Insumo` de `../types`, supabase.
- Produces: `useImportarInsumos()` → mutation cujo `mutationFn(insumos: Insumo[])` insere em massa; `onSuccess` invalida `['insumos']`.

- [ ] **Step 1: Implementar o hook** (adicionar ao fim de `src/hooks/useInsumos.ts`):

```ts
/** Insere vários insumos de uma vez (import de planilha). Lança erro se 0 linhas (RLS silencioso). */
export function useImportarInsumos() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (insumos: Insumo[]) => {
      if (insumos.length === 0) return;
      const { data, error } = await supabase
        .from('insumos')
        .insert(insumos.map(insumoToDb))
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nenhuma peça foi importada — possível negação de permissão (RLS).');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['insumos'] }),
  });
}
```

- [ ] **Step 2: Verificar tipos** — `npx tsc -b` limpo (confere que `insumoToDb` aceita `Insumo` e o `.insert` de array compila).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useInsumos.ts
git commit -m "feat(manutencao): hook useImportarInsumos (insert em massa)"
```

---

## Task 3: Wrapper `ImportPecasModal`

**Files:**
- Create: `src/components/manutencao/almoxarifado/ImportPecasModal.tsx`

**Interfaces:**
- Consumes: `ImportExcelModal` (default) + `ParsedRow` de `../../ui/ImportExcelModal`; `criarDedupCtx`, `parseRowPeca`, `pecaRowToInsumo`, `TEMPLATE_PECAS` de `../../../utils/importPecasAlmoxarifado`; `useImportarInsumos` de `../../../hooks/useInsumos`; `useAuth`; `useToast`; `Insumo` de `../../../types`.
- Produces: `export default function ImportPecasModal({ open, onClose, insumos }: { open: boolean; onClose: () => void; insumos: Insumo[] })`.

- [ ] **Step 1: Implementar o componente**

```tsx
import { useMemo, useRef } from 'react';
import ImportExcelModal, { type ParsedRow } from '../../ui/ImportExcelModal';
import { criarDedupCtx, parseRowPeca, pecaRowToInsumo, TEMPLATE_PECAS } from '../../../utils/importPecasAlmoxarifado';
import { useImportarInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import type { Insumo } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  insumos: Insumo[];
}

export default function ImportPecasModal({ open, onClose, insumos }: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const importar = useImportarInsumos();

  // ctx de dedup reconstruído a cada abertura (catálogo atual). O ref garante
  // que o mesmo ctx (com o acumulador do arquivo) seja usado nas chamadas de parseRow.
  const ctxRef = useRef(criarDedupCtx(insumos));
  useMemo(() => {
    if (open) ctxRef.current = criarDedupCtx(insumos);
  }, [open, insumos]);

  const parseRow = (row: unknown[], index: number): ParsedRow =>
    parseRowPeca(row, index, ctxRef.current);

  const toEntity = (r: ParsedRow): Record<string, unknown> =>
    pecaRowToInsumo(r.dados, usuario?.nome ?? '') as unknown as Record<string, unknown>;

  const handleImport = (items: Record<string, unknown>[]) => {
    const novos = items as unknown as Insumo[];
    importar.mutate(novos, {
      onSuccess: () => showToast({ kind: 'success', message: `${novos.length} peça(s) importada(s).` }),
      onError: (e) => showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Falha ao importar peças.' }),
    });
  };

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={handleImport}
      title="Importar peças (Excel)"
      entityLabel="peça"
      genderFem
      templateData={[TEMPLATE_PECAS.headers, TEMPLATE_PECAS.exemplo]}
      templateFileName="template-pecas-almoxarifado.xlsx"
      sheetName="Peças"
      templateColWidths={TEMPLATE_PECAS.colWidths}
      formatHintHeaders={TEMPLATE_PECAS.headers}
      formatHintExample={TEMPLATE_PECAS.exemplo}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
```

Nota: conferir a assinatura real de `useToast`/`showToast` e `useAuth().usuario` (já usados no módulo — `Manutencao.tsx` usa `useToast().showToast({ kind, message })` e `PecaFormModal` usa `useAuth().usuario?.nome`). Ajustar se divergir.

- [ ] **Step 2: Verificação** — `npx tsc -b` + `npx eslint src/components/manutencao/almoxarifado/ImportPecasModal.tsx` limpos.

- [ ] **Step 3: Commit**

```bash
git add src/components/manutencao/almoxarifado/ImportPecasModal.tsx
git commit -m "feat(manutencao): ImportPecasModal (wrapper do ImportExcelModal pra peças)"
```

---

## Task 4: Botão "Importar Excel" na AlmoxarifadoPage

**Files:**
- Modify: `src/components/manutencao/AlmoxarifadoPage.tsx`

**Interfaces:**
- Consumes: `ImportPecasModal` (Task 3); `insumos` (já disponível via `useInsumos()` na página); `temAcao('criar_peca_almoxarifado')`.

- [ ] **Step 1: Importar o modal** (junto dos outros imports de modal, ~linha 25):

```tsx
import ImportPecasModal from './almoxarifado/ImportPecasModal';
```

- [ ] **Step 2: Estado do modal** (junto dos outros `useState` da página):

```tsx
const [importOpen, setImportOpen] = useState(false);
const canImportar = temAcao('criar_peca_almoxarifado');
```

- [ ] **Step 3: Botão no header**, ao lado do "Nova peça" (usar o ícone `FileInput` já importado no arquivo). Achar o bloco do botão "Nova peça" (`<Plus .../> Nova peça`) e adicionar antes dele:

```tsx
{canImportar && (
  <Button variant="secondary" onClick={() => setImportOpen(true)}>
    <FileInput className="w-4 h-4" /> Importar Excel
  </Button>
)}
```

- [ ] **Step 4: Renderizar o modal** (junto dos outros modais no fim do JSX, ex. onde ficam `PecaFormModal`/`NovaEntradaModal`):

```tsx
<ImportPecasModal open={importOpen} onClose={() => setImportOpen(false)} insumos={insumos} />
```

- [ ] **Step 5: Verificação** — `npx tsc -b`, `npx eslint src/components/manutencao/AlmoxarifadoPage.tsx`, `npx vite build` limpos.

- [ ] **Step 6: Commit**

```bash
git add src/components/manutencao/AlmoxarifadoPage.tsx
git commit -m "feat(manutencao): botão Importar Excel de peças no almoxarifado"
```

---

## Fechamento
- [ ] `npx tsc -b`, `npx eslint` nos 4 arquivos tocados, `npx vitest run` (só as 12 falhas velhas do fifoCombustivel), `npx vite build` limpos.
- [ ] Teste manual em produção (após deploy, com ok do Tiago pro push): baixar template, preencher 2 peças novas + 1 repetindo SKU de peça existente, importar, conferir preview (2 ✅ / 1 ❌ "já existe"), confirmar que as 2 entram no catálogo. Depois apagar as 2 de teste.
- [ ] Atualizar vault: `projects/gestao-obras/status.md` + `log.md`.
- [ ] Merge/push na main com ok do Tiago → deploy Vercel READY.

## Self-review (cobertura da spec)
- Botão na tela Almoxarifado → Task 4. Reuso do ImportExcelModal → Task 3. Colunas/template → Task 1 (TEMPLATE_PECAS). Validação sem-nome/dedup catálogo/dedup arquivo → Task 1 (parseRowPeca) + testes. Insert em massa sem estoque → Task 2 (useImportarInsumos, só `insumos`). Sem migration/sem permissão nova → Tasks 2/4 (reusa `criar_peca_almoxarifado`). Testes unit → Task 1. Fora de escopo (Tipos de Óleo, estoque, update de existente) → respeitado.
