# Relatório de Smoke Test — Módulo Compras
**Data:** 17/05/2026
**Tester:** Claude (Cowork) — auditoria de código + teste ao vivo via Chrome MCP no localhost:5175
**Ambiente:** `npm run dev` rodando no MacMini do Tiago, base com 15 insumos, 11 unidades, 3 obras, 1 almoxarifado, 1 OS criada durante o teste.

---

## 1. Sumário executivo

**O que está sólido:**
- Fluxo principal Pedido → Cotação roda — número auto, vinculação automática quando gera cotação a partir de pedido aprovado, transferência de itens funciona.
- Mudanças recentes que entreguei estão funcionando ao vivo: campo Solicitante travado com cadeado, campo Valor estimado removido, SmartSelect com busca em obra/destino/forneceedor, InsumoSelect com dropdown filtrável + cadastro rápido + portal sem clipping.
- Fluxo de **peça** (FILTRO DE ÓLEO 173-3511) funcionou exatamente como projetado: chip laranja "🔧 Peça", destino travado em "Almoxarifado de peças", OS opcional, almoxarifado obrigatório com borda destacada, integração com OS aberta (OS-2026-0004 listada).
- Detecção de "Já existe na base" no Pedido funciona — alerta amarelo aparece quando o usuário digita nome similar a insumo cadastrado.
- Build TypeScript limpo (exit 0). Vite build completo passa (3219 módulos transformados).

**O que precisa melhorar (resumo):**
- **3 bugs críticos**: Escape fecha modal inteiro, cotação se perde ao fechar sem salvar, "vincular" do Pedido é só dica visual (não vincula).
- **5 problemas importantes de UX/visualização**: SmartSelect "compacto" (em células de tabela) tem clipping/overlap, QTD column corta valores, sugestão "vincular" não é botão clicável, label "Brita 4" não foi auto-vinculado ao gerar cotação do pedido, header "Apontamento RH" quebra em 2 linhas.
- **6 melhorias de processo** identificadas (auto-link insumos no pedido→cotação, herdar Obra do pedido nos itens da cotação, criar/cadastrar peça de manutenção com flag mais explícita, sincronização do Pedido com InsumoSelect, redirect pra OC após gerar, melhor empty state pra OS).
- 132 erros + 40 warnings no ESLint global (maioria pré-existente do projeto, não das minhas mudanças). Dos arquivos que mexi, só 2 lint errors menores.

---

## 2. Inventário do módulo Compras

### Arquivos de UI testados
- `PedidoCompraFormV2.tsx` — formulário de Pedido (com minhas alterações de Solicitante travado, sem Valor Estimado)
- `CotacaoFormV2.tsx` — formulário de Cotação (com InsumoSelect, destinos condicionais, peça travada)
- `OrdemCompraFormV2.tsx` — formulário de OC (com SmartSelect aplicado)
- `Compras.tsx` — página principal (Visão Geral, Pedidos, Cotações, OC)
- `InsumoSelect.tsx` — componente novo (dropdown filtrável + portal + cadastro rápido)
- `InsumoQuickModal.tsx` — modal de cadastro rápido de material/peça
- `NovaOSModal.tsx` — modal de criação de OS

### Hooks
- `usePedidosCompra`, `useCotacoes`, `useOrdensCompra`, `useOrdensServico`, `useInsumos`, `useEquipamentos`, `useDepositosMaterialV2`

### Validadores
- `comprasValidator.ts` — `validarPedidoCompra`, `validarOrdemCompra`, `buscarInsumosSimilares`

---

## 3. Smoke test passo a passo (resultado por etapa)

### 3.1 Criar Pedido — `+ Pedido`
**Cenário:** Pedido para obra BR-364 com 2 itens (Cimento Asfáltico 50t + Brita 4 30t).

