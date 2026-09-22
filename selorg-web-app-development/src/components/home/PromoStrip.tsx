"use client";

import type { IconType } from "react-icons";
import {
  TbBolt,
  TbLeaf,
  TbLock,
  TbMessageCircle,
  TbPlant2,
  TbRefresh,
  TbShieldCheck,
  TbTruckDelivery,
} from "react-icons/tb";
import { useAppConfig } from "@/context/AppConfigContext";
import { useDelivery } from "@/context/DeliveryContext";
import { TRUST } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/cn";

/**
 * Outline feature icons (Tabler via react-icons):
 * forest-green stroke, medium weight, rounded caps, centered in a soft squircle.
 */
function FeatureIcon({
  icon: Icon,
  bg,
  size = "md",
}: {
  icon: IconType;
  bg: string;
  size?: "md" | "sm";
}) {
  const box = size === "md" ? "h-12 w-12 rounded-2xl" : "h-11 w-11 rounded-2xl";
  const px = size === "md" ? 22 : 20;

  return (
    <span
      className={cn("flex shrink-0 items-center justify-center", box)}
      style={{ background: bg }}
      aria-hidden
    >
      <Icon size={px} strokeWidth={1.75} className="text-accent-dark" />
    </span>
  );
}

/** Trust badges are icon-by-position (plant, shield, bolt, refresh, lock, chat). */
const TRUST_ICONS: IconType[] = [
  TbPlant2,
  TbShieldCheck,
  TbBolt,
  TbRefresh,
  TbLock,
  TbMessageCircle,
];

/**
 * The free-delivery threshold and the delivery promise are read from
 * `/bootstrap` and the delivery context rather than hardcoded — the static copy
 * advertised a ₹199 threshold while checkout actually applies the configured
 * one, so the homepage was promising a discount the cart would not honour.
 */
export function PromoStrip() {
  const { pricing } = useAppConfig();
  const { promiseText } = useDelivery();

  const tiles = [
    {
      icon: TbTruckDelivery,
      title: "Free delivery",
      sub: `On orders over ${formatMoney(pricing.freeDeliveryThreshold)}`,
      bg: "#eef4e6",
    },
    {
      icon: TbBolt,
      title: promiseText ? `Delivered in ${promiseText}` : "Fast delivery",
      sub: "Lightning-fast & fresh",
      bg: "#f4e7d1",
    },
    { icon: TbLeaf, title: "100% Organic", sub: "Certified & farm-sourced", bg: "#e9f1ec" },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 pdp:grid-cols-3 pdp:gap-4">
      {tiles.map(({ icon, ...p }) => (
        <div
          key={p.title}
          className="flex items-center gap-3.5 rounded-app border border-line bg-white px-5 py-4"
        >
          <FeatureIcon icon={icon} bg={p.bg} size="md" />
          <div className="min-w-0">
            <div className="text-[15px] font-extrabold leading-snug text-ink">{p.title}</div>
            <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{p.sub}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function TrustGrid() {
  return (
    <div className="grid grid-cols-1 gap-x-5 gap-y-4 xs:grid-cols-2 min-[861px]:grid-cols-3">
      {TRUST.map((t, i) => {
        const Icon = TRUST_ICONS[i] ?? TbLeaf;
        return (
          <div key={t.title} className="flex items-center gap-3">
            <FeatureIcon icon={Icon} bg="var(--color-accent-tint)" size="sm" />
            <div className="min-w-0">
              <div className="text-[13.5px] font-extrabold leading-snug text-ink">{t.title}</div>
              <div className="mt-0.5 text-[11.5px] leading-snug text-muted">{t.sub}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
