# Import de peças em massa no Almoxarifado (Excel) — design

**Data:** 2026-07-02
**App:** Gestão de Obras (Vite + React + TS + Supabase)
**Pedido do Tiago:** importar várias peças de uma vez por planilha Excel no módulo Manutenção.

## Escopo (decidido com o Tiago)
- **Um** import, na tela **Almoxarifado** (`/manutencao/almoxarifado`): cadastra várias peças (insumos de manutenção) de uma vez.
- **Só catálogo**, não mexe em estoque (equivale ao "Nova peça" em massa; entrada de estoque continua sendo o fluxo "Nova entrada").
- Óleos entram aqui também, como peça (insumo). A aba **Tipos de Óleo** (catálogo separado do alerta de troca) **fica de fora** deste import.
- **Duplicados são pulados:** casa por SKU; se o SKU estiver vazio, por nome. Também dedup dentro do próprio arquivo.

## Abordagem
Reusar o componente genérico existente `src/components/ui/ImportExcelModal.tsx` (baixar template → arrastar .xlsx → preview ✅/❌ com erros → importar). Só forneço a config de peça (colunas, `parseRow`, `toEntity`) e um hook de insert em massa. Zero componente de import novo do zero, UX idêntica ao resto do app (ImportEquipamentos, ImportEtapas, etc.).

## Modelo de dados (existente, sem mudança)
Peça = `Insumo` com `tipo='peca'`, `usadoEmManutencao=true`, `ativo=true`. Campos usados no import: `nome`, `unidade`, `codigoSku`, `codigoEan`, `fabricante`, `codigoFabricante`, `estoqueMinimo`, `estoqueMaximo`, `leadTimeDias`, `equipamentosCompativeis` (array), `aplicacaoTecnica`. Tabela `insumos` já existe. **Sem migration. Sem chave de permissão nova** (reusa `criar_peca_almoxarifado`).

## Colunas da planilha (template)
| Coluna | Obrigatória | Observação |
|---|---|---|
| Nome | sim | sem nome → linha inválida |
| Unidade | não | default `un` |
| SKU | não | chave de dedup |
| EAN | não | |
| Fabricante | não | |
| Part number | não | mapeia `codigoFabricante` |
| Estoque mínimo | não | número (vírgula ou ponto) |
| Estoque máximo | não | número |
| Lead time (dias) | não | inteiro |
| Equipamentos compatíveis | não | separado por vírgula → array |
| Aplicação técnica | não | texto livre |

Fora do template: Foto (URL não faz sentido em massa) e "ativo" (entra ativa por padrão).

## Componentes / camadas
- **`src/utils/importPecasAlmoxarifado.ts`** (função pura, testável): `parseRowPeca(row, index, ctx)` → `ParsedRow` e `pecaRowToInsumo(row, usuario)` → `Insumo`. `ctx` carrega os índices de dedup: `skusExistentes: Set<string>` (lower), `nomesExistentes: Set<string>` (lower), e sets acumuladores para dedup dentro do arquivo. Também exporta `TEMPLATE_PECAS` (headers + exemplo + larguras) pro modal.
- **`src/components/manutencao/almoxarifado/ImportPecasModal.tsx`**: fino wrapper que monta o `ImportExcelModal` com a config de peças; recebe `insumos` (catálogo atual) pra montar o `ctx` de dedup; no `onImport` chama o hook de import em massa.
- **`useImportarInsumos()`** em `src/hooks/useInsumos.ts`: `mutationFn(insumos: Insumo[])` faz `supabase.from('insumos').insert(insumos.map(insumoToDb)).select()`, lança erro se 0 linhas (pega RLS silencioso), invalida `['insumos']`. Espelha o padrão de `useAdicionarInsumo`.
- **`AlmoxarifadoPage.tsx`**: botão "Importar Excel" no header ao lado de "Nova peça" (gate `criar_peca_almoxarifado`), estado do modal, passa `insumos` pro modal.

## Validação no preview (`parseRowPeca`)
- Sem `Nome` → inválida ("Nome é obrigatório").
- **Duplicado no catálogo** → inválida ("já existe no catálogo"): SKU (lower) ∈ `skusExistentes`, ou — se SKU vazio — nome (lower) ∈ `nomesExistentes`.
- **Duplicado no arquivo** → inválida ("linha repetida no arquivo"): mesma chave (SKU, ou nome se SKU vazio) já vista em linha anterior.
- Números via `parseNumero` (aceita vírgula/ponto; vazio → null).
- `resumo` = `nome` + (SKU) pra conferência no preview.
- Linha válida → `toEntity` monta o `Insumo` (`tipo='peca'`, `usadoEmManutencao=true`, `ativo=true`, `id` gerado, `criadoPor` = usuário atual).

## Fluxo
1. Usuário clica "Importar Excel" → modal abre.
2. Baixa template (11 colunas + 1 linha de exemplo).
3. Arrasta/seleciona .xlsx → `parseRow` roda linha a linha contra o catálogo atual → preview com válidas (✅) e inválidas (❌ com motivo: sem nome / já existe / repetida).
4. "Importar N peças" → só as válidas → `useImportarInsumos` (1 insert em massa) → `['insumos']` invalida → catálogo atualiza. Não cria estoque.

## Fora de escopo (YAGNI)
- Entrada de estoque pela planilha (continua no "Nova entrada").
- Import de Tipos de Óleo (catálogo separado).
- Atualizar peça existente pela planilha (decisão: pular duplicado, não atualizar).
- Mapeamento de colunas flexível (headers fixos do template).

## Testes
- **Unit (Vitest)** de `importPecasAlmoxarifado.ts`: linha válida; sem nome (inválida); SKU duplicado no catálogo (inválida); nome duplicado quando SKU vazio (inválida); duplicado dentro do arquivo (inválida); números com vírgula; equipamentos compatíveis split por vírgula; `pecaRowToInsumo` monta o Insumo com flags certas.
- **Manual (produção, com cleanup):** baixar template, preencher 2-3 peças novas + 1 repetida, importar, conferir que as novas entram e a repetida é pulada; depois apagar as de teste.

## Verificação de fechamento
`npx tsc -b`, `npx eslint` nos arquivos tocados, `npx vitest run` (fora as 12 falhas pré-existentes do fifoCombustivel), `npx vite build` limpos. Deploy pelo push da main (com ok do Tiago).
