import clsx from 'clsx';

interface SkeletonProps {
  className?: string;
}

export function SkeletonLoader({ className }: SkeletonProps) {
  return (
    <div 
      className={clsx(
        "animate-pulse bg-slate-200 rounded",
        className
      )}
    />
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 overflow-hidden">
      <SkeletonLoader className="h-48 w-full rounded-lg mb-4" />
      <SkeletonLoader className="h-6 w-3/4 mb-2" />
      <SkeletonLoader className="h-4 w-1/2 mb-4" />
      <div className="space-y-2">
        <SkeletonLoader className="h-3 w-full" />
        <SkeletonLoader className="h-3 w-5/6" />
        <SkeletonLoader className="h-3 w-4/6" />
      </div>
      <div className="mt-6 flex justify-between items-center">
        <SkeletonLoader className="h-8 w-24 rounded-md" />
        <SkeletonLoader className="h-8 w-24 rounded-md" />
      </div>
    </div>
  );
}
