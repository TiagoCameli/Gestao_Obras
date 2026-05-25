# Findings — Etapas da obra "Ramal do Gama" não aparecem em SaidaCombustivelForm

**Data:** 2026-05-23
**Branch:** `fix/combustivel-etapas-ramal-gama`
**Plano:** `docs/superpowers/plans/2026-05-23-combustivel-etapas-ramal-gama.md`
**Tarefa:** RG.1 (investigação aprofundada)

---

## Contexto

- Usuário relatou: cadastrou etapas para a obra **"003 - Recuperação do Ramal do Gama"** via Cadastros de Obras, porém o dropdown de etapas no `SaidaCombustivelForm` (saída de combustível) vem vazio para essa obra.
- Obra: `c5f6493a-5921-434c-93c5-f3a14cd2e428` — "003 - Recuperação do Ramal do Gama"

---

## Step 1 — Verificar etapas da obra em `etapas_obra`

### Query 1.a — Obra existe?
```sql
SELECT id, nome FROM public.obras WHERE nome ILIKE '%ramal%gama%';
```
**Resultado:** 1 obra
```
[{"id":"c5f6493a-5921-434c-93c5-f3a14cd2e428","nome":"003 - Recuperação do Ramal do Gama"}]
```

### Query 1.b — Quantas etapas em `etapas_obra`?
```sql
SELECT COUNT(*) FROM public.etapas_obra
WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428';
```
**Resultado:** `total_etapas = 0` (zero!)

---

## Step 2 — Etapas órfãs com nome similar?

```sql
SELECT eo.id, eo.nome, eo.obra_id, o.nome AS obra_nome
FROM public.etapas_obra eo
LEFT JOIN public.obras o ON o.id = eo.obra_id
WHERE eo.nome ILIKE '%ramal%' OR eo.nome ILIKE '%gama%' OR o.nome ILIKE '%ramal%gama%';
```

**Resultado:** 1 linha, mas é da obra **BR-364 Lote 09** (apenas porque a etapa chama "Argamassa..." — coincidência de nome contendo "gama" no fragmento "argaMAssa" não, é "areia comercial"; nada relacionado a "Ramal do Gama").
```
[{
  "id":"ea4e3e7b-a010-4c35-8153-84598b4c3dad",
  "nome":"03.14.04 - Argamassa de cimento e areia 1:4 - confecção em betoneira e lançamento manual - areia comercial",
  "obra_id":"99a8ba7d-1b26-4d19-a983-379d46ac86aa",
  "obra_nome":"009 - Manutenção de Rodovia BR-364 (Lote - 09)"
}]
```
**Conclusão:** Não há etapas órfãs ou associadas erroneamente para Ramal do Gama em `etapas_obra`. Caso B descartado.

---

## Step 3 — Search por features de import/save etapas

```bash
grep -rn "ImportEtapas\|importEtapas\|salvarEtapasObra\|useSalvarEtapasObra" src/
```

**Achados:**
- `src/components/obras/ImportEtapasModal.tsx` — componente modal de import via Excel (`onImport` callback recebe array de `EtapaObra`).
- `src/hooks/useEtapas.ts:53` — `useSalvarEtapasObra` existe (delete + reinsert em `etapas_obra`), **MAS o grep não encontrou consumidor algum** (nenhum `import` nem chamada em outros arquivos).

**Significa:** o hook que persistiria etapas em `etapas_obra` está órfão; nada o usa. O `ImportEtapasModal` também não tem importador (não há `import ImportEtapasModal` em lugar nenhum do `src/`).

---

## Step 4 — `audit_log` referencia a obra?

```sql
SELECT id, tipo, alvo_id, data_hora, detalhes
FROM public.audit_log
WHERE alvo_id::text LIKE 'c5f6493a%'
   OR detalhes::text ILIKE '%ramal%gama%'
   OR detalhes::text LIKE '%c5f6493a-5921-434c-93c5-f3a14cd2e428%'
ORDER BY data_hora DESC LIMIT 30;
```
**Resultado:** `[]` (vazio).

