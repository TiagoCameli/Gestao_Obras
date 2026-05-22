# Combustível — Forms RHF + Zod Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrar os 3 forms de combustível (Saída, Entrada, Transferência) de `useState` manual + validação ad-hoc pra `react-hook-form` + Zod resolver. Padroniza com a stack do projeto (forms novos do shadcn assumem RHF + Zod).

**Architecture:** (a) Instalar `react-hook-form`, `@hookform/resolvers`, `zod`. (b) Criar Zod schemas em `src/schemas/combustivel/` separados dos componentes pra reuso (formulários + validação server-side futura). (c) Migrar cada form um por vez: schema → useForm → Controller pros selects + register pros inputs → exibir errors. (d) Preservar 100% do comportamento condicional (carreta vs equipamento, origem variants, inline new combustível/fornecedor, preview de cálculo).

**Tech Stack:** React 19, TypeScript, `react-hook-form ^7`, `@hookform/resolvers ^3`, `zod ^3`, `Controller` pra integração com `SmartSelect`/`FilterCombobox`.

**Audit fonte:** `combustivel-audit.md` item 11.

**Pré-requisito:** Plano A (`2026-05-22-combustivel-polish-stack-align.md`) pode ou não estar aplicado — independente. Se ambos vão executar, **rodar este DEPOIS do Plano A** porque MP.4 deletou as listas v1, e os forms são reusados pelos containers — o swap de lista não afeta forms.

**Branch:** `feat/combustivel-forms-rhf-zod` (baseada em main).

**Out of scope:** Forms de outras telas (frota, manutenção, etc) — só os 3 de combustível.

---

## File Structure

**Novos pacotes:**
- `package.json` ganha `react-hook-form`, `@hookform/resolvers`, `zod`

**Novos arquivos:**

| Arquivo | Responsabilidade |
|---|---|
| `src/schemas/combustivel/saidaCombustivel.schema.ts` | Zod schema da saída + tipo `SaidaCombustivelFormValues` inferido |
| `src/schemas/combustivel/entradaCombustivel.schema.ts` | Zod schema da entrada + tipo |
| `src/schemas/combustivel/transferenciaCombustivel.schema.ts` | Zod schema da transferência + tipo |
| `src/schemas/combustivel/saidaCombustivel.schema.test.ts` | Testes vitest do schema (validar required, formatos, regras condicionais) |
| `src/schemas/combustivel/entradaCombustivel.schema.test.ts` | idem |
| `src/schemas/combustivel/transferenciaCombustivel.schema.test.ts` | idem |

**Modificados:**

| Arquivo | Task |
|---|---|
| `src/components/combustivel/SaidaCombustivelForm.tsx` | RZ.3 (maior — 1028 LOC) |
| `src/components/combustivel/EntradaForm.tsx` | RZ.4 (552 LOC) |
| `src/components/combustivel/TransferenciaForm.tsx` | RZ.5 (445 LOC) |

---

## Task RZ.0: Branch + dependencies

**Files:** `package.json`, `package-lock.json`

- [ ] **Step 1: Branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main
git pull origin main
git checkout -b feat/combustivel-forms-rhf-zod
git branch --show-current
```

Expected: `feat/combustivel-forms-rhf-zod`.

- [ ] **Step 2: npm install**

```bash
npm install react-hook-form @hookform/resolvers zod
```

Expected: 3 deps adicionadas. Sem erros (peerDep `react ^19` ok).

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | tail -3
```

Expected: `✓ built`.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: instalar react-hook-form + zod pra forms combustível

Setup pra migração dos 3 forms (Saída, Entrada, Transferência) de
useState manual pra RHF + Zod. Próximas tasks (RZ.1-RZ.5) usam essas
deps. Plano docs/superpowers/plans/2026-05-22-combustivel-forms-rhf-zod.md."
```

---

## Task RZ.1: Schema da Entrada + testes (TDD — começa pelo mais simples)

**Files:**
- Create: `src/schemas/combustivel/entradaCombustivel.schema.ts`
- Create: `src/schemas/combustivel/entradaCombustivel.schema.test.ts`

> Estratégia: começar pelo schema mais simples (Entrada, sem condicionais complexas) pra estabelecer o padrão. Saída (RZ.3) e Transferência (RZ.5) reusam o pattern.

- [ ] **Step 1: Tests primeiro**

Create `src/schemas/combustivel/entradaCombustivel.schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { entradaCombustivelSchema } from './entradaCombustivel.schema'

const validBase = {
  dataHora: '2026-05-22T08:00',
  depositoId: 'dep-1',
  tipoCombustivel: 'ins-diesel',
  quantidadeLitros: 1000,
  valorUnitario: 5.5,
  fornecedor: 'forn-1',
  notaFiscal: 'NF-12345',
  observacoes: '',
}

