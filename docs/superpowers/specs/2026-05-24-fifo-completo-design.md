# FIFO Completo — Design Spec

**Data:** 2026-05-24
**Branch alvo:** `fix/combustivel-fifo-completo`
**Audit fonte:** sessão anterior (2026-05-23) implementou FIFO parcial — backfill ignorou 3 fontes físicas de consumo (carretas, transferências OUT, esvaziamentos). Saldos calculados pelo FIFO divergem da realidade física do tanque.

---

## Problema

Backfill FIFO de 2026-05-23 processou apenas saídas `tipo_consumidor='equipamento_proprio'`. Resultado: saldo "FIFO" dos lotes não reflete realidade física do tanque.

**Exemplo confirmado — Meloza Colorado:**

| Métrica | Litros |
|---|---:|
| Entradas (lifetime) | 128.769 |
| Saídas equipamento_proprio | 121.965 |
| Transferências OUT | 5.000 |
| Carretas | 0 |
| Esvaziamentos | 0 |
| **Saldo físico real** (entradas − todas saídas) | **1.804 L** |
| **Saldo "FIFO" atual** (sum litros restantes nos lots ativos) | **12.832 L** |
| **Erro** | **+11.028 L** |

Diff = 5.000 (transferências OUT ignoradas) + 6.028 (saídas sem suprimento — combustível inicial "fantasma" pré-lotes).

---

## Princípio

**Toda operação que reduz fisicamente combustível em um tanque consome do FIFO.**

Saldo de um lote `L`:
```
saldo(L) = L.litros_original − Σ(consumos_lote.litros WHERE fonte_id = L)
```

**4 fontes de consumo** alimentam a mesma tabela:

| Fonte | tipo_consumidor | Preço do consumo | Modelo |
|---|---|---|---|
| Saída equip_proprio | `equipamento_proprio` | FIFO (média ponderada) | Vigente; mantém |
| Saída carreta | `carreta_transportadora` | Externo (negociação) | Novo: consome FIFO, **preserva preço externo** |
| Transferência OUT | n/a (`transferencias_combustivel`) | FIFO da origem | Novo: destino recebe lote derivado a preço FIFO computado |
| Esvaziamento | n/a (`esvaziamentos_tanque`) | FIFO da origem (perda contábil) | Novo: registra perda monetária |

---

## Arquitetura

### Storage: `saidas_lotes` → `consumos_lote` (polimórfico)

Rename + add `consumo_tipo`. Drop FK rígida (consumo_id ref varia por tipo). View `saidas_lotes` pra backward compat de consumidores existentes.

```sql
ALTER TABLE saidas_lotes RENAME TO consumos_lote;
ALTER TABLE consumos_lote RENAME COLUMN saida_id TO consumo_id;
ALTER TABLE consumos_lote DROP CONSTRAINT fk_saidas_lotes_saida;
ALTER TABLE consumos_lote ADD COLUMN consumo_tipo text NOT NULL DEFAULT 'saida'
  CHECK (consumo_tipo IN ('saida','transferencia_out','esvaziamento'));
ALTER TABLE consumos_lote ALTER COLUMN consumo_tipo DROP DEFAULT;

CREATE VIEW saidas_lotes AS
  SELECT id, consumo_id AS saida_id, fonte_tipo, fonte_id, litros, preco_lote, created_at
  FROM consumos_lote WHERE consumo_tipo = 'saida';

CREATE INDEX idx_consumos_lote_consumo ON consumos_lote(consumo_tipo, consumo_id);
```

### Helper TS atualizado: `calcularPrecoFIFO`

Signature muda — `consumosAnteriores` substitui `saidasAnteriores`:

```typescript
interface ConsumoAnterior {
  tipo: 'saida' | 'transferencia_out' | 'esvaziamento'
  data: string          // wall-clock ISO
  litros: number
  tanqueId: string
}

interface FIFOInput {
  tanqueId: string
  dataHora: string
  litros: number
  entradas: EntradaCombustivel[]
  transferenciasIn: TransferenciaCombustivel[]   // recebidas (destino = tanqueId)
  consumosAnteriores: ConsumoAnterior[]          // TODOS os consumos prévios neste tanque
}

interface PorcaoConsumida {
  fonteTipo: 'entrada' | 'transferencia'
  fonteId: string
  fonteDataHora: string         // pra UI mostrar "Lote de DD/MM HH:MM"
  saldoAntesDoConsumo: number   // pra UI mostrar "saldo do lote antes desta operação"
  litros: number                // litros consumidos desta operação
  preco: number                 // preço unitário do lote
}

interface FIFOResult {
  precoMedio: number
  detalhamento: PorcaoConsumida[]
  litrosSemSuprimento: number
}
```

Algoritmo permanece igual; apenas substitui `saidasAnteriores.filter(...)` por `consumosAnteriores.filter(c => c.tanqueId === tanqueId && c.data < dataHora)`.

