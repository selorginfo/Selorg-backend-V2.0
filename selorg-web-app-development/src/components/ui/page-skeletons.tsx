import type { ReactNode } from "react";
import { Skeleton, ProductCardSkeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";

/** Marks route loading UI so layout footer stays hidden and content fills the viewport. */
function SkeletonPage({
  children,
  className,
  home,
}: {
  children: ReactNode;
  className?: string;
  home?: boolean;
}) {
  return (
    <div
      className={cn(
        "page-skeleton flex w-full min-h-[calc(100dvh-8rem)] flex-col",
        home && "home-shell",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ProductGridSkeleton({ count = 12, className }: { count?: number; className?: string }) {
  return (
    <div className={cn("pgrid", className)}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function HomePageSkeleton() {
  return (
    <SkeletonPage home className="wrap pt-[18px] pb-9">
      <div className="grid grid-cols-1 items-start gap-[18px] min-[941px]:grid-cols-[200px_minmax(0,1fr)] min-[1221px]:grid-cols-[200px_minmax(0,1fr)_260px]">
        <aside className="hidden min-[941px]:block">
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            <Skeleton className="h-11 w-full rounded-none" />
            <div className="flex flex-col gap-1 p-2">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex items-center gap-2.5 px-2 py-2">
                  <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-full" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton className="aspect-[2.2/1] w-full rounded-[14px] sm:aspect-[3.2/1] min-[941px]:aspect-[4.2/1]" />
          <div className="grid grid-cols-1 gap-3 pdp:grid-cols-3">
            <Skeleton className="h-[72px] w-full rounded-2xl" />
            <Skeleton className="h-[72px] w-full rounded-2xl" />
            <Skeleton className="h-[72px] w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="mb-4 h-7 w-40" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} className="flex shrink-0 flex-col items-center gap-2">
                  <Skeleton className="h-16 w-16 rounded-full" />
                  <Skeleton className="h-3 w-14" />
                </div>
              ))}
            </div>
          </div>
          <div>
            <Skeleton className="mb-4 h-7 w-56" />
            <ProductGridSkeleton count={12} />
          </div>
        </div>

        <aside className="hidden min-[1221px]:flex min-[1221px]:flex-col min-[1221px]:gap-4">
          <Skeleton className="h-[200px] w-full rounded-2xl" />
          <Skeleton className="h-[160px] w-full rounded-2xl" />
        </aside>
      </div>
    </SkeletonPage>
  );
}

export function SearchPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-14 pt-5">
      <Skeleton className="mb-4 h-11 w-full max-w-xl rounded-2xl" />
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <ProductGridSkeleton count={12} />
    </SkeletonPage>
  );
}

export function CategoryPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-14 pt-5">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-4 mb-6 h-28 w-full rounded-2xl sm:h-32" />
      <div className="mb-4 flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-full" />
        ))}
      </div>
      <ProductGridSkeleton count={12} />
    </SkeletonPage>
  );
}

export function ProductPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-10 pt-4 sm:pb-14 sm:pt-5">
      <div className="grid grid-cols-1 items-start gap-5 pdp:grid-cols-2 pdp:gap-8">
        <Skeleton className="aspect-square w-full rounded-[22px]" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-14 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-2.5">
            <Skeleton className="h-16 rounded-xl" />
            <Skeleton className="h-16 rounded-xl" />
          </div>
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
      <div className="mt-8">
        <Skeleton className="mb-4 h-7 w-56" />
        <ProductGridSkeleton count={6} />
      </div>
    </SkeletonPage>
  );
}

export function CartPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-9 pt-3 min-[861px]:pt-[18px]">
      <Skeleton className="mb-5 h-8 w-40" />
      <div className="grid grid-cols-1 items-start gap-5 min-[1041px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-line bg-white p-4">
              <Skeleton className="h-20 w-20 shrink-0 rounded-xl" />
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="mt-auto h-8 w-28 rounded-full" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}

export function CheckoutPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-9 pt-[18px]">
      <Skeleton className="mb-5 h-8 w-48" />
      <div className="grid grid-cols-1 items-start gap-5 min-[1041px]:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
          <Skeleton className="h-52 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-3">
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-12 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}

