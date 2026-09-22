"use client";

import Image from "next/image";
import { Gift, Leaf, Lock, RefreshCw, Truck, Zap, type LucideIcon } from "lucide-react";
import { useAppConfig } from "@/context/AppConfigContext";
import { useAuth } from "@/context/AuthContext";
import { useDeliveryEtaLabel } from "@/context/DeliveryContext";
import { formatMoney } from "@/lib/money";

interface Perk {
  Icon: LucideIcon;
  title: string;
  sub: string;
}

/** Photo hero behind the green scrim, exactly as the design source does
 *  (a different shot for the login and signup states). */
const HERO_PHOTO = {
  login: "https://images.pexels.com/photos/735536/pexels-photo-735536.jpeg?auto=compress&cs=tinysrgb&w=900",
  signup:
    "https://images.pexels.com/photos/33975355/pexels-photo-33975355.jpeg?auto=compress&cs=tinysrgb&w=900",
} as const;

function useAuthPerks(): { isSignup: boolean; perks: Perk[]; eta: string | null } {
  const { auth } = useAuth();
  const { pricing } = useAppConfig();
  const eta = useDeliveryEtaLabel();
  const isSignup = auth.mode === "signup";

  const perks: Perk[] = isSignup
    ? [
        { Icon: Gift, title: "Offers on every order", sub: "Apply a coupon at checkout" },
        {
          Icon: Zap,
          title: eta ? `Delivery in ${eta}` : "Fast delivery",
          sub: "Fresh produce, straight to you",
        },
        { Icon: Lock, title: "Secure & private", sub: "Your details are encrypted" },
      ]
    : [
        { Icon: Leaf, title: "100% certified organic", sub: "Sourced from trusted farms" },
        {
          Icon: Truck,
          title: `Free delivery over ${formatMoney(pricing.freeDeliveryThreshold)}`,
          sub: "No hidden charges, ever",
        },
        { Icon: RefreshCw, title: "Easy returns", sub: "Quality checked on delivery" },
      ];

  return { isSignup, perks, eta };
}

/** Compact green strip for the single-column (small) auth card. */
export function AuthMobileBrand() {
  const { isSignup } = useAuthPerks();

  return (
    <div className="relative overflow-hidden bg-accent px-4 py-3 text-white min-[720px]:hidden">
      <Image
        src={isSignup ? HERO_PHOTO.signup : HERO_PHOTO.login}
        alt=""
        fill
        sizes="380px"
        className="object-cover"
        priority
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg,rgba(94,140,58,.94) 0%,rgba(68,106,32,.92) 55%,rgba(40,64,18,.96) 100%)",
        }}
      />
      <div className="relative flex items-center gap-2.5">
        <Image
          src="/selorg-logo.png"
          alt="Selorg"
          width={40}
          height={40}
          className="h-10 w-10 rounded-[10px] object-cover shadow-md"
        />
        <div className="min-w-0">
          <div className="font-sans text-[15px] font-extrabold leading-tight tracking-tight">
            {isSignup ? "Join Selorg today." : "Good food, free ride home."}
          </div>
          <p className="mt-0.5 truncate text-[11.5px] leading-snug opacity-90">
            {isSignup
              ? "Create your account in under a minute."
              : "Fresh organic groceries · free delivery"}
          </p>
        </div>
      </div>
    </div>
  );
}

export function AuthBrandPanel() {
  const { isSignup, perks, eta } = useAuthPerks();

  // Stretches with the form column (no fixed min-height) so landscape / short
  // frames don't force the card taller than the viewport.
  return (
    <div className="relative hidden min-h-0 flex-col justify-between overflow-hidden bg-accent p-6 text-white min-[720px]:flex min-[900px]:p-7 [@media(max-height:640px)]:p-5">
      <Image
        src={isSignup ? HERO_PHOTO.signup : HERO_PHOTO.login}
        alt=""
        fill
        sizes="(min-width: 900px) 360px, 340px"
        className="object-cover"
        priority
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(165deg,rgba(94,140,58,.93) 0%,rgba(68,106,32,.9) 55%,rgba(40,64,18,.95) 100%)",
        }}
      />
      <div className="animate-glowPulse absolute -right-[70px] -top-[70px] h-[200px] w-[200px] rounded-full bg-white opacity-[0.07]" />
      <div className="animate-glowPulse absolute -bottom-[50px] -left-[40px] h-[140px] w-[140px] rounded-full bg-white opacity-[0.06]" />

      <div className="relative flex items-center gap-2">
        <Image
          src="/selorg-logo.png"
          alt="Selorg"
          width={48}
          height={48}
          className="animate-floatY h-10 w-10 rounded-xl object-cover shadow-lg min-[900px]:h-12 min-[900px]:w-12"
        />
      </div>

      <div className="relative my-4 min-w-0 [@media(max-height:640px)]:my-2">
        <div className="font-sans text-[22px] font-extrabold leading-[1.1] tracking-[-0.6px] min-[900px]:text-[26px] min-[900px]:leading-[1.08] [@media(max-height:640px)]:text-[20px]">
          {isSignup ? "Join Selorg today." : "Good food, free ride home."}
        </div>
        <p className="mb-3.5 mt-2 max-w-[240px] text-[13px] leading-[1.5] opacity-90 min-[900px]:mb-4 min-[900px]:text-[13.5px] [@media(max-height:640px)]:mb-2.5 [@media(max-height:640px)]:mt-1.5 [@media(max-height:640px)]:line-clamp-2">
          {isSignup
            ? "Create your account in under a minute and get 10% off your first order."
            : "Fresh, organic groceries delivered to your door in minutes — with zero delivery fees."}
        </p>
        <div className="flex flex-col gap-2.5 [@media(max-height:640px)]:gap-2">
          {perks.map(({ Icon, title, sub }) => (
            <div key={title} className="animate-authFieldIn flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white/[.16] min-[900px]:h-8 min-[900px]:w-8">
                <Icon size={15} />
              </span>
              <span className="min-w-0">
                <span className="block text-[12.5px] font-bold min-[900px]:text-[13px]">{title}</span>
                <span className="mt-px block text-[10.5px] opacity-[.82] min-[900px]:text-[11px] [@media(max-height:640px)]:hidden">
                  {sub}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex gap-4 text-[11.5px] opacity-90 min-[900px]:gap-5 min-[900px]:text-[12px] [@media(max-height:560px)]:hidden">
        {eta ? (
          <div>
            <div className="font-sans text-[17px] font-extrabold min-[900px]:text-[18px]">{eta}</div>
            avg delivery
          </div>
        ) : null}
        <div>
          <div className="font-sans text-[17px] font-extrabold min-[900px]:text-[18px]">100%</div>
          organic sourced
        </div>
      </div>
    </div>
  );
}
