// Seed inicial dos modelos Caterpillar mais presentes na frota EMT.
// Idempotente: pula modelos que já existem.
//
// Uso: node scripts/seed-modelos-iniciais.mjs
//
// IMPORTANTE: as specs (motor, capacidades, anos) foram preenchidas a partir
// de fontes públicas dos manuais Cat e devem ser CONFERIDAS contra o manual
// real do equipamento antes de servirem como fonte de verdade pra serviço.
// Este seed serve pra deixar o catálogo populado e permitir associar os
// equipamentos da frota; os valores podem ser ajustados depois pela UI.

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gunyitwrbxbmnezokgjq.supabase.co';
const SUPABASE_KEY = 'sb_publishable_vNp6YsxujUlGNQA5sXH7sg_CNF3NPrG';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CRIADO_POR = 'seed:modelos-iniciais';

// ---------------------------------------------------------------------------
// MODELOS — edite/adicione aqui. Reexecutar o script é seguro (idempotente).
// ---------------------------------------------------------------------------

const MODELOS = [
  {
    id: 'cat-320c',
    fabricante: 'Caterpillar',
    modelo_nome: '320C',
    familia: 'Escavadeira Hidráulica de Médio Porte',
    ano_inicio_producao: 2002,
    ano_fim_producao: 2007,
    prefixos_serie: ['ANB', 'PAB', 'PAC', 'BER'],
    motor: {
      catModel: '3066T',
      displacementL: 6.4,
      netPowerKW: 105,
      netPowerHP: 140,
      cylinders: 6,
      configuration: 'Em linha, turboalimentado',
      injectionType: 'Mecânica',
    },
    capacidades: {
      fuelTankL: 350,
      engineCrankcaseL: 23,
      hydraulicSystemTotalL: 270,
      hydraulicTankL: 142,
      swingDriveL: 7.5,
      finalDriveEachL: 6,
      finalDriveCount: 2,
      coolantSystemL: 22,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos:
      '## Pontos de atenção\n- Folga das válvulas requer ajuste a cada 2000h\n- Vazamento crônico no swing motor após 8000h\n- Substituir mangueira de alta pressão do braço a cada 5000h',
  },
  {
    id: 'cat-416e',
    fabricante: 'Caterpillar',
    modelo_nome: '416E',
    familia: 'Retroescavadeira',
    ano_inicio_producao: 2007,
    ano_fim_producao: 2014,
    prefixos_serie: ['PHB', 'RBA', 'SKR'],
    motor: {
      catModel: '3054C',
      displacementL: 4.4,
      netPowerKW: 67,
      netPowerHP: 90,
      cylinders: 4,
      configuration: 'Em linha, turboalimentado',
      injectionType: 'Mecânica',
    },
    capacidades: {
      fuelTankL: 144,
      engineCrankcaseL: 8,
      hydraulicSystemTotalL: 95,
      hydraulicTankL: 60,
      transmissionL: 19,
      axleFrontL: 16,
      axleRearL: 16,
      coolantSystemL: 21,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos:
      '## Pontos de atenção\n- Junta universal do braço estende sofre desgaste prematuro\n- Verificar alinhamento das torres da caçamba a cada 1000h',
  },
  {
    id: 'cat-12h',
    fabricante: 'Caterpillar',
    modelo_nome: '12H',
    familia: 'Motoniveladora',
    ano_inicio_producao: 1995,
    ano_fim_producao: 2005,
    prefixos_serie: ['4XM', 'AMZ'],
    motor: {
      catModel: '3176C',
      displacementL: 10.3,
      netPowerKW: 119,
      netPowerHP: 160,
      cylinders: 6,
      configuration: 'Em linha, turboalimentado',
      injectionType: 'Eletrônica HEUI',
    },
    capacidades: {
      fuelTankL: 360,
      engineCrankcaseL: 26,
      hydraulicSystemTotalL: 90,
      hydraulicTankL: 60,
      transmissionL: 80,
      differentialL: 80,
      coolantSystemL: 50,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos:
      '## Pontos de atenção\n- Articulação do círculo da lâmina exige lubrificação a cada 50h (graxeiras)\n- Mangueira do circuito do tandem trava: substituir preventivamente a cada 3000h',
  },
  {
    id: 'cat-924k',
    fabricante: 'Caterpillar',
    modelo_nome: '924K',
    familia: 'Pá Carregadeira de Pequeno Porte',
    ano_inicio_producao: 2011,
    ano_fim_producao: null,
    prefixos_serie: ['PRH', 'PHJ'],
    motor: {
      catModel: 'C6.6 ACERT',
      displacementL: 6.6,
      netPowerKW: 132,
      netPowerHP: 177,
      cylinders: 6,
      configuration: 'Em linha, turboalimentado',
      injectionType: 'Eletrônica common rail',
    },
    capacidades: {
      fuelTankL: 240,
      engineCrankcaseL: 20,
      hydraulicSystemTotalL: 130,
      hydraulicTankL: 75,
      transmissionL: 36,
      finalDriveEachL: 11,
      finalDriveCount: 2,
      coolantSystemL: 30,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos:
      '## Pontos de atenção\n- DPF (Diesel Particulate Filter) — regen ativo se obstruído\n- Sensor de NOx pode falhar; verificar códigos a cada 500h',
  },
  {
    id: 'cat-cw34',
    fabricante: 'Caterpillar',
    modelo_nome: 'CW34',
    familia: 'Rolo Compactador de Pneu',
    ano_inicio_producao: 2010,
    ano_fim_producao: null,
    prefixos_serie: [],
    motor: {
      catModel: 'C4.4 ACERT',
      displacementL: 4.4,
      netPowerKW: 74,
      netPowerHP: 99,
      cylinders: 4,
      configuration: 'Em linha, turboalimentado',
    },
    capacidades: {
      fuelTankL: 120,
      engineCrankcaseL: 12,
      hydraulicSystemTotalL: 60,
      hydraulicTankL: 40,
      coolantSystemL: 18,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos: '',
  },
  {
    id: 'cat-cp56',
    fabricante: 'Caterpillar',
    modelo_nome: 'CP56',
    familia: 'Rolo Compactador Pé de Carneiro',
    ano_inicio_producao: 2007,
    ano_fim_producao: null,
    prefixos_serie: [],
    motor: {
      catModel: 'C4.4 ACERT',
      displacementL: 4.4,
      netPowerKW: 97,
      netPowerHP: 130,
      cylinders: 4,
      configuration: 'Em linha, turboalimentado',
    },
    capacidades: {
      fuelTankL: 250,
      engineCrankcaseL: 11,
      hydraulicSystemTotalL: 60,
      hydraulicTankL: 40,
      coolantSystemL: 22,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos:
      '## Pontos de atenção\n- Excêntrico do tambor exige troca de óleo a cada 1000h\n- Coxins do motor sofrem fadiga em pista de pé de carneiro',
  },
  {
    id: 'cat-d6n-xl',
    fabricante: 'Caterpillar',
    modelo_nome: 'D6N XL',
    familia: 'Trator de Esteira de Médio Porte',
    ano_inicio_producao: 2005,
    ano_fim_producao: null,
    prefixos_serie: ['ALY', 'GHS', 'KSB'],
    motor: {
      catModel: 'C9.3 ACERT',
      displacementL: 9.3,
      netPowerKW: 138,
      netPowerHP: 185,
      cylinders: 6,
      configuration: 'Em linha, turboalimentado, aftercooled',
      injectionType: 'Eletrônica common rail',
    },
    capacidades: {
      fuelTankL: 410,
      engineCrankcaseL: 33,
      hydraulicSystemTotalL: 75,
      hydraulicTankL: 50,
      transmissionL: 90,
      finalDriveEachL: 22,
      finalDriveCount: 2,
      coolantSystemL: 50,
    },
    fluidos_recomendados: [],
    filtros: [],
    problemas_conhecidos:
      '## Pontos de atenção\n- Tensão da esteira exige ajuste a cada 250h\n- Roletes inferiores: rotacionar a cada 1500h\n- Embreagem da direção sofre se operada com solo molhado/argiloso por longos períodos',
  },
];

// ---------------------------------------------------------------------------

async function main() {
  console.log(`Seedando ${MODELOS.length} modelo(s)...\n`);
  let inseridos = 0;
  let pulados = 0;
  let erros = 0;

  for (const modelo of MODELOS) {
    const { data: existente, error: errCheck } = await supabase
      .from('equipamento_modelos')
      .select('id')
      .eq('id', modelo.id)
      .maybeSingle();

    if (errCheck) {
      console.error(`ERRO ao verificar ${modelo.id}: ${errCheck.message}`);
      erros += 1;
      continue;
    }

    if (existente) {
      console.log(`SKIP ${modelo.id} (já existe)`);
      pulados += 1;
      continue;
    }

    const { error } = await supabase.from('equipamento_modelos').insert({
      ...modelo,
      ativo: true,
      criado_por: CRIADO_POR,
    });

    if (error) {
      console.error(`ERRO ${modelo.id}: ${error.message}`);
      erros += 1;
      continue;
    }

    console.log(`OK   ${modelo.id} — ${modelo.fabricante} ${modelo.modelo_nome}`);
    inseridos += 1;
  }

  console.log(
    `\nResumo: ${inseridos} inserido(s), ${pulados} pulado(s), ${erros} erro(s).`
  );

  if (erros > 0) process.exit(1);
}

main().catch((e) => {
  console.error('Falha geral:', e);
  process.exit(1);
});
