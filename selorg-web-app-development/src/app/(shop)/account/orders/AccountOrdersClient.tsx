"use client";

import Link from "next/link";
import { PackageSearch } from "lucide-react";
import { useOrders } from "@/context/OrdersContext";
import { OrderCard } from "@/components/orders/OrderCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export function AccountOrdersClient() {
  const { orders } = useOrders();

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={PackageSearch}
        title="No orders yet"
        subtitle="Your placed orders will show up here."
        action={
          <Link href="/">
            <Button>Start shopping</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {orders.map((o) => (
        <OrderCard key={o.id} order={o} />
      ))}
    </div>
  );
}
