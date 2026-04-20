import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gunyitwrbxbmnezokgjq.supabase.co',
  'sb_publishable_vNp6YsxujUlGNQA5sXH7sg_CNF3NPrG'
);

// Tentar com login
const email = process.argv[2];
const password = process.argv[3];

async function main() {
  if (email && password) {
    const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
    if (loginError) {
      console.error('Erro login:', loginError.message);
      process.exit(1);
    }
    console.log('Login OK');
  }

  const { data, error, count } = await supabase
    .from('abastecimentos')
    .select('id', { count: 'exact' })
    .limit(3);

  console.log('Count:', count, 'Data length:', data?.length, 'Error:', error?.message || 'none');
  if (data?.length > 0) console.log('Primeiro:', data[0]);
}
main();