export function PaymentPageSkeleton() {
  return (
    <SkeletonPage className="mx-auto w-full max-w-[560px] px-3 pb-10 pt-5 sm:px-5 sm:pb-14 sm:pt-8">
      <div className="overflow-hidden rounded-2xl border border-line bg-white sm:rounded-[20px]">
        <Skeleton className="h-[72px] w-full rounded-none" />
        <div className="flex flex-col items-center gap-4 px-4 py-12 sm:py-16">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="h-5 w-52" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-48" />
        </div>
      </div>
    </SkeletonPage>
  );
}

export function OrderResultPageSkeleton() {
  return (
    <SkeletonPage className="flex min-h-full w-full flex-1 flex-col items-center justify-center bg-[#f6f6f2] px-3 py-8 sm:px-5 sm:py-10">
      <div className="w-full max-w-[560px] sm:max-w-[640px]">
        <div className="rounded-2xl border border-line bg-white p-4 sm:rounded-[22px] sm:p-8">
          <Skeleton className="mx-auto h-16 w-16 rounded-full sm:h-[88px] sm:w-[88px]" />
          <Skeleton className="mx-auto mt-5 h-7 w-56 sm:h-8 sm:w-72" />
          <Skeleton className="mx-auto mt-3 h-4 w-full max-w-[360px]" />
          <Skeleton className="mx-auto mt-2 h-4 w-full max-w-[280px]" />
          <Skeleton className="mx-auto mt-6 h-16 w-full max-w-xs rounded-2xl" />
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
            <Skeleton className="h-12 w-full rounded-[13px]" />
            <Skeleton className="h-12 w-full rounded-[13px]" />
          </div>
        </div>
      </div>
    </SkeletonPage>
  );
}

export function OrdersPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-9 pt-[18px]">
      <Skeleton className="mb-5 h-8 w-40" />
      <div className="flex max-w-[820px] flex-col gap-3.5">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-6 w-20 rounded-full" />
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonPage>
  );
}

export function OrderDetailPageSkeleton() {
  return (
    <SkeletonPage className="wrap max-w-[1240px] pb-9 pt-[18px]">
      <Skeleton className="mb-4 h-5 w-32" />
      <div className="grid grid-cols-1 gap-4 min-[1081px]:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-56 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
        <div className="flex flex-col gap-3.5">
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}

export function AccountPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-9 pt-[18px]">
      <Skeleton className="mb-4 h-8 w-44" />
      <div className="grid grid-cols-1 items-start gap-[26px] min-[861px]:grid-cols-[250px_minmax(0,1fr)]">
        <div className="hidden rounded-2xl border border-line bg-white p-4 min-[861px]:block">
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="mb-2.5 h-10 w-full rounded-xl" />
          ))}
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <Skeleton className="h-36 w-full rounded-2xl" />
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-44 w-full rounded-2xl" />
        </div>
      </div>
    </SkeletonPage>
  );
}

export function OffersPageSkeleton() {
  return (
    <SkeletonPage className="wrap pb-9 pt-3 min-[861px]:pt-[18px]">
      <Skeleton className="mb-5 h-8 w-48" />
      <div className="grid grid-cols-1 gap-4 pdp:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-36 w-full rounded-2xl" />
        ))}
      </div>
      <Skeleton className="mt-8 mb-4 h-6 w-40" />
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </SkeletonPage>
  );
}

export function ContentPageSkeleton() {
  return (
    <SkeletonPage className="wrap max-w-[720px] py-8">
      <Skeleton className="mb-5 h-8 w-48" />
      <div className="mb-5 flex flex-wrap gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-16 w-full rounded-2xl" />
        ))}
      </div>
    </SkeletonPage>
  );
}

export function AuthPageSkeleton() {
  return (
    <div className="page-skeleton mx-auto grid min-h-[calc(100dvh-8rem)] w-full max-w-[1100px] grid-cols-1 gap-0 p-4 min-[861px]:grid-cols-2 min-[861px]:p-8">
      <Skeleton className="hidden min-h-[480px] rounded-[24px] min-[861px]:block" />
      <div className="flex flex-col justify-center gap-4 px-2 py-8 sm:px-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-4 h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    </div>
  );
}

/** Compact list skeleton for account / support content panes. */
export function PanelListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="rounded-2xl border border-line bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
