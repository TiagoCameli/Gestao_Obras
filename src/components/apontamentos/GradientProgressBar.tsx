const HEIGHT_MAP = {
  sm: 'h-2',
  md: 'h-3',
  lg: 'h-4',
};

export default function GradientProgressBar({
  value,
  height = 'md',
  showLabel = false,
  label,
}: {
  value: number;
  height?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, value));
  const hClass = HEIGHT_MAP[height];

  return (
    <div>
      {showLabel && label && (
        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
          <span>{label}</span>
          <span>{Math.round(clamped)}%</span>
        </div>
      )}
      <div className={`w-full bg-gray-200 dark:bg-slate-700 rounded-full ${hClass} overflow-hidden`}>
        <div
          className={`${hClass} rounded-full transition-all duration-500`}
          style={{
            width: `${clamped}%`,
            background: `linear-gradient(to right, #22c55e, #eab308 50%, #ef4444)`,
            backgroundSize: '200% 100%',
            backgroundPosition: `${100 - clamped}% 0`,
          }}
        />
      </div>
    </div>
  );
}
