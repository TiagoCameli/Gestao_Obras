import { useEffect, useRef, useState } from 'react';

export interface SummaryCardItem {
  label: string;
  value: number;
  color: 'green' | 'amber' | 'blue' | 'orange' | 'gray';
  icon: React.ReactNode;
  trend?: { value: number; label: string };
  tooltip?: string;
  format?: (n: number) => string;
  subtitle?: string;
}

const COLOR_MAP: Record<string, { text: string; bg: string }> = {
  green: { text: 'text-green-600', bg: 'bg-green-50' },
  amber: { text: 'text-amber-600', bg: 'bg-amber-50' },
  blue: { text: 'text-blue-600', bg: 'bg-blue-50' },
  orange: { text: 'text-orange-600', bg: 'bg-orange-50' },
  gray: { text: 'text-gray-600', bg: 'bg-gray-50' },
};

function CountUp({ target, format }: { target: number; format?: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number | null>(null);

  useEffect(() => {
    if (target === 0) { setDisplay(0); return; }
    const start = performance.now();
    const duration = 600;

    function animate(now: number) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * target));
      if (progress < 1) {
        ref.current = requestAnimationFrame(animate);
      }
    }

    ref.current = requestAnimationFrame(animate);
    return () => { if (ref.current) cancelAnimationFrame(ref.current); };
  }, [target]);

  return <>{format ? format(display) : display}</>;
}

export default function SummaryCards({
  items,
  columns = 4,
}: {
  items: SummaryCardItem[];
  columns?: 2 | 3 | 4;
}) {
  const colClass = columns === 2 ? 'sm:grid-cols-2' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-4';

  return (
    <div className={`grid grid-cols-2 ${colClass} gap-4`} role="group" aria-label="Resumo do dia">
      {items.map((item) => {
        const colors = COLOR_MAP[item.color] || COLOR_MAP.gray;
        return (
          <div key={item.label} className="bg-white dark:bg-slate-800 rounded-lg p-4 border dark:border-slate-700 shadow-sm relative group">
            <div className="flex items-center gap-2 mb-1">
              <span className={`${colors.bg} ${colors.text} p-1.5 rounded-lg`}>
                {item.icon}
              </span>
              <p className="text-xs text-gray-500 dark:text-slate-400 uppercase font-medium">{item.label}</p>
            </div>
            <p className={`text-2xl font-bold ${colors.text} mt-1`}>
              <CountUp target={item.value} format={item.format} />
            </p>
            {item.subtitle && (
              <p className="text-xs text-gray-400 mt-1">{item.subtitle}</p>
            )}
            {item.trend && item.trend.value !== 0 && (
              <p className={`text-xs mt-1 ${item.trend.value > 0 ? 'text-green-600' : 'text-red-500'}`}>
                {item.trend.value > 0 ? '+' : ''}{item.trend.value} {item.trend.label}
              </p>
            )}
            {item.tooltip && (
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity z-10">
                {item.tooltip}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-800" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
