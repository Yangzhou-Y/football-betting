"use client";

/** Base skeleton block with pulse animation */
export function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className || ""}`} />;
}

/** Skeleton for a single MatchCard */
export function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-slate-200">
      <div className="flex items-center justify-between mb-2">
        <Skeleton className="w-16 h-5 rounded-full" />
        <Skeleton className="w-24 h-4" />
      </div>
      <Skeleton className="w-32 h-3 mx-auto mb-2" />
      <div className="flex items-center justify-center gap-2 mb-3">
        <Skeleton className="w-20 h-5" />
        <Skeleton className="w-8 h-4" />
        <Skeleton className="w-20 h-5" />
      </div>
      <Skeleton className="w-48 h-4 mx-auto mb-2" />
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-1.5">
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
        <Skeleton className="flex-1" />
      </div>
      <div className="grid grid-cols-3 gap-1 mt-1.5">
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
        <Skeleton className="h-4" />
      </div>
      <Skeleton className="w-24 h-4 mx-auto mt-3" />
    </div>
  );
}

/** Grid of MatchCard skeletons */
export function MatchCardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <MatchCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Skeleton for a table row */
export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3"><Skeleton className="h-4 w-full" /></td>
      ))}
    </tr>
  );
}

/** Full table skeleton with header */
export function TableSkeleton({ rows = 5, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i} className="px-4 py-3"><Skeleton className="h-4 w-16" /></th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: rows }).map((_, i) => (
              <TableRowSkeleton key={i} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Mobile card list skeleton */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-4 h-4" />
              <Skeleton className="w-16 h-4" />
            </div>
            <Skeleton className="w-6 h-6 rounded-full" />
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="w-24 h-4" />
            <Skeleton className="w-16 h-4" />
          </div>
        </div>
      ))}
    </div>
  );
}
