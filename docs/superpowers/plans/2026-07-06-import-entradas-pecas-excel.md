# Import de Entradas de Peças via Excel — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Importar entradas de peças em estoque via planilha Excel, várias peças e várias NFs num arquivo só, no almoxarifado do módulo de manutenção.

**Architecture:** Util puro de parse/validação (`importEntradasPecas.ts`) + modal fino que reusa o `ImportExcelModal` genérico + hook de insert em lote na tabela `entradas_material`. Mesmo padrão do import de catálogo de peças (`importPecasAlmoxarifado.ts` + `ImportPecasModal`).

**Tech Stack:** React 18 + TypeScript, TanStack Query, Supabase JS, XLSX (SheetJS), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-06-import-entradas-pecas-excel-design.md`

## Global Constraints

- Trabalho direto na branch `main`, sem branch/worktree (preferência do Tiago registrada).
- Todo texto de UI e mensagens de erro em português do Brasil.
- Match de depósito/fornecedor/peça: case-insensitive com trim.
- Só casam insumos `ativo && usadoEmManutencao`, depósitos `ativo`, fornecedores `ativo !== false` (mesmos filtros do `NovaEntradaModal`).
- Data wall-clock: o dia digitado na planilha é o dia gravado/exibido. Serialização igual ao `NovaEntradaModal` (via `new Date(...).toISOString()`), com horário fixo 12:00 pra não deslocar o dia.
- NF já lançada = mesmo `fornecedorId` + mesma `notaFiscal` (trim, lowercase) em `entradas_material` não soft-deletada.
- Rodar comandos a partir de `/Users/tiagocameli/projects/Gestao_Obras`.

---

### Task 1: Util puro `importEntradasPecas.ts` (parse + validação) com testes

**Files:**
- Create: `src/utils/importEntradasPecas.ts`
- Test: `src/utils/importEntradasPecas.test.ts`

**Interfaces:**
- Consumes: `parseNumero`, `parseStr`, `parseData`, `type ParsedRow` de `src/components/ui/ImportExcelModal.tsx`; tipos `EntradaMaterial`, `Insumo`, `DepositoMaterial`, `Fornecedor` de `src/types`.
- Produces (usados na Task 3):
  - `TEMPLATE_ENTRADAS_PECAS: { headers: string[]; exemplo: string[]; colWidths: number[] }`
  - `criarEntradasCtx(insumos: Insumo[], depositos: DepositoMaterial[], fornecedores: Fornecedor[], entradas: EntradaMaterial[]): EntradasImportCtx`
  - `parseRowEntrada(row: unknown[], index: number, ctx: EntradasImportCtx): ParsedRow`
  - `entradaRowToEntradaMaterial(dados: Record<string, unknown>, criadoPor: string): EntradaMaterial`

- [ ] **Step 1: Escrever os testes (falhando)**

Criar `src/utils/importEntradasPecas.test.ts` com este conteúdo completo:

```typescript
import { describe, it, expect } from 'vitest';
import {
  criarEntradasCtx, parseRowEntrada, entradaRowToEntradaMaterial, TEMPLATE_ENTRADAS_PECAS,
} from './importEntradasPecas';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo } from '../types';

// Colunas: Depósito, Fornecedor, Nota fiscal, Data, SKU, Peça (nome), Quantidade, Valor unitário
function ctx() {
  return criarEntradasCtx(
    [
      { id: 'i1', nome: 'Filtro de Óleo 173-3511', codigoSku: 'FO-173', ativo: true, usadoEmManutencao: true },
      { id: 'i2', nome: 'Correia Sem SKU', codigoSku: '', ativo: true, usadoEmManutencao: true },
      { id: 'i3', nome: 'Peça Inativa', codigoSku: 'PI-9', ativo: false, usadoEmManutencao: true },
      { id: 'i4', nome: 'Cimento CP-II', codigoSku: 'CIM-2', ativo: true, usadoEmManutencao: false },
    ] as unknown as Insumo[],
    [
      { id: 'd1', nome: 'Almoxarifado Central', obraId: 'obra1', ativo: true },
      { id: 'd2', nome: 'Depósito Desativado', obraId: '', ativo: false },
    ] as unknown as DepositoMaterial[],
    [
      { id: 'f1', nome: 'Auto Peças Acre', ativo: true },
      { id: 'f2', nome: 'Fornecedor Inativo', ativo: false },
    ] as unknown as Fornecedor[],
    [
      { fornecedorId: 'f1', notaFiscal: '111' },
      { fornecedorId: 'f1', notaFiscal: '222', deletadoEm: '2026-01-01T00:00:00Z' },
    ] as unknown as EntradaMaterial[]
  );
}

