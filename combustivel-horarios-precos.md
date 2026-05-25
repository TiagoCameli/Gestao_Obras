# Combustível — Análise Focada: Horários & Preços

**Data:** 2026-05-23
**Escopo:** Investigação aprofundada de 2 temas do `combustivel-audit.md` com dados reais do banco. Read-only.
**Método:** Síntese do audit + queries diagnósticas Supabase + leitura de código (`SaidaCombustivelForm`, `MSaidaCombustivelPage`, helpers, hooks). Nenhuma alteração feita.

## Sumário Executivo

Os bugs históricos de PREÇO já estão fechados em produção (HF.5 + backfill HF.10/HF.11): **zero registros com `preco_unitario = 0`** no banco e R$ 0 de perda financeira mensurável. A integridade temporal também está limpa: **zero `data_hora` no futuro** e nenhum formato inválido em entradas/transferências. Os achados reais que ainda merecem ação:

1. **56 saídas com `preco_medio_tanque_snapshot = 0`** (5,5% das saídas via tanque) — `preco_unitario` final está correto mas o snapshot histórico ficou zerado; comprometendo rastreabilidade contábil
2. **200 saídas (19,6%) sem entrada/transferência anterior na linha do tempo** — saldo inicial dos tanques nunca foi formalizado em `entradas_combustivel`, então saídas antigas "saem do nada" no histórico contábil
3. **62% dos lançamentos são retroativos > 30 dias** — uso massivo de digitalização de papel; sem trigger restringindo retroatividade
4. **Timezone é cego ao fuso local** — UTC gravado no banco como se fosse local; horário exibido depende do device (browser em BRT mostra +3h, browser em UTC mostra 0h). Operadores em Acre veriam ainda outra hora
5. **Método de custeio vitalício distorce custo corrente em ~2,6%** vs janela móvel 30d. Spread total entre FIFO e LIFO em 90d num tanque é **R$ 30.125** (8,5% do consumo)
6. **Bug "Ramal do Gama" é DADOS** — a obra simplesmente não tem etapas cadastradas no banco. Hipótese (a) confirmada. Sem alteração de código necessária

---

## Parte A — Resumo do que já sabemos (síntese do audit)

### A.1 HORÁRIOS — achados já documentados

- **`data_hora` como `text`** (não `timestamptz`) em `entradas_combustivel` e `transferencias_combustivel`. Sem constraint de formato. §1.2 + item 15 das Recomendações (🟢 BAIXA). **Pendente.**
- **Ausência de validação de data futura.** `EntradaForm` e `MSaidaCombustivelPage` aceitam qualquer data. §2.1 + §2.2 edge cases. **Pendente.**
- **Mobile sem campo de data/hora visível** — `MSaidaCombustivelPage` não exibe o campo; usa `new Date().toISOString()` invisível. §2.2. (Por design.)
- **Dois triggers de `updated_at` em `saidas_combustivel`** (redundante). §1.2 + item 15. **Pendente.**
- **Colunas `foto_urls`, `arquivo_urls`, `deleted_at` de `transferencias_combustivel` sem migration** — adicionadas via dashboard. Bug T4. **Pendente.**

### A.2 PREÇOS DE EQUIPAMENTO PRÓPRIO — achados já documentados

| # | Achado | Estado |
|---|---|---|
| S1 | Mobile mandava `tipo_consumidor='equipamento'` (CHECK violation → INSERT silenciosamente falhava) | ✅ Corrigido (HF.5) |
| S2 | Mobile gravava `preco_unitario=0` e `valor_total=0` hardcoded | ✅ Corrigido (HF.5) |
| S4 | Mobile gravava `preco_medio_tanque_snapshot=null` | ✅ Corrigido (HF.5) |
| C1 | Preço médio vitalício (sem corte temporal) — distorce custo corrente | ⏳ Pendente (decisão de negócio: FIFO/janela/manter) |
| C2 | Preço médio ignorava transferências recebidas → tanque que só recebia via transf ficava com preço 0 | ✅ Corrigido (HF.6 — helper `calcularPrecoMedioTanque`) |
| C3 | `recalcular_nivel_deposito` não filtrava `deleted_at` | ✅ Corrigido (HF.1) |
| C4 | Edição manual de `preco_unitario` não atualiza `preco_medio_tanque_snapshot` | ⏳ Pendente (mitigado por HF.11 snapshot imutável) |

