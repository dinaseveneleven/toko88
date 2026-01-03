import { Skeleton } from '@/components/ui/skeleton';

export function ProductCardSkeleton() {
  return (
    <div className="pos-card p-2 sm:p-4 md:p-5 flex flex-col gap-2 sm:gap-3 md:gap-4">
      {/* Header with name and stock */}
      <div className="flex items-start justify-between gap-1 sm:gap-2 md:gap-3">
        <div className="flex-1 min-w-0 space-y-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>

      {/* Price */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Quantity controls placeholder */}
      <div className="flex items-center justify-center gap-2">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-8 rounded-md" />
      </div>

      {/* Add button */}
      <Skeleton className="h-10 w-full rounded-lg mt-auto" />
    </div>
  );
}

interface ProductGridSkeletonProps {
  count?: number;
}

export function ProductGridSkeleton({ count = 6 }: ProductGridSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </>
  );
}