describe('entradaCombustivelSchema', () => {
  it('aceita objeto válido', () => {
    expect(entradaCombustivelSchema.safeParse(validBase).success).toBe(true)
  })

  it('rejeita quantidadeLitros = 0', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, quantidadeLitros: 0 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('quantidadeLitros'))).toBe(true)
    }
  })

  it('rejeita quantidadeLitros negativo', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, quantidadeLitros: -10 })
    expect(r.success).toBe(false)
  })

  it('rejeita valorUnitario = 0', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, valorUnitario: 0 })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('valorUnitario'))).toBe(true)
    }
  })

  it('rejeita depositoId vazio', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, depositoId: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita tipoCombustivel vazio', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, tipoCombustivel: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita fornecedor vazio', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, fornecedor: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita dataHora vazia', () => {
    const r = entradaCombustivelSchema.safeParse({ ...validBase, dataHora: '' })
    expect(r.success).toBe(false)
  })

  it('aceita notaFiscal vazia (opcional)', () => {
    expect(entradaCombustivelSchema.safeParse({ ...validBase, notaFiscal: '' }).success).toBe(true)
  })

  it('aceita observacoes vazia (opcional)', () => {
    expect(entradaCombustivelSchema.safeParse({ ...validBase, observacoes: '' }).success).toBe(true)
  })
})
```

- [ ] **Step 2: Run failing tests**

```bash
npm test src/schemas/combustivel/entradaCombustivel.schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema**

Create `src/schemas/combustivel/entradaCombustivel.schema.ts`:

```typescript
import { z } from 'zod'

export const entradaCombustivelSchema = z.object({
  dataHora: z.string().min(1, 'Data e hora obrigatórias'),
  depositoId: z.string().min(1, 'Selecione um tanque'),
  tipoCombustivel: z.string().min(1, 'Selecione o combustível'),
  quantidadeLitros: z.number({ invalid_type_error: 'Quantidade obrigatória' }).positive('Quantidade deve ser > 0'),
  valorUnitario: z.number({ invalid_type_error: 'Valor unitário obrigatório' }).positive('Valor unitário deve ser > 0'),
  fornecedor: z.string().min(1, 'Selecione o fornecedor'),
  notaFiscal: z.string(),
  observacoes: z.string(),
})

export type EntradaCombustivelFormValues = z.infer<typeof entradaCombustivelSchema>
```

- [ ] **Step 4: Run tests (PASS)**

```bash
npm test src/schemas/combustivel/entradaCombustivel.schema.test.ts
```

Expected: `10 tests passed`.

- [ ] **Step 5: Commit**

```bash
git add src/schemas/combustivel/entradaCombustivel.schema.ts src/schemas/combustivel/entradaCombustivel.schema.test.ts
git commit -m "feat(combustivel): zod schema entradaCombustivelSchema + 10 testes

Schema da entrada de combustível com validação inline:
- quantidadeLitros > 0
- valorUnitario > 0
- depositoId, tipoCombustivel, fornecedor, dataHora obrigatórios
- notaFiscal, observacoes opcionais (string vazia OK)

Exportado tipo EntradaCombustivelFormValues = z.infer<...> pro form.

Próxima task (RZ.2) migra o EntradaForm pra usar este schema via useForm."
```

---

## Task RZ.2: Migrar EntradaForm pra RHF + Zod

**Files:**
- Modify: `src/components/combustivel/EntradaForm.tsx`

> Estratégia: read the existing form (552 LOC), entender o que cada `useState` faz, traduzir pra `useForm({ resolver: zodResolver(entradaCombustivelSchema) })`. Selects custom (SmartSelect, FilterCombobox) precisam de `<Controller>`.

### Step 1: Mapear estados atuais

- [ ] **Step 1.1: Listar useState atuais**

```bash
grep -n "useState\|defaultValue\|setValue" src/components/combustivel/EntradaForm.tsx | head -30
```

Esperado encontrar useState pra: dataHora, depositoId, tipoCombustivel, quantidadeLitros, valorUnitario, fornecedor, notaFiscal, observacoes, fotoUrls, arquivoUrls + auxiliary (novoCombustivel*, novoFornecedor*).

Anotar TODOS os state names.

### Step 2: Adicionar imports + setup useForm

- [ ] **Step 2.1: Imports**

No topo de `src/components/combustivel/EntradaForm.tsx`:

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { entradaCombustivelSchema, type EntradaCombustivelFormValues } from '../../schemas/combustivel/entradaCombustivel.schema';
```

- [ ] **Step 2.2: useForm setup no topo do componente**

Substituir o bloco com `useState` dos 8 campos por:

```tsx
const {
  control,
  register,
  handleSubmit: rhfHandleSubmit,
  watch,
  setValue,
  formState: { errors, isValid },
  reset,
} = useForm<EntradaCombustivelFormValues>({
  resolver: zodResolver(entradaCombustivelSchema),
  mode: 'onChange',
  defaultValues: {
    dataHora: initial?.dataHora ?? new Date().toISOString().slice(0, 16),
    depositoId: initial?.depositoId ?? '',
    tipoCombustivel: initial?.tipoCombustivel ?? '',
    quantidadeLitros: initial?.quantidadeLitros ?? 0,
    valorUnitario: initial && initial.quantidadeLitros > 0 ? initial.valorTotal / initial.quantidadeLitros : 0,
    fornecedor: initial?.fornecedor ?? '',
    notaFiscal: initial?.notaFiscal ?? '',
    observacoes: initial?.observacoes ?? '',
  },
});

// Watch campos pra cálculos derivados (preview, conflitos)
const quantidadeLitros = watch('quantidadeLitros');
const valorUnitario = watch('valorUnitario');
const depositoId = watch('depositoId');
const tipoCombustivel = watch('tipoCombustivel');
const valorTotalCalc = quantidadeLitros * valorUnitario;
```

> Manter `useState` apenas pra coisas que NÃO são campos validados: `fotoUrls`, `arquivoUrls` (anexos), `novoCombustivelNome` (inline create), `novoFornecedorNome`, `importExcelOpen`, `submitting`, `erro`.

### Step 3: Migrar inputs simples (register)

- [ ] **Step 3.1: Substituir `<input value={x} onChange={setX}/>` por `<input {...register('campo')}/>`**

Exemplos:

```tsx
// Antes:
<input
  type="datetime-local"
  value={dataHora}
  onChange={(e) => setDataHora(e.target.value)}
  required
  className="..."
