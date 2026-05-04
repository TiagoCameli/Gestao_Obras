// Dry-run: lista todos os nomes de transportadora distintos em
//   fretes.transportadora ∪ pagamentos_frete.transportadora ∪ abastecimentos_carreta.transportadora
// e propõe o mapping bruto → canônico → fornecedor_id.
//
// NÃO faz nenhum INSERT/UPDATE — só SELECTs. Roda local sem mexer no banco.
//
// USO:  node --env-file=.env.local --env-file=.env scripts/dryrunNormalizeTransportadoras.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gunyitwrbxbmnezokgjq.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY ausente'); process.exit(1); }

const sb = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// Consolidações manuais (nome canônico final por chave normalizada).
// Origem: regra existente em FreteDashboard.tsx (Amazonia ≡ EMT Transportes).
const CONSOLIDACOES = new Map([
  ['amazonia agroindustria', 'EMT Transportes'],
  ['emt transportes', 'EMT Transportes'],
]);

// Aliases comuns (variações de capitalização/grafia → canônico).
// Adicione aqui se notar nomes esquisitos no relatório.
const ALIASES = new Map([
  ['transportadora triunfo', 'Transportadora Triunfo'],
  ['triunfo', 'Transportadora Triunfo'],
  ['areacre', 'Areacre'],
  ['etam construtora', 'ETAM Construtora'],
  ['etam', 'ETAM Construtora'],
  ['andrade transporte', 'Andrade Transporte'],
  ['andrade transportes', 'Andrade Transporte'],
  ['emt construtora', 'EMT Construtora'],
]);

function canonicalizar(nomeBruto) {
  const n = norm(nomeBruto);
  if (!n) return null;
  if (CONSOLIDACOES.has(n)) return CONSOLIDACOES.get(n);
  if (ALIASES.has(n)) return ALIASES.get(n);
  // Default: capitaliza palavras
  return nomeBruto.trim().replace(/\s+/g, ' ');
}

async function fetchAll(table, col) {
  const { data, error } = await sb.from(table).select(`${col}`);
  if (error) throw new Error(`${table}.${col}: ${error.message}`);
  return (data ?? []).map((r) => r[col]).filter(Boolean);
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('DRY-RUN: Normalização de transportadoras');
  console.log('═══════════════════════════════════════════════════════════════\n');

  const [fretesNomes, pagNomes, abastNomes, fornecedores] = await Promise.all([
    fetchAll('fretes', 'transportadora'),
    fetchAll('pagamentos_frete', 'transportadora'),
    fetchAll('abastecimentos_carreta', 'transportadora'),
    sb.from('fornecedores').select('id,nome,cnpj,ativo').then((r) => r.data ?? []),
  ]);

  // Frequência por nome bruto
  const freq = new Map(); // norm → { brutos: Set<string>, fretes:n, pag:n, abast:n }
  function bump(nomeBruto, kind) {
    const k = norm(nomeBruto);
    if (!k) return;
    if (!freq.has(k)) freq.set(k, { brutos: new Set(), fretes: 0, pag: 0, abast: 0 });
    const e = freq.get(k);
    e.brutos.add(nomeBruto);
    e[kind]++;
  }
  fretesNomes.forEach((n) => bump(n, 'fretes'));
  pagNomes.forEach((n) => bump(n, 'pag'));
  abastNomes.forEach((n) => bump(n, 'abast'));

  // Index fornecedores por norm(nome)
  const fornByNorm = new Map();
  for (const f of fornecedores) {
    const k = norm(f.nome);
    if (!fornByNorm.has(k)) fornByNorm.set(k, []);
    fornByNorm.get(k).push(f);
  }

  // Monta tabela
  const linhas = [];
  for (const [k, info] of freq.entries()) {
    const brutos = Array.from(info.brutos);
    const canon = canonicalizar(brutos[0]);
    const canonKey = norm(canon);
    const matches = fornByNorm.get(canonKey) ?? [];
    const fornecedorMatch = matches[0] ?? null;
    linhas.push({
      brutos,
      normKey: k,
      canonico: canon,
      fornecedorId: fornecedorMatch?.id ?? null,
      fornecedorNome: fornecedorMatch?.nome ?? null,
      qtdMatchesFornecedores: matches.length,
      consolidado: CONSOLIDACOES.has(k),
      fretes: info.fretes,
      pag: info.pag,
      abast: info.abast,
      total: info.fretes + info.pag + info.abast,
    });
  }
  linhas.sort((a, b) => b.total - a.total);

  console.log('### Mapping proposto (brutos → canônico → fornecedor_id)\n');
  console.log('Total de nomes brutos distintos (após norm):', linhas.length);
  console.log('Fornecedores cadastrados hoje:', fornecedores.length);
  console.log();

  console.log('| # | Nome bruto | → Canônico | Fornecedor (match) | Consolidado? | Fretes | Pag | Abast | Σ |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  linhas.forEach((l, i) => {
    const brutosStr = l.brutos.map((b) => `"${b}"`).join(' / ');
    const fornStr = l.fornecedorMatch
      ? `${l.fornecedorNome} (${l.fornecedorId})`
      : l.fornecedorId
        ? `${l.fornecedorNome} (${l.fornecedorId})`
        : '⚠️  SEM MATCH — criar nova';
    console.log(
      `| ${i + 1} | ${brutosStr} | ${l.canonico} | ${l.fornecedorId ? `${l.fornecedorNome} (${l.fornecedorId})` : '⚠️ CRIAR'} | ${l.consolidado ? 'Sim' : ''} | ${l.fretes} | ${l.pag} | ${l.abast} | ${l.total} |`
    );
  });

  // Casos sem match
  const semMatch = linhas.filter((l) => !l.fornecedorId);
  console.log('\n### Casos SEM match em fornecedores (precisam ser criados):\n');
  if (semMatch.length === 0) {
    console.log('Nenhum — todos os nomes têm correspondente em `fornecedores`.');
  } else {
    semMatch.forEach((l) => {
      console.log(`- "${l.canonico}" — usado em ${l.total} registro(s) (fretes=${l.fretes}, pag=${l.pag}, abast=${l.abast}). Brutos: ${l.brutos.map((b) => `"${b}"`).join(', ')}`);
    });
  }

  // Casos com múltiplos matches
  const multiMatch = linhas.filter((l) => l.qtdMatchesFornecedores > 1);
  console.log('\n### Casos com MÚLTIPLOS fornecedores no mesmo nome canônico (ambíguos):\n');
  if (multiMatch.length === 0) {
    console.log('Nenhum.');
  } else {
    multiMatch.forEach((l) => {
      const matches = fornByNorm.get(norm(l.canonico)) ?? [];
      console.log(`- "${l.canonico}":`);
      matches.forEach((f) => console.log(`    • ${f.id} — "${f.nome}" (cnpj=${f.cnpj || '∅'}, ativo=${f.ativo})`));
    });
  }

  // Consolidações
  console.log('\n### Consolidações manuais aplicadas:\n');
  for (const [k, v] of CONSOLIDACOES.entries()) {
    const linhasAlvo = linhas.filter((l) => norm(l.canonico) === norm(v) && l.normKey !== norm(v));
    if (linhasAlvo.length || k !== norm(v)) {
      console.log(`- "${k}" → "${v}"`);
    }
  }

  console.log('\n═══════════════════════════════════════════════════════════════');
  console.log('FIM DRY-RUN. Nada foi alterado no banco.');
  console.log('═══════════════════════════════════════════════════════════════');
}

main().catch((e) => { console.error('Erro:', e.message); process.exit(1); });
