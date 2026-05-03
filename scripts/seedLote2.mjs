// Seed do Lote 2: 7 modelos não-Cat + tarefas (camelCase EN no JSON, mapeadas
// para snake_case PT do banco). Idempotente (upsert por id).
//
// USO:
//   SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/seedLote2.mjs
//   ou:
//   node --env-file=.env.local scripts/seedLote2.mjs
//
// REGRAS DE INSERÇÃO ESPECIAIS PARA Cat 320C:
//   - A tarefa pré-existente `cat-320c-h500-engine-oil-fuel` NÃO é tocada.
//   - Das 4 tarefas novas do Lote 2 da 320C, a `task-cat-320c-500h` é PULADA
//     (já existe equivalente). As outras 3 (250h, 1000h, 2000h) entram.

import { createClient } from '@supabase/supabase-js';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://gunyitwrbxbmnezokgjq.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('✗ ERRO: SUPABASE_SERVICE_ROLE_KEY não definida.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ROOT = 'manutencao-app/seed/lote2';
const DIR_MODELOS = path.join(ROOT, 'equipment-models');
const DIR_TAREFAS = path.join(ROOT, 'equipment-tasks');
const CRIADO_POR = 'seed:lote2';

const TAREFAS_CAT_320C_PULAR = new Set(['task-cat-320c-500h']);

// ─── helpers ──────────────────────────────────────────────────────────────

async function listarJsons(dir) {
  return (await readdir(dir)).filter((n) => n.toLowerCase().endsWith('.json')).sort();
}

async function lerJson(filepath) {
  return JSON.parse(await readFile(filepath, 'utf-8'));
}

/** Deriva categoria do banco a partir do sufixo do id da tarefa. */
function categoriaDoId(id) {
  if (id.endsWith('-diaria')) return 'diaria';
  if (id.endsWith('-250h')) return 'h_250';
  if (id.endsWith('-500h')) return 'h_500';
  if (id.endsWith('-1000h')) return 'h_1000';
  if (id.endsWith('-2000h')) return 'h_2000';
  return 'sob_demanda';
}

function mapearPecas(parts) {
  if (!Array.isArray(parts)) return [];
  return parts.map((p) => ({
    partNumber: p.partNumber,
    quantity: p.quantity ?? 1,
    notes: p.type ? `tipo: ${p.type}` : undefined,
  }));
}

function mapearFluidos(fluids) {
  if (!Array.isArray(fluids)) return [];
  return fluids.map((f) => {
    const litros =
      typeof f.consumoEstimadoL === 'number'
        ? f.consumoEstimadoL
        : typeof f.consumoEstimadoKg === 'number'
          ? f.consumoEstimadoKg
          : 0;
    const notas = [];
    if (typeof f.consumoEstimadoKg === 'number') notas.push(`${f.consumoEstimadoKg}kg de graxa`);
    if (f.tipo) notas.push(`tipo: ${f.tipo}`);
    return {
      fluidoId: f.fluidoId,
      quantityLiters: litros,
      notes: notas.length ? notas.join(' · ') : undefined,
    };
  });
}

function tarefaParaInsert(json) {
  return {
    id: json.id,
    modelo_id: json.modeloId,
    titulo: json.title ?? json.titulo,
    categoria: categoriaDoId(json.id),
    intervalo_horas: json.intervalHours ?? null,
    intervalo_dias: json.intervalDays ?? null,
    prioridade: json.priority ?? 'media',
    executor_papel: 'mecanico_propio',
    duracao_estimada_min: null,
    pecas_necessarias: mapearPecas(json.parts),
    fluidos_necessarios: mapearFluidos(json.fluids),
    ferramentas_necessarias: [],
    procedimento: json.procedimento ?? [],
    descricao_tecnica: json.description ?? json.descricao_tecnica ?? '',
    sistemas_afetados: json.sistemas_afetados ?? [],
    torques: [],
    specs_tecnicas: [],
    criterios_aceite: json.criterios_aceite ?? [],
    sinais_alerta: json.sinais_alerta ?? [],
    notas_seguranca: null,
    epi: null,
    notas_tecnicas: null,
    manual_referencia: null,
    pre_requisitos: null,
    ativo: json.ativo ?? true,
    criado_por: CRIADO_POR,
  };
}

// ─── seed: modelos ────────────────────────────────────────────────────────

