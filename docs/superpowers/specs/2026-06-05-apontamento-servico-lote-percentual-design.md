# Apontamento por Serviço em lote — porcentagem por horas de cada funcionário

**Data:** 2026-06-05
**Módulo:** `src/modules/apontamento`
**Status:** aprovado (aguardando plano de implementação)

## Problema

Na aba **Apontamento por Serviço**, o usuário já pode selecionar vários funcionários
e lançar o mesmo conjunto de serviços de uma vez, distribuindo as horas por
porcentagem do dia. Mas o lançamento em lote tem uma limitação:

- `LancamentoServicoModal` calcula `baseHoras = Math.min(...horasPorFunc)` (a **menor**
  quantidade de horas entre os selecionados).
- `replaceApontamentosDoDia` grava as **mesmas horas absolutas** para todos os
  funcionários.

Consequência: quem trabalhou mais que o mínimo fica com horas "pendentes". Ex.: João
bateu 8h, Maria 6h; num split 60/40 com base 6h, os dois recebem 3,6h + 2,4h, e João
fica com 2h não apropriadas.

## Objetivo

No lançamento em lote, a porcentagem deve ser aplicada sobre as **horas reais de cada
funcionário** (vindas do ponto), de modo que o dia de cada um feche 100%.

- João 8h, Maria 6h, split 60/40 → João 4,80h + 3,20h; Maria 3,60h + 2,40h.

## Abordagem escolhida

**Cirúrgica:** alterar apenas o modo lote. O modo de 1 funcionário (que já aplica a %
sobre as horas da própria pessoa, pois `baseHoras` = horas dela) permanece **inalterado**.
Decisão tomada por risco: os números do modo individual alimentam a folha; não mexer no
que já está correto e validado.

Abordagem alternativa descartada: unificar os dois modos em porcentagem canônica — mais
limpo, mas reescreve o caminho individual já validado, sem ganho que justifique o risco
agora.

## Mudanças

### 1. Camada de dados — `src/modules/apontamento/utils/apontamentoServicoApi.ts`

Nova função, sem tocar na `replaceApontamentosDoDia` existente (usada pelo modo individual):

```ts
export interface LinhaServicoPct {
  servicoId: string | null;
  pct: number;            // 0..100, % do dia de CADA funcionário
  tipo: TipoApontamento;
  motivoImprodutivo?: string | null;
  observacao?: string | null;
}

export async function replaceApontamentosDoDiaPorPct(input: {
  funcionarioIds: string[];
  data: string;
  linhas: LinhaServicoPct[];
  horasPorFunc: Record<string, number>;
}): Promise<void>
```

Comportamento:

1. Apaga os apontamentos existentes dos `funcionarioIds` na `data` (igual hoje).
2. Para **cada** funcionário, com `hf = horasPorFunc[fid]`:
   - Para cada linha ativa (pct > 0): `horas_i = round2(pct_i/100 × hf)`.
   - A **última** linha ativa absorve o drift de arredondamento, de forma que a soma
     das horas daquele funcionário seja exatamente `round2(hf)`.
   - Gera 1 row por funcionário × linha ativa (mesmos campos de hoje: `servico_id`
     null em improdutivo, `motivo_improdutivo` só em improdutivo, `registrado_por_id` =
     usuário logado).
3. Insere todas as rows num único `insert`.

A lógica de distribuição/arredondamento reaproveita o padrão já existente no modal
(`arred2`, `distribuirIgualmente`), aplicada por funcionário.

### 2. Modal — `src/modules/apontamento/components/LancamentoServicoModal.tsx`

`bulk = funcionarioIds.length > 1`.

- **1 funcionário (não-bulk):** nenhuma mudança. Mantém campos Horas + % e salva via
  `replaceApontamentosDoDia` (absoluto).
- **Vários (bulk):**
  - Os campos de cada serviço passam a ser **só "% do dia"** — o campo de horas
    absolutas some, porque cada funcionário tem total diferente.
  - A soma das % deve fechar **100%**. Adicionar/remover/editar uma linha redistribui as
    % mantendo a soma em 100 (reaproveita `compensarAposEdicao` / `distribuirEntreTodas`
    com base = 100 em vez de `baseHoras`).
  - Substitui a nota "Base de horas (menor entre os selecionados)" por uma explicação de
    que a % é aplicada sobre as horas de cada um.
  - **Prévia por pessoa** (bloco novo): lista cada funcionário selecionado com suas horas
    de ponto e quanto cai em cada serviço, recalculando ao vivo conforme as % mudam.
    Ex.: `João — 8,00h → A 4,80h · B 3,20h`; `Maria — 6,00h → A 3,60h · B 2,40h`.
  - Validação (bulk): soma das % = 100 (±tolerância); serviço obrigatório em linha
    produtiva; motivo obrigatório em improdutiva; sem serviço repetido.
  - Salva via `replaceApontamentosDoDiaPorPct` passando `horasPorFunc`.

### 3. Aba — `src/modules/apontamento/components/ApontamentoServicoTab.tsx`

Sem mudança estrutural: já faz o multi-select, o botão "Lançar serviço para N
selecionados" e passa `horasPorFunc` ao modal. Só confirmar que `horasPorFunc` continua
chegando completo para os selecionados (já chega).

### 4. Teste

Teste unitário do cálculo % → horas por pessoa (arquivo novo, ex.
`apontamentoServicoPct.test.ts` ou função pura extraída):

- Split 60/40 sobre 8h e 6h → fecha 100% em cada (8,00h e 6,00h), valores 4,80/3,20 e
  3,60/2,40.
- Caso com drift de arredondamento (ex. 3 serviços 33,33% sobre 7h) fecha exatamente 7h.
- Linha improdutiva entra no rateio normalmente.

## Fora de escopo (não muda)

- Banco/migração: a tabela `apont_apontamentos_servico` continua guardando horas
  absolutas. Nada de DDL.
- Modo individual (1 funcionário).
- Aba de Aprovação, Dashboard, Histórico, Registro de Ponto.
- Cálculo de folha.

## Critério de sucesso

Selecionar 2+ funcionários com horas de ponto diferentes, lançar um split por %, salvar,
e cada funcionário ficar com status "completo" (apropriado = ponto), sem pendência
artificial.