const ROW_OK = ['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '10', '38,50'];

describe('parseRowEntrada', () => {
  it('linha válida com SKU resolve ids e números', () => {
    const r = parseRowEntrada(ROW_OK, 0, ctx());
    expect(r.valido).toBe(true);
    expect(r.erros).toEqual([]);
    expect(r.dados.depositoId).toBe('d1');
    expect(r.dados.obraId).toBe('obra1');
    expect(r.dados.fornecedorId).toBe('f1');
    expect(r.dados.insumoId).toBe('i1');
    expect(r.dados.notaFiscal).toBe('123');
    expect(r.dados.data).toBe('2026-07-06');
    expect(r.dados.quantidade).toBe(10);
    expect(r.dados.valorUnitario).toBe(38.5);
    expect(r.resumo).toContain('123');
    expect(r.resumo).toContain('Filtro de Óleo 173-3511');
  });

  it('SKU vazio casa pelo nome exato (case-insensitive)', () => {
    const r = parseRowEntrada(['almoxarifado central', 'AUTO PEÇAS ACRE', '123', '06/07/2026', '', 'correia sem sku', '2', '10'], 0, ctx());
    expect(r.valido).toBe(true);
    expect(r.dados.insumoId).toBe('i2');
  });

  it('SKU inexistente é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'XX-999', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não encontrad/i);
  });

  it('nome inexistente (sem SKU) é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', '', 'Peça Fantasma', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/não encontrad/i);
  });

  it('sem SKU e sem nome é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', '', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/informe sku ou nome/i);
  });

  it('peça inativa ou fora da manutenção não casa', () => {
    const inativa = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'PI-9', '', '1', '1'], 0, ctx());
    expect(inativa.valido).toBe(false);
    const foraManut = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'CIM-2', '', '1', '1'], 0, ctx());
    expect(foraManut.valido).toBe(false);
  });

  it('depósito inexistente ou inativo é inválida', () => {
    const naoAchou = parseRowEntrada(['Depósito X', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(naoAchou.valido).toBe(false);
    expect(naoAchou.erros.join(' ')).toMatch(/depósito/i);
    const inativo = parseRowEntrada(['Depósito Desativado', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(inativo.valido).toBe(false);
  });

  it('fornecedor inexistente ou inativo é inválida', () => {
    const naoAchou = parseRowEntrada(['Almoxarifado Central', 'Fornecedor X', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(naoAchou.valido).toBe(false);
    expect(naoAchou.erros.join(' ')).toMatch(/fornecedor/i);
    const inativo = parseRowEntrada(['Almoxarifado Central', 'Fornecedor Inativo', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(inativo.valido).toBe(false);
  });

  it('NF vazia é inválida', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/nota fiscal/i);
  });

  it('data vazia ou inválida é inválida; serial do Excel funciona', () => {
    const vazia = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '', 'FO-173', '', '1', '1'], 0, ctx());
    expect(vazia.valido).toBe(false);
    expect(vazia.erros.join(' ')).toMatch(/data/i);
    const lixo = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', 'amanhã', 'FO-173', '', '1', '1'], 0, ctx());
    expect(lixo.valido).toBe(false);
    // serial 45000 = 15/03/2023
    const serial = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', 45000, 'FO-173', '', '1', '1'], 0, ctx());
    expect(serial.valido).toBe(true);
    expect(serial.dados.data).toBe('2023-03-15');
  });

  it('quantidade precisa ser > 0', () => {
    const zero = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '0', '1'], 0, ctx());
    expect(zero.valido).toBe(false);
    expect(zero.erros.join(' ')).toMatch(/quantidade/i);
    const vazia = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '', '1'], 0, ctx());
    expect(vazia.valido).toBe(false);
  });

  it('valor unitário vazio é inválido; zero é válido', () => {
    const vazio = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', ''], 0, ctx());
    expect(vazio.valido).toBe(false);
    expect(vazio.erros.join(' ')).toMatch(/valor/i);
    const zero = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '0'], 0, ctx());
    expect(zero.valido).toBe(true);
    expect(zero.dados.valorUnitario).toBe(0);
  });

  it('NF já lançada no banco bloqueia a linha', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '111', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(false);
    expect(r.erros.join(' ')).toMatch(/já lançada/i);
  });

  it('NF de entrada soft-deletada não bloqueia', () => {
    const r = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '222', '06/07/2026', 'FO-173', '', '1', '1'], 0, ctx());
    expect(r.valido).toBe(true);
  });

  it('mesma NF com peças diferentes no arquivo: ambas válidas', () => {
    const c = ctx();
    const r1 = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', 'FO-173', '', '1', '1'], 0, c);
    const r2 = parseRowEntrada(['Almoxarifado Central', 'Auto Peças Acre', '123', '06/07/2026', '', 'Correia Sem SKU', '1', '1'], 1, c);
    expect(r1.valido).toBe(true);
    expect(r2.valido).toBe(true);
  });

  it('mesma NF + mesma peça repetida no arquivo: 2ª ocorrência inválida', () => {
    const c = ctx();
    const r1 = parseRowEntrada(ROW_OK, 0, c);
    const r2 = parseRowEntrada(ROW_OK, 1, c);
    expect(r1.valido).toBe(true);
    expect(r2.valido).toBe(false);
    expect(r2.erros.join(' ')).toMatch(/repetida/i);
  });

  it('index 0 reseta o acumulador do arquivo (novo upload)', () => {
    const c = ctx();
    parseRowEntrada(ROW_OK, 0, c);
    const r = parseRowEntrada(ROW_OK, 0, c);
    expect(r.valido).toBe(true);
  });
});

