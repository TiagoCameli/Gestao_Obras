-- Renomeia o tipo de serviço "Sinalização Vertical" para "Sinalização"
-- nos registros existentes. As colunas internas (sinalizacao_vertical jsonb)
-- permanecem com o nome anterior — apenas o label visível muda.

UPDATE public.rodotracker_activities
   SET service = 'Sinalização'
 WHERE service = 'Sinalização Vertical';