/>

// Depois:
<input
  type="datetime-local"
  {...register('dataHora')}
  className="..."
/>
{errors.dataHora && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.dataHora.message}</p>}
```

Idem para `quantidadeLitros` (com `valueAsNumber: true`), `valorUnitario` (valueAsNumber), `notaFiscal`, `observacoes`.

```tsx
<input
  type="number"
  step="0.01"
  {...register('quantidadeLitros', { valueAsNumber: true })}
  className="..."
/>
{errors.quantidadeLitros && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.quantidadeLitros.message}</p>}
```

### Step 4: Migrar SmartSelects com Controller

- [ ] **Step 4.1: `depositoId` select**

Antes:
```tsx
<SmartSelect
  value={depositoId}
  onChange={(e) => setDepositoId(e.target.value)}
  required
>
  <option value="">Selecione…</option>
  {depositosAtivos.map((d) => (
    <option key={d.id} value={d.id}>{d.nome}</option>
  ))}
</SmartSelect>
```

Depois:
```tsx
<Controller
  name="depositoId"
  control={control}
  render={({ field }) => (
    <SmartSelect {...field}>
      <option value="">Selecione…</option>
      {depositosAtivos.map((d) => (
        <option key={d.id} value={d.id}>{d.nome}</option>
      ))}
    </SmartSelect>
  )}
/>
{errors.depositoId && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.depositoId.message}</p>}
```

- [ ] **Step 4.2: `tipoCombustivel` + inline create**

Mesmo padrão pro select. O fluxo "Novo Combustível" inline continua sendo state separado (`novoCombustivelNome` etc) — quando o usuário cria, chamar `setValue('tipoCombustivel', novoId)` pra atualizar o RHF.

```tsx
// No handler "Salvar Novo Combustível":
async function handleNovoCombustivel() {
  const novoId = gerarId('ins');
  await adicionarInsumoMutation.mutateAsync({ id: novoId, nome: novoCombustivelNome, ... });
  setValue('tipoCombustivel', novoId, { shouldValidate: true });
  setNovoCombustivelOpen(false);
  setNovoCombustivelNome('');
}
```

- [ ] **Step 4.3: `fornecedor` + inline create**

Mesmo padrão.

### Step 5: Migrar submit

- [ ] **Step 5.1: Substituir handleSubmit**

Antes (provável):
```tsx
async function handleSubmit(e: FormEvent) {
  e.preventDefault();
  // ... montar payload manualmente ...
  await onSubmit(payload);
}
// JSX:
<form onSubmit={handleSubmit}>
```

Depois:
```tsx
const onSubmitForm = async (data: EntradaCombustivelFormValues) => {
  setSubmitting(true);
  setErro(null);
  try {
    const valorTotal = data.quantidadeLitros * data.valorUnitario;
    await onSubmit({
      id: initial?.id ?? gerarId('ent'),
      dataHora: data.dataHora,
      depositoId: data.depositoId,
      tipoCombustivel: data.tipoCombustivel,
      quantidadeLitros: data.quantidadeLitros,
      valorTotal,
      fornecedor: data.fornecedor,
      notaFiscal: data.notaFiscal,
      observacoes: data.observacoes,
      criadoPor: usuario?.nome ?? '',
      fotoUrls,  // anexos ficam em useState separado
      arquivoUrls,
    });
  } catch (err) {
    setErro(err instanceof Error ? err.message : 'Erro ao salvar entrada');
  } finally {
    setSubmitting(false);
  }
};

// JSX:
<form onSubmit={rhfHandleSubmit(onSubmitForm)}>
  ...
  <Button type="submit" disabled={!isValid || submitting}>Salvar</Button>
</form>
```

### Step 6: Build + smoke

- [ ] **Step 6.1: TS check**

```bash
npx tsc -b 2>&1 | tail -10
```

Expected: zero errors. Se houver type mismatch entre `EntradaCombustivelFormValues` e `EntradaCombustivel`, ajustar.

- [ ] **Step 6.2: Build**

```bash
npm run build 2>&1 | tail -3
```

Expected: `✓ built`.

- [ ] **Step 6.3: Run all tests**

```bash
npm test 2>&1 | tail -10
```

Expected: 10 novos (schema) + existentes todos passando.

- [ ] **Step 6.4: Smoke manual via npm run dev**

```bash
npm run dev
```

Abrir Combustível → Entradas → Nova Entrada:
- Tentar salvar form vazio → ver errors em vermelho inline (não silent)
- Digitar 0 litros → error inline
- Preencher tudo válido → salva normal
- Editar entrada existente → campos populados via `defaultValues` do useForm

Encerrar dev server.

### Step 7: Commit

- [ ] **Step 7.1: Commit**

```bash
git add src/components/combustivel/EntradaForm.tsx
git commit -m "refactor(combustivel): EntradaForm usa react-hook-form + Zod

Audit item 11 — primeiro form migrado. Substitui ~9 useState manuais
por useForm({ resolver: zodResolver(entradaCombustivelSchema) }).

