-- Andrade Transporte: normaliza as placas e preenche o motorista que faltava
--
-- Continuação de fix_motoristas_andrade_nome_completo.sql (que unificou as
-- grafias do nome). Decidido pelo Tiago em 26/08/2026.
--
-- ETAPA 1 — PLACAS
-- `placa` é texto livre e acumulou erro de digitação clássico de OCR/teclado:
-- letra O no lugar do zero, 1 no lugar do I, T no lugar do R, espaço sobrando.
-- Resultado: 18 placas distintas para 9 carretas, o que estraga qualquer
-- relatório por veículo e o indicador "Qtd de placas diferentes" do extrato.
--
--   RSXOD29, TSX0D29  -> RSX0D29
--   UAPO150, UAO0I50, UAP0150, "UAP0I 50" -> UAP0I50
--   UAPOH80 -> UAP0H80
--   RSXOC29 -> RSX0C29
--
-- ETAPA 2 — MOTORISTA
-- 47 lançamentos estavam sem motorista, concentrados de março a junho (o campo
-- passou a ser preenchido depois). Cada placa canônica aponta para EXATAMENTE
-- um motorista — conferido antes de aplicar, `count(distinct motorista) = 1`
-- em todas as placas. Sem essa checagem o preenchimento seria chute.
--
-- FERNANDO SOUZA LOPES (RSX0C29) não aparece em nenhuma saída com motorista;
-- o nome vem da tabela `fretes`, mesma fonte dos outros nomes completos.
--
-- FICA DE FORA, de propósito:
--   - O lançamento mt8xfv6x97umm, de 17/08, que está SEM PLACA. O motorista é
--     ARNILDON REIS ALVES, mas ele dirige DUAS carretas (RSX0D29 e RSX0E39),
--     então a placa é ambígua. Só o Tiago resolve.
--   - QLY7F15 (Altino). Parece erro de QLY7F25 (Domingos), mas o motorista é
--     outro, então não é erro de digitação óbvio — pode ser outra carreta.
--   - "André" segue só com o primeiro nome, por decisão do Tiago.
--
-- Ensaiado em transação desfeita: 18 placas + 47 motoristas mudam, e
-- valor_total e conta corrente ficam com delta ZERO. Nem placa nem motorista
-- entram em cálculo — a linha de controle é que as 65 linhas mudam mesmo.
--
-- Rollback: rollback_andrade_placas_e_motoristas.sql

begin;

create table if not exists public.saidas_andrade_backup2_20260826 as
select id, placa, motorista, valor_total
  from public.saidas_combustivel
 where transportadora_id = 'mn921nnyuvp1t'
   and deleted_at is null;

comment on table public.saidas_andrade_backup2_20260826 is
  'Backup de fix_andrade_placas_e_motoristas.sql (26/08/2026). DROP previsto 26/10/2026.';

-- ETAPA 1a — placas digitadas errado
update public.saidas_combustivel s
   set placa = m.canon
  from (values
    ('UAP0I 50','UAP0I50'), ('UAPO150','UAP0I50'), ('UAO0I50','UAP0I50'), ('UAP0150','UAP0I50'),
    ('RSXOD29','RSX0D29'),  ('TSX0D29','RSX0D29'),
    ('UAPOH80','UAP0H80'),  ('RSXOC29','RSX0C29')
  ) as m(errada, canon)
 where s.transportadora_id = 'mn921nnyuvp1t'
   and s.deleted_at is null
   and upper(btrim(s.placa, E' \t\r\n')) = m.errada;

-- ETAPA 1b — espaço sobrando e caixa baixa no resto
update public.saidas_combustivel s
   set placa = upper(btrim(s.placa, E' \t\r\n'))
 where s.transportadora_id = 'mn921nnyuvp1t'
   and s.deleted_at is null
   and s.placa is not null and s.placa <> ''
   and s.placa is distinct from upper(btrim(s.placa, E' \t\r\n'));

-- ETAPA 2 — motorista pela placa, só onde está vazio
update public.saidas_combustivel s
   set motorista = m.nome
  from (values
    ('UAP0I50','REGINALDO DA SILVA'),
    ('RSX0D29','ARNILDON REIS ALVES'),
    ('RSX0E39','ARNILDON REIS ALVES'),
    ('UAP0H80','EDILSON MONTE DE BARROS'),
    ('QLY7F25','DOMINGOS PEREIRA'),
    ('UAP0E80','ADALTO FRANCELINO DA SILVA'),
    ('RSX0C29','FERNANDO SOUZA LOPES'),
    ('UAP0I40','André')
  ) as m(placa, nome)
 where s.transportadora_id = 'mn921nnyuvp1t'
   and s.deleted_at is null
   and btrim(coalesce(s.motorista,''), E' \t\r\n') = ''
   and upper(btrim(coalesce(s.placa,''), E' \t\r\n')) = m.placa;

-- Guardas
do $$
declare n int;
begin
  select count(*) into n
    from public.saidas_combustivel s
    join public.saidas_andrade_backup2_20260826 b on b.id = s.id
   where round(s.valor_total,4) <> round(b.valor_total,4);
  if n <> 0 then raise exception 'valor_total mudou em % linha(s). Abortando.', n; end if;

  -- Nenhuma placa pode ter sido apagada ou trocada por outra carreta.
  select count(*) into n
    from public.saidas_andrade_backup2_20260826 b
    join public.saidas_combustivel s on s.id = b.id
   where btrim(coalesce(b.placa,''), E' \t\r\n') <> ''
     and btrim(coalesce(s.placa,''), E' \t\r\n') = '';
  if n <> 0 then raise exception '% linha(s) perderam a placa. Abortando.', n; end if;

  -- Nenhum motorista que já existia pode ter sido sobrescrito.
  select count(*) into n
    from public.saidas_andrade_backup2_20260826 b
    join public.saidas_combustivel s on s.id = b.id
   where btrim(coalesce(b.motorista,''), E' \t\r\n') <> ''
     and s.motorista is distinct from b.motorista;
  if n <> 0 then raise exception '% motorista(s) existente(s) foram sobrescritos. Abortando.', n; end if;
end $$;

commit;