---

## Parte B — Impacto real (queries de diagnóstico)

### B.1 — Registros com `preco_unitario = 0` ou `valor_total = 0`

#### B.1.a Total

```sql
SELECT
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE preco_unitario = 0) AS preco_unit_zero,
  COUNT(*) FILTER (WHERE valor_total = 0) AS valor_zero,
  COUNT(*) FILTER (WHERE preco_unitario = 0 AND valor_total = 0) AS ambos_zero
FROM public.saidas_combustivel
WHERE deleted_at IS NULL;
```

| total | preco_unit_zero | valor_zero | ambos_zero |
|---|---|---|---|
| 1135 | **0** | **0** | **0** |

**Bug S2 erradicado.** Os fixes HF.5 + HF.10/HF.11 limparam todos os registros legados.

#### B.1.b Por origem

| origem | total | preco_zero |
|---|---|---|
| tanque | 1020 | 0 |
| requisicao | 102 | 0 |
| dinheiro | 13 | 0 |

#### B.1.c Por tipo_consumidor

| tipo_consumidor | total | preco_zero |
|---|---|---|
| equipamento_proprio | 898 | 0 |
| carreta_transportadora | 237 | 0 |

#### B.1.d Por mês (últimos 12 meses)

| mês | total | preco_zero |
|---|---|---|
| 2026-05 | 175 | 0 |
| 2026-04 | 272 | 0 |
| 2026-03 | 132 | 0 |
| 2026-02 | 102 | 0 |
| 2026-01 | 108 | 0 |
| 2025-12 | 121 | 0 |
| 2025-11 | 207 | 0 |
| 2025-10 | 18 | 0 |

Cobertura de 8 meses (out/25 → mai/26), pico em abril/26. Sem zerados em nenhum período.

### B.2 — Snapshot NULL ou 0 quando origem = tanque

```sql
SELECT
  COUNT(*) AS deveriam_ter_snapshot,
  COUNT(*) FILTER (WHERE preco_medio_tanque_snapshot IS NULL) AS sem_snapshot,
  COUNT(*) FILTER (WHERE preco_medio_tanque_snapshot = 0) AS snapshot_zero
FROM public.saidas_combustivel
WHERE deleted_at IS NULL AND origem = 'tanque' AND tanque_id IS NOT NULL;
```

| deveriam_ter_snapshot | sem_snapshot | snapshot_zero |
|---|---|---|
| 1020 | **0** | **56** |

**Achado relevante:** 56 saídas (5,5% das 1020 via tanque) têm `preco_medio_tanque_snapshot = 0` — apesar do `preco_unitario` final estar correto. Esses registros foram corrigidos em algum momento pós-backfill (provavelmente edição manual) mas o snapshot ficou zerado. Comprometeria reconciliação histórica caso fosse usado pra recálculo retroativo.

### B.3 — Valor financeiro perdido pelo bug S2

```sql
WITH zerados AS (
  SELECT id, tanque_id, litros, valor_total
  FROM public.saidas_combustivel
  WHERE deleted_at IS NULL AND preco_unitario = 0 AND tanque_id IS NOT NULL
),
preco_atual AS (
  SELECT e.deposito_id AS tanque_id,
    SUM(e.valor_total) / NULLIF(SUM(e.quantidade_litros), 0) AS preco_atual
  FROM public.entradas_combustivel e
  WHERE e.deleted_at IS NULL
  GROUP BY e.deposito_id
)
SELECT COUNT(*) AS qtd, SUM(z.litros) AS litros_totais,
  ROUND(SUM(z.litros * COALESCE(p.preco_atual, 0))::numeric, 2) AS valor_correto_brl,
  ROUND((SUM(z.litros * COALESCE(p.preco_atual, 0)) - SUM(z.valor_total))::numeric, 2) AS perda_brl
FROM zerados z LEFT JOIN preco_atual p ON p.tanque_id = z.tanque_id;
```

