type EmptyType = 'equipamentos' | 'colaboradores' | 'diaristas' | 'registros' | 'filtro';

const MESSAGES: Record<EmptyType, string> = {
  equipamentos: 'Nenhum equipamento encontrado',
  colaboradores: 'Nenhum colaborador encontrado',
  diaristas: 'Nenhum diarista encontrado',
  registros: 'Nenhum registro no período',
  filtro: 'Nenhum resultado para os filtros aplicados',
};

function WrenchSvg() {
  return (
    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

function PeopleSvg() {
  return (
    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

function CalendarSvg() {
  return (
    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function SearchSvg() {
  return (
    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function ClipboardSvg() {
  return (
    <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

const ICONS: Record<EmptyType, () => React.ReactNode> = {
  equipamentos: WrenchSvg,
  colaboradores: PeopleSvg,
  diaristas: CalendarSvg,
  registros: ClipboardSvg,
  filtro: SearchSvg,
};

export default function EmptyState({ type, message }: { type: EmptyType; message?: string }) {
  const Icon = ICONS[type];
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon />
      <p className="text-sm text-gray-400 mt-3">{message || MESSAGES[type]}</p>
    </div>
  );
}
