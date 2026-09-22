"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Loader2, MapPin, Search, X } from "lucide-react";
import { useAddresses } from "@/context/AddressContext";
import { useDelivery } from "@/context/DeliveryContext";
import { useUI } from "@/context/UIContext";
import { useMounted } from "@/hooks/useMounted";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOnClickOutside } from "@/hooks/useOnClickOutside";
import {
  resolvePlace,
  searchLocations,
  type LocationSuggestion,
} from "@/services/locationService";
import { cn } from "@/lib/cn";

export function LocationPicker({ compact = false }: { compact?: boolean }) {
  const {
    addresses,
    selectedAddr,
    selectAddr,
    locOpen,
    setLocOpen,
    locQuery,
    setLocQuery,
    locDetecting,
    detectLocation,
  } = useAddresses();
  const { openModal, showToast } = useUI();
  const { promiseText, loading: deliveryLoading } = useDelivery();
  const mounted = useMounted();
  const etaLabel = !mounted ? "soon" : deliveryLoading ? "…" : (promiseText ?? "soon");
  const ref = useRef<HTMLDivElement>(null);
  // Header mounts a desktop and a compact picker at once (one is CSS-hidden) and both
  // share `locOpen`, so the panel must survive mousedown inside either instance —
  // closing on mousedown would cancel the click before any button handler ran.
  useOnClickOutside(ref, () => setLocOpen(false), {
    enabled: locOpen,
    ignoreSelector: "[data-location-picker]",
  });

  const debouncedQuery = useDebouncedValue(locQuery, 300);
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [resolvingPlace, setResolvingPlace] = useState(false);

  const current = mounted ? addresses.find((a) => a.id === selectedAddr) : undefined;
  const filteredSaved = addresses.filter((a) =>
    `${a.type} ${a.line} ${a.line2} ${a.area}`.toLowerCase().includes(locQuery.toLowerCase()),
  );

  const currentLabel = current
    ? (
        current.line2 ||
        current.area
          .split(/[·,]/)
          .map((part) => part.trim().replace(/\s*\d{6}$/, ""))
          .filter(Boolean)[0] ||
        current.line
      )
    : "Set your location";

  useEffect(() => {
    const q = debouncedQuery.trim();
    if (q.length < 2) {
      return;
    }
    let cancelled = false;
    const selected = addresses.find((a) => a.id === selectedAddr);
    const run = async () => {
      setSuggestionsLoading(true);
      try {
        const items = await searchLocations(q, {
          latitude: selected?.latitude,
          longitude: selected?.longitude,
        });
        if (!cancelled) setSuggestions(items);
      } catch {
        if (!cancelled) {
          setSuggestions([]);
          showToast("Location search failed. Check your connection and try again.");
        }
      } finally {
        if (!cancelled) setSuggestionsLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, addresses, selectedAddr, showToast]);

  const searchActive = debouncedQuery.trim().length >= 2;
  const placeSuggestions = searchActive ? suggestions : [];
  const placesLoading = searchActive && suggestionsLoading;

  const pickSuggestion = async (s: LocationSuggestion) => {
    if (!s.placeId) {
      showToast("This suggestion has no place id to resolve");
      return;
    }
    setResolvingPlace(true);
    try {
      const resolved = await resolvePlace(s.placeId);
      if (!resolved) {
        showToast("Could not resolve that place. Try another search result.");
        return;
      }
      setLocOpen(false);
      setLocQuery("");
      setSuggestions([]);
      openModal({
        type: "address",
        draft: {
          type: "Other",
          line1: resolved.line1,
          line2: resolved.line2,
          city: resolved.city,
          state: resolved.state,
          pincode: resolved.pincode,
          latitude: resolved.latitude,
          longitude: resolved.longitude,
        },
      });
    } finally {
      setResolvingPlace(false);
    }
  };

  return (
    <div ref={ref} data-location-picker className="relative">
      {compact ? (
        <button
          onClick={() => setLocOpen(!locOpen)}
          className="flex w-full max-w-full items-center gap-1.5 rounded-[10px] bg-accent-tint px-2.5 py-2 text-left text-xs font-bold text-accent-dark"
        >
          <MapPin size={14} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{currentLabel}</span>
          <ChevronDown size={12} className="shrink-0 opacity-70" />
        </button>
      ) : (
        <button
          onClick={() => setLocOpen(!locOpen)}
          className="flex max-w-[220px] items-center gap-1.5 rounded-[10px] px-2 py-1.5 text-left hover:bg-accent-tint"
        >
          <MapPin size={17} className="shrink-0 text-accent-dark" />
          <span className="flex min-w-0 flex-col items-start">
            <span className="text-[11px] font-semibold text-muted">
              Delivery in <b className="text-accent-dark">{etaLabel}</b>
            </span>
            <span className="flex max-w-[200px] items-center gap-1.5 text-[13.5px] font-bold">
              <span className="min-w-0 truncate">{currentLabel}</span>
              <ChevronDown size={12} className="shrink-0 text-muted" />
            </span>
          </span>
        </button>
      )}

      {locOpen ? (
        <div
          className={cn(
            "z-[60] w-[352px] max-w-[calc(100vw-30px)] overflow-hidden rounded-app border border-line bg-white",
            "shadow-[0_22px_50px_-18px_rgba(30,40,20,.42)]",
            compact
              ? "absolute left-0 right-0 top-[calc(100%+8px)] w-auto min-w-[min(352px,calc(100vw-30px))]"
              : "absolute left-0 top-[calc(100%+8px)]",
          )}
        >
          <div className="border-b border-line px-4 pb-3 pt-[15px]">
            <div className="flex items-center justify-between">
              <div className="text-[14.5px] font-extrabold">Delivery location</div>
              <button
                onClick={() => setLocOpen(false)}
                aria-label="Close location panel"
                className="text-muted"
              >
                <X size={18} />
              </button>
            </div>

            <div className="relative mt-[11px]">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                value={locQuery}
                onChange={(e) => setLocQuery(e.target.value)}
                placeholder="Search area, street, landmark…"
                className="h-10 w-full rounded-[10px] border-[1.5px] border-line bg-white pl-9 pr-3 text-[13px] font-medium outline-none focus:border-accent"
              />
            </div>

            {locDetecting || resolvingPlace ? (
              <div className="mt-[11px] flex items-center gap-2.5 text-[13px] font-bold text-muted">
                <Loader2 size={15} className="animate-spin" />
                {resolvingPlace ? "Resolving place…" : "Detecting your location…"}
              </div>
            ) : (
              <button
                type="button"
                onClick={() => void detectLocation()}
                className="mt-[11px] flex items-center gap-2 text-[13px] font-bold text-accent-dark"
              >
                <MapPin size={15} className="text-muted" /> Use my current location
              </button>
            )}
          </div>

          <div className="max-h-[280px] overflow-y-auto p-2">
            {placesLoading ? (
              <div className="px-3 py-3 text-[13px] text-muted">Searching places…</div>
            ) : null}

            {placeSuggestions.length > 0 ? (
              <div className="mb-2">
                <div className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
                  Places
                </div>
                {placeSuggestions.map((s) => (
                  <button
                    key={s.placeId || s.description}
                    type="button"
                    onClick={() => void pickSuggestion(s)}
                    className="mb-1 flex w-full flex-col rounded-xl px-3 py-2.5 text-left hover:bg-accent-tint"
                  >
                    <span className="text-[13px] font-bold text-ink">
                      {s.mainText || s.description}
                    </span>
                    {s.secondaryText || s.description ? (
                      <span className="text-[11.5px] text-muted">
                        {s.secondaryText || s.description}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="px-2 pb-1 text-[11px] font-extrabold uppercase tracking-wide text-muted">
              Saved addresses
            </div>
            {filteredSaved.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-muted">
                {addresses.length === 0
                  ? "No saved addresses yet. Use current location or add one."
                  : "No saved address matches that search."}
              </div>
            ) : (
              filteredSaved.map((a) => {
                const selected = a.id === selectedAddr;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      void selectAddr(a.id).then(() => setLocOpen(false));
                    }}
                    className={cn(
                      "mb-2 flex w-full items-start gap-2.5 rounded-xl border-[1.5px] px-[13px] py-[11px] text-left last:mb-0",
                      selected ? "border-accent bg-accent-tint" : "border-line bg-white",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-[1.5px] border-accent text-[11px] font-extrabold",
                        selected ? "bg-accent text-white" : "bg-white text-accent-dark",
                      )}
                    >
                      {selected ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-[7px]">
                        <b
                          className={cn(
                            "text-[13px]",
                            selected ? "text-accent-dark" : "text-ink",
                          )}
                        >
                          {a.type}
                        </b>
                        {a.def ? (
                          <span className="rounded-[20px] border border-[#dbe6cb] bg-white px-[7px] py-px text-[10px] font-extrabold text-accent-dark">
                            DEFAULT
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-xs leading-[1.5] text-muted">
                        {[a.line, a.area].filter(Boolean).join(", ")}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>

          <div className="border-t border-line px-4 py-3">
            <button
              type="button"
              onClick={() => {
                setLocOpen(false);
                openModal({ type: "address" });
              }}
              className="h-11 w-full rounded-xl bg-accent text-[13.5px] font-extrabold text-white"
            >
              + Add a new address
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