Pattern estabelecido pros próximos:
- register() pra inputs simples (text, number, datetime-local)
- Controller pra SmartSelect custom
- valueAsNumber: true em inputs numéricos
- Errors inline com mensagem do Zod
- Inline create (novo insumo/fornecedor) usa setValue() pra atualizar RHF
- Anexos ficam em useState separado (não são campos validados)
- handleSubmit do RHF chama onSubmitForm com data tipada

Próxima task (RZ.3) migra SaidaCombustivelForm seguindo mesmo padrão."
```

---

## Task RZ.3: Schema da Saída + testes + form (maior — 1028 LOC)

**Files:**
- Create: `src/schemas/combustivel/saidaCombustivel.schema.ts`
- Create: `src/schemas/combustivel/saidaCombustivel.schema.test.ts`
- Modify: `src/components/combustivel/SaidaCombustivelForm.tsx`

> **Mais complexo** — 2 tipos de consumidor (equipamento_proprio, carreta_transportadora), 3 tipos de origem (tanque, dinheiro, requisicao), campos condicionais.

### Step 1: Schema + testes

- [ ] **Step 1.1: Tests primeiro**

Create `src/schemas/combustivel/saidaCombustivel.schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { saidaCombustivelSchema } from './saidaCombustivel.schema'

const validEquipamentoTanque = {
  data: '2026-05-22T08:00',
  origem: 'tanque' as const,
  tipoConsumidor: 'equipamento_proprio' as const,
  tanqueId: 'dep-1',
  equipamentoId: 'eq-1',
  transportadoraId: '',
  placa: '',
  obraId: 'obra-1',
  etapaId: '',
  tipoCombustivel: 'ins-diesel',
  litros: 100,
  taxaLitro: 0,
  precoUnitarioManual: 0,
  precoCombustivel: 0,
  precoCombustivelAreacre: 0,
  motorista: '',
  medicaoLeitura: '',
  observacoes: '',
  pago: false,
  pagoEm: '',
}

describe('saidaCombustivelSchema', () => {
  it('aceita saída equipamento_proprio + tanque válida', () => {
    expect(saidaCombustivelSchema.safeParse(validEquipamentoTanque).success).toBe(true)
  })

  it('rejeita litros = 0', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, litros: 0 })
    expect(r.success).toBe(false)
  })

  it('rejeita litros negativo', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, litros: -1 })
    expect(r.success).toBe(false)
  })

  it('exige equipamentoId quando tipoConsumidor = equipamento_proprio', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, equipamentoId: '' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.path.includes('equipamentoId'))).toBe(true)
    }
  })

  it('exige transportadoraId quando tipoConsumidor = carreta_transportadora', () => {
    const carreta = {
      ...validEquipamentoTanque,
      tipoConsumidor: 'carreta_transportadora' as const,
      equipamentoId: '',
      transportadoraId: '', // missing
      precoCombustivel: 5.0,
    }
    const r = saidaCombustivelSchema.safeParse(carreta)
    expect(r.success).toBe(false)
  })

  it('exige tanqueId quando origem = tanque', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, tanqueId: '' })
    expect(r.success).toBe(false)
  })

  it('aceita origem = dinheiro sem tanque', () => {
    const dinheiro = {
      ...validEquipamentoTanque,
      origem: 'dinheiro' as const,
      tanqueId: '',
      precoUnitarioManual: 6.0,
    }
    expect(saidaCombustivelSchema.safeParse(dinheiro).success).toBe(true)
  })

  it('rejeita origem = dinheiro com precoUnitarioManual = 0', () => {
    const dinheiro = {
      ...validEquipamentoTanque,
      origem: 'dinheiro' as const,
      tanqueId: '',
      precoUnitarioManual: 0,
    }
    expect(saidaCombustivelSchema.safeParse(dinheiro).success).toBe(false)
  })

  it('aceita carreta válida com transportadora + preco', () => {
    const carreta = {
      ...validEquipamentoTanque,
      tipoConsumidor: 'carreta_transportadora' as const,
      equipamentoId: '',
      transportadoraId: 'forn-1',
      placa: 'ABC1234',
      precoCombustivel: 6.0,
    }
    expect(saidaCombustivelSchema.safeParse(carreta).success).toBe(true)
  })

  it('exige obraId', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, obraId: '' })
    expect(r.success).toBe(false)
  })

  it('rejeita tipoCombustivel vazio', () => {
    const r = saidaCombustivelSchema.safeParse({ ...validEquipamentoTanque, tipoCombustivel: '' })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 1.2: Run failing tests**

```bash
npm test src/schemas/combustivel/saidaCombustivel.schema.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 1.3: Implement schema**

Create `src/schemas/combustivel/saidaCombustivel.schema.ts`:

```typescript
import { z } from 'zod'

const baseSchema = z.object({
  data: z.string().min(1, 'Data obrigatória'),
  origem: z.enum(['tanque', 'dinheiro', 'requisicao'], { required_error: 'Selecione origem' }),
  tipoConsumidor: z.enum(['equipamento_proprio', 'carreta_transportadora'], { required_error: 'Selecione tipo' }),
  tanqueId: z.string(),
  equipamentoId: z.string(),
  transportadoraId: z.string(),
  placa: z.string(),
  obraId: z.string().min(1, 'Selecione obra'),
  etapaId: z.string(),
  tipoCombustivel: z.string().min(1, 'Selecione combustível'),
  litros: z.number({ invalid_type_error: 'Litros obrigatório' }).positive('Litros deve ser > 0'),
  taxaLitro: z.number({ invalid_type_error: 'Taxa inválida' }).min(0, 'Taxa deve ser ≥ 0'),
  precoUnitarioManual: z.number({ invalid_type_error: 'Preço inválido' }).min(0),
  precoCombustivel: z.number({ invalid_type_error: 'Preço combustível inválido' }).min(0),
  precoCombustivelAreacre: z.number({ invalid_type_error: 'Preço Areacre inválido' }).min(0),
  motorista: z.string(),
  medicaoLeitura: z.string(),
  observacoes: z.string(),
  pago: z.boolean(),
  pagoEm: z.string(),
})

export const saidaCombustivelSchema = baseSchema.superRefine((data, ctx) => {
  // equipamento_proprio exige equipamentoId
  if (data.tipoConsumidor === 'equipamento_proprio' && !data.equipamentoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione equipamento',
      path: ['equipamentoId'],
    })
  }
  // carreta exige transportadoraId
  if (data.tipoConsumidor === 'carreta_transportadora' && !data.transportadoraId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione transportadora',
      path: ['transportadoraId'],
    })
  }
  // origem=tanque exige tanqueId
  if (data.origem === 'tanque' && !data.tanqueId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Selecione tanque',
      path: ['tanqueId'],
    })
  }
  // origem!=tanque exige precoUnitarioManual > 0
  if (data.origem !== 'tanque' && data.precoUnitarioManual <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Preço unitário deve ser > 0',
      path: ['precoUnitarioManual'],
    })
  }
  // carreta + tanque exige precoCombustivel > 0
  if (data.tipoConsumidor === 'carreta_transportadora' && data.origem === 'tanque' && data.precoCombustivel <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Preço cobrado da transportadora deve ser > 0',
      path: ['precoCombustivel'],
    })
  }
})

