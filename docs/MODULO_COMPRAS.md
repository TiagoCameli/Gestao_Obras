# Módulo de Compras — EMT Construtora

> Documento vivo de arquitetura. Atualize aqui sempre que mudarmos uma regra de negócio ou um contrato de dado.
>
> Última revisão: 2026-05-15

---

## 1. Visão geral

O módulo de Compras cobre o ciclo completo: **Pedido → Cotação → Ordem de Compra → Entrada (estoque ou financeiro)**.

Solicitantes (apontadores, encarregados, engenheiros) registram pedidos com itens listados, texto livre, ou ambos. Pedidos passam por aprovação (permissão `aprovar_pedido`). Pedidos aprovados podem virar **Cotação** ou **OC direto**. Cotações coletam preços de múltiplos fornecedores (inclusive via portal público), e geram OC. OCs aprovadas viram entrada de material/combustível no estoque (quando aplicável) e geram um **lançamento pendente no financeiro** (que será processado pelo módulo Financeiro — fase futura).

```
SOLICITANTE                APROVADOR              COMPRADOR             RECEBIMENTO
   │                          │                       │                     │
   ▼                          ▼                       ▼                     ▼
┌─────────┐  aprova   ┌──────────────┐   gera   ┌──────────┐   gera   ┌──────────┐
│ PEDIDO  │──────────▶│ COTAÇÃO      │─────────▶│   OC     │─────────▶│ ENTRADA  │
│ pendente│           │ em_cotacao   │          │ comprado │          │ recebido │
└─────────┘           │ → cotado     │          └──────────┘          └──────────┘
   │                  └──────────────┘                │
   ▼                       │                          ▼
Anexos                     ▼                  Depósito / Obra /
(Supabase Storage)    Portal público          Sede / Equipamento
                      do fornecedor                  │
                      (token + assinatura)           ▼
                                              Lançamento pendente
                                              no Financeiro
```

---

## 2. Telas

| Aba | Conteúdo |
|---|---|
| **Visão Geral** | KPIs, gráficos, pendências de aprovação, lançamentos financeiros pendentes |
| **Pedidos** | Lista + modal híbrido (itens + texto livre + anexos), aprovação, dedup |
| **Cotações** | Mapa comparativo, multi-fornecedor, link público, PDF |
| **Ordens de Compra** | Destinos com regras, PDF EMT, geração de entrada |
| **Lixeira** | Restore de pedidos/cotações/OCs (30 dias) |

Em cada documento, ícone **🕓 Histórico** abre drawer lateral com timeline de auditoria.

---

## 3. Regras de destino × tipo de item (OC)

Cada item da OC tem `tipo: 'material' | 'servico'`. Uma OC pode misturar materiais e serviços, **desde que o destino aceite ambos**.

| Destino | Aceita material? | Aceita serviço? | Campos extras |
|---|---|---|---|
| `obra_etapa` | ✅ | ✅ | `obraId` + `etapaId` |
| `obra_deposito` | ✅ | ❌ | `obraId` + `depositoMaterialId` (entra no depósito da obra; saída posterior pra etapa) |
| `deposito_central` | ✅ | ❌ | `depositoMaterialId` |
| `sede` | ✅ | ✅ | — |
| `manutencao_equipamento` | ✅ (sempre passa pelo almoxarifado) | ✅ | `equipamentoId` |

A UI de criação/edição da OC ajusta os campos dinamicamente e bloqueia combinações inválidas (ex.: tentar adicionar serviço numa OC com destino `deposito_central`).

---

## 4. Schema do banco de dados

### Tabelas novas

#### `compras_anexos`
Anexos (fotos/PDFs) ligados a pedido, cotação ou OC. Storage em bucket `compras-anexos`.

```sql
id text primary key
entidade text not null  -- 'pedido' | 'cotacao' | 'oc'
entidade_id text not null
nome_arquivo text not null
tipo_mime text not null
tamanho_bytes integer not null
storage_path text not null  -- caminho no bucket
enviado_por text not null
enviado_em timestamptz not null default now()
```

