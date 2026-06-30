# Manutenção — Caderno de Serviços (redesign)

**Data:** 2026-06-30
**App:** Gestão de Obras (Vite + React + TS + Supabase)
**Decisão do Tiago:** transformar o módulo Manutenção num caderno de registro de todos os serviços feitos nos equipamentos, padronizado para relatórios completos.

## Objetivo

Hoje o Manutenção é uma Ordem de Serviço com fluxo pesado (status machine, aprovação, planos preventivos, agenda, checklists). O Tiago quer um **caderno de serviços enxuto**: escolher a máquina, registrar o serviço, lançar peças, serviços de terceiros e trocas de óleo, e tirar relatórios completos por máquina.

## Decisões travadas (com o Tiago, 2026-06-30)

1. **Caderno enxuto, sem status** — todo registro é um serviço já feito. Sem fluxo de aprovação/status.
2. **Sem mão de obra própria** — só peças + terceiros + óleo.
3. **Peças vêm do catálogo do almoxarifado** (insumos). Almoxarifado permanece no módulo.
4. **Óleo tem lista própria** (tabela de tipos de óleo, semeada e editável), não se mistura com peça.
5. **Alerta de troca de óleo por tipo, por data** — cada tipo de óleo tem seu intervalo em meses (motor ≠ hidráulico). Alerta por máquina + tipo.
6. **Removidos** planos preventivos, agenda preventiva e checklists pré-uso (app + banco).
7. Abordagem: **evoluir a OS existente**, não recriar do zero (reaproveita máquina, número, data, horímetro, fotos, soma de custos, relatório).

## Modelo de dados

### Tabela espinha: `ordens_servico` (evoluída → "Serviço de Manutenção")
Reaproveitada. Mudanças:
- `tipo` CHECK expandido: `preventiva | corretiva | troca_oleo | lubrificacao | pneu | solda | eletrica | revisao_geral | outro` (mantém os antigos que já existem por compatibilidade).
- Fluxo de status **removido da UI**. Coluna `status` fica vestigial com default `'concluida'` (evita refactor amplo de queries) e não é exposta.
- `custo_mao_obra_propria` sai da soma.
- Novo: `custo_terceiros numeric(14,2) default 0` e `custo_oleos numeric(14,2) default 0`.
- `custo_total` regenerado: `custo_pecas + custo_terceiros + custo_oleos`.
- Campos reaproveitados: `equipamento_id` (máquina), `data_abertura` (data do serviço), `medicao_abertura` (horímetro/km), `defeito_reportado`/`solucao_aplicada`/`observacoes` (descrição do que foi feito), `foto_urls`, `arquivo_urls`, numeração automática, auditoria.

### `os_pecas` (existe, mantida)
`insumo_id` (catálogo), `quantidade`, `custo_unitario` (pré-preenchido do cadastro, editável), `custo_total` (gerado = qtd × unit). **Não baixa estoque** — só registro. Soma em `ordens_servico.custo_pecas` via trigger (já existe).

### `os_terceiros` (NOVA)
`id, os_id (FK ordens_servico ON DELETE CASCADE), prestador text, descricao text, valor numeric(14,2), nota_fiscal text NULL, created_at, created_by`. Trigger soma `valor` em `ordens_servico.custo_terceiros`.

### `os_oleos` (NOVA)
`id, os_id (FK CASCADE), tipo_oleo_id (FK tipos_oleo), quantidade numeric, unidade text CHECK ('L','kg'), valor_unitario numeric(14,2), valor_total numeric(14,2) GENERATED (quantidade × valor_unitario), created_at, created_by`. Trigger soma `valor_total` em `ordens_servico.custo_oleos`.

### `tipos_oleo` (NOVA, apoio)
`id, nome text, aplicacao text CHECK ('motor','hidraulico','transmissao','diferencial','graxa','outro'), intervalo_meses int NULL (null = sem alerta), ativo boolean default true, created_at, created_by`.
Semeada: Óleo Motor 15W40 (motor, 6m), Óleo Hidráulico 68 (hidraulico, 12m), Óleo Transmissão 85W140 (transmissao, 12m), Óleo Diferencial (diferencial, 12m), Graxa (graxa, null), ATF (transmissao, 12m). Editável pelo usuário.