Novidades em `PorcaoConsumida`: `fonteDataHora` + `saldoAntesDoConsumo` (necessários pra UI).

### Backend RPCs

#### `registrar_saida_combustivel_fifo` (existente, leve mudança)

- Insert em `consumos_lote` com `consumo_tipo='saida'` (em vez de `saidas_lotes` direto)
- Aceita carreta normalmente: cliente passa `preco_unitario` externo no payload; FIFO só popula `consumos_lote` pra contabilizar saldo. **Não sobrescreve** `preco_unitario` quando tipo_consumidor='carreta_transportadora'.

#### `registrar_transferencia_fifo` (NOVA)

Inputs: payload transferência + `lotes` (porções consumidas no source) + `litros_sem_suprimento`.

Comportamento:
1. INSERT em `transferencias_combustivel` — `valor_total = SUM(lotes.litros × lotes.preco_lote)` (computado server-side, ignora qualquer valor enviado pelo cliente)
2. INSERT N rows em `consumos_lote` com `consumo_tipo='transferencia_out'`, `consumo_id=transf.id`
3. IF `litros_sem_suprimento > 0` → registrar em `saidas_sem_suprimento`? **Decisão:** não, pra não confundir. Criar tabela paralela `transferencias_sem_suprimento` OU reusar com coluna `consumo_tipo`. **Recomendação:** estender `saidas_sem_suprimento` → `consumos_sem_suprimento` (mesmo polimorfismo). Fica out of scope desta sessão se aumentar muito; tracking via TODO.

#### `registrar_esvaziamento_fifo` (NOVA)

Inputs: payload esvaziamento + `lotes` consumidos.

Comportamento:
1. INSERT em `esvaziamentos_tanque`
2. INSERT N rows em `consumos_lote` com `consumo_tipo='esvaziamento'`
3. **Perda monetária** = `SUM(lotes.litros × lotes.preco_lote)` — campo `valor_perda numeric` adicionado em `esvaziamentos_tanque`. Compute server-side.

### Forms

#### `SaidaCombustivelForm` (desktop) — **mudança principal de UX**

Substituir `<details>` (atual) por **card sempre visível** com o seguinte formato:

```
┌── CONSUMO FIFO ─────────────────────────────────────────┐
│  Lote 27/04 09:41  · saldo 3.832 L × R$ 6,2332 →       │
│    3.832 L = R$ 23.886,62                                │
│                                                          │
│  Lote 01/05 13:27  · saldo 5.000 L × R$ 6,7261 →       │
│       68 L = R$ 457,38                                  │
│  ─────────────────────────────────────────              │
│  Total                                3.900 L            │
│                                       R$ 24.344,00       │
│                                                          │
│  Preço médio: R$ 24.344,00 / 3.900 L = R$ 6,2421/L     │
└──────────────────────────────────────────────────────────┘
```

Por linha: **data formatada wall-clock** (sem ID críptico) + saldo restante ANTES desta saída + preço unitário × litros consumidos = subtotal. Total e fórmula do preço médio explícitos.

Quando 1 só lote: simplifica pra única linha sem o ━━━ separator.

Quando `litrosSemSuprimento > 0`: warning amarelo abaixo do card.

#### `MSaidaCombustivelPage` (mobile)

Mantém warning de sem suprimento. **Não** adiciona card detalhado (mobile não tem espaço); só mostra preço final + um indicador "FIFO" pequeno.

#### `TransferenciaForm`

Mostra card FIFO **igual ao SaidaCombustivelForm** (consumidores do source). `valor_total` agora é **calculated read-only** — não input. Submit chama RPC nova `registrar_transferencia_fifo`.

#### `EsvaziamentoForm` (verificar se existe)

Investigar na implementation. Se existir, atualizar pra mostrar card FIFO + valor da perda. Se não, criar.

### Migration backfill

Substitui o backfill anterior:

```sql
-- TRUNCATE consumos_lote (era saidas_lotes) + saidas_sem_suprimento
-- Replay considerando TODAS as 4 fontes em ordem cronológica unificada
```

Pseudo-algorithm:
```
para cada tanque T:
  lots = entradas(T) ∪ transferencias_in(T)  -- ordenados por data ASC
  consumos = saidas(T) ∪ transferencias_out(T) ∪ esvaziamentos(T)  -- ordenados por data ASC

  para cada consumo C em ordem cronológica:
    porções = FIFO(consumir C.litros dos lots)
    INSERT consumos_lote (consumo_tipo=C.tipo, consumo_id=C.id, ...porções)

    se C.tipo == 'saida' AND C.saida.tipo_consumidor == 'equipamento_proprio':
      UPDATE saida SET preco_unitario, valor_total, preco_medio_tanque_snapshot

    se C.tipo == 'transferencia_out':
      UPDATE transferencia SET valor_total = SUM(porções)
      -- audit_log entry pra rastrear o diff

    se C.tipo == 'esvaziamento':
      UPDATE esvaziamento SET valor_perda = SUM(porções)

    se faltou suprimento (porções.litros < C.litros):
      INSERT consumos_sem_suprimento (ou saidas_sem_suprimento estendida)
```