| qtd | litros_totais | valor_correto_brl | perda_brl |
|---|---|---|---|
| 0 | NULL | NULL | NULL |

**Perda financeira: R$ 0.** Zero registros a corrigir hoje.

### B.4 — `data_hora` em formato inválido (entradas e transferências)

```sql
SELECT 'entradas' AS tabela,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE data_hora IS NULL OR data_hora = '') AS vazios,
  COUNT(*) FILTER (WHERE NOT (data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}')) AS formato_invalido
FROM public.entradas_combustivel WHERE deleted_at IS NULL
UNION ALL
SELECT 'transferencias', COUNT(*),
  COUNT(*) FILTER (WHERE data_hora IS NULL OR data_hora = ''),
  COUNT(*) FILTER (WHERE NOT (data_hora ~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}'))
FROM public.transferencias_combustivel WHERE deleted_at IS NULL;
```

| tabela | total | vazios | formato_invalido |
|---|---|---|---|
| entradas | 14 | 0 | 0 |
| transferencias | 2 | 0 | 0 |

Todos os `data_hora` válidos no formato `YYYY-MM-DDTHH:MM`.

### B.5 — `data_hora` no futuro

| tabela | futuras |
|---|---|
| saidas | **0** |
| entradas | **0** |
| transferencias | **0** |

Integridade temporal OK em todas as 3 tabelas.

### B.6 — Saídas anteriores a qualquer suprimento

```sql
SELECT COUNT(*) AS saidas_sem_suprimento_anterior
FROM public.saidas_combustivel s
WHERE s.deleted_at IS NULL AND s.tanque_id IS NOT NULL AND s.origem = 'tanque'
  AND NOT EXISTS (
    SELECT 1 FROM public.entradas_combustivel e
    WHERE e.deposito_id = s.tanque_id AND e.deleted_at IS NULL
      AND e.data_hora ~ '^\d{4}-\d{2}-\d{2}' AND e.data_hora::timestamp <= s.data
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.transferencias_combustivel t
    WHERE t.deposito_destino_id = s.tanque_id AND t.deleted_at IS NULL
      AND t.data_hora ~ '^\d{4}-\d{2}-\d{2}' AND t.data_hora::timestamp <= s.data
  );
```

| saidas_sem_suprimento_anterior |
|---|
| **200** |

**Achado crítico:** 200 saídas (19,6% das 1020 via tanque) não têm nenhuma entrada/transferência anterior em `data_hora`. Causas prováveis: (a) saldo inicial dos tanques nunca foi registrado via `entradas_combustivel`; (b) entradas lançadas com data muito posterior à criação real do estoque; (c) migração incompleta de dados históricos. Compromete FIFO point-in-time e qualquer reconstrução histórica.

---

## Parte C — Deep dive em HORÁRIOS

### C.1 — Timezone

**Schema:**
- `saidas_combustivel.data` → `timestamp with time zone`
- `entradas_combustivel.data_hora` → `text`
- `transferencias_combustivel.data_hora` → `text`

**Amostra `saidas_combustivel.data` (UTC vs BRT):**

| id | data (banco) | em_utc | em_brt |
|---|---|---|---|
| mph3e4dt30geg | 2026-05-21 14:43:00+00 | 14:43 | 11:43 |
| mph3d19c8li9o | 2026-05-21 14:50:00+00 | 14:50 | 11:50 |
| mph3a0f8zo4d3 | 2026-05-21 17:15:00+00 | 17:15 | 14:15 |

**Observação crítica:** O banco grava em UTC, mas os horários terminam em `:00` (minuto exato) → o app envia o valor do `<input type="datetime-local">` sem offset, e o Postgres interpreta como UTC. Uma saída registrada às "14:43" pelo operador foi gravada como `14:43 UTC`, que corresponde a `11:43 BRT`. **Há 3h de defasagem implícita** para operadores em BRT — visualmente eles vêem o horário correto, mas o que está armazenado não é a hora local.

**Exibição:** `fmtData` em `SaidaCombustivelListV2.tsx:54-59` usa `new Date(iso).getHours()` — exibe na timezone do device do browser. Sem `Intl.DateTimeFormat({timeZone:'America/Sao_Paulo'})`. **Fuso-dependente do dispositivo.**

