// Seed das tabelas do módulo de Manutenção a partir de JSONs em
// manutencao-app/seed/data/. Idempotente (upsert por id).
//
// Estrutura esperada dos JSONs (todos em snake_case, mesmo formato do banco):
//   manutencao-app/seed/data/equipment-models/*.json   → equipamento_modelos
//   manutencao-app/seed/data/maintenance-tasks/*.json  → manutencao_tarefas
//   manutencao-app/seed/data/fluids-catalog.json       → manutencao_fluidos (formato: { fluids: [...] })
//   manutencao-app/seed/data/parts-catalog.json        → manutencao_pecas   (formato: { parts:  [...] })
//
// USO:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seedManutencao.mjs
//
// ou via npm:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed:manutencao
//
// Como obter a service role key:
//   Supabase Dashboard → Project Settings → API → Project API keys → service_role
//
// IMPORTANTE: a service role key BYPASSA RLS. Nunca commite ela em .env do
// front. Use .env.local (já gitignorado) ou passe inline.

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://gunyitwrbxbmnezokgjq.supabase.co';

const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error(
    '✗ ERRO: SUPABASE_SERVICE_ROLE_KEY não definida.\n' +
      '\n' +
      'Como obter:\n' +
      '  1. Acesse https://supabase.com/dashboard\n' +
      '  2. Selecione o projeto\n' +
      '  3. Project Settings → API → Project API keys → service_role\n' +
      '  4. Copie a chave (começa com eyJ...)\n' +
      '\n' +
      'Como passar:\n' +
      '  SUPABASE_SERVICE_ROLE_KEY=eyJ... npm run seed:manutencao\n' +
      '\n' +
      'Ou crie/edite .env.local com SUPABASE_SERVICE_ROLE_KEY=eyJ... e rode:\n' +
      '  node --env-file=.env.local scripts/seedManutencao.mjs\n' +
      '\n' +
      'NUNCA commite essa chave em .env (use .env.local que está gitignorado).'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROOT = 'manutencao-app/seed/data';
const DIR_MODELOS = path.join(ROOT, 'equipment-models');
const DIR_TAREFAS = path.join(ROOT, 'maintenance-tasks');
const FILE_FLUIDOS = path.join(ROOT, 'fluids-catalog.json');
const FILE_PECAS = path.join(ROOT, 'parts-catalog.json');

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function existePath(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function listarJsons(dir) {
  const nomes = await readdir(dir);
  return nomes.filter((n) => n.toLowerCase().endsWith('.json')).sort();
}

async function lerJson(filepath) {
  const raw = await readFile(filepath, 'utf-8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// 1. equipamento_modelos
// ---------------------------------------------------------------------------

async function seedModelos() {
  const out = { ok: 0, erros: 0, pulados: 0 };
  if (!(await existePath(DIR_MODELOS))) {
    console.log(`⚠  ${DIR_MODELOS}/ não existe — pulando modelos.`);
    return out;
  }

  const arquivos = await listarJsons(DIR_MODELOS);
  if (arquivos.length === 0) {
    console.log(`⚠  Nenhum .json em ${DIR_MODELOS}/`);
    return out;
  }

  console.log(`\n[1/4] Modelos (${arquivos.length} arquivo(s))`);
  for (const nome of arquivos) {
    const filepath = path.join(DIR_MODELOS, nome);
    let row;
    try {
      row = await lerJson(filepath);
    } catch (e) {
      console.error(`  ✗ ${nome}: JSON malformado (${e.message})`);
      out.pulados += 1;
      continue;
    }

    if (!row.id) {
      console.error(`  ✗ ${nome}: campo "id" obrigatório ausente`);
      out.pulados += 1;
      continue;
    }

    const { error } = await supabase
      .from('equipamento_modelos')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error(`  ✗ ${row.id}: ${error.message}`);
      out.erros += 1;
      continue;
    }

    console.log(`  ✓ Modelo cadastrado: ${row.id}`);
    out.ok += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 2. manutencao_tarefas
// ---------------------------------------------------------------------------

async function seedTarefas() {
  const out = { ok: 0, erros: 0, pulados: 0 };
  if (!(await existePath(DIR_TAREFAS))) {
    console.log(`⚠  ${DIR_TAREFAS}/ não existe — pulando tarefas.`);
    return out;
  }

  const arquivos = await listarJsons(DIR_TAREFAS);
  if (arquivos.length === 0) {
    console.log(`⚠  Nenhum .json em ${DIR_TAREFAS}/`);
    return out;
  }

  // Carrega ids de modelos existentes uma vez só pra validar FK em memória
  const { data: modelosRows, error: errMod } = await supabase
    .from('equipamento_modelos')
    .select('id');
  if (errMod) {
    console.error(`  ✗ Falha ao listar modelos para validação: ${errMod.message}`);
    out.erros += 1;
    return out;
  }
  const modelosExistentes = new Set((modelosRows ?? []).map((r) => r.id));

  console.log(`\n[2/4] Tarefas (${arquivos.length} arquivo(s))`);
  for (const nome of arquivos) {
    const filepath = path.join(DIR_TAREFAS, nome);
    let row;
    try {
      row = await lerJson(filepath);
    } catch (e) {
      console.error(`  ✗ ${nome}: JSON malformado (${e.message})`);
      out.pulados += 1;
      continue;
    }

    if (!row.id || !row.modelo_id) {
      console.error(`  ✗ ${nome}: campos "id" e "modelo_id" são obrigatórios`);
      out.pulados += 1;
      continue;
    }

    if (!modelosExistentes.has(row.modelo_id)) {
      console.error(
        `  ⚠ ${row.id}: modelo_id="${row.modelo_id}" não existe — pulando`
      );
      out.pulados += 1;
      continue;
    }

    const { error } = await supabase
      .from('manutencao_tarefas')
      .upsert(row, { onConflict: 'id' });

    if (error) {
      console.error(`  ✗ ${row.id}: ${error.message}`);
      out.erros += 1;
      continue;
    }

    console.log(`  ✓ Tarefa cadastrada: ${row.id}`);
    out.ok += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 3. manutencao_fluidos (arquivo único)
// ---------------------------------------------------------------------------

async function seedFluidos() {
  const out = { ok: 0, erros: 0, pulados: 0 };
  if (!(await existePath(FILE_FLUIDOS))) {
    console.log(`⚠  ${FILE_FLUIDOS} não existe — pulando fluidos.`);
    return out;
  }

  let payload;
  try {
    payload = await lerJson(FILE_FLUIDOS);
  } catch (e) {
    console.error(`  ✗ ${FILE_FLUIDOS}: JSON malformado (${e.message})`);
    out.pulados += 1;
    return out;
  }

  const fluidos = Array.isArray(payload?.fluids) ? payload.fluids : null;
  if (!fluidos) {
    console.error(`  ✗ ${FILE_FLUIDOS}: esperado { "fluids": [...] }`);
    out.pulados += 1;
    return out;
  }

  console.log(`\n[3/4] Fluidos (${fluidos.length} item(ns))`);
  for (const row of fluidos) {
    if (!row?.id) {
      console.error(`  ✗ Fluido sem "id" — pulando`);
      out.pulados += 1;
      continue;
    }
    const { error } = await supabase
      .from('manutencao_fluidos')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ ${row.id}: ${error.message}`);
      out.erros += 1;
      continue;
    }
    console.log(`  ✓ Fluido cadastrado: ${row.id}`);
    out.ok += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. manutencao_pecas (arquivo único)
// ---------------------------------------------------------------------------

async function seedPecas() {
  const out = { ok: 0, erros: 0, pulados: 0 };
  if (!(await existePath(FILE_PECAS))) {
    console.log(`⚠  ${FILE_PECAS} não existe — pulando peças.`);
    return out;
  }

  let payload;
  try {
    payload = await lerJson(FILE_PECAS);
  } catch (e) {
    console.error(`  ✗ ${FILE_PECAS}: JSON malformado (${e.message})`);
    out.pulados += 1;
    return out;
  }

  const pecas = Array.isArray(payload?.parts) ? payload.parts : null;
  if (!pecas) {
    console.error(`  ✗ ${FILE_PECAS}: esperado { "parts": [...] }`);
    out.pulados += 1;
    return out;
  }

  console.log(`\n[4/4] Peças (${pecas.length} item(ns))`);
  for (const row of pecas) {
    if (!row?.part_number) {
      console.error(`  ✗ Peça sem "part_number" — pulando`);
      out.pulados += 1;
      continue;
    }
    const { error } = await supabase
      .from('manutencao_pecas')
      .upsert(row, { onConflict: 'part_number' });
    if (error) {
      console.error(`  ✗ ${row.part_number}: ${error.message}`);
      out.erros += 1;
      continue;
    }
    console.log(`  ✓ Peça cadastrada: ${row.part_number}`);
    out.ok += 1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seed Manutenção — ${SUPABASE_URL}`);
  console.log(`Lendo de: ${ROOT}/`);

  const modelos = await seedModelos();
  const tarefas = await seedTarefas();
  const fluidos = await seedFluidos();
  const pecas = await seedPecas();

  console.log('\n──────────────────────────────────────────');
  console.log('Resumo:');
  console.log(
    `  Modelos: ${modelos.ok} ok, ${modelos.pulados} pulado(s), ${modelos.erros} erro(s)`
  );
  console.log(
    `  Tarefas: ${tarefas.ok} ok, ${tarefas.pulados} pulado(s), ${tarefas.erros} erro(s)`
  );
  console.log(
    `  Fluidos: ${fluidos.ok} ok, ${fluidos.pulados} pulado(s), ${fluidos.erros} erro(s)`
  );
  console.log(
    `  Peças:   ${pecas.ok} ok, ${pecas.pulados} pulado(s), ${pecas.erros} erro(s)`
  );
  console.log('──────────────────────────────────────────');

  const totalErros = modelos.erros + tarefas.erros + fluidos.erros + pecas.erros;
  if (totalErros > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Falha geral:', e);
  process.exit(1);
});