export type SaidaCombustivelFormValues = z.infer<typeof saidaCombustivelSchema>
```

- [ ] **Step 1.4: Run tests (PASS)**

```bash
npm test src/schemas/combustivel/saidaCombustivel.schema.test.ts
```

Expected: `11 tests passed`.

### Step 2: Migrar SaidaCombustivelForm — overview

> **Cuidado:** este form tem ~15+ useState e MUITAS condicionais. Estratégia: migrar gradualmente, mas commitar só quando estiver tudo verde. Não fazer commit no meio se o build falhar.

- [ ] **Step 2.1: Imports**

No topo de `src/components/combustivel/SaidaCombustivelForm.tsx`:

```tsx
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { saidaCombustivelSchema, type SaidaCombustivelFormValues } from '../../schemas/combustivel/saidaCombustivel.schema';
```

- [ ] **Step 2.2: useForm setup**

Substituir o bloco de useState (data, origem, tipoConsumidor, etc — ~15 estados) por:

```tsx
const {
  control,
  register,
  handleSubmit: rhfHandleSubmit,
  watch,
  setValue,
  formState: { errors, isValid },
} = useForm<SaidaCombustivelFormValues>({
  resolver: zodResolver(saidaCombustivelSchema),
  mode: 'onChange',
  defaultValues: {
    data: initial?.data?.slice(0, 16) ?? new Date().toISOString().slice(0, 16),
    origem: initial?.origem ?? 'tanque',
    tipoConsumidor: initial?.tipoConsumidor ?? 'equipamento_proprio',
    tanqueId: initial?.tanqueId ?? '',
    equipamentoId: initial?.equipamentoId ?? '',
    transportadoraId: initial?.transportadoraId ?? '',
    placa: initial?.placa ?? '',
    obraId: initial?.obraId ?? '',
    etapaId: initial?.etapaId ?? '',
    tipoCombustivel: initial?.tipoCombustivel ?? '',
    litros: initial?.litros ?? 0,
    taxaLitro: initial?.taxaLitro ?? 0,
    precoUnitarioManual: initial?.origem !== 'tanque' ? (initial?.precoUnitario ?? 0) : 0,
    precoCombustivel: initial?.precoCombustivel ?? 0,
    precoCombustivelAreacre: initial?.precoCombustivelAreacre ?? 0,
    motorista: initial?.motorista ?? '',
    medicaoLeitura: initial?.medicaoNoAbastecimento?.toString() ?? '',
    observacoes: initial?.observacoes ?? '',
    pago: initial?.pago ?? false,
    pagoEm: initial?.pagoEm?.slice(0, 16) ?? '',
  },
});

// Watch campos pra cálculos derivados
const origem = watch('origem');
const tipoConsumidor = watch('tipoConsumidor');
const tanqueId = watch('tanqueId');
const equipamentoId = watch('equipamentoId');
const obraId = watch('obraId');
const litros = watch('litros');
const taxaLitro = watch('taxaLitro');
const precoUnitarioManual = watch('precoUnitarioManual');
const precoCombustivel = watch('precoCombustivel');
const precoCombustivelAreacre = watch('precoCombustivelAreacre');
const tipoCombustivel = watch('tipoCombustivel');

// useState separado pra anexos + submit state + helpers
const [fotoUrls, setFotoUrls] = useState<string[]>(initial?.fotoUrls ?? []);
const [arquivoUrls, setArquivoUrls] = useState<string[]>(initial?.arquivoUrls ?? []);
const [submitting, setSubmitting] = useState(false);
const [erro, setErro] = useState<string | null>(null);
```

- [ ] **Step 2.3: Effects pra reset condicional**

Quando `tipoConsumidor` muda, limpar campos do outro tipo:

```tsx
useEffect(() => {
  if (tipoConsumidor === 'equipamento_proprio') {
    setValue('transportadoraId', '', { shouldValidate: true });
    setValue('placa', '', { shouldValidate: true });
    setValue('motorista', '', { shouldValidate: true });
  } else if (tipoConsumidor === 'carreta_transportadora') {
    setValue('equipamentoId', '', { shouldValidate: true });
    setValue('medicaoLeitura', '', { shouldValidate: true });
  }
}, [tipoConsumidor, setValue]);

