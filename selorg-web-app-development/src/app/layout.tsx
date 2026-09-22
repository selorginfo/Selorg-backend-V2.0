import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/context/AppProviders";
import { Toast } from "@/components/ui/Toast";
import { CartDrawer } from "@/components/layout/CartDrawer";
import { ModalHost } from "@/components/layout/ModalHost";

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Selorg · Organic groceries delivered in minutes",
    template: "%s · Selorg",
  },
  description:
    "Certified organic fruits, vegetables, dairy, and pantry staples delivered fresh to your door in minutes.",
};

/**
 * Must run before React's inline `$RS` assign. Kept as a plain <head> script
 * (not next/script): React 19 warns when a Client Component renders <script>.
 */
const REACT_STREAMING_PATCH = `(function(){function completeSegment(segmentId,placeholderId){var segment=document.getElementById(segmentId);var placeholder=document.getElementById(placeholderId);if(!segment||!placeholder||!segment.parentNode||!placeholder.parentNode){return}for(segment.parentNode.removeChild(segment);segment.firstChild;){placeholder.parentNode.insertBefore(segment.firstChild,placeholder)}placeholder.parentNode.removeChild(placeholder)}try{Object.defineProperty(window,"$RS",{configurable:true,enumerable:false,get:function(){return completeSegment},set:function(){}})}catch(e){window.$RS=completeSegment}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={plusJakarta.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: REACT_STREAMING_PATCH }} />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <AppProviders>
          {children}
          <CartDrawer />
          <ModalHost />
          <Toast />
        </AppProviders>
      </body>
    </html>
  );
}