#### `cotacao_links_publicos`
Tokens únicos para o portal do fornecedor.

```sql
id text primary key
cotacao_id text not null references cotacoes(id) on delete cascade
fornecedor_id text not null references fornecedores(id)
token text not null unique  -- gerado server-side, ex: 32 chars
canal_envio text  -- 'whatsapp' | 'email' | 'link'
expires_at timestamptz not null
respondido boolean not null default false
respondido_em timestamptz
criado_por text not null
criado_em timestamptz not null default now()
```

#### `cotacao_respostas_fornecedor`
O que o fornecedor preencheu via portal.

```sql
id text primary key
link_publico_id text not null references cotacao_links_publicos(id) on delete cascade
cotacao_id text not null
fornecedor_id text not null
itens_resposta jsonb not null  -- [{itemPedidoId, precoUnitario, marca}]
condicao_pagamento text
prazo_entrega text
observacoes text
assinatura_base64 text  -- canvas drawing
respondido_em timestamptz not null default now()
ip_origem text
```

#### `compras_auditoria`
Log append-only de todas as ações.

```sql
id bigserial primary key
entidade text not null  -- 'pedido' | 'cotacao' | 'oc'
entidade_id text not null
acao text not null  -- 'created' | 'updated' | 'approved' | 'rejected'
                    -- | 'cancelled' | 'deleted' | 'restored' | 'received'
usuario_id text
usuario_nome text not null
diff_antes jsonb
diff_depois jsonb
observacao text
criado_em timestamptz not null default now()
```

#### `compras_lixeira`
Soft-delete unificado (Pedido/Cotação/OC).

```sql
id text primary key
entidade text not null
entidade_id text not null
payload jsonb not null  -- snapshot completo pra restore
deletado_por text not null
deletado_em timestamptz not null default now()
retencao_ate timestamptz not null  -- deletado_em + 30 dias
restaurado_em timestamptz
restaurado_por text
```

#### `compras_notificacoes`
Notificações in-app (com flag enviado_whatsapp para fase futura).

```sql
id text primary key
destinatario_id text not null  -- funcionario id
tipo text not null  -- 'cotacao_respondida' | 'pedido_aprovado' | ...
titulo text not null
mensagem text not null
link text  -- ex: /compras?tab=cotacoes&id=COT-...
lida boolean not null default false
lida_em timestamptz
enviado_whatsapp boolean not null default false
criado_em timestamptz not null default now()
```

### Alterações em tabelas existentes

#### `pedidos_compra`
- `+ descricao_livre text default ''` — texto opcional do solicitante
- `+ valor_estimado numeric` — opcional
- `+ aprovado_por text`, `aprovado_em timestamptz`
- `+ reprovado_por text`, `reprovado_em timestamptz`, `motivo_reprovacao text`
- `+ deletado_em timestamptz` — soft delete (lixeira)
- `status` enum estendido: `pendente | aprovado | reprovado | em_cotacao | cotado | comprado`
- itens (jsonb) → cada item ganha `tipo: 'material' | 'servico'` e `insumo_id` opcional e `criar_na_base` (flag transitória)

#### `cotacoes`
- `+ descricao_livre text default ''` (herdada do pedido quando vier sem itens)
- `+ prazo_resposta timestamptz`
- `+ aprovado_por`, `cancelado_por`, `deletado_em` (mesmos campos de auditoria)

#### `ordens_compra`
- `+ tipo_destino text not null` enum: `obra_etapa | obra_deposito | deposito_central | sede | manutencao_equipamento`
- `+ equipamento_id text references equipamentos(id)`
- `+ deposito_destino_id text` — depósito da obra ou central
- itens (jsonb) → cada item ganha `tipo: 'material' | 'servico'`
- `+ aprovada_por text`, `aprovada_em timestamptz`
- `+ cancelada_por text`, `cancelada_em timestamptz`
- `+ recebida_por text`, `recebida_em timestamptz`
- `+ lancamento_financeiro_status text not null default 'nao_aplicavel'` — `nao_aplicavel | pendente | lancada`
- `+ lancada_em_financeiro_em timestamptz`, `lancada_em_financeiro_por text`
- `+ deletado_em timestamptz`

