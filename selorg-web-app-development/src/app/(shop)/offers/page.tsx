import type { Metadata } from "next";
import { OffersClient } from "./OffersClient";

export const metadata: Metadata = { title: "Offers & Deals" };

export default function OffersPage() {
  return <OffersClient />;
}
