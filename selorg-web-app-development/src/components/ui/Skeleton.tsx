import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skel", className)} />;
}

/** Mirrors ProductCard so loading grids match the locked card size. */
export function ProductCardSkeleton() {
  return (
    <div className="flex h-full w-full min-w-0 flex-col overflow-hidden bg-white">
      <Skeleton className="aspect-square w-full shrink-0 rounded-none" />
      <div className="flex flex-col gap-1.5 p-2.5 pb-3 sm:p-3 sm:pb-3.5">
        <Skeleton className="h-3 w-24 rounded-md" />
        <Skeleton className="h-[2.56em] w-full rounded-md" />
        <div className="flex h-[38px] items-end justify-between gap-1.5">
          <div className="flex flex-col gap-1">
            <Skeleton className="h-4 w-14 rounded-md" />
            <Skeleton className="h-3 w-10 rounded-md" />
          </div>
          <Skeleton className="h-[38px] w-[38px] shrink-0 rounded-full" />
        </div>
      </div>
    </div>
  );
}
