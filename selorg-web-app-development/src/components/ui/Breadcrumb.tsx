import Link from "next/link";
import { Fragment } from "react";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-muted">
      {items.map((item, i) => (
        <Fragment key={i}>
          {i > 0 ? <span className="opacity-50">/</span> : null}
          {item.href ? (
            <Link href={item.href} className="hover:text-accent-dark">
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
