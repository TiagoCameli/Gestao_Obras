-- Padroniza o nome dos motoristas da Andrade Transporte nos abastecimentos
--
-- Nos 212 abastecimentos da Andrade (mn921nnyuvp1t) o campo `motorista` é texto
-- livre e acumulou 19 grafias para 7 pessoas: "Reginaldo", "REGINALDO",
-- "REGINALDO DA SILVA" e até "REINALDO" para o mesmo motorista.
--
-- O nome completo canônico NÃO foi inventado: veio da tabela `fretes`, onde os
-- mesmos motoristas aparecem escritos por extenso e sempre casados com a mesma
-- placa.
--
--   REGINALDO DA SILVA          UAP0I50
--   ARNILDON REIS ALVES         RSX0D29 / RSX0E39
--   DOMINGOS PEREIRA            QLY7F25
--   EDILSON MONTE DE BARROS     UAP0H80
--   ADALTO FRANCELINO DA SILVA  UAP0E80
--
-- FORA deste fix, de propósito:
--   - "André" (UAP0I40) e "Altino" (QLY7F15): não existe nome completo em
--     lugar nenhum do banco. Precisam vir do Tiago.
--   - Os 47 lançamentos SEM motorista: identificar não é o mesmo que preencher.
--   - As variações de PLACA (RSXOD29, TSX0D29, UAPO150...): outro assunto.
--
-- "REINALDO" (1 lançamento, 25/06, placa UAP0I50) entra como REGINALDO DA
-- SILVA: é a placa dele, e é 1 ocorrência contra 78 na mesma placa. É a única
-- linha deste fix que depende de julgamento, não de correspondência exata.
--
-- Ensaiado em transação desfeita: 81 linhas mudam, e valor_total, conta
-- corrente e preço médio FIFO ficam com delta ZERO — `motorista` não entra em
-- cálculo nenhum.
--
-- Rollback: rollback_motoristas_andrade_nome_completo.sql

begin;

create table if not exists public.saidas_motorista_backup_20260826 as
select id, motorista
  from public.saidas_combustivel
 where transportadora_id = 'mn921nnyuvp1t'
   and deleted_at is null;

comment on table public.saidas_motorista_backup_20260826 is
  'Backup de fix_motoristas_andrade_nome_completo.sql (26/08/2026). DROP previsto 26/10/2026.';

update public.saidas_combustivel s
   set motorista = m.canonico
  from (values
    ('reginaldo',                  'REGINALDO DA SILVA'),
    ('reginaldo da silva',         'REGINALDO DA SILVA'),
    ('reinaldo',                   'REGINALDO DA SILVA'),
    ('arnildon',                   'ARNILDON REIS ALVES'),
    ('arnildon reis',              'ARNILDON REIS ALVES'),
    ('arnildon reis alves',        'ARNILDON REIS ALVES'),
    ('domingos',                   'DOMINGOS PEREIRA'),
    ('domingos pereira',           'DOMINGOS PEREIRA'),
    ('edilson',                    'EDILSON MONTE DE BARROS'),
    ('edilson monte de barros',    'EDILSON MONTE DE BARROS'),
    ('adalto',                     'ADALTO FRANCELINO DA SILVA'),
    ('adalto francelino da silva', 'ADALTO FRANCELINO DA SILVA')
  ) as m(chave, canonico)
 where s.transportadora_id = 'mn921nnyuvp1t'
   and s.deleted_at is null
   and lower(btrim(s.motorista, E' \t\r\n')) = m.chave
   and s.motorista is distinct from m.canonico;

-- Guardas
do $$
declare n int;
begin
  select count(*) into n
    from public.saidas_combustivel s
    join public.saidas_motorista_backup_20260826 b on b.id = s.id
   where s.valor_total is distinct from (
     select valor_total from public.saidas_combustivel x where x.id = b.id);
  if n <> 0 then raise exception 'valor_total mudou em % linha(s). Abortando.', n; end if;

  -- Nenhum lançamento que TINHA motorista pode ter ficado sem.
  select count(*) into n
    from public.saidas_motorista_backup_20260826 b
    join public.saidas_combustivel s on s.id = b.id
   where btrim(coalesce(b.motorista,''), E' \t\r\n') <> ''
     and btrim(coalesce(s.motorista,''), E' \t\r\n') = '';
  if n <> 0 then raise exception '% linha(s) perderam o motorista. Abortando.', n; end if;
end $$;

commit;