---

## 5. Numeração

Função `proximoNumeroPorAno(prefix, ano, existentes)` gera identificadores no formato `PREFIX-AAAA-NNNN`:

- `PED-2026-0001`
- `COT-2026-0001`
- `OC-2026-0001`

Quando o ano muda, a contagem reinicia.

---

## 6. Portal público do fornecedor

URL: `https://gestao-obras-rho.vercel.app/cotacao/r/{token}`

Fluxo:
1. Comprador clica "Enviar cotação" → modal pede para escolher fornecedores (já cadastrados ou adicionar na hora) e canal (WhatsApp / email / só link).
2. Sistema gera um `cotacao_links_publicos` para cada fornecedor, com token único de 32 chars e `expires_at` = prazo_resposta (ou 7 dias).
3. Botão "Copiar links" copia URLs prontas para colar no WhatsApp/email (WhatsApp automático fica na Fase 6 — futuro).
4. Fornecedor abre o link, vê layout EMT com itens, preenche `precoUnitario` e `marca` por item, condição de pagamento, prazo de entrega, assina (canvas) e envia.
5. Sistema grava em `cotacao_respostas_fornecedor`, marca `respondido = true`, e notifica o criador da cotação (notificação in-app + futuramente WhatsApp).
6. Token vira inválido após resposta. Link expirado mostra mensagem amigável.

---

## 7. Auditoria

Toda ação em pedido/cotação/OC dispara `INSERT compras_auditoria` via helper `auditar(entidade, entidade_id, acao, diff_antes, diff_depois)`. O drawer "Histórico" lê esses registros e renderiza timeline.

Ações registradas: `created | updated | approved | rejected | cancelled | deleted | restored | received | sent_to_supplier | quote_received | financial_posted`.

---

## 8. Lixeira

Soft delete: ao excluir, registro vai para `compras_lixeira` (com payload completo do registro original) e ganha `deletado_em` no registro principal. Listagens normais filtram `deletado_em IS NULL`.

- Retenção: **30 dias** (`retencao_ate = deletado_em + 30d`)
- Job semanal (Supabase Edge Function ou trigger) limpa registros com `retencao_ate < now()` e `restaurado_em IS NULL`
- Restore: registro volta para tabela original com status anterior; cria entrada `restored` na auditoria
- Permissão para restaurar: `restaurar_lixeira_compras`

---

## 9. Permissões

Adicionadas ao `utils/permissions.ts`:

| Chave | Padrão para roles |
|---|---|
| `ver_compras` | todos exceto operador puro |
| `ver_dashboard_compras` | todos com `ver_compras` |
| `criar_pedido_compra` | apontador, encarregado, engenheiro, gerente, gerente compras, admin |
| `aprovar_pedido` | gerente, gerente compras, admin |
| `criar_cotacao` | gerente compras, admin |
| `enviar_cotacao_fornecedor` | gerente compras, admin |
| `criar_oc` | gerente compras, admin |
| `aprovar_oc` | gerente compras, admin |
| `restaurar_lixeira_compras` | gerente compras, admin |
| `ver_auditoria_compras` | gerente, gerente compras, admin |

---

## 10. Lançamento financeiro pendente

Quando uma OC é **aprovada** (`aprovada = true`), automaticamente:
- `lancamento_financeiro_status` vira `pendente`
- A OC aparece no Dashboard de Compras numa seção "🟡 Aguardando lançamento financeiro"

Quando o módulo Financeiro for construído, ele consome essas OCs pendentes e marca como `lancada` ao gerar o lançamento contábil/parcelas.

