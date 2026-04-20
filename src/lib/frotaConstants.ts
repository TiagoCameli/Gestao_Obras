export interface CategoriaFrota {
  codigo: string;
  label: string;
  cor: string;
  corBg: string;
  corTexto: string;
}

const CATEGORIAS: Record<string, CategoriaFrota> = {
  Carro:                    { codigo: 'VL',  label: 'Carro',                cor: 'bg-indigo-500',  corBg: 'bg-indigo-100 dark:bg-indigo-900/40',  corTexto: 'text-indigo-700 dark:text-indigo-300' },
  Moto:                     { codigo: 'MT',  label: 'Moto',                 cor: 'bg-violet-500',  corBg: 'bg-violet-100 dark:bg-violet-900/40',  corTexto: 'text-violet-700 dark:text-violet-300' },
  'Trator de Pneu':         { codigo: 'TRP', label: 'Trator de Pneu',        cor: 'bg-lime-500',    corBg: 'bg-lime-100 dark:bg-lime-900/40',      corTexto: 'text-lime-700 dark:text-lime-300' },
  'Trator de Esteira':      { codigo: 'TRE', label: 'Trator de Esteira',     cor: 'bg-green-500',   corBg: 'bg-green-100 dark:bg-green-900/40',    corTexto: 'text-green-700 dark:text-green-300' },
  'Escavadeira Hidráulica': { codigo: 'EH',  label: 'Escavadeira Hidráulica', cor: 'bg-amber-500', corBg: 'bg-amber-100 dark:bg-amber-900/40',   corTexto: 'text-amber-700 dark:text-amber-300' },
  Retroescavadeira:         { codigo: 'RT',  label: 'Retroescavadeira',      cor: 'bg-orange-500', corBg: 'bg-orange-100 dark:bg-orange-900/40',  corTexto: 'text-orange-700 dark:text-orange-300' },
  Motoniveladora:           { codigo: 'MN',  label: 'Motoniveladora',        cor: 'bg-emerald-500', corBg: 'bg-emerald-100 dark:bg-emerald-900/40', corTexto: 'text-emerald-700 dark:text-emerald-300' },
  'Pá Carregadeira':        { codigo: 'PC',  label: 'Pá Carregadeira',       cor: 'bg-yellow-500', corBg: 'bg-yellow-100 dark:bg-yellow-900/40',  corTexto: 'text-yellow-700 dark:text-yellow-300' },
  'Caminhão Basculante':    { codigo: 'CB',  label: 'Caminhão Basculante',   cor: 'bg-sky-500',    corBg: 'bg-sky-100 dark:bg-sky-900/40',        corTexto: 'text-sky-700 dark:text-sky-300' },
  Semirreboque:             { codigo: 'CS',  label: 'Semirreboque',          cor: 'bg-blue-500',   corBg: 'bg-blue-100 dark:bg-blue-900/40',      corTexto: 'text-blue-700 dark:text-blue-300' },
  Minicarregadeira:         { codigo: 'MC',  label: 'Minicarregadeira',      cor: 'bg-teal-500',   corBg: 'bg-teal-100 dark:bg-teal-900/40',      corTexto: 'text-teal-700 dark:text-teal-300' },
  'Rolo Pé de Carneiro':    { codigo: 'RPC', label: 'Rolo Pé de Carneiro',   cor: 'bg-purple-500', corBg: 'bg-purple-100 dark:bg-purple-900/40',  corTexto: 'text-purple-700 dark:text-purple-300' },
  Vibroacabadora:           { codigo: 'VB',  label: 'Vibroacabadora',        cor: 'bg-fuchsia-500', corBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', corTexto: 'text-fuchsia-700 dark:text-fuchsia-300' },
  'Caminhão Espargidor':    { codigo: 'CE',  label: 'Caminhão Espargidor',   cor: 'bg-pink-500',   corBg: 'bg-pink-100 dark:bg-pink-900/40',      corTexto: 'text-pink-700 dark:text-pink-300' },
  'Caminhão Pipa':          { codigo: 'CP',  label: 'Caminhão Pipa',         cor: 'bg-cyan-500',   corBg: 'bg-cyan-100 dark:bg-cyan-900/40',      corTexto: 'text-cyan-700 dark:text-cyan-300' },
  'Telescópio de Elevação': { codigo: 'TE',  label: 'Telescópio de Elevação', cor: 'bg-rose-500',  corBg: 'bg-rose-100 dark:bg-rose-900/40',      corTexto: 'text-rose-700 dark:text-rose-300' },
  'Rolo de Pneu':           { codigo: 'RP',  label: 'Rolo de Pneu',          cor: 'bg-stone-500',  corBg: 'bg-stone-100 dark:bg-stone-900/40',    corTexto: 'text-stone-700 dark:text-stone-300' },
  'Rolo Chapa':             { codigo: 'RC',  label: 'Rolo Chapa',            cor: 'bg-slate-500',  corBg: 'bg-slate-200 dark:bg-slate-700/40',    corTexto: 'text-slate-700 dark:text-slate-300' },
  'Caminhão Munck':         { codigo: 'CM',  label: 'Caminhão Munck',        cor: 'bg-amber-600',  corBg: 'bg-amber-100 dark:bg-amber-900/40',    corTexto: 'text-amber-700 dark:text-amber-300' },
  'Caminhão Betoneira':     { codigo: 'CBT', label: 'Caminhão Betoneira',    cor: 'bg-zinc-500',   corBg: 'bg-zinc-100 dark:bg-zinc-900/40',      corTexto: 'text-zinc-700 dark:text-zinc-300' },
  Meloza:                   { codigo: 'MZ',  label: 'Meloza',                cor: 'bg-orange-600', corBg: 'bg-orange-100 dark:bg-orange-900/40',  corTexto: 'text-orange-700 dark:text-orange-300' },
  Implementos:              { codigo: 'IMP', label: 'Implementos',           cor: 'bg-red-500',    corBg: 'bg-red-100 dark:bg-red-900/40',        corTexto: 'text-red-700 dark:text-red-300' },
  'Caminhão de Pintura':    { codigo: 'CPT', label: 'Caminhão de Pintura',   cor: 'bg-blue-600',   corBg: 'bg-blue-100 dark:bg-blue-900/40',      corTexto: 'text-blue-700 dark:text-blue-300' },
  'Usina de Asfalto':       { codigo: 'UA',  label: 'Usina de Asfalto',      cor: 'bg-gray-600',   corBg: 'bg-gray-100 dark:bg-gray-900/40',      corTexto: 'text-gray-700 dark:text-gray-300' },
};

const FALLBACK: CategoriaFrota = {
  codigo: '???',
  label: 'Outros',
  cor: 'bg-gray-500',
  corBg: 'bg-gray-100 dark:bg-gray-800/40',
  corTexto: 'text-gray-700 dark:text-gray-300',
};

// Cores rotativas para tipos dinâmicos que não estão no mapa hardcoded
const CORES_DINAMICAS = [
  { cor: 'bg-indigo-600',  corBg: 'bg-indigo-100 dark:bg-indigo-900/40',  corTexto: 'text-indigo-700 dark:text-indigo-300' },
  { cor: 'bg-teal-600',    corBg: 'bg-teal-100 dark:bg-teal-900/40',      corTexto: 'text-teal-700 dark:text-teal-300' },
  { cor: 'bg-rose-600',    corBg: 'bg-rose-100 dark:bg-rose-900/40',      corTexto: 'text-rose-700 dark:text-rose-300' },
  { cor: 'bg-emerald-600', corBg: 'bg-emerald-100 dark:bg-emerald-900/40', corTexto: 'text-emerald-700 dark:text-emerald-300' },
  { cor: 'bg-violet-600',  corBg: 'bg-violet-100 dark:bg-violet-900/40',  corTexto: 'text-violet-700 dark:text-violet-300' },
  { cor: 'bg-sky-600',     corBg: 'bg-sky-100 dark:bg-sky-900/40',        corTexto: 'text-sky-700 dark:text-sky-300' },
  { cor: 'bg-fuchsia-600', corBg: 'bg-fuchsia-100 dark:bg-fuchsia-900/40', corTexto: 'text-fuchsia-700 dark:text-fuchsia-300' },
  { cor: 'bg-lime-600',    corBg: 'bg-lime-100 dark:bg-lime-900/40',      corTexto: 'text-lime-700 dark:text-lime-300' },
];

export function getCategoriaFrota(tipo: string, codigo?: string): CategoriaFrota {
  if (!tipo) return FALLBACK;
  if (CATEGORIAS[tipo]) return CATEGORIAS[tipo];

  // Para tipos dinâmicos, gera uma categoria com base no código fornecido
  // e uma cor determinística baseada no hash do nome
  let hash = 0;
  for (let i = 0; i < tipo.length; i++) {
    hash = ((hash << 5) - hash + tipo.charCodeAt(i)) | 0;
  }
  const corIdx = Math.abs(hash) % CORES_DINAMICAS.length;
  const corDinamica = CORES_DINAMICAS[corIdx];

  return {
    codigo: codigo || '???',
    label: tipo,
    ...corDinamica,
  };
}

export function getAllCategorias() {
  return CATEGORIAS;
}

/** Registra um tipo dinâmico no mapa em memória (para a sessão atual) */
export function registrarCategoriaDinamica(nome: string, codigo: string) {
  if (!CATEGORIAS[nome]) {
    let hash = 0;
    for (let i = 0; i < nome.length; i++) {
      hash = ((hash << 5) - hash + nome.charCodeAt(i)) | 0;
    }
    const corIdx = Math.abs(hash) % CORES_DINAMICAS.length;
    const corDinamica = CORES_DINAMICAS[corIdx];
    CATEGORIAS[nome] = { codigo, label: nome, ...corDinamica };
  }
}
