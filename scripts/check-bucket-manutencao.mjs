// Valida se o bucket 'manutencao-fotos' existe e é privado.
// Uso: node scripts/check-bucket-manutencao.mjs
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gunyitwrbxbmnezokgjq.supabase.co',
  'sb_publishable_vNp6YsxujUlGNQA5sXH7sg_CNF3NPrG'
);

const BUCKET = 'manutencao-fotos';

async function main() {
  const { data, error } = await supabase.storage.getBucket(BUCKET);
  if (error) {
    console.error(`[bucket] '${BUCKET}' — ERRO: ${error.message}`);
    process.exit(1);
  }
  if (!data) {
    console.error(`[bucket] '${BUCKET}' — não encontrado`);
    process.exit(1);
  }
  console.log(`[bucket] '${BUCKET}' encontrado.`);
  console.log(`  public: ${data.public}`);
  console.log(`  file_size_limit: ${data.file_size_limit ?? 'sem limite'}`);
  console.log(`  allowed_mime_types: ${data.allowed_mime_types ?? 'qualquer'}`);
  if (data.public) {
    console.warn('  ⚠️  Bucket está PÚBLICO — esperado: privado.');
    process.exit(2);
  }
  console.log('  ✓ Privado, OK.');
}
main();
