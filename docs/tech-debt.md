# Débito Técnico

Lista de itens conhecidos que não estão no escopo imediato mas precisam ser
endereçados em algum momento. Cada item referencia o turno/contexto onde
foi identificado.

---

## Adicionar `created_at` / `updated_at` em fretes, pagamentos_frete, abastecimentos_carreta

**Identificado em:** Refatoração Frete + Combustível + Conta Corrente, Fase 1a
(turno onde tivemos que decodar o ID em base36 pra inferir hora de inserção
de 3 fretes com `transportadora_id IS NULL`).

**Contexto:** as 3 tabelas foram criadas antes do versionamento de migrations
e nunca ganharam colunas de auditoria temporal. A única coluna temporal hoje
é `data` (data semântica do evento, não da inserção — pode ser retroativa).

**Workaround atual:** o `id` é gerado client-side via
`Date.now().toString(36) + Math.random().toString(36).slice(2,7)`. Os 8
primeiros caracteres encodam `Date.now()` em base36 e podem ser decodados
pra inferir hora de inserção com precisão de segundo. Frágil — depende da
convenção de geração de ID se manter.

**Plano sugerido (quando entrar em escopo):**

1. Migration: `ALTER TABLE ... ADD COLUMN created_at timestamptz NOT NULL
   DEFAULT now(), ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now()`.
2. Backfill `created_at` decodando do ID:
   `UPDATE ... SET created_at = to_timestamp(('x' || lpad(substring(id, 1, 8), 16, '0'))::bit(64)::bigint::numeric / 1000)`.
3. Trigger `BEFORE UPDATE` pra manter `updated_at` atualizado.
4. Atualizar mappers TS e tipos.

**Não é bloqueante** pra refatoração atual — usar decode do ID resolve casos
pontuais. Mas vai voltar a morder em qualquer auditoria temporal séria.

---

## Badge "EXTERNO" no card do TanqueList

**Identificado em:** Refatoração Frete + Combustível, Fase 1b (planejamento).

**Contexto:** o depósito virtual `Transterra (Areacre)` (id `mori6yyt9owm9`)
aparece junto com os tanques internos no `TanqueList`. UX seria melhor com um
badge visual destacando que ele é controlado por terceiro.

**Plano sugerido:** adicionar pill âmbar "EXTERNO — Areacre" no card quando
`deposito.eh_externo = true`. Cosmético, não-bloqueante. Pode entrar junto
com a Fase 4 (telas novas).

---

## IDs canônicos de seed

IDs gerados client-side e hardcoded em migrations de seed. Referenciar daqui
pra evitar ambiguidade em migrations futuras / scripts de backfill.

| Constante | Valor | Origem | Significado |
|---|---|---|---|
| `DEPOSITO_VIRTUAL_TRANSTERRA_ID` | `mori6yyt9owm9` | Migration `20260505060000` | Depósito virtual Transterra (Areacre); `eh_externo=true`. Não tem estoque interno — só amarra movimentos pra conta-corrente da Areacre. |
