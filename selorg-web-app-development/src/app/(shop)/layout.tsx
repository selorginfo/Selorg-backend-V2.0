import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: browser extensions (e.g. "Open in Incognito")
    // inject attrs/nodes onto this shell before React hydrates.
    // Viewport shell: header stays put; main scrolls.
    <div id="shop-shell" className="flex h-dvh flex-col overflow-hidden" suppressHydrationWarning>
      <Header />
      <main
        id="shop-main"
        className="shop-main flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(72px+env(safe-area-inset-bottom))] min-[861px]:pb-0"
        suppressHydrationWarning
      >
        {/* `grow` (basis:auto) expands short pages so footer sits at the viewport
            bottom, but still grows with tall pages so footer is never mid-content.
            Do NOT use flex-1 + min-h-full — that locks height and lets overflow
            paint on top of the footer (checkout / cart bug). */}
        <div className="page-slot flex w-full grow flex-col">{children}</div>
        <Footer className="mt-auto shrink-0" />
      </main>
      <MobileBottomNav />
    </div>
  );
}
