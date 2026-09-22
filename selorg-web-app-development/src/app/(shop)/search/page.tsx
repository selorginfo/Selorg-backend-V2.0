import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchClient } from "./SearchClient";
import { SearchPageSkeleton } from "@/components/ui/page-skeletons";

export const metadata: Metadata = { title: "Search" };

export default function SearchPage() {
  return (
    <Suspense fallback={<SearchPageSkeleton />}>
      <SearchClient />
    </Suspense>
  );
}