useEffect(() => {
  if (origem !== 'tanque') {
    setValue('tanqueId', '', { shouldValidate: true });
  } else {
    setValue('precoUnitarioManual', 0, { shouldValidate: true });
  }
}, [origem, setValue]);

// Auto-preencher combustível ao selecionar tanque interno
useEffect(() => {
  if (tanqueId) {
    const tanque = tanquesAtivos.find((t) => t.id === tanqueId);
    if (tanque?.combustivelAtualId) {
      setValue('tipoCombustivel', tanque.combustivelAtualId, { shouldValidate: true });
    }
  }
}, [tanqueId, tanquesAtivos, setValue]);
```

### Step 3: Migrar inputs simples

- [ ] **Step 3.1: Inputs com register**

Cada `<input value={x} onChange={setX}/>` vira:

```tsx
<input
  type="number"
  step="0.01"
  {...register('litros', { valueAsNumber: true })}
  className="..."
/>
{errors.litros && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.litros.message}</p>}
```

Mesmo padrão para: `taxaLitro`, `precoUnitarioManual`, `precoCombustivel`, `precoCombustivelAreacre`, `litros`, `medicaoLeitura` (string), `motorista`, `placa`, `observacoes`, `notaFiscal`, `pagoEm`, `pago` (checkbox → `{...register('pago')}`), `data` (datetime-local).

### Step 4: Migrar selects + custom components

- [ ] **Step 4.1: Radio cards Tipo Consumidor**

```tsx
<Controller
  name="tipoConsumidor"
  control={control}
  render={({ field }) => (
    <div className="grid grid-cols-2 gap-2">
      <button type="button" onClick={() => field.onChange('equipamento_proprio')} className={field.value === 'equipamento_proprio' ? 'bg-[var(--color-accent-soft)] border-[var(--color-accent)]' : '...'}>
        Equipamento Próprio
      </button>
      <button type="button" onClick={() => field.onChange('carreta_transportadora')} className={...}>
        Carreta de Transportadora
      </button>
    </div>
  )}
/>
```

- [ ] **Step 4.2: Toggle Origem (Tanque/Dinheiro/Requisição)**

```tsx
<Controller
  name="origem"
  control={control}
  render={({ field }) => (
    <div className="flex gap-1">
      {(['tanque', 'dinheiro', 'requisicao'] as const).map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => field.onChange(o)}
          className={field.value === o ? '...selected...' : '...unselected...'}
        >
          {o === 'tanque' ? 'Tanque' : o === 'dinheiro' ? 'Dinheiro' : 'Requisição'}
        </button>
      ))}
    </div>
  )}
/>
```

- [ ] **Step 4.3: FilterCombobox equipamento**

```tsx
<Controller
  name="equipamentoId"
  control={control}
  render={({ field }) => (
    <FilterCombobox
      value={field.value}
      onChange={field.onChange}
      options={equipamentos.filter((e) => e.ativo !== false).map((e) => ({ value: e.id, label: e.codigoPatrimonio || e.nome }))}
      placeholder="Selecione…"
    />
  )}
/>
{errors.equipamentoId && <p className="mt-1 text-xs text-[var(--color-danger)]">{errors.equipamentoId.message}</p>}
```

- [ ] **Step 4.4: SmartSelect tanque, transportadora, obra, etapa, tipoCombustivel**

Mesmo padrão.

### Step 5: Migrar submit

- [ ] **Step 5.1: Substituir handleSubmit**

```tsx
const onSubmitForm = async (data: SaidaCombustivelFormValues) => {
  setSubmitting(true);
  setErro(null);
  try {
    // Calcular preco_unitario
    let precoUnitario: number;
    if (data.origem === 'tanque') {
      precoUnitario = (data.tipoConsumidor === 'carreta_transportadora')
        ? data.precoCombustivel + data.taxaLitro
        : precoMedioTanque + data.taxaLitro; // precoMedioTanque vem do useMemo já existente
    } else {
      precoUnitario = data.precoUnitarioManual;
    }
    const valorTotal = data.litros * precoUnitario;
    const medicaoNum = data.medicaoLeitura.trim() ? Number(data.medicaoLeitura) : null;

    await onSubmit({
      id: initial?.id ?? gerarId('saida'),
      data: data.data,
      origem: data.origem,
      tipoConsumidor: data.tipoConsumidor,
      tanqueId: data.origem === 'tanque' ? data.tanqueId : null,
      equipamentoId: data.tipoConsumidor === 'equipamento_proprio' ? data.equipamentoId : null,
      transportadoraId: data.tipoConsumidor === 'carreta_transportadora' ? data.transportadoraId : null,
      placa: data.placa || null,
      obraId: data.obraId,
      etapaId: data.etapaId || null,
      alocacoes: data.etapaId ? [{ etapaId: data.etapaId, percentual: 100 }] : null,
      tipoCombustivel: data.tipoCombustivel,
      litros: data.litros,
      precoMedioTanqueSnapshot: data.origem === 'tanque' ? precoMedioTanque : null,
      taxaLitro: data.taxaLitro,
      precoCombustivel: data.precoCombustivel || null,
      precoCombustivelAreacre: data.precoCombustivelAreacre || null,
      precoUnitario,
      valorTotal,
      fotoUrls,
      arquivoUrls,
      observacoes: data.observacoes,
      pago: data.pago,
      pagoEm: data.pago ? data.pagoEm : null,
      movimentoId: initial?.movimentoId ?? null,
      medicaoNoAbastecimento: medicaoNum,
      tipoMedicaoSnapshot: equipamento?.tipoMedicao ?? null,
      motorista: data.motorista,
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: initial?.createdBy ?? usuario?.nome ?? null,
      updatedBy: usuario?.nome ?? null,
    });
  } catch (err) {
    setErro(err instanceof Error ? err.message : 'Erro ao salvar saída');
  } finally {
    setSubmitting(false);
  }
};

