-- Padroniza o nome do fornecedor "EMT Transportes" pra "EMT TRANSPORTES"
-- alinhando com a forma canônica usada em fretes/abastecimentos/pagamentos.
-- Sem isso, o dropdown de transportadora no filtro de fretes não casa com
-- o transportadora dos fretes (strict equality em case-sensitive).

UPDATE fornecedores
SET nome = 'EMT TRANSPORTES'
WHERE trim(lower(nome)) = 'emt transportes'
  AND nome <> 'EMT TRANSPORTES';
