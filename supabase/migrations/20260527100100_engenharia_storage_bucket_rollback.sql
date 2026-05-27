-- Rollback de 20260527100000_engenharia_storage_bucket_fix.sql

begin;

drop policy if exists engenharia_arquivos_storage_select on storage.objects;
drop policy if exists engenharia_arquivos_storage_insert on storage.objects;
drop policy if exists engenharia_arquivos_storage_update on storage.objects;
drop policy if exists engenharia_arquivos_storage_delete on storage.objects;

-- Bucket: remover objetos primeiro (se houver) antes de drop.
-- Em prod, isso pode envolver dados — confirmar antes!
-- delete from storage.objects where bucket_id = 'engenharia-arquivos';
-- delete from storage.buckets where id = 'engenharia-arquivos';

-- Por segurança, o rollback NÃO apaga o bucket nem seus objetos por default.
-- Se você quer apagar mesmo, descomente as 2 linhas acima e re-rode.

commit;