**Formato `data_hora` (text):** Amostra: `2026-05-20T04:25`, `2026-05-20T12:58`, `2026-05-18T13:00`. Padrão `YYYY-MM-DDTHH:MM` — sem segundos, sem offset.

### C.2 — Fonte da hora

**Desktop (`SaidaCombustivelForm.tsx`, linha 126):**
```ts
defaultValues: {
  data: (initial?.data ?? new Date().toISOString()).slice(0, 16),
  ...
}
```
- Novo: `new Date().toISOString()` (UTC) → `.slice(0, 16)` → `"2026-05-21T14:43"` cortado.
- Edição: lê `initial.data` (com offset `+00:00`), corta pra 16 chars.
- Submit (linha 514-515): `formData.data + ':00'` → Postgres recebe `"2026-05-21T14:43:00"` → grava como UTC.
- **Operador BR vê "14:43" mas o gravado é `14:43 UTC` (=`11:43 BRT`).**

**Mobile (`MSaidaCombustivelPage.tsx`, linha 155):**
```ts
const agora = new Date().toISOString();
// ...
data: agora,
```
- Sem campo visível ao usuário. Sempre `now()` no momento do clique.
- Hora gravada é **realmente UTC do momento do registro** (correto).

**Edição manual:** Campo `datetime-local` sem `min`/`max`. Aceita qualquer data passada ou futura. Validação só de saldo do tanque na data escolhida (`calcularEstoqueCombustivelNaData`).

### C.3 — Lançamento retroativo

**Triggers/checks bloqueando retroatividade?** **Nenhum.** Só validação de saldo, não de janela temporal.

**Distribuição `created_at − data` (últimos 1000 registros):**

| Faixa | Qtd | % |
|---|---|---|
| 0-1h (tempo real) | 10 | 1% |
| 1-24h (mesmo dia) | 85 | 8,5% |
| 1-7d (mesma semana) | 80 | 8% |
| 7-30d (mês) | 207 | 20,7% |
| **> 30d (retroativo antigo)** | **618** | **61,8%** |

**Conclusão:** 62% dos registros são lançados com mais de 30 dias de retraso. O módulo é usado majoritariamente para **digitalização retroativa** de registros físicos, não em tempo real.

### C.4 — Sequência fora de ordem

```sql
WITH ordem AS (
  SELECT s.id, s.tanque_id, s.data, s.created_at,
    LAG(s.data) OVER (PARTITION BY s.tanque_id ORDER BY s.created_at) AS data_anterior_criada
  FROM public.saidas_combustivel s
  WHERE s.deleted_at IS NULL AND s.tanque_id IS NOT NULL
)
SELECT COUNT(*) AS total_fora_ordem, COUNT(DISTINCT tanque_id) AS tanques_afetados
FROM ordem WHERE data < data_anterior_criada;
```

| total_fora_ordem | tanques_afetados |
|---|---|
| 294 | 4 |

294 registros foram inseridos com `created_at` mais novo, mas `data` mais antiga do que a saída imediatamente anterior. Em 4 tanques distintos. Esperado dado C.3 (62% retroativo), mas impacta cálculos baseados em `ORDER BY data` (FIFO, snapshot por data).

### C.5 — Audit trail de edição de horário

**Trigger `trg_audit_saidas` AFTER INSERT/UPDATE/DELETE** existe. Grava em `public.audit_log` (colunas: `id, tipo, funcionario_id, alvo_id, detalhes (text), data_hora (timestamptz)`). O campo `detalhes` armazena diff JSON serializado como text.

**Mudanças do campo `data` ficam rastreadas?** **SIM.** A função `audit_combustivel_log` calcula diff via:
```sql
SELECT jsonb_object_agg(key, jsonb_build_object('old', old_val, 'new', new_val))
FROM jsonb_object_keys(to_jsonb(NEW)) k
WHERE old_val IS DISTINCT FROM new_val AND key NOT IN ('updated_at', 'updated_by');
```

**Exemplo real (registro `al_1779482252_ee479bb2`):**
```json
{
  "data": {"old": "2026-05-18T22:56:00+00:00", "new": "2026-05-18T17:56:00+00:00"},
  "litros": {"old": 188.000, "new": 40.000},
  "valor_total": {"old": 1164.37, "new": 247.74}
}
```

