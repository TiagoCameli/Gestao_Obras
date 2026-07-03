# Baixa de estoque ao lançar peça/óleo no serviço — design

**Data:** 2026-07-02
**App:** Gestão de Obras (Vite + React + TS + Supabase)
**Pedido do Tiago:** ao registrar um serviço de manutenção, a peça/óleo tem que (1) mostrar a unidade, (2) só aparecer se estiver disponível num almoxarifado, (3) dizer de qual almoxarifado sai, (4) puxar o preço da entrada. E dar **baixa** no estoque desse almoxarifado.

## Decisões travadas (com o Tiago)
1. **Dá baixa** no estoque do almoxarifado escolhido (reverte o "peça não baixa estoque" do redesign do caderno).
2. **Custo travado no custo médio** da entrada (não digitado).
3. **Óleo híbrido:** sai do almoxarifado com baixa/custo/depósito E mantém o tipo pro alerta de vencimento. Tipo vem **automático** do cadastro do óleo (marca o tipo no insumo), sem segunda seleção.

## Descoberta-chave (o banco já faz a baixa de peça)
`v_saldo_estoque` (por insumo+depósito) calcula `saldo = entradas + transf_in − saídas − transf_out − os_pecas(ativas, deposito_id não nulo)` e `custo_medio = Σvalor_entradas / Σqtd_entradas`. O trigger `tg_os_pecas_valida_saldo` barra saldo insuficiente. Hook `useSaldoEstoquePorDeposito(insumoId)` entrega saldo+custoMedio+depósito por insumo. Logo, uma `os_pecas` com `deposito_id` **já debita** (via view) e o estorno ao remover é automático. Faltou o frontend usar isso.

## Peça — só frontend (`AdicionarPecaOSModal`)
- Lista de peças: só insumos `usadoEmManutencao` com **saldo > 0** em algum depósito.
- Ao escolher a peça: carrega `useSaldoEstoquePorDeposito(insumoId)`; o select de **depósito é obrigatório** e mostra só os depósitos com saldo > 0 (com o saldo ao lado).
- **Unidade** exibida (do insumo).
- **Custo unitário** = `custoMedio` do (insumo, depósito) escolhido, campo **read-only**.
- **Quantidade** limitada ao saldo do depósito (aviso "Disponível: X" + bloqueio de submit se exceder). Backstop: trigger no banco.
- `depositoId` sempre preenchido → baixa via view; remover a peça estorna (automático).
- `status` continua `'reservada'` por baixo dos panos (não exibido). `unidade_medida_id` segue como está (exibe a unidade string, não popula o FK — fora de escopo).
- **Sem migration.**

## Óleo — híbrido (`AdicionarOleoOSModal` + banco)
- `os_oleos` ganha `insumo_id` (FK `insumos`, nullable) + `deposito_id` (FK `depositos_material`, nullable). Mantém `tipo_oleo_id` (vencimento).
- `insumos` ganha `tipo_oleo_id` (FK `tipos_oleo`, nullable) — marca "este insumo é um óleo do tipo X".
- Modal de óleo: lista só insumos com `tipo_oleo_id` não nulo E saldo > 0; escolhe → depósito (com saldo) → **unidade e custo (= custo_medio) automáticos** → `tipo_oleo_id` derivado do insumo (sem segunda seleção).
- `valor_unitario` = `custoMedio`; `valor_total` segue gerado (qtd × valor_unitario).
- `v_saldo_estoque`: passa a descontar também o consumo de `os_oleos` (CTE espelho do os_pecas: OS ativa, `deposito_id` não nulo, `insumo_id` não nulo). Assim óleo debita e o custo bate.
- Trigger `tg_os_oleos_valida_saldo` (espelho do de peça) barra saldo insuficiente de óleo.
- `v_oleos_vencendo` **não muda** (segue usando `os_oleos.tipo_oleo_id`).

## Migration (uma, versionada _fix/_rollback, via MCP com ok do Tiago)
1. `ALTER TABLE os_oleos ADD COLUMN insumo_id text REFERENCES insumos(id)` + `deposito_id text REFERENCES depositos_material(id)` (nullable).
2. `ALTER TABLE insumos ADD COLUMN tipo_oleo_id text REFERENCES tipos_oleo(id)` (nullable).
3. `CREATE OR REPLACE VIEW v_saldo_estoque` acrescentando o CTE `osoleos_agg` na subtração do saldo (preservando todo o resto da view).
4. Função + trigger `tg_os_oleos_valida_saldo` em `os_oleos` (BEFORE INSERT/UPDATE), espelhando `tg_os_pecas_valida_saldo`.
5. Sem chave de permissão nova.

## Cadastro (`PecaFormModal`)
Campo novo opcional "Tipo de óleo (se for óleo)" — select de `tipos_oleo` ativos; grava `insumos.tipo_oleo_id`. Marca o insumo como óleo pro modal de óleo e pro vencimento.

## Compatibilidade
Peças/óleos lançados antes (sem depósito) seguem válidos e **não** dão baixa (deposito_id nulo → view ignora). Nada retroativo.

## Fora de escopo (YAGNI)
- Popular `os_pecas.saida_material_id` / criar linha em `saidas_material` (a baixa é via view, não precisa de saída física).
- FIFO/lote específico (custo é médio ponderado, como já é).
- Devolução parcial / status consumida-vs-reservada na UI.

## Testes
- **Unit (Vitest):** funções puras de montagem do item de peça/óleo (deriva custo do custoMedio, valida qtd ≤ saldo, monta OSPeca/OSOleo com deposito/insumo). Filtro "só com saldo".
- **Migration:** aplicar via MCP; conferir que `v_saldo_estoque` desconta os_oleos (inserir óleo de teste com depósito e ver saldo cair; remover e voltar); trigger barra saldo insuficiente.
- **Manual (produção, com cleanup):** cadastrar 1 peça-óleo no almoxarifado (com tipo) + dar entrada; registrar serviço consumindo peça e óleo; ver saldo cair no almoxarifado; remover e ver voltar; tentar exceder o saldo (bloqueia); conferir vencimento ainda funciona. Apagar tudo de teste.

## Verificação de fechamento
`npx tsc -b`, `npx eslint` nos arquivos tocados, `npx vitest run` (fora as 12 falhas pré-existentes do fifoCombustivel), `npx vite build` limpos. Migration aplicada com ok do Tiago; deploy pelo push da main (deploy ANTES de nada que dependa; a migration é aditiva e compatível, pode ir antes ou junto).