// JSX:
<form onSubmit={rhfHandleSubmit(onSubmitForm)}>
  ...
  <Button type="submit" disabled={!isValid || submitting}>Salvar</Button>
</form>
```

### Step 6: Build + smoke + commit

- [ ] **Step 6.1: TS check**

```bash
npx tsc -b 2>&1 | tail -10
```

Expected: zero errors.

- [ ] **Step 6.2: Build**

```bash
npm run build 2>&1 | tail -3
```

- [ ] **Step 6.3: Tests**

```bash
npm test 2>&1 | tail -10
```

Expected: schema tests (10+11) passando + existentes.

- [ ] **Step 6.4: Smoke**

```bash
npm run dev
```

Abrir Combustível → Saídas → Nova Saída:
- Toggle entre Equipamento Próprio e Carreta → campos mudam corretamente
- Toggle origem Tanque → Dinheiro → campo Tanque some, aparece input Preço Unitário
- Validações inline funcionam (campos vermelhos quando faltam)
- Sanity warnings (>= 1000L) ainda aparecem (preservar logic existente)
- Preview de cálculo atualiza com `watch`

Encerrar dev server.

- [ ] **Step 6.5: Commit**

```bash
git add src/schemas/combustivel/saidaCombustivel.schema.ts \
        src/schemas/combustivel/saidaCombustivel.schema.test.ts \
        src/components/combustivel/SaidaCombustivelForm.tsx
git commit -m "refactor(combustivel): SaidaCombustivelForm usa react-hook-form + Zod

Audit item 11 — form mais complexo do módulo (1028 LOC). Substitui
~15+ useState manuais por useForm com schema Zod que valida regras
condicionais (equipamento exige equipamentoId, carreta exige
transportadoraId+precoCombustivel, origem=tanque exige tanqueId).

Pattern:
- Radio cards (tipo, origem) usam Controller
- FilterCombobox usa Controller
- SmartSelect usa Controller
- Inputs simples usam register({ valueAsNumber: true } pros numéricos)
- useEffect com setValue limpa campos do outro tipo ao trocar
- precoMedioTanque continua sendo derivado via useMemo (HF.6 helper)

11 testes vitest cobrindo regras de validação condicional."
```

---

## Task RZ.4: Schema da Transferência + testes + form

**Files:**
- Create: `src/schemas/combustivel/transferenciaCombustivel.schema.ts`
- Create: `src/schemas/combustivel/transferenciaCombustivel.schema.test.ts`
- Modify: `src/components/combustivel/TransferenciaForm.tsx`

### Step 1: Schema + testes

- [ ] **Step 1.1: Tests primeiro**

Create `src/schemas/combustivel/transferenciaCombustivel.schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { transferenciaCombustivelSchema } from './transferenciaCombustivel.schema'

const valid = {
  dataHora: '2026-05-22T08:00',
  depositoOrigemId: 'dep-1',
  depositoDestinoId: 'dep-2',
  quantidadeLitros: 500,
  valorTotal: 2500,
  observacoes: '',
}

describe('transferenciaCombustivelSchema', () => {
  it('aceita transferência válida', () => {
    expect(transferenciaCombustivelSchema.safeParse(valid).success).toBe(true)
  })

  it('rejeita quantidadeLitros = 0', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, quantidadeLitros: 0 }).success).toBe(false)
  })

  it('rejeita quantidadeLitros negativo', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, quantidadeLitros: -1 }).success).toBe(false)
  })

  it('rejeita depositoOrigemId vazio', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, depositoOrigemId: '' }).success).toBe(false)
  })

  it('rejeita depositoDestinoId vazio', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, depositoDestinoId: '' }).success).toBe(false)
  })

  it('rejeita mesmo tanque origem e destino', () => {
    const r = transferenciaCombustivelSchema.safeParse({ ...valid, depositoDestinoId: 'dep-1' })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.issues.some((i) => i.message.toLowerCase().includes('mesmo'))).toBe(true)
    }
  })

  it('aceita valorTotal = 0 (opcional)', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, valorTotal: 0 }).success).toBe(true)
  })

  it('rejeita valorTotal negativo', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, valorTotal: -100 }).success).toBe(false)
  })

  it('aceita observacoes vazia', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, observacoes: '' }).success).toBe(true)
  })

  it('rejeita dataHora vazia', () => {
    expect(transferenciaCombustivelSchema.safeParse({ ...valid, dataHora: '' }).success).toBe(false)
  })
})
```

- [ ] **Step 1.2: Run failing**

```bash
npm test src/schemas/combustivel/transferenciaCombustivel.schema.test.ts
```

Expected: FAIL.

- [ ] **Step 1.3: Implement schema**

Create `src/schemas/combustivel/transferenciaCombustivel.schema.ts`:

```typescript
import { z } from 'zod'

