// Seed dos equipamentos da frota EMT + Colorado (69 equipamentos do PDF
// frota-2026-05-02). Idempotente — upsert por id determinístico.
// USO: node --env-file=.env.local scripts/seedFrotaEquipamentos.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://gunyitwrbxbmnezokgjq.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) { console.error('SUPABASE_SERVICE_ROLE_KEY ausente'); process.exit(1); }

const sb = createClient(SUPABASE_URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const EMPRESA_EMT = 'mm4em4xic5sp2';
const EMPRESA_COLORADO = 'mm503m8kbfafr';
const CRIADO_POR = 'seed:frota-2026-05-02';

function slugId(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// EMT (53) + Colorado (16) = 69. Modelo extraído do nome.
const FROTA = [
  // ── EMT Construtora — Escavadeiras
  { patrimony: 'EH-001', nome: 'Escavadeira 320C - 01', tipo: 'Escavadeira Hidráulica', marca: 'Caterpillar', modelo: '320C', ano: '2005', serie: '', dataAquisicao: '' },
  { patrimony: 'EH-002', nome: 'Escavadeira 320C - 02', tipo: 'Escavadeira Hidráulica', marca: 'Caterpillar', modelo: '320C', ano: '2002', serie: 'CAT0320CKBER00495', dataAquisicao: '' },
  { patrimony: 'EH-003', nome: 'Escavadeira 320C - 03', tipo: 'Escavadeira Hidráulica', marca: 'Caterpillar', modelo: '320C', ano: '2007', serie: 'CAT0320CJRAW01303', dataAquisicao: '' },
  { patrimony: 'EH-004', nome: 'Escavadeira 315CL - 04', tipo: 'Escavadeira Hidráulica', marca: 'Caterpillar', modelo: '315CL', ano: '1997', serie: '04YMOO395', ativo: false },
  { patrimony: 'EH-005', nome: 'Escavadeira PC200 - 05', tipo: 'Escavadeira Hidráulica', marca: 'Komatsu', modelo: 'PC200', ano: '2025', serie: 'B60399', dataAquisicao: '2025-08-29' },
  { patrimony: 'EH-006', nome: 'Escavadeira EC55BPRO - 06', tipo: 'Escavadeira Hidráulica', marca: 'Volvo', modelo: 'EC55B PRO', serie: 'VCEEC55BE00038523' },
  // Retroescavadeiras
  { patrimony: 'RT-001', nome: 'Retroescavadeira 416E - 01', tipo: 'Retroescavadeira', marca: 'Caterpillar', modelo: '416E', ano: '2014', serie: 'CAT0416ETMFG09931' },
  { patrimony: 'RT-002', nome: 'Retroescavadeira 416E - 02', tipo: 'Retroescavadeira', marca: 'Caterpillar', modelo: '416E', ano: '2012', serie: 'CAT0416ELMFG02195' },
  // Pá Carregadeira
  { patrimony: 'PC-001', nome: 'Pá Carregadeira 924K - 01', tipo: 'Pá Carregadeira', marca: 'Caterpillar', modelo: '924K', ano: '2016', serie: 'CAT0924KTKW400165' },
  { patrimony: 'PC-002', nome: 'Pá Carregadeira W20 - 02', tipo: 'Pá Carregadeira', marca: 'Case', modelo: 'W20', serie: 'N5AE00238' },
  // Motoniveladora
  { patrimony: 'MN-001', nome: 'Motoniveladora 12H - 01', tipo: 'Motoniveladora', marca: 'Caterpillar', modelo: '12H', ano: '2008', serie: 'CAT0012HK4ER01323' },
  { patrimony: 'MN-002', nome: 'Motoniveladora 12H - 02', tipo: 'Motoniveladora', marca: 'Caterpillar', modelo: '12H', ano: '2008', serie: 'CAT0012HV4ER01374' },
  // Rolo Pé de Carneiro
  { patrimony: 'RPC-001', nome: 'Rolo Pé de Carneiro CP56 - 01', tipo: 'Rolo Pé de Carneiro', marca: 'Caterpillar', modelo: 'CP-56', ano: '2008', serie: 'CAT0CP56JC5P00364' },
  { patrimony: 'RPC-002', nome: 'Rolo Pé de Carneiro CP56 - 02', tipo: 'Rolo Pé de Carneiro', marca: 'Caterpillar', modelo: 'CP-56', ano: '2008', serie: 'CAT0CP56AC5P00370' },
  { patrimony: 'RPC-003', nome: 'Rolo Pé de Carneiro CA260 - 03', tipo: 'Rolo Pé de Carneiro', marca: 'Dynapac', modelo: 'CA260', serie: '7832BR0029' },
  // Trator de Esteira
  { patrimony: 'TRE-001', nome: 'Trator de Esteira D6NXL - 01', tipo: 'Trator de Esteira', marca: 'Caterpillar', modelo: 'D6N XL', ano: '2013', serie: 'CAT00D6NKLJR00910' },
  { patrimony: 'TRE-002', nome: 'Trator de Esteira D6M - 02', tipo: 'Trator de Esteira', marca: 'Caterpillar', modelo: 'D6M', ano: '2004', serie: 'CAT00DLMP6LR00632', ativo: false },
  { patrimony: 'TRE-003', nome: 'Trator de Esteira D6G - 03', tipo: 'Trator de Esteira', marca: 'Caterpillar', modelo: 'D6G', ativo: false },
  // Minicarregadeira
  { patrimony: 'MC-001', nome: 'Bobcat MC110C - 01', tipo: 'Minicarregadeira', marca: 'Volvo', modelo: 'MC110C', serie: 'GEO110SSHB1640782' },
  // Telescópico
  { patrimony: 'TE-001', nome: 'Manipulador Telescópio 540-170 - 01', tipo: 'Telescópio de Elevação', marca: 'JCB', modelo: '540-170', serie: 'SOR5AFKNP02216098' },
  // Munck / Implementos / Meloza
  { patrimony: 'CM-001', nome: 'Caminhão Munck L 1620 MZO-4396 - 01', tipo: 'Caminhão Munck', marca: 'Mercedes-Benz', modelo: 'L 1620', serie: '9BM6953016B475719' },
  { patrimony: 'IMP-001', nome: 'Carga Semi-Reboque SRCT3E QLU-2791 - 01', tipo: 'Implementos', marca: 'NOMA', modelo: 'SRCT3E', serie: '9EP181530F100206' },
  { patrimony: 'IMP-002', nome: 'Carga Semi-Reboque SR/GUERRA BASC B2T093 - 03', tipo: 'Implementos', marca: 'FORD', modelo: 'SR/GUERRA BASC B2T093', serie: '91VB0982RSC217165' },
  { patrimony: 'IMP-003', nome: 'Carga Semi-Reboque SR/GUERRA BASC B2D095 - 02', tipo: 'Implementos', marca: 'FORD', modelo: 'SR/GUERRA BASC B2D095', serie: '91VB0952RSC27164' },
  { patrimony: 'MZ-001', nome: 'Meloza 1517 MZO-3926 - 01', tipo: 'Meloza', marca: 'FORD', modelo: '1517', serie: '9BFXTNCF25B52014' },
  // Cavalo / Caçamba MB
  { patrimony: 'CS-001', nome: 'Caminhão Cavalo 2644 S/33 MZO-2987 - 01', tipo: 'Semirreboque', marca: 'Mercedes-Benz', modelo: '2644 S/33', serie: '9BM9584517B538781' },
  { patrimony: 'CB-001', nome: 'Caminhão Caçamba 2423 K/36 MZO-5897 - 01', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: '2423 K/36', serie: '9BM6933867B535751' },
  { patrimony: 'CB-002', nome: 'Caminhão Caçamba 2423 K/36 MZO-8547 - 02', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: '2423 K/36', serie: '9BM6933867B535447' },
  { patrimony: 'CB-003', nome: 'Caminhão Caçamba 2423 K/36 MZO-8F87 - 03', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: '2423 K/36', serie: '9BM6933867B536216' },
  { patrimony: 'CB-004', nome: 'Caminhão Caçamba 2425/48 NAB-4689 - 04', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: '2425/48', serie: '9BM9580949B628205' },
  { patrimony: 'CB-005', nome: 'Caminhão Caçamba 2425/48 NAB-4669 - 05', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: '2425/48', serie: '9BM9580949B628215' },
  { patrimony: 'CB-006', nome: 'Caminhão Caçamba 2425/48 NAB-4619 - 06', tipo: 'Caminhão Basculante', marca: 'Mercedes-Benz', modelo: '2425/48', serie: '9BM9580949B622547' },
  // Caminhão Betoneira / Pipa
  { patrimony: 'CBT-001', nome: 'Caminhão Betoneira MZO-9678 - 01', tipo: 'Caminhão Betoneira', marca: 'FORD', modelo: '2628', serie: '9BFZ2UMT55BB49165' },
  { patrimony: 'CP-001', nome: 'Caminhão Pipa 2626 NCP-4846 - 01', tipo: 'Caminhão Pipa', marca: 'FORD', modelo: '2626', serie: '9BFZTNY65BB50984' },
  { patrimony: 'CP-002', nome: 'Caminhão Pipa L1318/50 MZO-4486 - 02', tipo: 'Caminhão Pipa', marca: 'Mercedes-Benz', modelo: 'L 1318/50', serie: '9BM69940006B503601' },
  // Carros EMT
  { patrimony: 'VL-001', nome: 'Hilux CHLSTM4FD QWQ-3H97 - 01', tipo: 'Carro', marca: 'Toyota', modelo: 'Hilux' },
  { patrimony: 'VL-002', nome: 'Saveiro RBMBVD QWP-6B51 - 02', tipo: 'Carro', marca: 'Volkswagen', modelo: 'Saveiro' },
  { patrimony: 'VL-003', nome: 'Tracker QWM-9H99 - 03', tipo: 'Carro', marca: 'Chevrolet', modelo: 'Tracker' },
  { patrimony: 'VL-004', nome: 'Hilux CDSRXA4FD QLY-7H84 - 04', tipo: 'Carro', marca: 'Toyota', modelo: 'Hilux' },
  { patrimony: 'VL-005', nome: 'Hilux CDSRVA4FD QWQ-1D76 - 05', tipo: 'Carro', marca: 'Toyota', modelo: 'Hilux' },
  { patrimony: 'VL-006', nome: 'Hilux CDLOWA4SD SQQ-8F87 - 06', tipo: 'Carro', marca: 'Toyota', modelo: 'Hilux' },
  { patrimony: 'VL-007', nome: 'Hilux SQR1C93 - 07', tipo: 'Carro', marca: 'Toyota', modelo: 'Hilux' },
  { patrimony: 'VL-008', nome: 'SAVEIRO CS RB MF - QWQ2I35', tipo: 'Carro', marca: 'VOLKSWAGEN', modelo: 'Saveiro CS', ano: '2026', serie: '9BWKL45U2TP079725', dataAquisicao: '2026-03-19' },
  { patrimony: 'VL-009', nome: 'SAVEIRO CS RB MF - QWQ2I65', tipo: 'Carro', marca: 'VOLKSWAGEN', modelo: 'Saveiro CS', ano: '2026', serie: '9BWKL45UXTP080282', dataAquisicao: '2026-03-19' },
  // Cavalos DAF
  { patrimony: 'CS-002', nome: 'Caminhão Cavalo XF 530 FTT SQS7E01 - 02', tipo: 'Semirreboque', marca: 'DAF', modelo: 'XF 530 FTT', ano: '2024', serie: '98PTTH430SB157038', dataAquisicao: '2024-10-01', tipoMedicao: 'odometro' },
  { patrimony: 'CS-003', nome: 'Caminhão Cavalo XF 530 FTT - 03', tipo: 'Semirreboque', marca: 'DAF', modelo: 'XF 530 FTT', ano: '2026', dataAquisicao: '2026-03-19', tipoMedicao: 'odometro' },
  { patrimony: 'CS-004', nome: 'Caminhão Cavalo XF 530 FTT - 04', tipo: 'Semirreboque', marca: 'DAF', modelo: 'XF 530 FTT', ano: '2026', dataAquisicao: '2026-03-19', tipoMedicao: 'odometro' },
  { patrimony: 'CS-005', nome: 'Caminhão Cavalo XF 530 FTT - 05', tipo: 'Semirreboque', marca: 'DAF', modelo: 'XF 530 FTT', ano: '2026', dataAquisicao: '2026-03-19', tipoMedicao: 'odometro' },
  // Vibroacabadora / Espargidor / Rolo CB / CW34
  { patrimony: 'VB-001', nome: 'Vibro Acabadora AF4500 - 01', tipo: 'Vibroacabadora', marca: 'Ciber', modelo: 'AF4500', ano: '2020', serie: 'CP450022', medicaoInicial: 455, dataAquisicao: '2026-02-20' },
  { patrimony: 'CE-001', nome: 'Caminhão Espargidor - 01', tipo: 'Caminhão Espargidor', marca: 'Mercedes-Benz', modelo: 'Atego', ano: '2019', serie: '9BM958156LB165609', dataAquisicao: '2026-02-20', tipoMedicao: 'odometro' },
  { patrimony: 'RC-001', nome: 'Rolo Chapa CB10 - 01', tipo: 'Rolo Chapa', marca: 'Caterpillar', modelo: 'CB10', ano: '2019', serie: 'CAT0CB10L5B400127', medicaoInicial: 833.7, dataAquisicao: '2026-02-20' },
  { patrimony: 'RP-001', nome: 'Rolo de Pneu CW34 - 01', tipo: 'Rolo de Pneu', marca: 'Caterpillar', modelo: 'CW34', ano: '2019', serie: 'CAT0CW34A3G400232', medicaoInicial: 613.2, dataAquisicao: '2026-02-20' },
  { patrimony: 'LAB-001', nome: 'Laboratório', tipo: 'Laboratório' },

  // ── Construtora Colorado (alugados) — patrimônio criado pra ter id estável
  { patrimony: 'COL-CB-25', nome: 'Caminhão Caçamba Colorado - 25', tipo: 'Caminhão Basculante', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-CB-32', nome: 'Caminhão Caçamba Colorado - 32', tipo: 'Caminhão Basculante', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-CB-02', nome: 'Caminhão Caçamba Colorado - 02', tipo: 'Caminhão Basculante', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-CB-04', nome: 'Caminhão Caçamba Colorado - 04', tipo: 'Caminhão Basculante', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-CB-37', nome: 'Caminhão Caçamba Colorado - 37', tipo: 'Caminhão Basculante', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-CB-40', nome: 'Caminhão Caçamba Colorado - 40', tipo: 'Caminhão Basculante', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-MN-14', nome: 'Motoniveladora 140 Colorado - 14', tipo: 'Motoniveladora', marca: 'Caterpillar', modelo: '140', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-MN-05', nome: 'Motoniveladora 140 Colorado - 05', tipo: 'Motoniveladora', modelo: '140', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-VL-01', nome: 'Hilux de Apoio Colorado - 01', tipo: 'Carro', marca: 'Toyota', modelo: 'Hilux', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-ESP-01', nome: 'Espargidor Colorado', tipo: 'Caminhão Espargidor', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-USINA-01', nome: 'Usina de Asfalto Ciber 80ton/hr Colorado - 01', tipo: 'Usina de Asfalto', marca: 'Ciber', modelo: '80 ton/hr', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-RC-CAT', nome: 'Rolo Chapa Colorado', tipo: 'Rolo Chapa', marca: 'Caterpillar', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-RC-MIRLA', nome: 'Rolo Chapa Mirla Colorado', tipo: 'Rolo Chapa', marca: 'Mirla', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-CP-01', nome: 'Caminhão de Pintura Colorado - 01', tipo: 'Caminhão de Pintura', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-MZ-01', nome: 'Meloza Colorado - 01', tipo: 'Meloza', empresa: EMPRESA_COLORADO },
  { patrimony: 'COL-VB-01', nome: 'Vibro Acabadora Leeboy - Colorado - 01', tipo: 'Vibroacabadora', marca: 'Leeboy', empresa: EMPRESA_COLORADO },
];

async function main() {
  console.log(`Seed Frota — ${SUPABASE_URL}`);
  console.log(`Total: ${FROTA.length} equipamentos\n`);

  const { data: existRaw } = await sb.from('equipamentos').select('id');
  const idsExistentes = new Set((existRaw ?? []).map(r => r.id));

  let ok = 0, atualizados = 0, erros = 0;

  for (const eq of FROTA) {
    const id = slugId(eq.patrimony);
    const empresaId = eq.empresa ?? EMPRESA_EMT;
    const propriedade = empresaId === EMPRESA_COLORADO ? 'alugada' : 'propria';
    const row = {
      id,
      nome: eq.nome,
      tipo: eq.tipo ?? '',
      empresa_id: empresaId,
      codigo_patrimonio: eq.patrimony,
      numero_serie: eq.serie ?? '',
      ano: eq.ano ?? '',
      marca: eq.marca ?? '',
      modelo: eq.modelo ?? '',
      propriedade,
      tipo_medicao: eq.tipoMedicao ?? 'horimetro',
      medicao_inicial: eq.medicaoInicial ?? 0,
      ativo: eq.ativo === false ? false : true,
      data_aquisicao: eq.dataAquisicao ?? '',
      data_venda: '',
      criado_por: CRIADO_POR,
    };
    const era = idsExistentes.has(id);
    const { error } = await sb.from('equipamentos').upsert(row, { onConflict: 'id' });
    if (error) {
      console.error(`  ✗ ${eq.patrimony}: ${error.message}`);
      erros += 1;
      continue;
    }
    if (era) {
      console.log(`  ↻ Atualizado: ${id} — ${eq.nome}`);
      atualizados += 1;
    } else {
      console.log(`  ✓ Inserido:   ${id} — ${eq.nome}`);
      ok += 1;
    }
  }

  console.log('\n──────────────────────────────────────────');
  console.log(`Resumo: ${ok} inseridos, ${atualizados} atualizados, ${erros} erros`);
  console.log('──────────────────────────────────────────');
  if (erros > 0) process.exit(1);
}

main().catch(e => { console.error('Falha geral:', e); process.exit(1); });
