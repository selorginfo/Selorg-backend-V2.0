"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useOrders } from "@/context/OrdersContext";
import { OrderCard } from "@/components/orders/OrderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";
import { OrdersPageSkeleton } from "@/components/ui/page-skeletons";

export function OrdersClient() {
  const loggedIn = useRequireAuth();
  const { orders, loading } = useOrders();

  if (!loggedIn) return null;

  if (loading && orders.length === 0) {
    return <OrdersPageSkeleton />;
  }

  return (
    <div className="wrap pb-9 pt-[18px]">
      <h1 className="mb-4 font-sans text-[28px] font-extrabold tracking-[-0.7px]">My orders</h1>

      {orders.length === 0 ? (
        <EmptyState
          icon={PackageSearch}
          title="No orders yet"
          subtitle="Your orders will appear here once you place them."
          action={
            <Link href="/">
              <Button>Start shopping</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex max-w-[820px] flex-col gap-3.5">
          {orders.map((o) => (
            <OrderCard key={o.id} order={o} />
          ))}
        </div>
      )}
    </div>
  );
}
