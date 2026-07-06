# Import de entradas de peças via Excel (almoxarifado / manutenção)

**Data:** 2026-07-06
**Status:** aprovado pelo Tiago

## Objetivo

Lançar entradas de peças em estoque em massa, por planilha Excel, várias peças e
várias notas fiscais num arquivo só. Complementa a entrada manual do
`NovaEntradaModal` (que segue existindo).

## Decisões (validadas em conversa)

1. **Várias NFs no mesmo arquivo.** Cada linha carrega depósito, fornecedor,
   NF e data, além do item. Não há cabeçalho no modal.
2. **Match de peça: SKU com fallback de nome.** SKU preenchido casa por SKU;
   SKU vazio casa pelo nome exato (case-insensitive, trim).
3. **Peça não encontrada no catálogo = linha inválida.** Não cria peça
   automaticamente. Cadastra antes (manual ou import de catálogo) e reimporta.
4. **NF já lançada (mesmo fornecedor + mesmo número em `entradas_material`) =
   todas as linhas dessa NF viram erro.** Protege contra reimport duplicando
   estoque. Complemento legítimo de nota se lança manual.

## Arquitetura

Reusa o `ImportExcelModal` genérico (`src/components/ui/ImportExcelModal.tsx`),
mesmo padrão do import de catálogo de peças (PR do
`2026-07-02-import-pecas-almoxarifado-design.md`).

### Componentes novos

| Unidade | Responsabilidade |
|---|---|
| `src/utils/importEntradasPecas.ts` | Funções puras: `TEMPLATE_ENTRADAS_PECAS`, `criarEntradasCtx(...)`, `parseRowEntrada(row, index, ctx)`, `entradaRowToEntradaMaterial(dados, criadoPor)`. Sem React, sem IO. |
| `src/utils/importEntradasPecas.test.ts` | Unit tests do util. |
| `src/components/manutencao/almoxarifado/ImportEntradasModal.tsx` | Modal fino: monta o ctx com dados dos hooks, delega UI ao `ImportExcelModal`, dispara o insert em lote. |
| `useImportarEntradasMaterial` em `src/hooks/useEntradasMaterial.ts` | Mutation: um `insert` com array de rows; invalida `entradas_material`, `saldo_estoque_total`, `saldo_estoque_deposito`. |

### Ponto de entrada na UI

Botão "Importar entradas (Excel)" na seção de almoxarifado do
`AlmoxarifadoPage.tsx`, ao lado de "Nova entrada".

## Planilha (template para download)

| # | Coluna | Regra |
|---|---|---|
| 0 | Depósito | nome de depósito ativo (case-insensitive, trim); não achou = erro |
| 1 | Fornecedor | nome de fornecedor ativo (idem); não achou = erro |
| 2 | Nota fiscal | obrigatório |
| 3 | Data | data serial do Excel ou `dd/mm/aaaa`; inválida/vazia = erro |
| 4 | SKU | opcional; se preenchido casa por SKU |
| 5 | Peça (nome) | fallback de match quando SKU vazio; obrigatório se SKU vazio |
| 6 | Quantidade | número > 0 (aceita vírgula decimal BR) |
| 7 | Valor unitário | número >= 0 (aceita vírgula BR); `valorTotal = qty * vUnit` |

## Validações

Por linha (no `parseRowEntrada`):
- Depósito, fornecedor, NF, data, quantidade e valor conforme tabela acima.
- Peça: SKU não cadastrado, ou nome não cadastrado quando sem SKU, = erro.
  Só casa com insumos `ativo && usadoEmManutencao` (mesmo filtro do modal manual).
- NF já lançada no banco: chave `fornecedorId + notaFiscal (trim, lower)`
  contra as `entradas_material` existentes = erro em toda linha dessa NF.
- Duplicata no arquivo: mesma NF + mesma peça repetida = erro na repetição.

Contexto (`criarEntradasCtx`) recebe: insumos, depósitos, fornecedores e
entradas existentes; pré-indexa mapas por nome/SKU e o set de NFs lançadas.
Acumulador de duplicatas do arquivo reseta em `index === 0` (mesmo padrão do
`parseRowPeca`).

## Gravação

- Cada linha válida vira uma row de `entradas_material` (mesma tabela e mapper
  da entrada manual). `obra_id` vem do depósito da linha.
- Data: a planilha traz só a data; a entrada é gravada com horário fixo 12:00
  daquele dia, serializada exatamente como o `NovaEntradaModal` serializa hoje
  (mesmo mapper `entradaMaterialToDb`), pra não criar dois formatos na tabela.
  A regra wall-clock do projeto vale: o dia digitado na planilha é o dia
  gravado e exibido, sem deslocamento de fuso.
- Insert em lote (um `.insert(array)`), não N chamadas.
- Sucesso: toast com contagem, invalidação das três query keys.

## Fora de escopo

- Criar peça automaticamente a partir da planilha.
- Export de entradas para Excel.
- Import de saídas de estoque.
- Leitura de DANFE (já prevista em PR separado).

## Testes

Unit no util, no molde do `importPecasAlmoxarifado.test.ts`:
- match por SKU, match por nome, SKU inexistente, nome inexistente
- depósito/fornecedor inexistente ou inativo
- NF já lançada bloqueia todas as linhas da NF
- duplicata intra-arquivo (NF + peça)
- parse de número BR (vírgula) e de data (serial Excel e dd/mm/aaaa)
- `entradaRowToEntradaMaterial` monta a entidade com obraId do depósito
