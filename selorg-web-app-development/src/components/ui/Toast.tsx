"use client";

import { CheckCircle2 } from "lucide-react";
import { useUI } from "@/context/UIContext";

export function Toast() {
  const { toast } = useUI();
  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className="fixed bottom-6 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2.5 rounded-2xl bg-ink px-5 py-3.5 text-sm font-bold text-white shadow-2xl animate-toastIn"
    >
      <CheckCircle2 size={18} className="text-accent-tint" />
      {toast.message}
    </div>
  );
}