Tiago de Melo Cameli editou em 2026-05-22 20:37 UTC. Audit preserva before/after completo. **Risco de ajustar hora pra esconder consumo: BAIXO** porque qualquer edição fica logada.

### C.6 — Foto com EXIF

**Os abastecimentos têm fotos?** Sim. Maioria vem do WhatsApp (filenames `WhatsApp_Image_2026-05-22_at_10.41.49.jpeg`). Não capturadas pelo app — importadas da galeria.

**EXIF preservado?** **NÃO.**
- **Câmera (capture="environment"):** `AnexosUploader.tsx:92-129` chama `stampImage()` → render em canvas → `canvas.toBlob(..., 'image/jpeg', 0.92)`. Canvas **destrói EXIF**.
- **Galeria:** envia File original sem processamento (`fromCamera = false`). EXIF **pode** ser preservado mas depende do browser; alguns strip EXIF em `FileList`.
- Nenhuma biblioteca EXIF (`exifr`, `piexifjs`) em todo o pipeline.

**Watermark visual:** `stampImage` desenha rodapé com timestamp local + GPS no canvas. Pixels, não metadado. `fmtDateTimeLocal(time)` usa `d.getHours()` (local do device).

**Conclusão:** Sem `DateTimeOriginal` EXIF, não dá pra comparar programaticamente foto vs `data`. Só visual.

---

## Parte D — Deep dive em PREÇO

### D.1 — Fluxo do preço (Desktop)

`src/components/combustivel/SaidaCombustivelForm.tsx` (já em RHF+Zod, HF.5/6/11):

**1. Hooks que lêem dados:**
- `entradasCombustivel` chega como prop (sem filtro de período — todas as ativas).
- `transferencias = useTransferenciasCombustivel()` (linha 180) — todas ativas.

**2. Cálculo (linha 256-259):**
```tsx
const precoMedioTanqueCorrente = useMemo(() => {
  if (origem !== 'tanque' || !tanqueId) return 0;
  return calcularPrecoMedioTanque(tanqueId, entradasCombustivel, transferencias);
}, [origem, tanqueId, entradasCombustivel, transferencias]);
```

`calcularPrecoMedioTanque` (`src/utils/precoMedioTanque.ts`):
- `entradas` com `depositoId === tanqueId` → soma litros + valor
- `transferencias` com `depositoDestinoId === tanqueId` → soma litros + valor
- Retorna `totalValor / totalLitros` (vitalício ponderado)

**3. Snapshot vs corrente (HF.11):** Em edit mode com tanque/origem não modificados, usa `initial.precoMedioTanqueSnapshot` salvo (linha 263-273).

**4. Preço final (linha 315-320):**
```tsx
const precoUnitario =
  origem === 'tanque'
    ? precoMedioTanque + taxaLitro  // taxaLitro = 0 pra equipamento próprio
    : precoUnitarioManual;
```

**5. Grava no insert:**
- `precoUnitario` (linha 553)
- `precoMedioTanqueSnapshot = precoMedioTanque` (linha 542)
- `valorTotal = litros * precoUnitario` (linha 497)

### D.2 — Fluxo do preço (Mobile)

`src/pages/mobile/MSaidaCombustivelPage.tsx` (HF.5 aplicado).

**1. Hooks (linhas 57-58):**
```tsx
const { data: entradasCombustivel = [] } = useEntradasCombustivel();
const { data: transferencias = [] } = useTransferenciasCombustivel();
```

**2. Cálculo (linhas 92-95):**
```tsx
const precoMedioTanque = useMemo(() => {
  if (!tanqueId) return 0;
  return calcularPrecoMedioTanque(tanqueId, entradasCombustivel, transferencias);
}, [tanqueId, entradasCombustivel, transferencias]);
```

Mesmo helper do desktop.

**3. Grava (linhas 156, 174-177):**
```tsx
const valorTotal = litrosNum * precoMedioTanque;
// ...
precoUnitario: precoMedioTanque,
precoMedioTanqueSnapshot: precoMedioTanque,
valorTotal,
```

