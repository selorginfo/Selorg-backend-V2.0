import type { Metadata } from "next";
import { AccountOrdersClient } from "./AccountOrdersClient";

export const metadata: Metadata = { title: "Your Orders" };

export default function AccountOrdersPage() {
  return <AccountOrdersClient />;
}