**Conclusão:** Nenhuma operação registrada de mexer em `etapas_obra` para essa obra. Confirma que o caminho `etapas_obra` nunca foi tocado.

---

## Step 5 — `src/modules/cadastros/EtapasPage.tsx`

Arquivo único: `/Users/tiagocameli/projects/Gestao_Obras/src/modules/cadastros/EtapasPage.tsx`

Imports/hooks usados (linhas 17–21):
```ts
import {
  useContractItemsByObra,
  useAdicionarContractItem,
  useAtualizarContractItem,
  useExcluirContractItem,
} from '../../hooks/useContractItems';
```

Uso (linhas 106–109):
```ts
const { data: items = [], isLoading } = useContractItemsByObra(obraId);
const addMutation = useAdicionarContractItem(obraId);
const updateMutation = useAtualizarContractItem(obraId);
const deleteMutation = useExcluirContractItem(obraId);
```

**Confirma:** o usuário, ao cadastrar "etapas" via menu `Cadastros → Etapas` (esta página), está escrevendo na tabela `rodotracker_contract_items` (com `type='etapa'`), **NÃO** em `etapas_obra`.

A página opera com 3 tipos via `TYPE_OPTIONS`: `etapa | subetapa | item`. Detecção automática pelo `code` (depth 1 = etapa).

---

## Step 6 — `src/pages/ObrasPage.tsx`

Arquivo único: `/Users/tiagocameli/projects/Gestao_Obras/src/pages/ObrasPage.tsx`

Texto no header (linhas 148–150):
```
"Visualização consolidada (somente leitura). Para cadastrar/editar obras,
use Cadastros → Obras."
```

ObrasPage é só leitura — usa **ambos** `useEtapas()` (linha 91 — etapas_obra) e `useAllContractItems()` (linha 92 — rodotracker_contract_items) para mostrar dados consolidados. Nenhuma aba de cadastrar etapa aqui.

Cadastro de obra em si: `src/modules/rodotracker/components/Home/ObraFormModal.tsx` (não inspecionado em profundidade, mas é o modal de criar/editar a obra, e por convenção do projeto não envolve etapas).

---

## Step 7 — Onde o `SaidaCombustivelForm` lê etapas?

Arquivo: `src/components/frota/combustivel/FrotaCombustivelContainer.tsx`

Linhas relevantes:
```ts
import { useEtapas } from '../../../hooks/useEtapas';      // L11
const { data: etapas = [] } = useEtapas();                 // L130
<SaidaCombustivelForm etapas={etapas} ... />               // L933
```

E `useEtapas()` (`src/hooks/useEtapas.ts:6-15`):
```ts
const { data, error } = await supabase.from('etapas_obra').select('*');
```

E dentro do form (`src/components/combustivel/SaidaCombustivelForm.tsx`):
```ts
const etapasDaObra = useMemo(
  () => (obraId ? etapas.filter((e) => e.obraId === obraId) : []),
  [etapas, obraId]
);
// ...
options={etapasDaObra.map((et) => ({ value: et.id, label: et.nome }))}
```

**Confirma o bug:** o form filtra `etapas_obra` por `obraId`. Como Ramal do Gama tem 0 etapas em `etapas_obra` (tudo está em `rodotracker_contract_items`), o dropdown fica vazio.

---

## Evidência adicional — Cross-check

### Query 7.a — Ramal do Gama em `rodotracker_contract_items`
```sql
SELECT COUNT(*) FROM public.rodotracker_contract_items
WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428';
```
**Resultado:** `27` registros (5 etapas + 22 items).

### Query 7.b — Breakdown por type
```sql
SELECT type, COUNT(*) FROM public.rodotracker_contract_items
WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428' GROUP BY type;
```
**Resultado:** `etapa=5, item=22`.