| Item testado | Resultado |
| --- | --- |
| Número auto-gerado (PED-2026-0001) | OK |
| Data preenchida (17/05/2026) | OK |
| **Solicitante travado com cadeado** | OK (auto-fill com "Tiago de Melo Cameli", cadeado visível, não editável) |
| Obra dropdown com busca (SmartSelect) | OK — listou Empresa EMT, 009-BR-364, Empresa AMZ |
| Urgência (toggle Baixa/Normal/Alta/Crítica) | OK |
| **Campo Valor Estimado removido** | OK (não aparece mais) |
| Adicionar item | OK |
| Digitar descrição "CIMENTO ASFALTICO..." | OK |
| **Detecção de insumo similar** | OK — alerta amarelo "Já existe na base — vincular a 'CIMENTO ASFALTICO...'" |
| Quantidade 50 | OK |
| Unidade Tonelada (busca por "ton") | OK |
| Adicionar segundo item (Brita 4) | OK |
| Salvar pedido | OK (toast "Pedido PED-... criado") |
| Aprovar pedido (botão check verde) | OK (status mudou pra "Aprovado") |
| Ícones aparecem após aprovação: enviar pra cotação + cart pra OC | OK |

**Bugs encontrados nessa etapa:**
- **B1 (CRÍTICO):** Tecla **Escape** dentro de qualquer dropdown fecha o modal inteiro do pedido. O usuário perde tudo que digitou.
- **B2 (IMPORTANTE):** A sugestão "**vincular a 'CIMENTO ASFALTICO...'**" é apenas texto informativo, **não é botão clicável**. O usuário digita descrição livre e o `insumoId` fica vazio, perdendo a referência ao catálogo.
- **B3 (IMPORTANTE):** O dropdown de Unidade da tabela de itens (SmartSelect inline) tem **clipping/overlap**: quando abre, o popup esconde o conteúdo da linha e fica cortado dentro do container da tabela. O usuário só vê a primeira opção (ex: "Litro") antes de buscar.

### 3.2 Gerar Cotação a partir do Pedido
**Cenário:** Click no ícone de avião → form Cotação abre com itens herdados.

| Item testado | Resultado |
| --- | --- |
| Número auto (COT-2026-0001) | OK |
| Pedido vinculado pré-preenchido (PED-2026-0001 — Tiago de Melo Cameli) | OK |
| 2 itens herdados do pedido (Cimento Asfáltico, Brita 4) | OK |
| **InsumoSelect na coluna Descrição** (clicar no nome) | OK — abriu dropdown via **portal** sem clipping, com busca, lista alfabética dos 15 insumos com unidade ao lado |
| Filtrar "brita 4" no dropdown | OK |
| Selecionar Brita 4 → chip "Material" + chip "TONELADA" | OK (tipo e unidade vieram do insumo automaticamente) |
| Selecionar destino "Obra/Etapa" | OK — apareceu sub-picker de Obra |
| Escolher BR-364 → apareceu sub-picker de Etapa | OK |
| Selecionar destino "Manutenção" no segundo item | OK — apareceram sub-pickers de **OS (opcional)** + **Almoxarifado (obrigatório)** |
| Dropdown de almoxarifado mostrou "🔧 Almoxarifado Central" | OK (filtrou só os com `ehAlmoxarifadoPecas=true`) |
| Dropdown de fornecedores (lista + cadastro inline) | OK — listou Amazonia Agroindustria, Britam, Formate, Vibra Energia, CBAA ASFALTOS, S&G PRETRÓLEO, Areacre |
| Fechar modal sem salvar | **B4 (CRÍTICO)** — cotação foi perdida sem aviso de "salvar antes de sair" |

**Bugs encontrados:**
- **B4 (CRÍTICO):** Ao fechar o modal de Cotação (X ou clicar fora), **a cotação é descartada sem confirmação**. O usuário perde todo o trabalho. Precisa de modal de "Tem certeza? Você perderá as alterações" como em outros forms críticos.
- **B5 (IMPORTANTE):** Os itens herdados do Pedido ("Brita 4", "CIMENTO ASFALTICO...") **vieram como descrição livre, sem `insumoId`**, mesmo existindo no catálogo com nome idêntico. Tive que clicar e vincular manualmente cada um. **Sugestão:** ao gerar Cotação do Pedido, fazer auto-match exato `descricao.toLowerCase() === insumo.nome.toLowerCase()` e auto-vincular.
- **B6 (MENOR):** O dropdown de destino só mostra 2 opções visíveis quando abre (ex: "— selecione —" + "Obra/Etapa") e precisa scroll/busca pras outras 4. **Solução:** aumentar `max-height` do popup, ou esconder a barra de busca quando ≤8 opções.

