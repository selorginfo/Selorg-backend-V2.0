import type { Metadata } from "next";
import { HelpClient } from "@/app/(shop)/help/HelpClient";

export const metadata: Metadata = { title: "Help & Support" };

export default function AccountHelpPage() {
  return <HelpClient embedded />;
}
