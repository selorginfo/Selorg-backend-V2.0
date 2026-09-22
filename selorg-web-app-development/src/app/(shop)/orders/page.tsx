import type { Metadata } from "next";
import { OrdersClient } from "./OrdersClient";

export const metadata: Metadata = { title: "Your Orders" };

export default function OrdersPage() {
  return <OrdersClient />;
}