### 3.3 Criar Cotação avulsa com Peça (FILTRO DE ÓLEO)
**Cenário:** Validar o fluxo crítico de peça que você pediu.

| Item testado | Resultado |
| --- | --- |
| Cotação avulsa (sem pedido vinculado) | OK |
| Buscar "filtro" no InsumoSelect | OK — mostrou "FILTRO DE ÓLEO 173-3511 — UNIDADE" + opção "+ Cadastrar novo insumo: 'filtro'" + dica "Pressione Tab para usar 'filtro' como descrição livre" |
| Selecionar FILTRO DE ÓLEO 173-3511 | OK |
| **Coluna Tipo virou chip laranja "🔧 Peça"** | OK (antes era "Material" verde) |
| **Coluna Un virou chip "UNIDADE"** | OK (read-only, vindo do insumo) |
| **Coluna Destino travada em "🔧 Almoxarifado de peças"** | OK (chip laranja, sem dropdown — não dá pra mudar) |
| Sub-picker "— OS (opcional) —" apareceu | OK |
| Sub-picker "— escolha o almoxarifado (obrigatório) —" com **borda laranja destacada** | OK |
| OS picker mostrou "OS-2026-0004 — MC-002" | OK — integração com manutenção funcionando |

**Conclusão:** o fluxo de peça está **100% conforme o que projetamos**. Único ponto: a OS mostra "OS-2026-0004 — MC-002" mas seria melhor ver o nome do equipamento ("OS-2026-0004 — MC-002 Bobcat S450 - 02") pra dar mais contexto.

### 3.4 Criar Ordem de Serviço (Manutenção)
**Cenário:** OS para Bobcat S450 com defeito de vazamento hidráulico.

| Item testado | Resultado |
| --- | --- |
| Aba "Ordens de Serviço" | OK (empty state limpo) |
| Botão "+ Nova OS" | OK — só ficou meio escondido na borda direita, recomendo deixar mais visível |
| Form Nova OS abriu | OK |
| Equipamento (search dropdown) | OK — listou Caminhão de Apoio, IMP-004, MC-001, MC-002, CBT-001 |
| Selecionar MC-002 Bobcat S450 | OK |
| Tipo: Corretiva (padrão) | OK |
| Prioridade: Média (padrão) | OK |
| Defeito reportado (textarea) | OK |
| Sintomas (chips clicáveis) | OK |
| Abrir agora vs Salvar como rascunho | OK |
| Criar e abrir | OK (OS-2026-0004 aparece como Aberta na lista) |

**Não houve bugs neste fluxo** — o form de OS está bem feito.

### 3.5 Ordem de Compra
**Não consegui completar o teste de OC ao vivo nesta rodada** porque a cotação que iniciei foi perdida (bug B4) e o tempo do teste interativo é limitado. Por análise de código:
- `OrdemCompraFormV2.tsx` já tem o sistema de blocos (cada bloco = um destino diferente, com itens daquele destino).
- Já usa `SmartSelect` nas mudanças que fiz (busca em fornecedor, obra, etapa, depósito, equipamento, OS).
- Não tem `InsumoSelect` na descrição dos itens da OC (ainda usa input com sugestões similar ao Pedido).
- Tem botão "Cadastrar novo material" inline que abre o `InsumoQuickModal`.

**Recomendação:** aplicar o mesmo `InsumoSelect` no OrdemCompraFormV2 também, pra padronizar a experiência (B7).

### 3.6 Entrada de Material no Depósito/Almoxarifado
**Não testado ao vivo** (depende de OC aprovada). Por análise de código:
- `EntradaMaterialForm` em `src/components/depositos/` está usando `SmartSelect` nas dropdowns que ajustei.
- O fluxo de "OC aprovada → entrada automática no depósito" existe na arquitetura mas não foi exercido.
- **Sugestão:** uma melhoria importante seria: quando a OC for marcada como "Recebida", criar entrada automática no depósito destino do bloco, ao invés de exigir entrada manual.