describe('entradaRowToEntradaMaterial', () => {
  it('monta EntradaMaterial com total calculado e dia preservado', () => {
    const dados = {
      depositoId: 'd1', obraId: 'obra1', fornecedorId: 'f1', notaFiscal: '123',
      data: '2026-07-06', insumoId: 'i1', quantidade: 10, valorUnitario: 38.5,
    };
    const e = entradaRowToEntradaMaterial(dados, 'Tiago');
    expect(typeof e.id).toBe('string');
    expect(e.id.length).toBeGreaterThan(0);
    expect(e.depositoMaterialId).toBe('d1');
    expect(e.obraId).toBe('obra1');
    expect(e.fornecedorId).toBe('f1');
    expect(e.insumoId).toBe('i1');
    expect(e.notaFiscal).toBe('123');
    expect(e.quantidade).toBe(10);
    expect(e.valorUnitario).toBe(38.5);
    expect(e.valorTotal).toBe(385);
    expect(e.criadoPor).toBe('Tiago');
    expect(e.observacoes).toBe('');
    // dia gravado = dia da planilha, no fuso local (regra wall-clock)
    expect(new Date(e.dataHora).toLocaleDateString('sv-SE')).toBe('2026-07-06');
  });
});

describe('TEMPLATE_ENTRADAS_PECAS', () => {
  it('tem 8 colunas com Depósito primeiro', () => {
    expect(TEMPLATE_ENTRADAS_PECAS.headers.length).toBe(8);
    expect(TEMPLATE_ENTRADAS_PECAS.headers[0]).toBe('Depósito');
    expect(TEMPLATE_ENTRADAS_PECAS.exemplo.length).toBe(8);
    expect(TEMPLATE_ENTRADAS_PECAS.colWidths.length).toBe(8);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx vitest run src/utils/importEntradasPecas.test.ts`
Expected: FAIL — módulo `./importEntradasPecas` não existe.

- [ ] **Step 3: Implementar o util**

Criar `src/utils/importEntradasPecas.ts` com este conteúdo completo:

```typescript
// Import de entradas de peças em estoque via Excel (várias NFs num arquivo).
// Funções puras de parse/validação usadas pelo ImportEntradasModal +
// ImportExcelModal genérico. Espelha o padrão do importPecasAlmoxarifado.ts.

import { parseData, parseNumero, parseStr, type ParsedRow } from '../components/ui/ImportExcelModal';
import type { DepositoMaterial, EntradaMaterial, Fornecedor, Insumo } from '../types';

// Ordem das colunas da planilha (índices de row[]).
const COL = {
  deposito: 0, fornecedor: 1, notaFiscal: 2, data: 3,
  sku: 4, nome: 5, quantidade: 6, valorUnitario: 7,
} as const;

export const TEMPLATE_ENTRADAS_PECAS = {
  headers: [
    'Depósito', 'Fornecedor', 'Nota fiscal', 'Data',
    'SKU', 'Peça (nome)', 'Quantidade', 'Valor unitário',
  ],
  exemplo: [
    'Almoxarifado Central', 'Auto Peças Acre', '123456', '06/07/2026',
    'OL-15W40-CAT', 'Óleo Motor 15W40 SAE CJ-4', '20', '38,50',
  ],
  colWidths: [24, 24, 12, 12, 16, 32, 12, 14],
};

export interface EntradasImportCtx {
  depositosPorNome: Map<string, DepositoMaterial>;
  fornecedoresPorNome: Map<string, Fornecedor>;
  insumosPorSku: Map<string, Insumo>;
  insumosPorNome: Map<string, Insumo>;
  /** `${fornecedorId}|${nf lower}` das entradas já no banco (sem soft-deleted). */
  nfsLancadas: Set<string>;
  /** `${fornecedorId}|${nf lower}|${insumoId}` já vistos no arquivo atual. */
  vistosNoArquivo: Set<string>;
}

function chave(...partes: string[]): string {
  return partes.map((p) => p.trim().toLowerCase()).join('|');
}

export function criarEntradasCtx(
  insumos: Insumo[],
  depositos: DepositoMaterial[],
  fornecedores: Fornecedor[],
  entradas: EntradaMaterial[]
): EntradasImportCtx {
  const depositosPorNome = new Map<string, DepositoMaterial>();
  for (const d of depositos) {
    if (d.ativo) depositosPorNome.set(d.nome.trim().toLowerCase(), d);
  }

  const fornecedoresPorNome = new Map<string, Fornecedor>();
  for (const f of fornecedores) {
    if (f.ativo !== false) fornecedoresPorNome.set(f.nome.trim().toLowerCase(), f);
  }

  // Mesmo filtro do NovaEntradaModal: só peças ativas usadas em manutenção.
  const insumosPorSku = new Map<string, Insumo>();
  const insumosPorNome = new Map<string, Insumo>();
  for (const i of insumos) {
    if (!i.ativo || !i.usadoEmManutencao) continue;
    const sku = (i.codigoSku ?? '').trim().toLowerCase();
    if (sku) insumosPorSku.set(sku, i);
    insumosPorNome.set(i.nome.trim().toLowerCase(), i);
  }

  const nfsLancadas = new Set<string>();
  for (const e of entradas) {
    if (e.deletadoEm) continue;
    const nf = (e.notaFiscal ?? '').trim();
    if (nf) nfsLancadas.add(chave(e.fornecedorId, nf));
  }

  return {
    depositosPorNome, fornecedoresPorNome, insumosPorSku, insumosPorNome,
    nfsLancadas, vistosNoArquivo: new Set(),
  };
}

export function parseRowEntrada(row: unknown[], index: number, ctx: EntradasImportCtx): ParsedRow {
  // Reseta o acumulador do arquivo a cada novo upload (o modal genérico
  // reindexa a partir de 0 em cada processamento de arquivo).
  if (index === 0) ctx.vistosNoArquivo.clear();

  const depositoNome = parseStr(row[COL.deposito]);
  const fornecedorNome = parseStr(row[COL.fornecedor]);
  const notaFiscal = parseStr(row[COL.notaFiscal]);
  const data = parseData(row[COL.data]);
  const sku = parseStr(row[COL.sku]);
  const nome = parseStr(row[COL.nome]);
  const quantidade = parseNumero(row[COL.quantidade]);
  const valorUnitario = parseNumero(row[COL.valorUnitario]);

  const erros: string[] = [];

  const deposito = ctx.depositosPorNome.get(depositoNome.toLowerCase());
  if (!deposito) erros.push(`Depósito "${depositoNome}" não encontrado ou inativo`);

  const fornecedor = ctx.fornecedoresPorNome.get(fornecedorNome.toLowerCase());
  if (!fornecedor) erros.push(`Fornecedor "${fornecedorNome}" não encontrado ou inativo`);

  if (!notaFiscal) erros.push('Nota fiscal é obrigatória');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) erros.push('Data inválida (use dd/mm/aaaa)');

  let insumo: Insumo | undefined;
  if (sku) {
    insumo = ctx.insumosPorSku.get(sku.toLowerCase());
    if (!insumo) erros.push(`SKU "${sku}" não encontrado no catálogo de peças`);
  } else if (nome) {
    insumo = ctx.insumosPorNome.get(nome.toLowerCase());
    if (!insumo) erros.push(`Peça "${nome}" não encontrada no catálogo`);
  } else {
    erros.push('Informe SKU ou nome da peça');
  }

  if (quantidade === null || quantidade <= 0) erros.push('Quantidade deve ser maior que zero');
  if (valorUnitario === null || valorUnitario < 0) erros.push('Valor unitário inválido');

  if (fornecedor && notaFiscal) {
    if (ctx.nfsLancadas.has(chave(fornecedor.id, notaFiscal))) {
      erros.push('NF já lançada para esse fornecedor');
    }
    if (insumo) {
      const k = chave(fornecedor.id, notaFiscal, insumo.id);
      if (ctx.vistosNoArquivo.has(k)) {
        erros.push('Peça repetida na mesma NF dentro do arquivo');
      } else {
        ctx.vistosNoArquivo.add(k);
      }
    }
  }

  const pecaLabel = insumo
    ? (insumo.codigoSku ? `${insumo.codigoSku} — ${insumo.nome}` : insumo.nome)
    : (sku || nome || '(sem peça)');

  return {
    valido: erros.length === 0,
    erros,
    resumo: `NF ${notaFiscal || '?'} · ${pecaLabel} · qtd ${quantidade ?? '?'}`,
    dados: {
      depositoId: deposito?.id ?? '',
      obraId: deposito?.obraId ?? '',
      fornecedorId: fornecedor?.id ?? '',
      notaFiscal,
      data,
      insumoId: insumo?.id ?? '',
      quantidade,
      valorUnitario,
    },
  };
}

function gerarId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

export function entradaRowToEntradaMaterial(dados: Record<string, unknown>, criadoPor: string): EntradaMaterial {
  const quantidade = (dados.quantidade as number | null) ?? 0;
  const valorUnitario = (dados.valorUnitario as number | null) ?? 0;
  // Meio-dia local: o dia da planilha é o dia gravado/exibido (wall-clock),
  // serializado do mesmo jeito que o NovaEntradaModal (toISOString).
  const dataHora = new Date(`${String(dados.data)}T12:00:00`).toISOString();
  return {
    id: gerarId(),
    dataHora,
    depositoMaterialId: String(dados.depositoId ?? ''),
    insumoId: String(dados.insumoId ?? ''),
    obraId: String(dados.obraId ?? ''),
    quantidade,
    valorUnitario,
    valorTotal: quantidade * valorUnitario,
    fornecedorId: String(dados.fornecedorId ?? ''),
    notaFiscal: String(dados.notaFiscal ?? ''),
    observacoes: '',
    criadoPor,
  };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx vitest run src/utils/importEntradasPecas.test.ts`
Expected: PASS, todos os testes verdes.

- [ ] **Step 5: Commit**

```bash
git add src/utils/importEntradasPecas.ts src/utils/importEntradasPecas.test.ts
git commit -m "feat(manutencao): parse/validação do import de entradas de peças via Excel"
```

---

### Task 2: Hook `useImportarEntradasMaterial` (insert em lote)

**Files:**
- Modify: `src/hooks/useEntradasMaterial.ts` (adicionar função ao fim do arquivo)

**Interfaces:**
- Consumes: `entradaMaterialToDb` (já importado no arquivo), `supabase`, `EntradaMaterial`.
- Produces: `useImportarEntradasMaterial(): UseMutationResult` — mutation que recebe `EntradaMaterial[]`, insere em lote e invalida `entradas_material`, `saldo_estoque_total`, `saldo_estoque_deposito`. Usado na Task 3.

Não há teste unitário de hook aqui: segue o padrão do `useImportarInsumos` (sem teste), a lógica é uma chamada Supabase + invalidações, coberta por typecheck e pela verificação manual da Task 5.

- [ ] **Step 1: Adicionar o hook**

Acrescentar ao fim de `src/hooks/useEntradasMaterial.ts`:

```typescript
/** Insert em lote pro import via Excel. Um único .insert(array) — não N chamadas. */
export function useImportarEntradasMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entradas: EntradaMaterial[]) => {
      if (entradas.length === 0) return;
      const { data, error } = await supabase
        .from('entradas_material')
        .insert(entradas.map(entradaMaterialToDb))
        .select();
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error('Nenhuma entrada foi importada — possível negação de permissão (RLS).');
      }
    },
    onSuccess: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['entradas_material'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_total'] }),
        qc.invalidateQueries({ queryKey: ['saldo_estoque_deposito'] }),
      ]),
  });
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useEntradasMaterial.ts
git commit -m "feat(manutencao): hook de insert em lote de entradas de material"
```

---

### Task 3: Modal `ImportEntradasModal.tsx`

**Files:**
- Create: `src/components/manutencao/almoxarifado/ImportEntradasModal.tsx`

**Interfaces:**
- Consumes: `ImportExcelModal` + `ParsedRow`; `criarEntradasCtx`, `parseRowEntrada`, `entradaRowToEntradaMaterial`, `TEMPLATE_ENTRADAS_PECAS` (Task 1); `useEntradasMaterial`, `useImportarEntradasMaterial` (Task 2); `useDepositosMaterial`, `useFornecedores`, `useInsumos`, `useAuth`, `useToast`.
- Produces: `export default function ImportEntradasModal({ open, onClose }: { open: boolean; onClose: () => void })` — usado na Task 4.

- [ ] **Step 1: Criar o componente**

Conteúdo completo de `src/components/manutencao/almoxarifado/ImportEntradasModal.tsx`:

```tsx
// Import de entradas de peças em estoque via Excel (várias NFs num arquivo).
// Modal fino: monta o contexto de validação com os dados dos hooks e delega
// UI/fluxo ao ImportExcelModal genérico. Espelha o ImportPecasModal.