### View: `v_oleos_vencendo`
Por (`equipamento_id`, `tipo_oleo_id`): última troca daquele tipo naquela máquina + `intervalo_meses` → `data_vencimento`; flag `vencido`/`a_vencer` (janela ex. 30 dias). Só para tipos com `intervalo_meses` não nulo.

### Triggers
- Mantém o trigger de soma de `os_pecas` → `custo_pecas`.
- Novos: soma `os_terceiros` → `custo_terceiros`; soma `os_oleos.valor_total` → `custo_oleos` (INSERT/UPDATE/DELETE).
- `custo_total` continua coluna gerada, agora sobre os três.

## Telas

1. **Lista de serviços** (principal, `/manutencao` ou `/manutencao/servicos`): tabela de todos os serviços, filtro por máquina, período e tipo, coluna de custo total e subtotais. É o "caderno".
2. **Registrar / editar serviço**: máquina, data, tipo, horímetro/km, descrição; três seções (Peças / Terceiros / Óleos) cada uma com sua lista e soma; rodapé com total geral. Fotos/anexos.
3. **Detalhe do serviço**: dados + as três listas + fotos; editar/excluir.
4. **Tipos de óleo** (cadastro): CRUD da lista de óleos com intervalo em meses.
5. **Painel de óleos vencendo**: lista "máquina X, óleo do motor vence DD/MM" (vencido/a vencer). Também resumido no dashboard.
6. **Dashboard** reformado: custo por máquina e por tipo de serviço, total do mês, óleos vencendo. (Remove os widgets de preventivas que vão sumir.)

## Relatórios (Excel + PDF, padrão da marca)
1. **Por máquina**: histórico de serviços num período, com subtotal por categoria (peças / terceiros / óleo) e total geral.
2. **Mensal da frota**: serviços do mês, custo por máquina e por tipo.
3. **Trocas de óleo**: histórico + próximas a vencer.

## O que sai (app + banco, migration versionada)
- **Planos preventivos + agenda + checklists**: tabelas `planos_preventivos`, `plano_atividades`, `plano_atividade_pecas`, `equipamento_plano`, `execucoes_atividade`, view `v_proximas_preventivas`, `checklists_modelos`, `execucoes_checklist` (+ triggers/funções). Componentes `PlanosPreventivosPage`, `planos/*`, `AgendaPreventivasPage`, `ChecklistsPage`, `checklists/*`. Rotas `/manutencao/planos`, `/manutencao/agenda`, `/manutencao/checklists`.
- **Mão de obra**: tabela `os_mao_obra` + UI + modal.
- **Status workflow**: tabela `os_transicoes` + trigger `tg_os_grava_transicao` + modais de status/aprovação.
- **Permissões**: removidas `ver/criar/editar/excluir_plano_preventivo`, `ver_agenda_preventiva`, `ver/criar/executar_checklist`, `bloquear_equipamento_checklist`, `mudar_status_os`, `aprovar_os`, `cancelar_os`, `adicionar_mao_obra_os`; abas `aba_manutencao_planos/_agenda/_checklists`. Novas: `adicionar_terceiro_os`, `adicionar_oleo_os`, `gerenciar_tipos_oleo`. Mantidas `ver_manutencao`, `criar_os`, `editar_os`, `excluir_os`, `adicionar_peca_os`, `ver_custos`, e as do almoxarifado.
- **Almoxarifado FICA** (alimenta as peças).
- Scrub das chaves removidas em `funcionarios.acoes_permitidas`.

## Premissas confirmadas
1. Peça não baixa estoque (só registro). 
2. Valor unitário da peça pré-preenchido do cadastro, editável.
3. Terceiros: prestador em texto livre (não exige cadastrar fornecedor).

## Riscos / cuidados
- Dado de teste apenas (a 1 OS de teste + 0 nas tabelas de plano/checklist). Confirmar contagem antes de dropar.
- Dashboard e `manutencaoPdfExport.ts` referenciam preventivas — reformar junto pra não quebrar.
- `tipo` enum: ALTER do CHECK preservando valores antigos.
- Verificar (como nas remoções de Engenharia/Compras) que nada fora do módulo importa os componentes/hooks removidos.

## Fora de escopo (por ora)
- Baixa automática de estoque pela peça.
- Mão de obra própria.
- Planos preventivos / checklists (removidos; podem voltar como projeto próprio depois se o Tiago quiser).