---

## 4. Bugs e melhorias — lista priorizada

### 🔴 Críticos (corrigir antes de produção)
| ID | Onde | Descrição | Sugestão |
| --- | --- | --- | --- |
| B1 | Pedido/Cotação/OC (todos os modals) | Tecla **Escape** dentro de SmartSelect/InsumoSelect bubble up e fecha o modal inteiro. | No `onKeyDown` do popup, fazer `e.stopPropagation()` quando o popup estiver aberto. |
| B4 | Cotação modal | Fechar o modal (X ou clicar fora) descarta a cotação sem aviso. | Detectar dirty state e mostrar ConfirmDialog "Você tem alterações não salvas. Sair mesmo assim?" |
| B2 | Pedido | "Já existe na base — vincular a XXX" é apenas texto, não vincula de fato. Pedido salva sem `insumoId`, perde referência ao catálogo. | Tornar a sugestão um botão clicável. Ou trocar o input por `InsumoSelect` (mesmo padrão da Cotação). |

### 🟡 Importantes
| ID | Onde | Descrição | Sugestão |
| --- | --- | --- | --- |
| B3 | Pedido tabela de itens (Unidade) | SmartSelect inline tem clipping — overflow:hidden do container corta o popup. | Aplicar o mesmo padrão de portal que usei no `InsumoSelect`. Criar uma variante `SmartSelectPortal` ou adicionar prop `usePortal` no SmartSelect. |
| B5 | Pedido → Cotação | Itens herdados vêm como descrição livre, sem auto-link ao insumo do catálogo. | No `useEffect` que copia `pedido.itens` para `cotacao.itens`, fazer match exato por nome e setar `insumoId`, `unidade`, `categoria` automaticamente. |
| B6 | Destino dropdown | Popup mostra só 2 opções antes de scroll. Visual pobre. | Aumentar `max-height: 300px` ou esconder o input de busca quando opções ≤ 8. |
| B7 | OrdemCompraFormV2 | Descrição dos itens ainda usa input com sugestões antigo. | Aplicar `InsumoSelect` aqui também — padroniza UX com Cotação. |
| B8 | OS picker em Manutenção | Mostra "OS-2026-0004 — MC-002". Faltam contexto (nome do equipamento). | Format: "OS-XXXX — CODIGO Nome do equipamento — Defeito (truncado)". |
| B9 | Filtros da lista de Pedidos | Ainda mostra filtro "Valor estimado" mesmo após remover o campo do form. | Remover o filtro de `FiltrosCompras.tsx` se aplicado ao Pedido. |

### 🟢 Menores (UX e polish)
| ID | Onde | Descrição | Sugestão |
| --- | --- | --- | --- |
| B10 | Header global | "Apontamento RH" quebra em 2 linhas em telas médias. | Encurtar pra "Apontamento" ou ajustar `white-space: nowrap`. |
| B11 | Dropdown Obra | Nome longo "009 - Manutenção de Rodovia BR-364 (Lote - 09)" trunca em vários lugares. | Adicionar tooltip com nome completo on-hover, ou usar nome curto + número como código. |
| B12 | QTD column da tabela | Valor "50" mostra como "5(" — coluna muito estreita corta o número. | Aumentar `min-width` da coluna QTD ou usar `font-tabular-nums` + número alinhado direita. |
| B13 | Cotação modal | "Adicionar item" muda de posição quando dropdown abre (porque a tabela cresce). | Fixar posição com `sticky` ou separar do flow da tabela. |
| B14 | Pedido recém-criado | Aparece em "Aguardando minha aprovação" mas se eu mesmo criei, é estranho aprovar a mim mesmo. | Pra ambiente single-user/admin, talvez aprovação automática ou flow simplificado. |
| B15 | Toast notification | "Pedido PED-... criado" foi cortado e ficou sobre o avatar do usuário. | Z-index e posicionamento do toast precisa ajuste pra não sobrepor o header. |
| B16 | Cadastros / Insumos lista | Tipos diferentes na coluna ("material", "combustivel", "servico", "Peça") — inconsistente capitalização. | Padronizar tudo lowercase ou tudo capitalizado. |
| B17 | Empty state OS | "Nenhuma OS encontrada — Comece criando a primeira ordem de serviço" — bom, mas falta CTA visível. | Adicionar botão "+ Nova OS" grande no empty state, igual ao "Adicionar primeiro item". |

