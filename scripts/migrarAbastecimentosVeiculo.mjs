// Backfill: para cada abastecimento.veiculo, tenta resolver o equipamento_id real.
// Estratégia (em ordem):
//   1. Se veiculo === equipamento.id → match direto
//   2. Se veiculo === equipamento.nome → match exato por nome
//   3. Se veiculo === equipamento.codigo_patrimonio → match por patrimônio
//   4. Se veiculo for normalizado (lowercase, sem espaço extra) bate com nome → match
//   5. Caso contrário → fica null (com log)
//
// USO: node --env-file=.env.local scripts/migrarAbastecimentosVeiculo.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gunyitwrbxbmnezokgjq.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY ausente'); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim().replace(/\s+/g, ' ');
}

/** Normalização "fuzzy": também remove hífens, zeros à esquerda em sufixos numéricos
 *  ("- 01" / "-01" / " - 1" → " 1") e tudo virá um único token separado por espaço.
 */
function normFuzzy(s) {
  return norm(s)
    .replace(/[-]+/g, ' ')                    // hífens viram espaço
    .replace(/\s+/g, ' ')
    .replace(/\b0+(\d)/g, '$1')               // 01 → 1
    .trim();
}

async function main() {
  console.log('Carregando equipamentos...');
  const { data: equipsRaw } = await sb.from('equipamentos').select('id, nome, codigo_patrimonio');
  const equips = equipsRaw ?? [];
  const byId = new Map(equips.map(e => [e.id, e]));
  const byNomeNorm = new Map(equips.map(e => [norm(e.nome), e]));
  const byNomeFuzzy = new Map(equips.map(e => [normFuzzy(e.nome), e]));
  const byPatrim = new Map(equips.filter(e => e.codigo_patrimonio).map(e => [norm(e.codigo_patrimonio), e]));
  const byPatrimFuzzy = new Map(equips.filter(e => e.codigo_patrimonio).map(e => [normFuzzy(e.codigo_patrimonio), e]));
  console.log(`  ${equips.length} equipamentos no catálogo`);

  console.log('Carregando abastecimentos...');
  const { data: ab } = await sb.from('abastecimentos').select('id, veiculo, equipamento_id');
  const total = ab?.length ?? 0;
  console.log(`  ${total} lançamentos`);

  const stats = { jaResolvido: 0, semVeiculo: 0, matchId: 0, matchNome: 0, matchPatrim: 0, matchFuzzy: 0, naoEncontrado: new Map() };

  for (const a of ab ?? []) {
    if (a.equipamento_id) { stats.jaResolvido += 1; continue; }
    if (!a.veiculo) { stats.semVeiculo += 1; continue; }

    let eq = null;
    let how = '';
    const v = a.veiculo;
    const vN = norm(v);
    const vF = normFuzzy(v);
    if (byId.has(v)) { eq = byId.get(v); how = 'matchId'; }
    else if (byNomeNorm.has(vN)) { eq = byNomeNorm.get(vN); how = 'matchNome'; }
    else if (byPatrim.has(vN)) { eq = byPatrim.get(vN); how = 'matchPatrim'; }
    else if (byNomeFuzzy.has(vF)) { eq = byNomeFuzzy.get(vF); how = 'matchFuzzy'; }
    else if (byPatrimFuzzy.has(vF)) { eq = byPatrimFuzzy.get(vF); how = 'matchFuzzy'; }

    if (eq) {
      stats[how] += 1;
      const { error } = await sb.from('abastecimentos').update({ equipamento_id: eq.id }).eq('id', a.id);
      if (error) console.error(`  ✗ ${a.id}: ${error.message}`);
    } else {
      stats.naoEncontrado.set(a.veiculo, (stats.naoEncontrado.get(a.veiculo) ?? 0) + 1);
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log('Resumo:');
  console.log(`  Já tinham equipamento_id: ${stats.jaResolvido}`);
  console.log(`  Sem veiculo (campo vazio): ${stats.semVeiculo}`);
  console.log(`  Match por id direto:       ${stats.matchId}`);
  console.log(`  Match por nome exato:      ${stats.matchNome}`);
  console.log(`  Match por patrimônio:      ${stats.matchPatrim}`);
  console.log(`  Match fuzzy (variação):    ${stats.matchFuzzy}`);
  console.log(`  Não encontrados:           ${[...stats.naoEncontrado.values()].reduce((s, n) => s + n, 0)} lançamentos / ${stats.naoEncontrado.size} valores únicos`);
  console.log('──────────────────────────────────────────');

  if (stats.naoEncontrado.size > 0) {
    console.log('\nValores de "veiculo" sem match (top 20):');
    const ordenados = [...stats.naoEncontrado.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20);
    ordenados.forEach(([v, n]) => console.log(`  [${n}x] ${v}`));
    if (stats.naoEncontrado.size > 20) console.log(`  ... e mais ${stats.naoEncontrado.size - 20} valores únicos`);
  }
}

main().catch(e => { console.error('Falha:', e); process.exit(1); });
