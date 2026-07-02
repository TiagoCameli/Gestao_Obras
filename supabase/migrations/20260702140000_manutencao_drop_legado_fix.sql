-- Manutenção — caderno de serviços: drop do legado (planos preventivos, agenda,
-- checklists pré-uso, mão de obra própria e fluxo de status de OS).
--
-- Decisão do Tiago (2026-07-02): remover planos preventivos e checklists do app
-- INTEIRO (Frota + Mobile inclusos), banco incluído. App-side removido no commit
-- que precede esta migration. Dado exportado antes em
-- outputs/gestao-obras-manutencao-drop/2026-07-02/backup-legado/ (840 linhas).
--
-- PRESERVADO de propósito:
--   - coluna ordens_servico.status (vestigial, default 'concluida', usada em queries);
--   - colunas ordens_servico.custo_servico_terceiro / custo_mao_obra_propria
--     (o sync offline do mobile ainda faz INSERT com esses campos = 0);
--   - função/trigger tg_os_sync_equipamento_status (sync de status da máquina,
--     domínio Frota, não referencia nada que cai).

-- (1) Triggers na tabela sobrevivente ordens_servico que dependem do legado.
--     Precisam de DROP explícito (CASCADE das tabelas não os remove).
DROP TRIGGER IF EXISTS trg_os_grava_transicao_ins ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_grava_transicao_upd ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_registra_execucao_atividade ON public.ordens_servico;

-- (2) Funções órfãs (gravar transição de status, registrar execução de atividade
--     preventiva, somar mão de obra). CASCADE varre triggers remanescentes que as usem.
DROP FUNCTION IF EXISTS public.tg_os_grava_transicao() CASCADE;
DROP FUNCTION IF EXISTS public.registra_execucao_atividade_em_conclusao() CASCADE;
DROP FUNCTION IF EXISTS public.tg_sync_custo_mao_obra_os() CASCADE;

-- (3) Views legadas.
DROP VIEW IF EXISTS public.v_proximas_preventivas;
DROP VIEW IF EXISTS public.v_checklists_nao_conformidades;

-- (4) Tabelas. CASCADE leva FKs internas ao grupo, índices, policies RLS e
--     triggers próprios. Nenhuma tabela sobrevivente referencia estas (verificado).
DROP TABLE IF EXISTS public.os_transicoes CASCADE;
DROP TABLE IF EXISTS public.os_mao_obra CASCADE;
DROP TABLE IF EXISTS public.checklist_respostas CASCADE;
DROP TABLE IF EXISTS public.checklist_execucoes CASCADE;
DROP TABLE IF EXISTS public.checklist_perguntas CASCADE;
DROP TABLE IF EXISTS public.checklists_template CASCADE;
DROP TABLE IF EXISTS public.plano_atividade_pecas CASCADE;
DROP TABLE IF EXISTS public.execucoes_atividade CASCADE;
DROP TABLE IF EXISTS public.equipamento_plano CASCADE;
DROP TABLE IF EXISTS public.plano_atividades CASCADE;
DROP TABLE IF EXISTS public.planos_preventivos CASCADE;

-- (5) Scrub das chaves de ação removidas em funcionarios.acoes_permitidas.
UPDATE public.funcionarios
SET acoes_permitidas = array(
  SELECT a FROM unnest(acoes_permitidas) AS a
  WHERE a NOT IN (
    'gerenciar_checklists','aplicar_plano_preventivo_equip',
    'ver_planos_preventivos','criar_plano_preventivo','editar_plano_preventivo',
    'excluir_plano_preventivo','ver_agenda_preventiva',
    'ver_checklists','criar_checklist','executar_checklist',
    'bloquear_equipamento_checklist','executar_checklist_mobile',
    'aba_manutencao_planos','aba_manutencao_agenda','aba_manutencao_checklists',
    'adicionar_mao_obra_os','mudar_status_os','aprovar_os','cancelar_os'
  )
)
WHERE acoes_permitidas && ARRAY[
  'gerenciar_checklists','aplicar_plano_preventivo_equip',
  'ver_planos_preventivos','criar_plano_preventivo','editar_plano_preventivo',
  'excluir_plano_preventivo','ver_agenda_preventiva',
  'ver_checklists','criar_checklist','executar_checklist',
  'bloquear_equipamento_checklist','executar_checklist_mobile',
  'aba_manutencao_planos','aba_manutencao_agenda','aba_manutencao_checklists',
  'adicionar_mao_obra_os','mudar_status_os','aprovar_os','cancelar_os'
]::text[];
