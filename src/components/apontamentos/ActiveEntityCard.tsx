import { useEffect, useState } from 'react';

interface ActiveEntityCardProps {
  name: string;
  obra: string;
  etapa: string;
  horaInicio: string;
  type: 'equipamento' | 'colaborador';
}

function parseMinutes(horaInicio: string): number {
  const [h, m] = horaInicio.split(':').map(Number);
  const now = new Date();
  const startMin = h * 60 + m;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, nowMin - startMin);
}

export default function ActiveEntityCard({ name, obra, etapa, horaInicio, type }: ActiveEntityCardProps) {
  const [elapsed, setElapsed] = useState(() => parseMinutes(horaInicio));

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(parseMinutes(horaInicio));
    }, 60000);
    return () => clearInterval(interval);
  }, [horaInicio]);

  const hrs = Math.floor(elapsed / 60);
  const mins = elapsed % 60;
  const elapsedLabel = hrs > 0 ? `${hrs}h ${mins}min` : `${mins}min`;

  const JORNADA = 480; // 8h em minutos
  const percent = Math.min(100, (elapsed / JORNADA) * 100);

  const borderColor = type === 'equipamento' ? 'border-blue-200' : 'border-green-200';
  const bgColor = type === 'equipamento' ? 'bg-blue-50' : 'bg-green-50';
  const barColor = percent > 90 ? 'bg-red-500' : percent > 70 ? 'bg-yellow-500' : 'bg-green-500';

  return (
    <div className={`${bgColor} border ${borderColor} rounded-lg p-3 transition-shadow hover:shadow-md`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium text-sm text-gray-800 dark:text-slate-200 truncate">{name}</span>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          {elapsedLabel}
        </span>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{obra}{etapa ? ` — ${etapa}` : ''}</p>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-2">Início: {horaInicio}</p>
      <div className="w-full bg-gray-200 dark:bg-slate-600 rounded-full h-1.5">
        <div
          className={`${barColor} h-1.5 rounded-full transition-all duration-500`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-[10px] text-gray-400 text-right mt-0.5">{Math.round(percent)}% da jornada</p>
    </div>
  );
}