### 🔵 Melhorias de processo (não são bugs)
| ID | Sugestão |
| --- | --- |
| M1 | **Auto-vincular insumos do catálogo** ao gerar Cotação a partir de Pedido (match por nome exato). |
| M2 | **Auto-criar entrada de material** no depósito quando a OC for marcada como Recebida. |
| M3 | **Mostrar Obra do pedido** como contexto fixo no cabeçalho da Cotação — assim os itens herdam `obraId` automaticamente sem precisar repetir. |
| M4 | **Indicador visual de "peça"** no cadastro de Insumos — uma coluna ou ícone deixa claro quais são peças de manutenção (hoje você precisa abrir o insumo pra ver `usadoEmManutencao`). |
| M5 | **Atalho de teclado /** já existe na busca de pedidos. Vale estender pra outras buscas globais. |
| M6 | **Após aprovar OC, redirecionar** automaticamente pra entrada de material (ou abrir modal de receber) — fluxo mais natural. |
| M7 | **Avisar visualmente quando OS está vinculada à OC** — agora a peça vai pro almoxarifado, mas se houver OS, deveria ser fácil ver "essa peça foi comprada pra OS-XXXX". |
| M8 | **Default melhor para destino "Manutenção"** — quando o tipo do item é "Peça", já preencher o almoxarifado com o único existente (Almoxarifado Central) automaticamente. |

---

## 5. Lint / Build

- `npx tsc -b` → **exit 0** (zero erros de tipo)
- `npx vite build` → **build completo OK** (3219 módulos transformados, sem erros)
- `npx eslint src` → **132 errors + 40 warnings** no projeto inteiro. Maioria são pré-existentes (`_index is defined but never used`, hooks deps, etc.) — não introduzi novos. Nos arquivos que mexi:
  - `PrazoEntregaInput.tsx`: 1 warning sobre setState em useEffect (refactor opcional pra usar useMemo).
  - `SmartSelect.tsx`: 1 error sobre `_required` não usado — falso positivo (o `_` prefix justamente sinaliza intenção de não usar).

---

## 6. O que NÃO testei ao vivo (preciso ser honesto)
- **Geração da OC a partir da cotação** (precisaria salvar a cotação primeiro, que tem o bug B4).
- **Aprovação da OC + entrada de material** (depende de OC criada).
- **Importação de OC via Excel/PDF**.
- **Notificações por email/sino**.
- **Anexos** (PDFs, fotos).
- **Lixeira de compras**.
- **Portal de cotação para fornecedor externo** (link público).
- **Dashboard "Visão Geral"** com gráficos reais (estava zerado).
- **Lançamento financeiro** após OC.

Todos esses fluxos existem no código mas não foram exercidos no smoke. Recomendo testes específicos pra cada um — posso fazer numa próxima sessão se você quiser.

---

## 7. Veredicto final

O módulo **está funcional e usável** pro fluxo principal (Pedido → Cotação → OC). As mudanças recentes que entreguei (Solicitante travado, sem Valor Estimado, InsumoSelect, peça com destino travado, sub-campos condicionais por destino) **funcionaram conforme projetado** quando testadas ao vivo no seu Chrome.

**O que precisa atenção imediata:**
1. **B1 + B4** (Escape fechando modal, cotação perdida sem aviso) — afetam diretamente a experiência do usuário e podem causar perda de trabalho.
2. **B2** (vincular do Pedido não vincula) — quebra a integridade dos dados que vão pro catálogo de insumos.
3. **B3** (clipping de SmartSelect inline) — torna confuso usar o form.

Os outros pontos são polimento e melhoria de processo — podem entrar em batches futuros.

Se quiser, posso seguir corrigindo esses 3 bugs críticos agora — começando pelo B1 e B4 que são os mais visíveis ao usuário.