Triggers desabilitados via `session_replication_role = 'replica'` durante o backfill.

### Reconciliação automática pós-backfill

Query de validação:

```sql
-- Pra cada tanque, saldo FIFO deve == saldo físico
SELECT
  d.id, d.nome,
  saldo_fifo,
  saldo_fisico,
  (saldo_fifo - saldo_fisico) AS diff
FROM depositos d
JOIN LATERAL (
  -- saldo FIFO = sum saldo restante de lots ativos
  SELECT COALESCE(SUM(litros_original - COALESCE(consumido, 0)), 0) AS saldo_fifo
  FROM (lots do tanque com consumo agregado)
) f ON true
JOIN LATERAL (
  -- saldo físico
  SELECT (
    (SELECT COALESCE(SUM(quantidade_litros),0) FROM entradas_combustivel WHERE deposito_id=d.id AND deleted_at IS NULL)
    + (SELECT COALESCE(SUM(quantidade_litros),0) FROM transferencias_combustivel WHERE deposito_destino_id=d.id AND deleted_at IS NULL)
    - (SELECT COALESCE(SUM(litros),0) FROM saidas_combustivel WHERE tanque_id=d.id AND deleted_at IS NULL)
    - (SELECT COALESCE(SUM(quantidade_litros),0) FROM transferencias_combustivel WHERE deposito_origem_id=d.id AND deleted_at IS NULL)
    - (SELECT COALESCE(SUM(litros_descartados),0) FROM esvaziamentos_tanque WHERE deposito_id=d.id)
  ) AS saldo_fisico
) p ON true
WHERE ABS(saldo_fifo - saldo_fisico) > 0.01;
```

Diff > 0.01L = bug ou dados inconsistentes. Reportar.

---

## Out of scope desta sessão

- **`consumos_sem_suprimento` polymorphic** (estender `saidas_sem_suprimento`): adia. Se backfill detectar transferência sem suprimento, log apenas em `audit_log` por enquanto.
- **UI relatório lote-por-operação** pra transferências/esvaziamentos: similar ao card de saída. Pode ser feito numa segunda passada.
- **Validação hard de saldo no momento do form** (bloquear submit se faltar saldo): adia. Só warning visual por enquanto.
- **Re-uso da função SQL `recalcular_nivel_deposito`**: existe e calcula saldo físico já — depois desta migração devem convergir. Sem mudar a função em si.

---

## Testes

- `fifoCombustivel.test.ts` (existente) — atualizar 8 testes pra nova signature + adicionar:
  - Teste: consumo anterior tipo `transferencia_out` reduz saldo correto
  - Teste: consumo anterior tipo `esvaziamento` reduz saldo correto
  - Teste: ordem cronológica mistura saídas + transf out + esvaziamentos
  - Teste: `PorcaoConsumida.saldoAntesDoConsumo` reflete consumos prévios

- Reconciliação SQL pós-backfill: assert 0 tanques com diff > 0.01

---

## Plano em alto nível (pra entrar em writing-plans)

1. Branch `fix/combustivel-fifo-completo`
2. Migration rename+polymorphic `consumos_lote` + view backward-compat
3. Update helper TS + tests (TDD)
4. Update RPC `registrar_saida_combustivel_fifo` (mínima)
5. Migration: adicionar `valor_perda` em esvaziamentos_tanque
6. RPC nova `registrar_transferencia_fifo`
7. RPC nova `registrar_esvaziamento_fifo`
8. Update `SaidaCombustivelForm` desktop — card FIFO sempre visível
9. Update `TransferenciaForm` — card FIFO + valor_total read-only + nova RPC
10. Investigar/atualizar/criar `EsvaziamentoForm`
11. Update `MSaidaCombustivelPage` mobile — só sinaliza FIFO
12. Migration backfill (TRUNCATE + replay) atomic
13. Migration de reconciliação automática + assert
14. Build + security review + deploy

---

## Critérios de aceitação

- Sum saldos lots ativos == saldo físico em **TODOS os tanques** (validação SQL post-backfill).
- Card FIFO no `SaidaCombustivelForm` desktop visível sem cliques, mostrando data, saldo antes, preço, subtotal, total e fórmula.
- Carretas registram em `consumos_lote` mas preservam preço externo na `saidas_combustivel`.
- Transferências computam `valor_total` server-side via FIFO (form mostra read-only).
- Esvaziamentos têm `valor_perda` populado.
- Backfill sem `transferencias_sem_suprimento` perdido (audit_log captura).
- 11+ testes vitest do helper passing.
