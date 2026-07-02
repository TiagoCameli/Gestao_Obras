CREATE OR REPLACE VIEW public.v_oleos_vencendo AS
WITH ultima AS (
  SELECT o.tipo_oleo_id,
         os.equipamento_id,
         max(os.data_abertura::date) AS ultima_troca
  FROM public.os_oleos o
  JOIN public.ordens_servico os ON os.id = o.os_id AND os.deleted_at IS NULL
  GROUP BY o.tipo_oleo_id, os.equipamento_id
)
SELECT u.equipamento_id,
       e.nome AS equipamento_nome,
       u.tipo_oleo_id,
       t.nome AS tipo_oleo_nome,
       t.aplicacao,
       u.ultima_troca,
       t.intervalo_meses,
       (u.ultima_troca + make_interval(months => t.intervalo_meses))::date AS data_vencimento,
       ((u.ultima_troca + make_interval(months => t.intervalo_meses))::date - CURRENT_DATE) AS dias_para_vencer,
       CASE
         WHEN (u.ultima_troca + make_interval(months => t.intervalo_meses))::date < CURRENT_DATE THEN 'vencido'
         WHEN (u.ultima_troca + make_interval(months => t.intervalo_meses))::date <= CURRENT_DATE + 30 THEN 'a_vencer'
         ELSE 'ok'
       END AS situacao
FROM ultima u
JOIN public.tipos_oleo t ON t.id = u.tipo_oleo_id
JOIN public.equipamentos e ON e.id = u.equipamento_id
WHERE t.intervalo_meses IS NOT NULL;

GRANT SELECT ON public.v_oleos_vencendo TO authenticated;
