# Combustível FIFO Real — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar custeio por **FIFO real com lotes** — cada saída consome estoque pela ordem cronológica de chegada (entradas + transferências recebidas), e o `preco_unitario` é a média ponderada exata dos pedaços consumidos. Persistir o detalhamento em tabela nova `saidas_lotes` (relacional auditável). Backfill aplicado em todo o histórico, com relatório separado das saídas sem lote anterior pra revisão manual.

**Architecture:** Helper TS puro `calcularPrecoFIFO(tanqueId, dataHora, litros, contexto)` que recebe entradas + transferências + saídas anteriores do tanque e retorna `{ precoMedio, detalhamento: [{ fonteTipo, fonteId, litros, preco }] }`. Forms (desktop + mobile) chamam o helper no submit, persistem `preco_unitario` calculado, gravam linhas em `saidas_lotes` numa única transaction. Migration de backfill itera saídas existentes em ordem cronológica, replay do FIFO. Saídas sem lote suprindo → registradas em tabela `saidas_sem_suprimento` pra relatório.

**Tech Stack:** PostgreSQL (Supabase MCP), React 19, TypeScript, vitest.

**Decisões do brainstorm:**
- **Cenário B.6**: FIFO sempre. Quando saída não tem lote anterior na linha do tempo → não cria estoque virtual, não usa fallback. Registra a saída em tabela de auditoria `saidas_sem_suprimento` pra usuário revisar manualmente.
- **Persistência**: tabela nova `saidas_lotes` (relacional, auditável).

**Branch:** `feat/combustivel-fifo-real` (baseada em main).

**Audit fonte:** `combustivel-horarios-precos.md` §D.5 (comparativo FIFO/LIFO/etc) + decisão user pós-análise.

---

## File Structure

**Migrations SQL:**
- `supabase/migrations/20260523140000_create_saidas_lotes.sql` — schema da tabela
- `supabase/migrations/20260523140100_create_saidas_sem_suprimento.sql` — auditoria de saídas órfãs
- `supabase/migrations/20260523140200_backfill_fifo_historico.sql` — processa histórico

**TS novos:**
- `src/utils/fifoCombustivel.ts` — helper puro `calcularPrecoFIFO`
- `src/utils/fifoCombustivel.test.ts` — testes vitest (8+ cenários)

**TS modificados:**
- `src/components/combustivel/SaidaCombustivelForm.tsx` — helper FIFO + persistir saidas_lotes
- `src/pages/mobile/MSaidaCombustivelPage.tsx` — idem
- `src/hooks/useSaidasCombustivel.ts` — nova mutation que faz INSERT em saidas_combustivel + saidas_lotes numa transaction (ou RPC)
- `src/types/index.ts` — type `SaidaLote`

**Out of scope deste plano:**
- ❌ UI pra visualizar lotes consumidos por saída (drawer pode mostrar, mas não é must-have)
- ❌ Recalcular preço dinamicamente ao editar entrada antiga (snapshot HF.11 dita que histórico é imutável)
- ❌ Mudança no comportamento de transferências (continuam usando o preço médio do tanque origem no momento — gerando "lotes derivados" no destino)

---

## Task FI.0: Branch setup

- [ ] **Step 1: Branch**

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
git checkout main && git pull origin main
git checkout -b feat/combustivel-fifo-real
git branch --show-current
```

Expected: `feat/combustivel-fifo-real`.

---

## Task FI.1: Schema `saidas_lotes` + `saidas_sem_suprimento`

**Files:**
- Create: `supabase/migrations/20260523140000_create_saidas_lotes.sql`
- Create: `supabase/migrations/20260523140100_create_saidas_sem_suprimento.sql`

### Step 1: Migration `saidas_lotes`

Write `supabase/migrations/20260523140000_create_saidas_lotes.sql`:

```sql
-- FI.1 — Tabela relacional pra detalhamento FIFO de cada saída.
--
-- Cada linha = uma "porção" de lote consumida por uma saída.
-- Exemplo: saída de 100L de um tanque que tinha 70L do lote A (R$ 5,50)
-- + 30L do lote B (R$ 6,00) → 2 linhas:
--   (saida_id=S, fonte_tipo='entrada', fonte_id=A, litros=70, preco_lote=5.50)
--   (saida_id=S, fonte_tipo='entrada', fonte_id=B, litros=30, preco_lote=6.00)
--
-- Fonte pode ser entrada_combustivel (compra) OU transferencia_combustivel
-- (lote derivado de outro tanque). O preco_lote registra qual era o preço
-- daquela porção no momento do consumo (snapshot imutável).