**Bug S2 corrigido? SIM.** Cabeçalho do arquivo (linhas 8-15) documenta os fixes S1-S6. Confirmado por inspeção: `precoUnitario` e `valorTotal` são calculados, não mais hardcoded 0.

### D.3 — Preço médio atual por tanque

| tanque | estoque (L) | última entrada | preço vitalício | preço 30d | diff % |
|---|---|---|---|---|---|
| Meloza Colorado | 3.095 | 2026-05-20 12:58 | R$ 6,2943 | R$ 6,4571 | **+2,59%** |
| Meloza EMT | 4.000 | 2026-05-20 04:25 | R$ 6,2313 | R$ 6,3448 | **+1,82%** |
| Tanque Canteiro 1 | 9.275 | 2026-05-18 13:00 | R$ 6,7022 | R$ 6,7841 | **+1,22%** |
| Transterra Areacre | 0 | — | NULL | NULL | NULL (externo) |
| Tanque Canteiro 2 | 15.000 | 2026-05-18 13:00 | R$ 6,5323 | R$ 6,5323 | 0,00% |

**Observações:**
- Todos os tanques com histórico mostram inflação recente leve (+1,2% a +2,6%) — método vitalício subestima custo corrente.
- Transterra Areacre: tanque externo, sem `entradas_combustivel` próprias (preço cobrado é input manual).
- Canteiro 2: diff = 0 (provavelmente entradas só na mesma data).

### D.4 — Tanques com preço médio = 0

| tanque_id | nome | nivel | qtd_entradas | qtd_transf | causa |
|---|---|---|---|---|---|
| `mori6yyt9owm9` | Transterra Areacre | 0 | 0 | 0 | **Tanque externo** (`eh_externo=true`). Não recebe entradas diretas — preço é input manual `precoCombustivelAreacre`. By design, sem risco de bug. |

**1 de 5 tanques ativos (20%)** com preço médio = 0, mas por razão correta de modelagem.

### D.5 — Comparativo de métodos de custeio (Meloza Colorado, 90 dias)

**Tanque mais consumido nos últimos 90 dias:** Meloza Colorado (`mmjak3d05dfun`) — 58.747 L consumidos.

| Método | Custo (R$) | Diff vs Atual |
|---|---|---|
| **Atual (vitalício + transf)** | **R$ 369.773,66** | baseline |
| Média móvel 30d | R$ 379.336,16 | **+2,59%** (+R$ 9.562) |
| FIFO (entrada mais antiga até a data) | R$ 354.212,45 | **−4,21%** (−R$ 15.561) |
| LIFO (entrada mais recente até a data) | R$ 384.337,60 | **+3,94%** (+R$ 14.564) |

**Spread total FIFO ↔ LIFO em 90d: R$ 30.125,15 (8,5% do consumo).**

**Interpretação:**
- O método **vitalício** atual fica entre FIFO e a média 30d — defensável contabilmente mas subestima custo de reposição corrente.
- **FIFO** é o mais "barato" — usa preços antigos, gerencialmente otimista demais.
- **LIFO** é o mais conservador — reflete custo de reposição imediata.
- **Média móvel 30d** é o "meio termo": +2,59% vs atual, ainda baseado em ponderado mas com janela representativa.

### D.6 — Histograma de preços (equipamento_proprio)

| Faixa R$/L | Qtd | % |
|---|---|---|
| 6,00–6,99 | **783** | 87,2% |
| 7,00–9,99 | 114 | 12,7% |
| 10,00–19,99 | 1 | 0,1% |
| 0 (BUG) | 0 | — |
| < R$ 1 (suspeito) | 0 | — |
| ≥ R$ 20 (suspeito) | 0 | — |

**Total 898 saídas equipamento_proprio.** Distribuição saudável, sem outliers extremos. O único registro em R$ 10-19,99 é marginal (provavelmente período com preço atípico distorcendo média vitalícia).

### D.7 — Impacto nos relatórios

Lugares que mostram "custo total combustível":

