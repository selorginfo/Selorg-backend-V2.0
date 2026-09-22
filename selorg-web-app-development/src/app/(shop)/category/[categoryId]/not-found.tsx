import Link from "next/link";
import { FolderX } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function CategoryNotFound() {
  return (
    <div className="mx-auto flex max-w-[1680px] flex-col items-center gap-4 px-4 py-24 text-center">
      <FolderX size={40} className="text-muted" />
      <h1 className="text-xl font-extrabold">Category not found</h1>
      <p className="text-sm text-muted">This category doesn&apos;t exist or may have been removed.</p>
      <Link href="/">
        <Button>Browse all categories</Button>
      </Link>
    </div>
  );
}