---

## 11. Design system "premium SaaS"

Tipografia, espaçamento, cards e badges seguem o estilo Linear/Notion.

**Status badges (chip translúcido):**
- 🟡 `pendente` — amber/100, border amber/200
- 🔵 `em_cotacao` — blue/100
- 🟣 `cotado` — violet/100
- 🟢 `aprovado` / `comprado` — emerald/100
- 🔴 `reprovado` / `cancelado` — rose/100
- ⚪ `recebido` — slate/100
- 🟠 `aguardando financeiro` — orange/100

**Componentes:**
- KPI cards: número 32px/700, label 12px/500 uppercase tracking, delta com seta
- Tabelas: zebra 1%, header sticky, hover destacado
- Modais: fade+scale 200ms, ESC e click fora fecham
- Drawer lateral: slide 250ms da direita para timeline
- Skeleton loaders em vez de spinners

---

## 12. Plano de execução por fases

| Fase | Conteúdo | Status |
|---|---|---|
| **0** | Fundação: migrations, bucket Storage, permissões, helpers de auditoria, numeração | ✅ |
| **1** | Pedidos premium: modal híbrido, anexos, dedup, status estendido, histórico | ✅ |
| **2** | Cotações premium: mapa comparativo, link público, portal do fornecedor | ✅ |
| **3** | OC premium: destinos múltiplos com validador, PDF EMT, lançamento financeiro pendente | ✅ |
| **4** | Dashboard Visão Geral: KPIs, gráficos, pendências | ✅ |
| **5** | Lixeira + UI de Auditoria: tela de restore, drawer de histórico | ✅ |
| **6** | Notificações in-app (WhatsApp como TODO) | ✅ |
| **7** | Polish, QA e validações finais | ✅ |

---

## 13. Convenções de código

- Tipos em `src/types/index.ts` na seção `// === Módulo de Compras ===`
- Hooks em `src/hooks/use{Pedidos|Cotacoes|Ordens}Compra.ts`
- Componentes em `src/components/compras/`
- Mappers (snake_case ↔ camelCase) em `src/lib/mappers.ts`
- Validações em `src/utils/comprasValidator.ts`
- Geração de PDF em `src/utils/comprasPdf.ts`
- Helper de auditoria em `src/utils/comprasAudit.ts`

---

## 14. Decisões registradas

| Data | Decisão | Quem |
|---|---|---|
| 2026-05-15 | Aprovação por permissão `aprovar_pedido` (sem regra por valor) | Tiago |
| 2026-05-15 | Pedido aceita itens + texto livre no mesmo registro | Tiago |
| 2026-05-15 | Destinos OC com regras material/serviço (ver §3) | Tiago |
| 2026-05-15 | Anexos no Supabase Storage, bucket `compras-anexos` | Tiago |
| 2026-05-15 | Cadastro de item novo com checkbox + dedup fuzzy + unidade obrigatória | Tiago |
| 2026-05-15 | Cotações ilimitados fornecedores, prazo opcional, link público com assinatura canvas | Tiago |
| 2026-05-15 | PDFs em Pedido, Cotação e OC | Tiago |
| 2026-05-15 | Dashboard com KPIs completos | Tiago |
| 2026-05-15 | Auditoria completa + Lixeira 30 dias | Tiago |
| 2026-05-15 | Status estendido: `em_cotacao`, `cotado`, `comprado` | Tiago |
| 2026-05-15 | Numeração por ano `PED-2026-0001` | Tiago |
| 2026-05-15 | Design "premium SaaS" estilo Linear/Notion | Tiago |
| 2026-05-15 | Link no menu: Obras → Compras → Cadastros → Frete | Tiago |
| 2026-05-15 | WhatsApp pro fornecedor fica como Fase 6 (link copiado por enquanto) | Tiago |
| 2026-05-15 | OC aprovada gera lançamento financeiro pendente; módulo Financeiro é fase futura | Tiago |