CREATE TABLE IF NOT EXISTS public.saidas_lotes (
  id text PRIMARY KEY DEFAULT 'sl-' || gen_random_uuid(),
  saida_id text NOT NULL,
  fonte_tipo text NOT NULL CHECK (fonte_tipo IN ('entrada', 'transferencia')),
  fonte_id text NOT NULL,
  litros numeric NOT NULL CHECK (litros > 0),
  preco_lote numeric NOT NULL CHECK (preco_lote > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT fk_saidas_lotes_saida
    FOREIGN KEY (saida_id) REFERENCES public.saidas_combustivel(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_saidas_lotes_saida_id
  ON public.saidas_lotes(saida_id);

CREATE INDEX IF NOT EXISTS idx_saidas_lotes_fonte
  ON public.saidas_lotes(fonte_tipo, fonte_id);

-- RLS — mesma política das tabelas principais combustível
ALTER TABLE public.saidas_lotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY saidas_lotes_select ON public.saidas_lotes
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY saidas_lotes_insert ON public.saidas_lotes
  FOR INSERT TO authenticated
  WITH CHECK (
    private.current_has_action('criar_saida_combustivel')
    OR private.current_has_action('criar_abastecimento_carreta')
  );

-- UPDATE/DELETE só por admin (snapshot imutável)
CREATE POLICY saidas_lotes_update ON public.saidas_lotes
  FOR UPDATE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));

CREATE POLICY saidas_lotes_delete ON public.saidas_lotes
  FOR DELETE TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'));
```

### Step 2: Migration `saidas_sem_suprimento`

Write `supabase/migrations/20260523140100_create_saidas_sem_suprimento.sql`:

```sql
-- FI.2 — Tabela de auditoria de saídas sem lote anterior na linha do tempo.
--
-- Quando o algoritmo FIFO não encontra entrada/transferência anterior
-- pra suprir uma saída, registra aqui pro user revisar. Tipicamente
-- são saídas históricas migradas sem estoque inicial formalizado.

CREATE TABLE IF NOT EXISTS public.saidas_sem_suprimento (
  id text PRIMARY KEY DEFAULT 'sss-' || gen_random_uuid(),
  saida_id text NOT NULL,
  tanque_id text NOT NULL,
  data_saida timestamptz NOT NULL,
  litros_solicitados numeric NOT NULL,
  litros_supridos numeric NOT NULL DEFAULT 0,
  litros_sem_suprimento numeric NOT NULL,
  observacao text DEFAULT 'Saída anterior a qualquer entrada/transferência registrada no tanque',
  detectado_em timestamptz NOT NULL DEFAULT now(),
  revisado boolean NOT NULL DEFAULT false,
  revisado_por text,
  revisado_em timestamptz,
  CONSTRAINT fk_sss_saida
    FOREIGN KEY (saida_id) REFERENCES public.saidas_combustivel(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sss_tanque ON public.saidas_sem_suprimento(tanque_id, data_saida);
CREATE INDEX IF NOT EXISTS idx_sss_nao_revisados
  ON public.saidas_sem_suprimento(detectado_em) WHERE NOT revisado;

ALTER TABLE public.saidas_sem_suprimento ENABLE ROW LEVEL SECURITY;

CREATE POLICY saidas_sem_suprimento_select ON public.saidas_sem_suprimento
  FOR SELECT TO authenticated
  USING (private.current_has_action('ver_frota'));

CREATE POLICY saidas_sem_suprimento_admin ON public.saidas_sem_suprimento
  FOR ALL TO authenticated
  USING (private.current_has_action('gerenciar_permissoes'))
  WITH CHECK (private.current_has_action('gerenciar_permissoes'));
```

### Step 3: Apply via MCP

`apply_migration` separadamente:
- name: `create_saidas_lotes`
- name: `create_saidas_sem_suprimento`

### Step 4: Verify

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN ('saidas_lotes', 'saidas_sem_suprimento');
```

Expected: 2 rows.

```sql
SELECT policyname FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('saidas_lotes', 'saidas_sem_suprimento');
```

Expected: 4 policies em `saidas_lotes` (select/insert/update/delete) + 2 em `saidas_sem_suprimento` (select + admin all).

### Step 5: Commit

```bash
git add supabase/migrations/20260523140000_create_saidas_lotes.sql \
        supabase/migrations/20260523140100_create_saidas_sem_suprimento.sql
git commit -m "feat(combustivel): tabelas saidas_lotes + saidas_sem_suprimento (FIFO)

Pre-req do FIFO real:
- saidas_lotes: detalhamento por porção de lote consumida (saida_id,
  fonte_tipo, fonte_id, litros, preco_lote). RLS granular: insert
  herda das perms de saídas, update/delete admin-only (snapshot imutável).
- saidas_sem_suprimento: auditoria de saídas sem lote anterior na
  linha do tempo. Usuário revisa manualmente.

Plano: docs/superpowers/plans/2026-05-23-combustivel-fifo-real.md"
```

---

## Task FI.2: Helper `calcularPrecoFIFO` + 8 testes (TDD)

**Files:**
- Create: `src/utils/fifoCombustivel.ts`
- Create: `src/utils/fifoCombustivel.test.ts`

### Step 1: Failing tests

Create `src/utils/fifoCombustivel.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { calcularPrecoFIFO } from './fifoCombustivel'
import type { EntradaCombustivel, TransferenciaCombustivel, SaidaCombustivel } from '../types'

// Helpers de criação
const ent = (id: string, depositoId: string, dataHora: string, litros: number, valor: number): EntradaCombustivel => ({
  id, dataHora, depositoId, tipoCombustivel: 'd', quantidadeLitros: litros, valorTotal: valor,
  fornecedor: 'f', notaFiscal: '', observacoes: '', criadoPor: '',
})
const sai = (id: string, tanqueId: string, data: string, litros: number): SaidaCombustivel => ({
  id, data, origem: 'tanque', tipoConsumidor: 'equipamento_proprio', tanqueId, equipamentoId: 'e',
  transportadoraId: null, placa: null, obraId: 'o', etapaId: null, alocacoes: null,
  tipoCombustivel: 'd', litros, precoMedioTanqueSnapshot: 0, taxaLitro: 0, precoUnitario: 0,
  precoCombustivel: null, precoCombustivelAreacre: null, valorTotal: 0, fotoUrls: [], arquivoUrls: [],
  observacoes: '', pago: false, pagoEm: null, movimentoId: null, motorista: '',
  medicaoNoAbastecimento: null, tipoMedicaoSnapshot: null, createdAt: data, updatedAt: data,
  createdBy: null, updatedBy: null,
} as SaidaCombustivel)

describe('calcularPrecoFIFO', () => {
  it('1 lote único — toda saída consome dele', () => {
    const entradas = [ent('e1', 't1', '2026-01-01T08:00:00Z', 10000, 55000)]  // R$ 5,50/L
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-02T08:00:00Z', litros: 100,
      entradas, transferencias: [], saidasAnteriores: [] })
    expect(r.precoMedio).toBe(5.5)
    expect(r.detalhamento).toEqual([{ fonteTipo: 'entrada', fonteId: 'e1', litros: 100, preco: 5.5 }])
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('2 lotes — exemplo do usuário: 70 do lote A + 30 do lote B', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00Z', 10000, 55000),  // R$ 5,50/L
      ent('B', 't1', '2026-01-10T08:00:00Z', 2000, 12000),   // R$ 6,00/L
    ]
    const saidasAnteriores = [
      sai('s1', 't1', '2026-01-05T08:00:00Z', 9930),  // consome 9930L do lote A, restam 70L
    ]
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-15T08:00:00Z', litros: 100,
      entradas, transferencias: [], saidasAnteriores })
    // 70 do A (R$ 5,50) + 30 do B (R$ 6,00) = R$ 565 / 100 = R$ 5,65
    expect(r.precoMedio).toBeCloseTo(5.65, 4)
    expect(r.detalhamento).toEqual([
      { fonteTipo: 'entrada', fonteId: 'A', litros: 70, preco: 5.5 },
      { fonteTipo: 'entrada', fonteId: 'B', litros: 30, preco: 6.0 },
    ])
    expect(r.litrosSemSuprimento).toBe(0)
  })

  it('saída sem lote anterior — retorna litrosSemSuprimento', () => {
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-01T08:00:00Z', litros: 100,
      entradas: [], transferencias: [], saidasAnteriores: [] })
    expect(r.precoMedio).toBe(0)
    expect(r.detalhamento).toEqual([])
    expect(r.litrosSemSuprimento).toBe(100)
  })

  it('saída parcialmente suprida — registra litros sem suprimento', () => {
    const entradas = [ent('A', 't1', '2026-01-01T08:00:00Z', 50, 275)]  // só 50L do lote A
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-02T08:00:00Z', litros: 100,
      entradas, transferencias: [], saidasAnteriores: [] })
    expect(r.detalhamento).toEqual([{ fonteTipo: 'entrada', fonteId: 'A', litros: 50, preco: 5.5 }])
    expect(r.litrosSemSuprimento).toBe(50)
    // precoMedio considera só os 50 supridos: 50 * 5,5 = 275 / 50 = 5,5
    expect(r.precoMedio).toBe(5.5)
  })

  it('ignora entradas/transferências futuras (data > saída.data)', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00Z', 100, 550),  // antes da saída — OK
      ent('B', 't1', '2026-02-01T08:00:00Z', 100, 800),  // depois da saída — IGNORA
    ]
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-15T08:00:00Z', litros: 50,
      entradas, transferencias: [], saidasAnteriores: [] })
    expect(r.detalhamento).toEqual([{ fonteTipo: 'entrada', fonteId: 'A', litros: 50, preco: 5.5 }])
  })

  it('inclui transferências recebidas como lote (depositoDestinoId === tanqueId)', () => {
    const transferencias: TransferenciaCombustivel[] = [{
      id: 'T1', dataHora: '2026-01-01T08:00:00Z',
      depositoOrigemId: 'outro_tanque', depositoDestinoId: 't1',
      quantidadeLitros: 200, valorTotal: 1200, observacoes: '', criadoPor: '',
    } as TransferenciaCombustivel]
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-15T08:00:00Z', litros: 100,
      entradas: [], transferencias, saidasAnteriores: [] })
    expect(r.precoMedio).toBe(6.0)
    expect(r.detalhamento).toEqual([{ fonteTipo: 'transferencia', fonteId: 'T1', litros: 100, preco: 6.0 }])
  })

  it('ordena lotes por data (mais antigo primeiro), independente da ordem do array input', () => {
    const entradas = [
      ent('B', 't1', '2026-01-10T08:00:00Z', 2000, 12000),  // R$ 6,00 (mais novo)
      ent('A', 't1', '2026-01-01T08:00:00Z', 100, 550),     // R$ 5,50 (mais antigo)
    ]
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-15T08:00:00Z', litros: 150,
      entradas, transferencias: [], saidasAnteriores: [] })
    // FIFO consome A (100L * 5,5) primeiro, depois 50L de B (5,5 * 50 + 6,0 * 50)
    // Esperado: detalhamento[0] = A, detalhamento[1] = B
    expect(r.detalhamento[0].fonteId).toBe('A')
    expect(r.detalhamento[1].fonteId).toBe('B')
  })

  it('saídas anteriores consomem do FIFO em ordem cronológica (não atual)', () => {
    const entradas = [
      ent('A', 't1', '2026-01-01T08:00:00Z', 100, 550),
      ent('B', 't1', '2026-01-10T08:00:00Z', 100, 700),
    ]
    const saidasAnteriores = [
      sai('s1', 't1', '2026-01-05T08:00:00Z', 80),   // consome 80 do A → restam 20 A + 100 B = 120L
      sai('s2', 't1', '2026-01-12T08:00:00Z', 40),   // consome 20 A + 20 B → restam 80 B
    ]
    const r = calcularPrecoFIFO({ tanqueId: 't1', dataHora: '2026-01-20T08:00:00Z', litros: 80,
      entradas, transferencias: [], saidasAnteriores })
    // Restam 80L de B (R$ 7,00)
    expect(r.precoMedio).toBe(7.0)
    expect(r.detalhamento).toEqual([{ fonteTipo: 'entrada', fonteId: 'B', litros: 80, preco: 7.0 }])
    expect(r.litrosSemSuprimento).toBe(0)
  })
})
```

### Step 2: Run failing tests

```bash
cd /Users/tiagocameli/projects/Gestao_Obras
npm test src/utils/fifoCombustivel.test.ts
```

Expected: FAIL (module not found).

### Step 3: Implement helper

Create `src/utils/fifoCombustivel.ts`:

```typescript
import type { EntradaCombustivel, TransferenciaCombustivel, SaidaCombustivel } from '../types'

export type FonteTipo = 'entrada' | 'transferencia'

export interface LoteFIFO {
  fonteTipo: FonteTipo
  fonteId: string
  dataHora: string  // ISO
  litrosOriginal: number
  precoUnitario: number  // R$/L do lote
}

export interface PorçãoConsumida {
  fonteTipo: FonteTipo
  fonteId: string
  litros: number
  preco: number
}

export interface FIFOInput {
  tanqueId: string
  dataHora: string  // ISO timestamp da saída
  litros: number   // litros solicitados
  entradas: EntradaCombustivel[]
  transferencias: TransferenciaCombustivel[]
  saidasAnteriores: SaidaCombustivel[]  // já carregadas, ordenadas ou não
}

export interface FIFOResult {
  precoMedio: number   // média ponderada das porções consumidas
  detalhamento: PorçãoConsumida[]
  litrosSemSuprimento: number  // > 0 se não houver lote suficiente
}

/**
 * Calcula preço FIFO real consumindo lotes em ordem cronológica.
 *
 * Para cada saída anterior (em ordem cronológica), simula o consumo no FIFO
 * reduzindo o saldo dos lotes mais antigos. Pra esta saída, consome
 * dos lotes restantes em ordem até atingir os litros solicitados.
 *
 * Se faltar lote (saídas que vieram antes de qualquer entrada/transferência),
 * registra `litrosSemSuprimento` > 0. O precoMedio considera apenas os litros
 * de fato supridos (preço médio das porções), retornando 0 se nenhum foi suprido.
 *
 * Bug reference: combustivel-horarios-precos.md §D.5 (FIFO).
 */
export function calcularPrecoFIFO(input: FIFOInput): FIFOResult {
  const { tanqueId, dataHora, litros, entradas, transferencias, saidasAnteriores } = input

  // 1. Monta lista de lotes (entradas + transferências recebidas) ATÉ a data da saída
  const lotes: LoteFIFO[] = []
  for (const e of entradas) {
    if (e.depositoId === tanqueId && e.dataHora <= dataHora) {
      lotes.push({
        fonteTipo: 'entrada',
        fonteId: e.id,
        dataHora: e.dataHora,
        litrosOriginal: e.quantidadeLitros,
        precoUnitario: e.valorTotal / e.quantidadeLitros,
      })
    }
  }
  for (const t of transferencias) {
    if (t.depositoDestinoId === tanqueId && t.dataHora <= dataHora) {
      lotes.push({
        fonteTipo: 'transferencia',
        fonteId: t.id,
        dataHora: t.dataHora,
        litrosOriginal: t.quantidadeLitros,
        precoUnitario: t.valorTotal / t.quantidadeLitros,
      })
    }
  }

  // 2. Ordena lotes por data ASC (FIFO)
  lotes.sort((a, b) => a.dataHora.localeCompare(b.dataHora))

  // 3. Saldo restante por lote (em ordem)
  const saldos = lotes.map((l) => ({ ...l, saldoRestante: l.litrosOriginal }))

  // 4. Replay das saídas anteriores em ordem cronológica — consomem dos lotes
  const saidasOrdenadas = [...saidasAnteriores]
    .filter((s) => s.tanqueId === tanqueId && s.data < dataHora)
    .sort((a, b) => a.data.localeCompare(b.data))

  for (const s of saidasOrdenadas) {
    let litrosRestantes = s.litros
    for (const lote of saldos) {
      if (litrosRestantes <= 0) break
      if (lote.saldoRestante <= 0) continue
      const consome = Math.min(litrosRestantes, lote.saldoRestante)
      lote.saldoRestante -= consome
      litrosRestantes -= consome
    }
    // Se sobrar litrosRestantes, é saída sem suprimento — ignora pro fim do replay (essa saída
    // anterior teve sua própria falta; não interfere no cálculo desta saída).
  }

  // 5. Agora consome ESTA saída
  let litrosFaltando = litros
  const detalhamento: PorçãoConsumida[] = []
  for (const lote of saldos) {
    if (litrosFaltando <= 0) break
    if (lote.saldoRestante <= 0) continue
    const consome = Math.min(litrosFaltando, lote.saldoRestante)
    detalhamento.push({
      fonteTipo: lote.fonteTipo,
      fonteId: lote.fonteId,
      litros: consome,
      preco: lote.precoUnitario,
    })
    lote.saldoRestante -= consome
    litrosFaltando -= consome
  }

  // 6. Calcula preço médio ponderado das porções consumidas
  const litrosSupridos = detalhamento.reduce((sum, p) => sum + p.litros, 0)
  const valorSuprido = detalhamento.reduce((sum, p) => sum + p.litros * p.preco, 0)
  const precoMedio = litrosSupridos > 0 ? valorSuprido / litrosSupridos : 0

  return {
    precoMedio,
    detalhamento,
    litrosSemSuprimento: litrosFaltando,
  }
}
```

### Step 4: Run tests, PASS

```bash
npm test src/utils/fifoCombustivel.test.ts
```

Expected: 8 passed.

### Step 5: Commit

```bash
git add src/utils/fifoCombustivel.ts src/utils/fifoCombustivel.test.ts
git commit -m "feat(combustivel): helper calcularPrecoFIFO + 8 testes vitest

Helper puro pra custeio FIFO real:
- Recebe tanque, data, litros + entradas/transferencias/saidas_anteriores
- Monta lista de lotes (entradas + transf recebidas até a data)
- Ordena por data ASC (FIFO)
- Replay das saídas anteriores em ordem cronológica → reduz saldo dos lotes
- Consome esta saída dos lotes restantes em ordem
- Retorna {precoMedio, detalhamento, litrosSemSuprimento}

8 testes cobrindo: 1 lote, 2 lotes (exemplo usuário), saída sem
suprimento, suprimento parcial, ordenação automática por data,
inclusão de transferências recebidas, replay de saídas anteriores
mudando o saldo disponível.

Próxima task integra o helper nos forms desktop + mobile."
```

---

## Task FI.3: RPC pra INSERT atomico (saida + saidas_lotes + saidas_sem_suprimento)

> **Por quê RPC e não cliente:** quando há FIFO, precisamos inserir 1 saída + N linhas em `saidas_lotes` (e talvez 1 em `saidas_sem_suprimento`) numa única transaction. Cliente Supabase faz tudo em chamadas separadas, sem atomicidade. RPC garante consistência.

**Files:**
- Create: `supabase/migrations/20260523140300_rpc_registrar_saida_fifo.sql`

### Step 1: Criar RPC

Write `supabase/migrations/20260523140300_rpc_registrar_saida_fifo.sql`:

```sql
-- FI.3 — RPC pra registrar saída + lotes consumidos + sem_suprimento numa
-- única transaction.
--
-- Cliente passa o payload da saída + array detalhamento (calculado pelo
-- helper fifoCombustivel.ts) + litrosSemSuprimento. RPC insere tudo
-- atomicamente.

CREATE OR REPLACE FUNCTION public.registrar_saida_combustivel_fifo(
  p_saida jsonb,
  p_lotes jsonb,                -- array de {fonte_tipo, fonte_id, litros, preco_lote}
  p_litros_sem_suprimento numeric DEFAULT 0
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_saida_id text;
  v_lote jsonb;
BEGIN
  -- 1. Insert da saída
  INSERT INTO public.saidas_combustivel (
    id, data, origem, tipo_consumidor, tanque_id, equipamento_id, transportadora_id,
    placa, obra_id, etapa_id, alocacoes, tipo_combustivel, litros,
    preco_medio_tanque_snapshot, taxa_litro, preco_unitario, valor_total,
    preco_combustivel, preco_combustivel_areacre, foto_urls, arquivo_urls,
    observacoes, pago, pago_em, movimento_id, motorista,
    medicao_no_abastecimento, tipo_medicao_snapshot, created_by, updated_by
  ) VALUES (
    p_saida->>'id',
    (p_saida->>'data')::timestamptz,
    p_saida->>'origem',
    p_saida->>'tipo_consumidor',
    NULLIF(p_saida->>'tanque_id', ''),
    NULLIF(p_saida->>'equipamento_id', ''),
    NULLIF(p_saida->>'transportadora_id', ''),
    NULLIF(p_saida->>'placa', ''),
    NULLIF(p_saida->>'obra_id', ''),
    NULLIF(p_saida->>'etapa_id', ''),
    p_saida->'alocacoes',
    p_saida->>'tipo_combustivel',
    (p_saida->>'litros')::numeric,
    (p_saida->>'preco_medio_tanque_snapshot')::numeric,
    COALESCE((p_saida->>'taxa_litro')::numeric, 0),
    (p_saida->>'preco_unitario')::numeric,
    (p_saida->>'valor_total')::numeric,
    NULLIF((p_saida->>'preco_combustivel'), '')::numeric,
    NULLIF((p_saida->>'preco_combustivel_areacre'), '')::numeric,
    COALESCE((p_saida->'foto_urls')::text::text[], '{}'),
    COALESCE((p_saida->'arquivo_urls')::text::text[], '{}'),
    p_saida->>'observacoes',
    COALESCE((p_saida->>'pago')::boolean, false),
    NULLIF(p_saida->>'pago_em', '')::timestamptz,
    NULLIF(p_saida->>'movimento_id', ''),
    COALESCE(p_saida->>'motorista', ''),
    NULLIF(p_saida->>'medicao_no_abastecimento', '')::numeric,
    NULLIF(p_saida->>'tipo_medicao_snapshot', ''),
    NULLIF(p_saida->>'created_by', ''),
    NULLIF(p_saida->>'updated_by', '')
  )
  RETURNING id INTO v_saida_id;

  -- 2. Insert dos lotes
  FOR v_lote IN SELECT * FROM jsonb_array_elements(p_lotes)
  LOOP
    INSERT INTO public.saidas_lotes (saida_id, fonte_tipo, fonte_id, litros, preco_lote)
    VALUES (
      v_saida_id,
      v_lote->>'fonte_tipo',
      v_lote->>'fonte_id',
      (v_lote->>'litros')::numeric,
      (v_lote->>'preco_lote')::numeric
    );
  END LOOP;

  -- 3. Se houver litros sem suprimento, registrar em sss
  IF p_litros_sem_suprimento > 0 THEN
    INSERT INTO public.saidas_sem_suprimento (
      saida_id, tanque_id, data_saida, litros_solicitados,
      litros_supridos, litros_sem_suprimento
    ) VALUES (
      v_saida_id,
      NULLIF(p_saida->>'tanque_id', ''),
      (p_saida->>'data')::timestamptz,
      (p_saida->>'litros')::numeric,
      (p_saida->>'litros')::numeric - p_litros_sem_suprimento,
      p_litros_sem_suprimento
    );
  END IF;

  RETURN v_saida_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_saida_combustivel_fifo(jsonb, jsonb, numeric) TO authenticated;
```

### Step 2: Apply via MCP

`apply_migration` com nome `rpc_registrar_saida_fifo`.

### Step 3: Smoke test via SQL

```sql
-- Teste rapido: chamar a função com payload mínimo (mas válido)
SELECT public.registrar_saida_combustivel_fifo(
  jsonb_build_object(
    'id', 'test_fifo_' || extract(epoch from now())::text,
    'data', now()::text,
    'origem', 'tanque',
    'tipo_consumidor', 'equipamento_proprio',
    'tanque_id', (SELECT id FROM public.depositos LIMIT 1),
    'equipamento_id', (SELECT id FROM public.equipamentos LIMIT 1),
    'obra_id', (SELECT id FROM public.obras LIMIT 1),
    'tipo_combustivel', 'd',
    'litros', '1',
    'preco_medio_tanque_snapshot', '6',
    'preco_unitario', '6',
    'valor_total', '6',
    'foto_urls', '[]'::jsonb,
    'arquivo_urls', '[]'::jsonb
  ),
  '[{"fonte_tipo":"entrada","fonte_id":"X","litros":1,"preco_lote":6}]'::jsonb,
  0
);
-- Rollback manual depois:
-- DELETE FROM public.saidas_combustivel WHERE id LIKE 'test_fifo_%';
```

Após sucesso, DELETE o registro de teste.

### Step 4: Commit

```bash
git add supabase/migrations/20260523140300_rpc_registrar_saida_fifo.sql
git commit -m "feat(combustivel): RPC registrar_saida_combustivel_fifo

Insert atomico de saida + saidas_lotes + saidas_sem_suprimento numa
única transaction. Cliente passa payload pré-calculado pelo helper
fifoCombustivel.ts. SECDEF com search_path fixo."
```

---

## Task FI.4: Hook + integração desktop SaidaCombustivelForm

**Files:**
- Modify: `src/hooks/useSaidasCombustivel.ts` — adicionar mutation `useRegistrarSaidaFIFO`
- Modify: `src/components/combustivel/SaidaCombustivelForm.tsx` — usar helper + nova mutation

### Step 1: Adicionar hook na `useSaidasCombustivel.ts`

Add:

```typescript
import { calcularPrecoFIFO } from '../utils/fifoCombustivel'

export function useRegistrarSaidaFIFO() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      saida: SaidaCombustivel
      lotes: { fonteTipo: 'entrada' | 'transferencia'; fonteId: string; litros: number; precoLote: number }[]
      litrosSemSuprimento: number
    }) => {
      const { data, error } = await supabase.rpc('registrar_saida_combustivel_fifo', {
        p_saida: saidaCombustivelToDb(params.saida),  // mapper existente
        p_lotes: params.lotes.map((l) => ({
          fonte_tipo: l.fonteTipo,
          fonte_id: l.fonteId,
          litros: l.litros,
          preco_lote: l.precoLote,
        })),
        p_litros_sem_suprimento: params.litrosSemSuprimento,
      })
      if (error) throw error
      return data as string  // saida_id
    },
    onSuccess: () => invalidateAll(qc),
  })
}
```

### Step 2: Modificar SaidaCombustivelForm

No componente:

```typescript
import { calcularPrecoFIFO } from '../../utils/fifoCombustivel'
import { useRegistrarSaidaFIFO } from '../../hooks/useSaidasCombustivel'
import { useSaidasCombustivel } from '../../hooks/useSaidasCombustivel'

// ...
const { data: saidasExistentes = [] } = useSaidasCombustivel()
const registrarFIFOMut = useRegistrarSaidaFIFO()
```

Substituir o cálculo de `precoMedioTanque` (linhas 256-273) por:

```typescript
const fifoResult = useMemo(() => {
  if (origem !== 'tanque' || !tanqueId) {
    return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  }
  return calcularPrecoFIFO({
    tanqueId,
    dataHora: formValues.data || new Date().toISOString(),
    litros: formValues.litros || 0,
    entradas: entradasCombustivel,
    transferencias,
    saidasAnteriores: saidasExistentes.filter((s) => s.tanqueId === tanqueId && s.id !== initial?.id),
  })
}, [origem, tanqueId, formValues.data, formValues.litros, entradasCombustivel, transferencias, saidasExistentes, initial?.id])

// Preserva snapshot imutável (HF.11): em edit mode com tanque/origem não mudados, usa snapshot salvo
const isEditingExistente = !!initial?.id
const tanqueOrigemNaoMudou = !!initial && initial.tanqueId === tanqueId && initial.origem === origem
const usaSnapshotSalvo = isEditingExistente && tanqueOrigemNaoMudou && (initial?.precoMedioTanqueSnapshot ?? 0) > 0

const precoMedioTanque = usaSnapshotSalvo
  ? (initial!.precoMedioTanqueSnapshot ?? 0)
  : fifoResult.precoMedio
```

UI: mostrar detalhamento dos lotes (opcional mas útil pra debug):

```tsx
{!usaSnapshotSalvo && fifoResult.detalhamento.length > 1 && (
  <details className="text-xs text-[var(--color-fg-muted)] mt-1">
    <summary>Detalhamento FIFO ({fifoResult.detalhamento.length} lote(s))</summary>
    <ul className="ml-4 mt-1">
      {fifoResult.detalhamento.map((p, i) => (
        <li key={i}>
          {p.litros.toFixed(2)} L × R$ {p.preco.toFixed(4)}/L = R$ {(p.litros * p.preco).toFixed(2)}
        </li>
      ))}
    </ul>
  </details>
)}

{fifoResult.litrosSemSuprimento > 0 && (
  <div className="text-xs text-[var(--color-warning)] mt-1">
    ⚠ {fifoResult.litrosSemSuprimento.toFixed(2)} L sem suprimento na linha do tempo.
    Será registrado em saidas_sem_suprimento pra revisão.
  </div>
)}
```

### Step 3: Trocar mutation de save

Substituir o handleSubmit (linha ~520) pra usar `registrarFIFOMut.mutateAsync`:

```typescript
const onSubmit = async (data: SaidaCombustivelFormValues) => {
  // ... (mesmo preparo do payload da saída)

  const saidaPayload: SaidaCombustivel = { /* ... */ }

  await registrarFIFOMut.mutateAsync({
    saida: saidaPayload,
    lotes: fifoResult.detalhamento.map((p) => ({
      fonteTipo: p.fonteTipo,
      fonteId: p.fonteId,
      litros: p.litros,
      precoLote: p.preco,
    })),
    litrosSemSuprimento: fifoResult.litrosSemSuprimento,
  })

  showToast({ kind: 'success', message: 'Saída registrada' })
  onClose()
}
```

### Step 4: TypeScript + build + tests

```bash
npx tsc -b 2>&1 | tail -5
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -10
```

### Step 5: Smoke manual

```bash
npm run dev
```

Abrir Nova Saída → escolher tanque → digitar litros → verificar:
- Card "CÁLCULO" mostra preço calculado via FIFO
- Se for múltiplos lotes, `<details>` mostra a quebra
- Salvar → verificar no DB que `saidas_combustivel` ganhou row + `saidas_lotes` ganhou N rows com `saida_id` apontando

Encerrar dev server.

### Step 6: Commit

```bash
git add src/hooks/useSaidasCombustivel.ts src/components/combustivel/SaidaCombustivelForm.tsx
git commit -m "feat(combustivel): desktop SaidaForm usa FIFO real

Substitui calcularPrecoMedioTanque (vitalício) por calcularPrecoFIFO
(por lote). Forms recebem saidasAnteriores do useSaidasCombustivel().

Cálculo:
- Lista lotes (entradas + transf recebidas) ATÉ data da saída
- Replay das saídas anteriores em ordem cronológica
- Consome desta saída dos lotes restantes em ordem
- preco_unitario = média ponderada das porções consumidas

UI:
- Detalhamento dos lotes em <details> quando >1 lote
- Warning amarelo se houver litros sem suprimento

Persist via nova RPC registrar_saida_combustivel_fifo (insert atomico:
saidas_combustivel + saidas_lotes + saidas_sem_suprimento)."
```

---

## Task FI.5: Integração mobile MSaidaCombustivelPage

**Files:**
- Modify: `src/pages/mobile/MSaidaCombustivelPage.tsx`

### Step 1: Add imports + hooks

```tsx
import { calcularPrecoFIFO } from '../../utils/fifoCombustivel'
import { useRegistrarSaidaFIFO, useSaidasCombustivel } from '../../hooks/useSaidasCombustivel'

const { data: saidasExistentes = [] } = useSaidasCombustivel()
const registrarFIFOMut = useRegistrarSaidaFIFO()
```

### Step 2: Substituir cálculo de precoMedioTanque

Find o `useMemo` de `precoMedioTanque` (linha ~92). Substituir por:

```tsx
const dataHoraNow = new Date().toISOString()
const fifoResult = useMemo(() => {
  if (!tanqueId || litrosNum <= 0) {
    return { precoMedio: 0, detalhamento: [], litrosSemSuprimento: 0 }
  }
  return calcularPrecoFIFO({
    tanqueId,
    dataHora: dataHoraNow,
    litros: litrosNum,
    entradas: entradasCombustivel,
    transferencias,
    saidasAnteriores: saidasExistentes.filter((s) => s.tanqueId === tanqueId),
  })
}, [tanqueId, dataHoraNow, litrosNum, entradasCombustivel, transferencias, saidasExistentes])

const precoMedioTanque = fifoResult.precoMedio
```

### Step 3: Substituir submit

```tsx
const handleSubmit = async (e: FormEvent) => {
  e.preventDefault()
  // ... validações ...

  await registrarFIFOMut.mutateAsync({
    saida: { /* payload SaidaCombustivel completo, similar ao atual */ },
    lotes: fifoResult.detalhamento.map((p) => ({
      fonteTipo: p.fonteTipo,
      fonteId: p.fonteId,
      litros: p.litros,
      precoLote: p.preco,
    })),
    litrosSemSuprimento: fifoResult.litrosSemSuprimento,
  })

  showToast({ kind: 'success', message: 'Saída registrada' })
  navigate('/m')
}
```

### Step 4: UI (mobile-friendly — sem `<details>` que ocupa muito)

Mostrar apenas a warning de sem suprimento (operacional pode não precisar do detalhamento):

```tsx
{fifoResult.litrosSemSuprimento > 0 && (
  <div className="text-xs text-[var(--color-warning)] p-2 bg-[var(--color-warning-soft)] rounded">
    ⚠ {fifoResult.litrosSemSuprimento.toFixed(2)} L sem suprimento registrado neste tanque.
    Continue se a operação for real — vai pra revisão.
  </div>
)}
```

### Step 5: Build + tests + smoke

```bash
npx tsc -b 2>&1 | tail -3
npm run build 2>&1 | tail -3
npm test 2>&1 | tail -10
```

Smoke via `npm run dev` + abrir mobile em `/m/saida-combustivel/<eq_id>` → registrar saída → verificar `saidas_lotes` foi populada.

### Step 6: Commit

```bash
git add src/pages/mobile/MSaidaCombustivelPage.tsx
git commit -m "feat(combustivel-mobile): MSaidaCombustivelPage usa FIFO real

Mobile agora chama mesma RPC do desktop. preco_unitario calculado
via FIFO. Linha em saidas_lotes pra cada porção consumida.

UI mobile mostra apenas warning quando há litros sem suprimento
(detalhamento dos lotes não cabe bem em mobile)."
```

---

## Task FI.6: Migration backfill — replay FIFO em todo o histórico

**Files:**
- Create: `supabase/migrations/20260523140400_backfill_fifo_historico.sql`

### Step 1: Estratégia

Backfill via SQL puro (não JS):
1. Para cada tanque, listar entradas + transferências recebidas ordenadas por data
2. Para cada tanque, listar saídas ordenadas por data
3. Replay: pra cada saída, consume dos lotes em ordem; popula `saidas_lotes` + atualiza `preco_unitario`/`valor_total`/`preco_medio_tanque_snapshot` da saída
4. Saídas sem lote registradas em `saidas_sem_suprimento`

> **Implementação:** procedure PL/pgSQL com loops aninhados (lento mas auditável).

### Step 2: Criar migration

Write `supabase/migrations/20260523140400_backfill_fifo_historico.sql`:

```sql
-- FI.6 — Backfill FIFO retroativo de todo o histórico.
--
-- Para cada tanque, replay cronológico das entradas/transferencias e saídas.
-- Popula saidas_lotes com o detalhamento real e atualiza preco_unitario /
-- valor_total / preco_medio_tanque_snapshot conforme FIFO.
--
-- Saídas sem lote anterior na linha do tempo → registradas em
-- saidas_sem_suprimento. Não modifica saídas tipo carreta_transportadora
-- (preço vem de negociação externa, não FIFO).

DO $$
DECLARE
  v_tanque record;
  v_saida record;
  v_lote record;
  v_litros_restantes numeric;
  v_litros_consome numeric;
  v_total_valor_consumido numeric;
  v_total_litros_consumidos numeric;
  v_saldos jsonb;  -- saldo por lote { lote_id: saldo_litros }
BEGIN
  -- Limpa backfill anterior se rodando de novo
  TRUNCATE public.saidas_lotes;
  TRUNCATE public.saidas_sem_suprimento;

  FOR v_tanque IN
    SELECT DISTINCT id FROM public.depositos WHERE deleted_at IS NULL
  LOOP
    -- Inicializa saldos com lotes do tanque ordenados por data
    v_saldos := '{}'::jsonb;

    -- Adiciona entradas
    FOR v_lote IN
      SELECT id, data_hora, quantidade_litros, valor_total
      FROM public.entradas_combustivel
      WHERE deposito_id = v_tanque.id AND deleted_at IS NULL
      ORDER BY data_hora ASC
    LOOP
      v_saldos := v_saldos || jsonb_build_object(
        v_lote.id,
        jsonb_build_object(
          'tipo', 'entrada',
          'data', v_lote.data_hora,
          'litros_original', v_lote.quantidade_litros,
          'saldo', v_lote.quantidade_litros,
          'preco', v_lote.valor_total / NULLIF(v_lote.quantidade_litros, 0)
        )
      );
    END LOOP;

    -- Adiciona transferências recebidas
    FOR v_lote IN
      SELECT id, data_hora, quantidade_litros, valor_total
      FROM public.transferencias_combustivel
      WHERE deposito_destino_id = v_tanque.id AND deleted_at IS NULL
      ORDER BY data_hora ASC
    LOOP
      v_saldos := v_saldos || jsonb_build_object(
        v_lote.id,
        jsonb_build_object(
          'tipo', 'transferencia',
          'data', v_lote.data_hora,
          'litros_original', v_lote.quantidade_litros,
          'saldo', v_lote.quantidade_litros,
          'preco', v_lote.valor_total / NULLIF(v_lote.quantidade_litros, 0)
        )
      );
    END LOOP;

    -- Processa cada saída em ordem cronológica
    FOR v_saida IN
      SELECT id, data, litros
      FROM public.saidas_combustivel
      WHERE tanque_id = v_tanque.id
        AND tipo_consumidor = 'equipamento_proprio'  -- carreta tem preço próprio
        AND origem = 'tanque'
        AND deleted_at IS NULL
      ORDER BY data ASC
    LOOP
      v_litros_restantes := v_saida.litros;
      v_total_valor_consumido := 0;
      v_total_litros_consumidos := 0;

      -- Consome de lotes em ordem ASC pela data, filtrando data <= saida.data
      FOR v_lote IN
        SELECT key AS lote_id, value AS lote
        FROM jsonb_each(v_saldos)
        WHERE (value->>'data')::timestamptz <= v_saida.data
          AND (value->>'saldo')::numeric > 0
        ORDER BY (value->>'data')::timestamptz ASC, key
      LOOP
        IF v_litros_restantes <= 0 THEN EXIT; END IF;

        v_litros_consome := LEAST(
          v_litros_restantes,
          (v_lote.lote->>'saldo')::numeric
        );

        -- Insert na saidas_lotes
        INSERT INTO public.saidas_lotes (saida_id, fonte_tipo, fonte_id, litros, preco_lote)
        VALUES (
          v_saida.id,
          v_lote.lote->>'tipo',
          v_lote.lote_id,
          v_litros_consome,
          (v_lote.lote->>'preco')::numeric
        );

        -- Atualiza saldo no jsonb
        v_saldos := jsonb_set(
          v_saldos,
          ARRAY[v_lote.lote_id, 'saldo'],
          to_jsonb(((v_lote.lote->>'saldo')::numeric) - v_litros_consome)
        );

        v_litros_restantes := v_litros_restantes - v_litros_consome;
        v_total_valor_consumido := v_total_valor_consumido + (v_litros_consome * (v_lote.lote->>'preco')::numeric);
        v_total_litros_consumidos := v_total_litros_consumidos + v_litros_consome;
      END LOOP;

      -- Atualiza saida_combustivel com preço FIFO
      IF v_total_litros_consumidos > 0 THEN
        UPDATE public.saidas_combustivel
        SET preco_unitario = v_total_valor_consumido / v_total_litros_consumidos,
            preco_medio_tanque_snapshot = v_total_valor_consumido / v_total_litros_consumidos,
            valor_total = (v_total_valor_consumido / v_total_litros_consumidos) * v_saida.litros,
            updated_at = now(),
            updated_by = COALESCE(updated_by, 'sistema') || ' [backfill FIFO]'
        WHERE id = v_saida.id;
      END IF;

      -- Se sobrou litros sem suprimento, registra
      IF v_litros_restantes > 0 THEN
        INSERT INTO public.saidas_sem_suprimento (
          saida_id, tanque_id, data_saida, litros_solicitados,
          litros_supridos, litros_sem_suprimento
        ) VALUES (
          v_saida.id,
          v_tanque.id,
          v_saida.data,
          v_saida.litros,
          v_total_litros_consumidos,
          v_litros_restantes
        );
      END IF;
    END LOOP;
  END LOOP;
END$$;
```

### Step 3: Apply via MCP

> **Cuidado:** essa migration é pesada (loops em ~1000 saídas × N lotes). Pode demorar alguns minutos. Aplicar fora de horário de pico se possível.

`apply_migration` com nome `backfill_fifo_historico`.

### Step 4: Verify

```sql
-- Total de linhas em saidas_lotes
SELECT COUNT(*) FROM public.saidas_lotes;

-- Saídas que ficaram com lote
SELECT COUNT(DISTINCT saida_id) FROM public.saidas_lotes;

-- Saídas órfãs detectadas
SELECT COUNT(*) FROM public.saidas_sem_suprimento;
```

Esperado: ~1000+ linhas em saidas_lotes, ~898 saídas equipamento_proprio cobertas, ~200 órfãs em saidas_sem_suprimento (conforme B.6 do audit).

### Step 5: Commit

```bash
git add supabase/migrations/20260523140400_backfill_fifo_historico.sql
git commit -m "fix(combustivel): backfill FIFO retroativo de todo o histórico

Replay cronológico de entradas + transferencias + saidas pra cada
tanque. Popula saidas_lotes com detalhamento real, atualiza
preco_unitario/valor_total/preco_medio_tanque_snapshot das saidas
equipamento_proprio. Saidas tipo carreta_transportadora preservadas
(têm preço de negociação externa).

Saidas anteriores a qualquer lote (~200 esperadas conforme B.6 do
audit) registradas em saidas_sem_suprimento pra revisão manual."
```

---

## Task FI.7: Relatório de saídas sem suprimento (UI)

**Files:**
- Create: `src/components/combustivel/v2/sem-suprimento/SemSuprimentoTab.tsx`
- Modify: `src/components/combustivel/v2/CombustivelTabsNav.tsx` — adicionar tab

### Step 1: Criar componente

Create `src/components/combustivel/v2/sem-suprimento/SemSuprimentoTab.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../../lib/supabase'
import { fmtDataHora } from '../shared/formatters'

interface SemSuprimentoRow {
  id: string
  saida_id: string
  tanque_id: string
  data_saida: string
  litros_solicitados: number
  litros_supridos: number
  litros_sem_suprimento: number
  detectado_em: string
  revisado: boolean
}

export default function SemSuprimentoTab() {
  const { data = [], isLoading } = useQuery<SemSuprimentoRow[]>({
    queryKey: ['saidas_sem_suprimento'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saidas_sem_suprimento')
        .select('*')
        .order('data_saida', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  if (isLoading) return <div className="p-4">Carregando...</div>

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-3">
        <h2 className="font-semibold">Saídas sem suprimento na linha do tempo</h2>
        <p className="text-xs mt-1 text-[var(--color-fg-muted)]">
          {data.length} saída(s) foram registradas antes de qualquer entrada/transferência
          ter sido lançada no tanque. Provável causa: saldo inicial dos tanques não foi
          formalizado em <code>entradas_combustivel</code>. Revise e — se aplicável —
          crie uma entrada retroativa pra suprir o saldo inicial.
        </p>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)]">
            <th className="text-left p-2">Saída ID</th>
            <th className="text-left p-2">Data</th>
            <th className="text-right p-2">Solicitados</th>
            <th className="text-right p-2">Supridos</th>
            <th className="text-right p-2">Sem suprimento</th>
            <th className="text-left p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id} className="border-b border-[var(--color-border)]/40">
              <td className="p-2 font-mono text-xs">{r.saida_id.slice(0, 8)}...</td>
              <td className="p-2">{fmtDataHora(r.data_saida)}</td>
              <td className="p-2 text-right tabular-nums">{r.litros_solicitados.toFixed(2)} L</td>
              <td className="p-2 text-right tabular-nums">{r.litros_supridos.toFixed(2)} L</td>
              <td className="p-2 text-right tabular-nums text-[var(--color-warning)]">
                {r.litros_sem_suprimento.toFixed(2)} L
              </td>
              <td className="p-2">
                {r.revisado ? '✅ Revisado' : '⏳ Pendente'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.length === 0 && (
        <div className="text-center text-[var(--color-fg-muted)] p-8">
          Nenhuma saída sem suprimento. 🎉
        </div>
      )}
    </div>
  )
}
```

### Step 2: Add tab no nav

Modify `src/components/combustivel/v2/CombustivelTabsNav.tsx` — adicionar entry:

```tsx
{
  id: 'sem-suprimento',
  label: 'Sem Suprimento',
  group: 'Auditoria',
  badge: 'admin',
  // ... estrutura existente
}
```

> Verificar a estrutura exata de tabs no `CombustivelTabsNav` e replicar pattern.

### Step 3: Add render na container

Modify `src/components/frota/combustivel/FrotaCombustivelContainer.tsx` — case do switch das tabs adicionar:

```tsx
case 'sem-suprimento':
  return <SemSuprimentoTab />
```

### Step 4: Build + test + commit

```bash
npx tsc -b 2>&1 | tail -3
npm run build 2>&1 | tail -3
git add src/components/combustivel/v2/sem-suprimento/SemSuprimentoTab.tsx \
        src/components/combustivel/v2/CombustivelTabsNav.tsx \
        src/components/frota/combustivel/FrotaCombustivelContainer.tsx
git commit -m "feat(combustivel): aba Sem Suprimento (relatório FIFO)

Lista saidas_sem_suprimento populada pelo backfill FIFO + por novos
registros do helper. Usuário pode revisar caso a caso e criar entradas
retroativas se aplicável."
```

---

## Task FI.8: Final — build + security + deploy + push

- [ ] **Step 1: Build + tests**

```bash
npm run build 2>&1 | tail -5
npm test 2>&1 | tail -10
```

Expected: 8 testes novos + existentes passing.

- [ ] **Step 2: /security-review**

```
/security-review
```

Expected: NO_FINDINGS. RPC SECDEF com search_path fixo. Tabelas com RLS granular.

- [ ] **Step 3: Preview deploy**

```bash
npx --yes vercel deploy 2>&1 | tail -3
```

- [ ] **Step 4: Smoke test**

Pedir ao usuário verificar:
- Nova saída com tanque que tem 2 lotes → detalhamento `<details>` mostra a quebra
- Salvar → `saidas_lotes` populada + `preco_unitario` reflete FIFO real
- Aba "Sem Suprimento" lista ~200 saídas históricas (pra revisão manual)
- Mobile registrar saída → mesma lógica, mesmo persist

- [ ] **Step 5: Promover prod**

```bash
npx --yes vercel --prod 2>&1 | tail -3
```

- [ ] **Step 6: Merge + push**

```bash
git checkout main && git pull origin main
git merge --no-ff feat/combustivel-fifo-real -m "Merge branch 'feat/combustivel-fifo-real'

FIFO real (custeio por lote) substituiu média vitalícia.

Estrutura:
- Tabelas novas: saidas_lotes (relacional), saidas_sem_suprimento (auditoria)
- Helper TS calcularPrecoFIFO (8 testes vitest)
- RPC registrar_saida_combustivel_fifo (insert atomico)
- Forms desktop + mobile usam o helper
- Backfill SQL processou ~1000 saídas históricas
- Aba 'Sem Suprimento' pra revisar saídas órfãs (~200 esperadas)

Plan: docs/superpowers/plans/2026-05-23-combustivel-fifo-real.md
Decisões do brainstorm: combustivel-horarios-precos.md §D.5"
git push origin main
```

---

## Critérios de Aceitação

- ✅ Helper `calcularPrecoFIFO` com 8 testes verdes
- ✅ RPC `registrar_saida_combustivel_fifo` retorna saida_id, popula 3 tabelas atomicamente
- ✅ Forms desktop + mobile gravam saidas_lotes pra cada nova saída
- ✅ Backfill aplicado: ~1000 saídas equipamento_proprio têm linhas em `saidas_lotes` somando = litros
- ✅ `saidas_sem_suprimento` populada com ~200 saídas órfãs (conforme B.6 do audit)
- ✅ Aba "Sem Suprimento" renderiza lista pra revisão
- ✅ `/security-review` NO_FINDINGS
- ✅ Smoke: cenário "70 do lote A + 30 do lote B" produz preço médio R$ 5,65

## Out of scope

- ❌ Recalcular automaticamente quando uma entrada antiga é editada (snapshot é imutável)
- ❌ UI pra reverter saídas órfãs (revisão manual via SQL no banco)
- ❌ Histórico de mudanças no detalhamento (saidas_lotes é append-only)
- ❌ Mudança em transferências (continuam usando preço médio do tanque origem no momento)
