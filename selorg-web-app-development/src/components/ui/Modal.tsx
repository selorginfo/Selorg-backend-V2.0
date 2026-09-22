"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-3 animate-fadeIn sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "w-full max-w-md rounded-[16px] bg-white p-4 shadow-2xl animate-popIn sm:rounded-[20px] sm:p-6",
          "max-h-[min(92dvh,860px)] overflow-hidden",
          className,
        )}
      >
        {title ? (
          <div className="mb-3 flex items-center justify-between sm:mb-4">
            <h2 className="text-base font-extrabold sm:text-lg">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="rounded-full p-1.5 text-muted hover:bg-black/5"
            >
              <X size={18} />
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
