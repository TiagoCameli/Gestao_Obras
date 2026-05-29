# Combustível: trava de saldo negativo + trava de ciclo fechado

**Data:** 2026-05-29
**Módulo:** Combustível (Gestão Obras)
**Tipo:** 1 bug (saldo negativo) + 1 regra de negócio nova (ciclo fechado)

## Problema

1. **Saldo negativo.** O app deixa lançar/editar saída que joga o saldo do tanque pra baixo de zero. A validação atual no banco (`fn_validate_saida_combustivel`) só compara `litros > saldo` **na data da própria saída**, não olha o efeito nas saídas posteriores. Uma saída retroativa ou no meio do histórico passa na checagem mas deixa um ponto posterior negativo. O nível do tanque usa `GREATEST(..., 0)`, então o negativo fica escondido no número final.

2. **Edição retroativa bagunça o saldo.** Depois que um tanque zera e recebe combustível novo, editar quantidade/data/tanque de movimentos do ciclo anterior corrompe o saldo de todos os ciclos seguintes.

## Modelo de saldo (fonte da verdade)

Mesmo modelo que o `recalcular_nivel_deposito` já usa:

```
saldo = entradas + transferências recebidas − saídas − transferências enviadas − esvaziamentos
```

Avaliado em ordem cronológica (`data`/`data_hora`, desempate por `id`). Tolerância de **0,001 L** pra comparações de zero (arredondamento). **Tanques externos** (`eh_externo = true`, ex: Transterra Areacre) ficam fora de tudo: não têm lote nem controle de estoque nosso.

Estado atual dos dados: nenhum tanque próprio tem ponto negativo no histórico (mínimos ≥ 0). Meloza Colorado e Canteiro 1 já zeraram. Não há dado sujo pra contornar; a trava pode ser rígida desde já.

## Trava 1 — Saldo nunca negativo

**Regra:** nenhuma operação pode deixar o saldo corrido do tanque abaixo de zero em **nenhum ponto** da linha do tempo (não só na data do movimento).

**Banco (autoritativo):** gatilho `AFTER INSERT/UPDATE/DELETE` em `entradas_combustivel`, `saidas_combustivel` e `transferencias_combustivel`. Depois da mudança, recalcula o saldo corrido do(s) tanque(s) afetado(s) e, se o mínimo ficar abaixo de `−0,001`, `RAISE EXCEPTION` (rollback da transação) com mensagem clara (tanque, data do ponto que estourou, déficit). Pega inserção retroativa, edição e exclusão de entrada/transferência que derrubaria saldo posterior. Externos isentos.

**App:** melhorar o aviso de "saldo insuficiente" no `SaidaCombustivelForm` pra checar a linha do tempo a partir da data da saída (mínimo ≥ 0), não só a data dela. Mensagem amigável antes de tentar salvar. O banco é a garantia final.

## Trava 2 — Ciclo fechado

**Marco do ciclo:** uma **entrada de combustível OU transferência recebida** que chega com o tanque **zerado** (saldo ≤ 0,001 L imediatamente antes dela). Esse movimento abre um novo ciclo e fecha o anterior.
- Entrada/transferência em tanque que ainda tem combustível (completar) **não** é marco; o ciclo continua.
- Tanque que zerou no consumo mas ainda não recebeu combustível **não** trava nada; aquelas saídas seguem no ciclo aberto.

**Início do ciclo aberto** = data do marco mais recente. Tudo com data **antes** dele está em **ciclo fechado**.

**Em ciclo fechado, fica TRAVADO** (banco + app), em saída, entrada e transferência:
- `tanque` (origem/destino), quantidade (`litros`/`quantidade_litros`), `data`, `tipo_combustivel`.
- **Exclusão** do movimento.

**Continua LIBERADO:**
- Saída: equipamento, obra, etapa, fotos, observação, medição.
- Entrada/transferência: fornecedor, nota fiscal, fotos, observação.

**Banco (autoritativo):** função `private.inicio_ciclo_aberto(tanque)` retorna o timestamp do marco mais recente. Gatilho de validação em UPDATE bloqueia se algum campo travado mudou e a data do registro `< inicio_ciclo_aberto`. Gatilho em DELETE bloqueia exclusão de registro em ciclo fechado. `RAISE EXCEPTION` com mensagem clara. Externos isentos.

**App:** no `SaidaCombustivelForm`, `EntradaForm` e `TransferenciaForm`, quando o registro está em ciclo fechado, desabilitar os campos travados com aviso "Ciclo fechado: tanque já zerou e recebeu combustível novo. Só dá pra ajustar equipamento, obra, etapa, fotos, observação e medição." Esconder/desabilitar o botão de excluir nessas linhas.

## Fora de escopo (itens relacionados, separados)

- Mostrar transferências recebidas na aba **Entradas** (hoje só aparecem na aba Transferências). Melhoria de tela, será tratada à parte.

## Testes

- Unit (SQL/lógica de saldo): inserção retroativa que derruba ponto posterior → rejeitada; edição de entrada reduzindo litros → rejeitada se downstream negativa; saída no limite exato (saldo = litros) → aceita.
- Ciclo: definir marco por entrada em tanque zerado e por transferência recebida em tanque zerado; top-up em tanque cheio não cria marco; editar campo travado em ciclo fechado → rejeitado; editar campo liberado → aceito; excluir em ciclo fechado → rejeitado; editar no ciclo aberto → aceito.
- App: campos desabilitados e avisos coerentes com o estado.

## Entrega e rollback

- 1 migration de fix + 1 de rollback (padrão do projeto), aplicada direto no Supabase.
- Ajustes nos forms do app, commit em main, deploy Vercel.
- Rollback: dropar os gatilhos/funções novos; restaurar `fn_validate_saida_combustivel` anterior. Sem alteração de dado (as travas só validam, não reescrevem), então rollback é só de schema.