async function seedModelos() {
  const out = { ok: 0, atualizados: 0, erros: 0, fluidosRefs: new Set() };
  const arquivos = await listarJsons(DIR_MODELOS);

  // Pré-busca ids existentes pra distinguir insert vs update
  const { data: existRaw } = await supabase.from('equipamento_modelos').select('id');
  const idsExistentes = new Set((existRaw ?? []).map((r) => r.id));

  console.log(`\n[1/2] Modelos (${arquivos.length} arquivo(s))`);
  for (const nome of arquivos) {
    const filepath = path.join(DIR_MODELOS, nome);
    let row;
    try {
      row = await lerJson(filepath);
    } catch (e) {
      console.error(`  ✗ ${nome}: JSON malformado (${e.message})`);
      out.erros += 1;
      continue;
    }

    // Coletar ids de fluidos referenciados pra validar depois
    (row.fluidos_recomendados ?? []).forEach((f) => {
      if (f.fluidoId) out.fluidosRefs.add(f.fluidoId);
    });

    const erra = idsExistentes.has(row.id);
    const { error } = await supabase
      .from('equipamento_modelos')
      .upsert({ ...row, criado_por: CRIADO_POR }, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ ${row.id}: ${error.message}`);
      out.erros += 1;
      continue;
    }
    if (erra) {
      console.log(`  ↻ Atualizado: ${row.id}`);
      out.atualizados += 1;
    } else {
      console.log(`  ✓ Inserido:   ${row.id}`);
      out.ok += 1;
    }
  }
  return out;
}

// ─── seed: tarefas ────────────────────────────────────────────────────────

async function seedTarefas() {
  const out = {
    ok: 0,
    atualizados: 0,
    pulados: 0,
    erros: 0,
    fluidosRefs: new Set(),
  };
  const arquivos = await listarJsons(DIR_TAREFAS);

  // Pré-busca ids de modelos válidos e ids de tarefas existentes
  const [{ data: modelosRows }, { data: tarefasExistRaw }] = await Promise.all([
    supabase.from('equipamento_modelos').select('id'),
    supabase.from('manutencao_tarefas').select('id'),
  ]);
  const modelosValidos = new Set((modelosRows ?? []).map((r) => r.id));
  const idsExistentes = new Set((tarefasExistRaw ?? []).map((r) => r.id));

  console.log(`\n[2/2] Tarefas (${arquivos.length} arquivo(s))`);
  for (const nome of arquivos) {
    const filepath = path.join(DIR_TAREFAS, nome);
    let json;
    try {
      json = await lerJson(filepath);
    } catch (e) {
      console.error(`  ✗ ${nome}: JSON malformado (${e.message})`);
      out.erros += 1;
      continue;
    }

    if (TAREFAS_CAT_320C_PULAR.has(json.id)) {
      console.log(`  ⊘ Pulado: ${json.id} (preservando tarefa Cat 320C 500h existente)`);
      out.pulados += 1;
      continue;
    }

    if (!json.id || !json.modeloId) {
      console.error(`  ✗ ${nome}: campos id/modeloId ausentes`);
      out.erros += 1;
      continue;
    }

    if (!modelosValidos.has(json.modeloId)) {
      console.error(`  ⚠ ${json.id}: modelo_id="${json.modeloId}" não existe — pulando`);
      out.pulados += 1;
      continue;
    }

    // Coletar fluidos referenciados
    (json.fluids ?? []).forEach((f) => {
      if (f.fluidoId) out.fluidosRefs.add(f.fluidoId);
    });

    const row = tarefaParaInsert(json);
    const era = idsExistentes.has(row.id);
    const { error } = await supabase
      .from('manutencao_tarefas')
      .upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ ${row.id}: ${error.message}`);
      out.erros += 1;
      continue;
    }
    if (era) {
      console.log(`  ↻ Atualizado: ${row.id}`);
      out.atualizados += 1;
    } else {
      console.log(`  ✓ Inserido:   ${row.id}`);
      out.ok += 1;
    }
  }
  return out;
}

// ─── validar fluidos referenciados ────────────────────────────────────────

async function validarFluidos(fluidosRefs) {
  if (fluidosRefs.size === 0) return [];
  const ids = Array.from(fluidosRefs);
  const { data: existRaw } = await supabase
    .from('manutencao_fluidos')
    .select('id')
    .in('id', ids);
  const existentes = new Set((existRaw ?? []).map((r) => r.id));
  return ids.filter((id) => !existentes.has(id)).sort();
}

// ─── main ────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Seed Lote 2 — ${SUPABASE_URL}`);
  console.log(`Lendo de: ${ROOT}/`);

  const modelos = await seedModelos();
  const tarefas = await seedTarefas();

  const todasRefs = new Set([...modelos.fluidosRefs, ...tarefas.fluidosRefs]);
  const fluidosFaltantes = await validarFluidos(todasRefs);

  console.log('\n──────────────────────────────────────────');
  console.log('Resumo Lote 2:');
  console.log(
    `  Modelos: ${modelos.ok} inserido(s), ${modelos.atualizados} atualizado(s), ${modelos.erros} erro(s)`
  );
  console.log(
    `  Tarefas: ${tarefas.ok} inserido(s), ${tarefas.atualizados} atualizado(s), ${tarefas.pulados} pulado(s), ${tarefas.erros} erro(s)`
  );
  console.log(
    `  Fluidos referenciados: ${todasRefs.size} (${fluidosFaltantes.length} ausentes do catálogo)`
  );
  console.log('──────────────────────────────────────────');

  if (fluidosFaltantes.length > 0) {
    console.log('\n⚠ Fluidos referenciados que NÃO existem em manutencao_fluidos:');
    fluidosFaltantes.forEach((id) => console.log(`    - ${id}`));
    console.log(
      '\n  Cadastre-os via UI em /manutencao ou seed adicional. As referências nas tarefas/modelos continuam válidas mas exibirão "não cadastrado" até serem populadas.'
    );
  }

  const totalErros = modelos.erros + tarefas.erros;
  if (totalErros > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Falha geral:', e);
  process.exit(1);
});