export const transferenciaCombustivelSchema = z.object({
  dataHora: z.string().min(1, 'Data e hora obrigatórias'),
  depositoOrigemId: z.string().min(1, 'Selecione tanque origem'),
  depositoDestinoId: z.string().min(1, 'Selecione tanque destino'),
  quantidadeLitros: z.number({ invalid_type_error: 'Quantidade obrigatória' }).positive('Quantidade deve ser > 0'),
  valorTotal: z.number({ invalid_type_error: 'Valor inválido' }).min(0, 'Valor deve ser ≥ 0'),
  observacoes: z.string(),
}).superRefine((data, ctx) => {
  if (data.depositoOrigemId && data.depositoDestinoId && data.depositoOrigemId === data.depositoDestinoId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Tanque destino deve ser diferente do origem',
      path: ['depositoDestinoId'],
    })
  }
})

export type TransferenciaCombustivelFormValues = z.infer<typeof transferenciaCombustivelSchema>
```

- [ ] **Step 1.4: Run tests (PASS)**

```bash
npm test src/schemas/combustivel/transferenciaCombustivel.schema.test.ts
```

Expected: `10 tests passed`.

### Step 2: Migrar TransferenciaForm

- [ ] **Step 2.1: Imports + useForm**

Add imports e setup (mesmo pattern de Entrada/Saída).

- [ ] **Step 2.2: register + Controller**

`dataHora`, `quantidadeLitros` (valueAsNumber), `valorTotal` (valueAsNumber), `observacoes` → `register`.
`depositoOrigemId`, `depositoDestinoId` → `Controller` + `SmartSelect`.

- [ ] **Step 2.3: Auto-fill valorTotal via watch**

A lógica de auto-fill com `precoMedio × qtd` continua. Usar `watch` pra ler `quantidadeLitros` e `setValue('valorTotal', ...)` em useEffect quando muda.

- [ ] **Step 2.4: Submit handler**

Mesmo padrão.

### Step 3: Build + smoke + commit

- [ ] **Step 3.1: Build + tests + smoke**

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -10
```

Smoke: criar transferência válida + tentar com origem=destino (deve mostrar error inline).

- [ ] **Step 3.2: Commit**

```bash
git add src/schemas/combustivel/transferenciaCombustivel.schema.ts \
        src/schemas/combustivel/transferenciaCombustivel.schema.test.ts \
        src/components/combustivel/TransferenciaForm.tsx
git commit -m "refactor(combustivel): TransferenciaForm usa react-hook-form + Zod

Audit item 11 — terceiro e último form. Schema Zod com:
- quantidadeLitros > 0
- valorTotal ≥ 0
- origem != destino (custom refine)
- dataHora, depositoOrigemId, depositoDestinoId obrigatórios

10 testes vitest. Auto-fill de valorTotal via watch + setValue
quando quantidade muda (preserva comportamento existente)."
```

---

## Task RZ.5: Final — build + security + deploy + push

- [ ] **Step 1: Build + testes**

```bash
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

Expected: passa. 3 schemas × ~10 testes cada = 31+ novos testes.

- [ ] **Step 2: /security-review**

No Claude Code:
```
/security-review
```

Expected: NO_FINDINGS. Mudança é client-side puro (RHF + Zod), não introduz nova superfície de ataque.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -5
```

- [ ] **Step 4: Smoke test manual**

Pedir ao user testar:
- Saída com validação inline (todos os caminhos: equipamento+tanque, carreta+tanque, equipamento+dinheiro, etc)
- Entrada com erros inline (litros 0, valor 0, faltando campos)
- Transferência com origem=destino (deve dar erro inline)

- [ ] **Step 5: Promote prod (com confirmação)**

```bash
npx --yes vercel --prod 2>&1 | tail -5
```

- [ ] **Step 6: Merge + push**

```bash
git checkout main
git pull origin main
git merge --no-ff feat/combustivel-forms-rhf-zod -m "Merge branch 'feat/combustivel-forms-rhf-zod'

Audit item 11: 3 forms de combustível (Saída, Entrada, Transferência)
migram de useState manual pra react-hook-form + Zod.

Tasks:
- RZ.0 deps (react-hook-form, @hookform/resolvers, zod)
- RZ.1 entradaCombustivel schema + 10 testes
- RZ.2 EntradaForm migra
- RZ.3 saidaCombustivel schema + 11 testes + SaidaCombustivelForm migra
- RZ.4 transferenciaCombustivel schema + 10 testes + TransferenciaForm migra
- RZ.5 build + security + deploy

Audit: combustivel-audit.md item 11
Plan: docs/superpowers/plans/2026-05-22-combustivel-forms-rhf-zod.md"
git push origin main 2>&1 | tail -3
```

---

## Critérios de Aceitação

- ✅ `react-hook-form`, `@hookform/resolvers`, `zod` instalados
- ✅ 3 schemas Zod criados + 31+ testes passando
- ✅ 3 forms migrados (sem `useState` manual de campos validados)
- ✅ Validação inline (errors aparecem nos campos quando vazios/inválidos)
- ✅ Comportamento condicional preservado (carreta vs equipamento, origem variants)
- ✅ Preview de cálculo + sanity warnings preservados
- ✅ Inline create (novo insumo/fornecedor) funciona via `setValue`
- ✅ `/security-review` retorna NO_FINDINGS
- ✅ Smoke manual confirma todos os fluxos
