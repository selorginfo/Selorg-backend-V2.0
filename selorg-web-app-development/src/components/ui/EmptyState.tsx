import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

/** Centred empty state card — large outlined glyph, title, blurb, optional CTA,
 *  matching the design source's empty/no-results panels. */
export function EmptyState({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col items-center justify-center rounded-app border border-line bg-white px-5 py-12 text-center">
      <Icon size={52} strokeWidth={1.6} className="text-[#c9ccc0]" />
      <h3 className="mt-3 text-[19px] font-extrabold">{title}</h3>
      {subtitle ? <p className="mt-2 max-w-sm text-sm text-muted">{subtitle}</p> : null}
      {action ? <div className="mt-[18px]">{action}</div> : null}
    </div>
  );
}
