export function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg p-4 border shadow-sm animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-7 w-16 bg-gray-200 dark:bg-slate-700 rounded mt-1" />
      <div className="h-3 w-24 bg-gray-200 dark:bg-slate-700 rounded mt-2" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-lg border shadow-sm overflow-hidden animate-pulse">
      <div className="bg-gray-50 dark:bg-slate-700 px-4 py-3 flex gap-4">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-slate-600 rounded flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="px-4 py-3 border-t border-gray-100 flex gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="h-3 bg-gray-200 dark:bg-slate-700 rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonEntityGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 animate-pulse">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-gray-50 dark:bg-slate-700 rounded-lg p-3 border">
          <div className="h-4 w-32 bg-gray-200 dark:bg-slate-600 rounded mb-2" />
          <div className="h-3 w-24 bg-gray-200 dark:bg-slate-600 rounded mb-1" />
          <div className="h-1.5 w-full bg-gray-200 dark:bg-slate-600 rounded-full mt-2" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPainel() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <SkeletonEntityGrid count={4} />
      <SkeletonTable rows={5} cols={4} />
    </div>
  );
}