| Componente | Como soma | Filtra `precoUnitario > 0`? |
|---|---|---|
| `KpisRow.tsx` (KPI visão geral) | `custo += s.valorTotal` (linha 110) | ❌ |
| `KpisRowObras.tsx` | `cur.custo += s.valorTotal` (linha 42) | ❌ |
| `ObrasRankingTable.tsx` | Soma `s.valorTotal` por `obraId` | ❌ |
| `MensalConsolidadoModal.tsx` | Filtra por mês via `s.data.slice(0, 7)` | ❌ |

**Nenhum filtra `precoUnitario > 0`.** Mas dado B.1 (zero registros zerados), nenhum seria excluído mesmo se filtrasse.

### D.8 — Bug "Ramal do Gama" (etapas não aparecem)

**Investigação em ordem das hipóteses:**

#### (a) DADOS — **CULPADA**

```sql
SELECT id, nome FROM public.obras WHERE nome ILIKE '%ramal%gama%';
-- id: c5f6493a-5921-434c-93c5-f3a14cd2e428
-- nome: 003 - Recuperação do Ramal do Gama

SELECT COUNT(*) FROM public.etapas_obra WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428';
-- qtd_etapas: 0
```

**A obra "Ramal do Gama" tem ZERO etapas cadastradas no banco.** Bug é puramente de dados — não é bug de código.

#### Hipóteses (b)–(f) descartadas:

- **(b) Soft-delete:** Tabela `etapas_obra` **não tem `deleted_at` nem `ativo`** (schema confirmado). Não existe soft-delete.
- **(c) Query/Hook:** `useEtapas` (`src/hooks/useEtapas.ts:10`) faz `SELECT *` sem filtro além de `obra_id`.
- **(d) RLS:** Policy única `"Authenticated full access" | cmd=ALL | qual=true` — sem restrição.
- **(e) UI:** `SaidaCombustivelForm.tsx:248-251` faz `etapasDaObra = etapas.filter(e => e.obraId === obraId)` — sem filtro adicional.
- **(f) Evento:** `useEffect` linha 742 reseta `etapaId` ao mudar `obraId`; `useMemo` de `etapasDaObra` tem `[etapas, obraId]` nas deps — correto.

#### Schema `etapas_obra`

| coluna | tipo | nullable |
|---|---|---|
| id | text | NO |
| nome | text | NO |
| obra_id | text | NO |
| unidade | text | NO |
| quantidade | numeric | NO |
| valor_unitario | numeric | NO |
| criado_por | text | NO |

#### Comparativo — obras que funcionam

| obra | qtd_etapas |
|---|---|
| 009 - Manutenção de Rodovia BR-364 (Lote - 09) | 265 |
| Empresa AMZ | 1 |
| Empresa EMT | 1 |
| **003 - Recuperação do Ramal do Gama** | **0** |

#### Outras obras afetadas

**Apenas Ramal do Gama** (1 de 4 obras no banco). Ela também tem 0 saídas — provavelmente foi criada mas nunca operacionalizada.

#### Proposta de fix

**Sem alteração de código.** Correção operacional: acessar a tela de cadastro/edição da obra "003 - Recuperação do Ramal do Gama" e inserir as etapas via fluxo normal (`useSalvarEtapasObra` faz DELETE + INSERT por `obra_id`). Se a obra ainda não tem etapas contratuais, criar pelo menos uma genérica ("Execução Geral") pra liberar o fluxo de saída. **Risco: zero** — só inserção de dados. **Teste:** após inserir, abrir `SaidaCombustivelForm`, selecionar Ramal do Gama, confirmar dropdown popula.

---

## Parte E — Recomendações específicas

### E.1 — Horários (plano de correção)