import { useMemo } from 'react';
import ImportExcelModal, { type ParsedRow } from '../../ui/ImportExcelModal';
import {
  criarEntradasCtx, parseRowEntrada, entradaRowToEntradaMaterial, TEMPLATE_ENTRADAS_PECAS,
} from '../../../utils/importEntradasPecas';
import { useEntradasMaterial, useImportarEntradasMaterial } from '../../../hooks/useEntradasMaterial';
import { useDepositosMaterial } from '../../../hooks/useDepositosMaterial';
import { useFornecedores } from '../../../hooks/useFornecedores';
import { useInsumos } from '../../../hooks/useInsumos';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../ui/Toast';
import type { EntradaMaterial } from '../../../types';

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function ImportEntradasModal({ open, onClose }: Props) {
  const { usuario } = useAuth();
  const { showToast } = useToast();
  const importar = useImportarEntradasMaterial();
  const { data: insumos = [] } = useInsumos();
  const { data: depositos = [] } = useDepositosMaterial();
  const { data: fornecedores = [] } = useFornecedores();
  const { data: entradas = [] } = useEntradasMaterial();

  // Ctx de validação contra catálogo/depósitos/fornecedores/NFs lançadas.
  // O acumulador intra-arquivo se reseta no index 0 (ver parseRowEntrada).
  const ctx = useMemo(
    () => criarEntradasCtx(insumos, depositos, fornecedores, entradas),
    [insumos, depositos, fornecedores, entradas]
  );

  const parseRow = (row: unknown[], index: number): ParsedRow =>
    parseRowEntrada(row, index, ctx);

  const toEntity = (r: ParsedRow): Record<string, unknown> =>
    entradaRowToEntradaMaterial(r.dados, usuario?.nome ?? '') as unknown as Record<string, unknown>;

  const handleImport = (items: Record<string, unknown>[]) => {
    const novas = items as unknown as EntradaMaterial[];
    importar.mutate(novas, {
      onSuccess: () => showToast({ kind: 'success', message: `${novas.length} entrada(s) importada(s).` }),
      onError: (e) => showToast({ kind: 'error', message: e instanceof Error ? e.message : 'Falha ao importar entradas.' }),
    });
  };

  return (
    <ImportExcelModal
      open={open}
      onClose={onClose}
      onImport={handleImport}
      title="Importar entradas de peças (Excel)"
      entityLabel="entrada"
      genderFem
      templateData={[TEMPLATE_ENTRADAS_PECAS.headers, TEMPLATE_ENTRADAS_PECAS.exemplo]}
      templateFileName="template-entradas-pecas.xlsx"
      sheetName="Entradas"
      templateColWidths={TEMPLATE_ENTRADAS_PECAS.colWidths}
      formatHintHeaders={TEMPLATE_ENTRADAS_PECAS.headers}
      formatHintExample={TEMPLATE_ENTRADAS_PECAS.exemplo}
      parseRow={parseRow}
      toEntity={toEntity}
    />
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc -b`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add src/components/manutencao/almoxarifado/ImportEntradasModal.tsx
git commit -m "feat(manutencao): modal de import de entradas de peças via Excel"
```

---

### Task 4: Botão e montagem na `AlmoxarifadoPage`

**Files:**
- Modify: `src/components/manutencao/AlmoxarifadoPage.tsx` (import ~linha 26, estado ~linha 92-96, botões ~linhas 153-167, modais ~linha 360)

**Interfaces:**
- Consumes: `ImportEntradasModal` (Task 3), `temAcao('criar_entrada_almoxarifado')` já usado na página.
- Produces: botão "Importar entradas" na barra de ações, visível pra quem pode criar entrada.

- [ ] **Step 1: Import do modal**

Depois da linha `import ImportPecasModal from './almoxarifado/ImportPecasModal';` adicionar:

```tsx
import ImportEntradasModal from './almoxarifado/ImportEntradasModal';
```

- [ ] **Step 2: Estado e permissão**

Perto dos estados existentes (`const [importOpen, setImportOpen] = useState(false);`) adicionar:

```tsx
const [importEntradasOpen, setImportEntradasOpen] = useState(false);
```

E junto de `const canImportar = temAcao('criar_peca_almoxarifado');` adicionar:

```tsx
const canEntrada = temAcao('criar_entrada_almoxarifado');
```

- [ ] **Step 3: Botão na barra de ações**

No bloco de botões (dentro de `{canCreate && (...)}`), logo antes do botão "Nova entrada", adicionar:

```tsx
{canEntrada && (
  <Button variant="secondary" onClick={() => setImportEntradasOpen(true)}>
    <Upload className="w-4 h-4" /> Importar entradas
  </Button>
)}
```

(O ícone `Upload` já está importado no topo do arquivo.)

- [ ] **Step 4: Montar o modal**

Logo após `<ImportPecasModal open={importOpen} onClose={() => setImportOpen(false)} insumos={insumos} />` adicionar:

```tsx
<ImportEntradasModal open={importEntradasOpen} onClose={() => setImportEntradasOpen(false)} />
```

- [ ] **Step 5: Typecheck + lint + testes**

Run: `npx tsc -b && npm run lint && npm test`
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/manutencao/AlmoxarifadoPage.tsx
git commit -m "feat(manutencao): botão de importar entradas de peças via Excel no almoxarifado"
```

---

### Task 5: Verificação de ponta a ponta

**Files:** nenhum (verificação).

- [ ] **Step 1: Suite completa e build**

Run: `npm test && npm run build`
Expected: testes verdes e build sem erro.

- [ ] **Step 2: Smoke manual no app**

1. `npm run dev` e abrir `/manutencao/almoxarifado` logado com perfil que tem `criar_entrada_almoxarifado`.
2. Clicar em "Importar entradas" → baixar o template → conferir as 8 colunas e a linha de exemplo.
3. Preencher o template com 2 NFs diferentes (3+ linhas, ao menos uma peça casada por SKU e uma por nome) usando depósito/fornecedor/peças reais do ambiente.
4. Importar → conferir preview (válidas/erros) → confirmar → toast de sucesso.
5. Conferir que o saldo das peças subiu na listagem e que as entradas aparecem no detalhe da peça.
6. Reimportar o mesmo arquivo → todas as linhas devem vir marcadas "NF já lançada".

Expected: fluxo completo sem erro; reimport bloqueado.