### Query 7.c — Etapas reais cadastradas
```sql
SELECT code, name FROM public.rodotracker_contract_items
WHERE obra_id = 'c5f6493a-5921-434c-93c5-f3a14cd2e428' AND type='etapa'
ORDER BY code;
```
| code | name |
|---|---|
| 1 | GERÊNCIA TÉCNICA |
| 2 | MOBILIZAÇÃO E DESMOBILIZAÇÃO E EQUIPAMENTOS E MÁQUINAS, E TRANSPORTE DE AGREGADOS |
| 3 | TRANSPORTE DE INSUMOS BETUMINOSOS |
| 4 | INSTALAÇÕES PROVISÓRIAS |
| 5 | PAVIMENTAÇÃO |

### Query 7.d — Quem usa `etapas_obra` hoje?
```sql
SELECT obra_id, COUNT(*) FROM public.etapas_obra GROUP BY obra_id ORDER BY 2 DESC;
```
**Resultado:**
| obra_id | qtd |
|---|---|
| `99a8ba7d-...` (BR-364 Lote 09) | 265 |
| `mm41xufthvpjm` | 1 |
| `mm41zeupkiyaq` | 1 |

Apenas a obra legada **BR-364 Lote 09** tem volume real em `etapas_obra` (provavelmente importada antes da migração para `rodotracker_contract_items`). Confirma que `etapas_obra` é **tabela legada**.

---

## Step 8 — Classificação do cenário

### **Cenário C — Cadastrado em outra tabela (não persiste em `etapas_obra`)**

**Justificativa (1 parágrafo):**
O usuário fez exatamente o que devia: cadastrou 5 etapas via `Cadastros → Etapas` (página `src/modules/cadastros/EtapasPage.tsx`). Mas essa página grava em `rodotracker_contract_items` (via `useAdicionarContractItem`), enquanto o `SaidaCombustivelForm` lê via `useEtapas()` que aponta para a **tabela legada `etapas_obra`**. Há um descompasso arquitetural: o módulo de Cadastros já migrou para o modelo unificado `rodotracker_contract_items` (que suporta `etapa | subetapa | item`), mas o módulo de Combustível (e provavelmente outros 6 consumidores de `useEtapas` — Dashboard, ObrasPage, Compras, Financeiro, Depositos, ExportarInsumosModal, ExportarPDFModal, GerarLancamentoOCModal) ainda lê da tabela antiga. O hook `useSalvarEtapasObra` existe mas está **órfão** (zero consumidores). Audit_log vazio confirma que nada nunca escreveu em `etapas_obra` para essa obra. Cenário A descartado (dados existem, mas em outra tabela). Cenário B descartado (não há associação errada). Cenário D descartado (`etapas_obra` não tem `deleted_at` e não há registros para excluir/restaurar).

---

## Recomendação de fix

Há duas estratégias possíveis — recomendo discutir com o usuário antes de implementar.

### Opção 1 — Fix mínimo cirúrgico (recomendado para RG.2 imediato)
Alterar `useEtapas()` em `src/hooks/useEtapas.ts` para **ler de `rodotracker_contract_items` filtrando `type='etapa'`** e mapear pro shape `EtapaObra`. Vantagem: corrige o bug imediato em todos os 9+ consumidores sem refatorar nada. Desvantagem: campos `quantidade`, `valor_unitario` e `unidade` precisam vir do `rodotracker_contract_items` (mapeamento: `contracted_qty → quantidade`, `unit_price → valor_unitario`, `unit → unidade`). Considerar union (`etapas_obra` UNION `rodotracker_contract_items WHERE type='etapa'`) para não quebrar BR-364 Lote 09 (265 registros legados).

### Opção 2 — Migração de dados + deprecação
Migrar os 267 registros restantes de `etapas_obra` para `rodotracker_contract_items` e deprecar `etapas_obra` + remover `useSalvarEtapasObra`. Mais limpo a longo prazo, mas exige mais coordenação e testes.

**Decisão:** aguardando confirmação do usuário sobre qual opção seguir antes de prosseguir para Task RG.2.
