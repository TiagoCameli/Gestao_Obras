import GradientProgressBar from './GradientProgressBar';

export interface ProgressBarItem {
  label: string;
  sublabel?: string;
  value: number;
  maxValue: number;
  detail: string;
  children?: ProgressBarItem[];
}

export default function ProgressBarGroup({
  items,
  title,
  headerBgClass = 'bg-gray-50',
  headerTextClass = 'text-gray-800',
}: {
  items: ProgressBarItem[];
  title?: string;
  headerBgClass?: string;
  headerTextClass?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border dark:border-slate-700 shadow-sm overflow-hidden">
      {title && (
        <div className={`px-4 py-2.5 border-b dark:border-slate-700 ${headerBgClass}`}>
          <h3 className={`text-sm font-semibold ${headerTextClass}`}>{title}</h3>
        </div>
      )}
      <div className="divide-y divide-gray-100 dark:divide-slate-700 p-4 space-y-4">
        {items.map((item) => {
          const percent = item.maxValue > 0 ? (item.value / item.maxValue) * 100 : 0;
          return (
            <div key={item.label} className="pt-2 first:pt-0">
              <div className="flex justify-between items-baseline mb-1">
                <span className="text-sm font-medium text-gray-800 dark:text-slate-200">{item.label}</span>
                <span className="text-sm text-gray-600 dark:text-slate-400">{item.detail}</span>
              </div>
              <GradientProgressBar value={percent} height="md" />
              {item.children && item.children.length > 0 && (
                <div className="ml-4 mt-2 space-y-1.5">
                  {item.children.map((child) => {
                    const childPercent = child.maxValue > 0 ? (child.value / child.maxValue) * 100 : 0;
                    return (
                      <div key={child.label}>
                        <div className="flex justify-between items-baseline mb-0.5">
                          <span className="text-xs text-gray-500">{child.label}</span>
                          <span className="text-xs text-gray-400">{child.detail}</span>
                        </div>
                        <GradientProgressBar value={childPercent} height="sm" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
