import Link from "next/link";
import { PackageX } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function ProductNotFound() {
  return (
    <div className="mx-auto flex max-w-[1680px] flex-col items-center gap-4 px-4 py-24 text-center">
      <PackageX size={40} className="text-muted" />
      <h1 className="text-xl font-extrabold">Product not found</h1>
      <p className="text-sm text-muted">This product doesn&apos;t exist or is no longer available.</p>
      <Link href="/">
        <Button>Continue shopping</Button>
      </Link>
    </div>
  );
}