| # | Ação | Esforço | Prioridade |
|---|---|---|---|
| 1 | **Migrar `data_hora` text → timestamptz** em `entradas_combustivel` e `transferencias_combustivel`. Tratamento: usar `data_hora::timestamp AT TIME ZONE 'America/Sao_Paulo'` ou `AT TIME ZONE 'UTC'` (decidir convenção). 0 registros inválidos (B.4) → migração limpa. | 2-3h | 🟡 |
| 2 | **Trigger DB `data <= now() + interval '24 hours'`** em saidas/entradas/transferencias — janela permissiva pra evitar erros de digitação grossos sem bloquear retroatividade legítima. | 1h | 🟡 |
| 3 | **Fixar timezone no display** — usar `Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' })` em todo `fmtData`/`fmtDataHora` em vez de `d.getHours()`. Garante que operadores em qualquer timezone vejam horário BRT consistente. | 2h | 🟡 |
| 4 | **Convenção de input** — desktop converte `<input datetime-local>` (sem offset) pra ISO BRT antes de salvar (em vez de assumir UTC). Documentar e padronizar. | 2-3h | 🟡 |
| 5 | **Audit trail de `data` já funciona** (C.5). Sem ação. | — | ✅ |
| 6 | **Dropar 1 dos 2 triggers `updated_at`** redundantes em saidas_combustivel. | 15min | 🟢 |

### E.2 — Preço de equipamento próprio (plano de correção)

| # | Ação | Esforço | Prioridade |
|---|---|---|---|
| 1 | **Bug S2 já corrigido** (B.1, B.3 = 0). Sem ação. | — | ✅ |
| 2 | **Re-backfill dos 56 snapshots = 0** (B.2) — rodar HF.10 novamente com filtro `preco_medio_tanque_snapshot = 0` (em vez de só `preco_unitario != computed`). | 1h | 🟡 |
| 3 | **Decisão FIFO vs janela móvel vs vitalício** — ver D.5. **Recomendação: migrar pra média móvel 30 dias.** Razão: reflete custo de reposição corrente (+2,59% vs atual = R$ 9.562 em 90d num tanque), simples de implementar (já temos `calcularPrecoMedioTanque` — só adicionar parâmetro `desdeData = now() - 30d`), evita complexidade de FIFO sem perder accuracy. Custo zero pra implementar. | 4-6h (helper + form + tests) | 🔴 |
| 4 | **Tela admin "Recálculo de preço"** — botão pra recalcular preço médio de cada tanque com método escolhido, ver preview antes/depois, aplicar com confirmação. | 4-6h | 🟢 |
| 5 | **Bug "Ramal do Gama"** (D.8) — inserir etapas na obra via UI normal. **Sem código.** | 30min operacional | 🔴 (UX bloqueante) |
| 6 | **Compensar saídas "sem suprimento anterior"** (B.6 — 200 saídas) — opção: criar entradas "estoque inicial" retroativas com data anterior; OU aceitar como histórico imutável e documentar limitação. | 4-8h | 🟡 |

### E.3 — Ordem de execução priorizada

| Ordem | Ação | Por quê |
|---|---|---|
| 1 | **Inserir etapas em Ramal do Gama** (E.2 #5) | UX bloqueante imediato, 30min operacional |
| 2 | **Re-backfill 56 snapshots = 0** (E.2 #2) | Tampa lacuna que pode confundir auditoria futura, 1h |
| 3 | **Decisão de método de custeio + migrar pra 30d** (E.2 #3) | Maior impacto financeiro/gerencial (~R$ 9.5k/90d num tanque), 4-6h |
| 4 | **Migrar `data_hora` → timestamptz + timezone fix display** (E.1 #1+#3) | Resolve confusion de fuso de uma vez, 4-5h |
| 5 | **Trigger anti-futuro + dropar trigger updated_at duplicado** (E.1 #2+#6) | Polish defensivo, 1h15 |
| 6 | **Compensar 200 saídas sem suprimento OU documentar** (E.2 #6) | Histórico migrado — debate sobre purismo contábil vs pragmatismo |
| 7 | **Tela admin de recálculo** (E.2 #4) | Quality of life pra contabilidade futura |

---

## Apêndice — Como reproduzir

Todas as queries acima rodam direto no Supabase MCP via `mcp__plugin_supabase_supabase__execute_sql`. Schema e RLS conferíveis via `list_tables` e `pg_policies`. Código TS referenciado em `file:line` apontado nas seções D.1/D.2/D.8.

Audit fonte: [`combustivel-audit.md`](./combustivel-audit.md)
Plano implementação dos HF: [`docs/superpowers/plans/2026-05-21-combustivel-high-risk-fixes.md`](./docs/superpowers/plans/2026-05-21-combustivel-high-risk-fixes.md)
