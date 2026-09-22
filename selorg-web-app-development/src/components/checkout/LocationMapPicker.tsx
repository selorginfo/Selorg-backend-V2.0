"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Loader2, MapPin } from "lucide-react";
import {
  detectAndResolveLocation,
  GeolocationError,
  reverseGeocode,
  type ResolvedLocation,
} from "@/services/locationService";
import { cn } from "@/lib/cn";
import "leaflet/dist/leaflet.css";

// Default Leaflet marker assets break under bundlers — use CDN icons explicitly.
const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function isMapAlive(map: L.Map | null | undefined): map is L.Map {
  if (!map) return false;
  try {
    const el = map.getContainer();
    return Boolean(el && el.isConnected && (map as unknown as { _loaded?: boolean })._loaded !== false);
  } catch {
    return false;
  }
}

/** Safe recenter — never animate (Esc/close mid-animation causes `_leaflet_pos` crashes). */
function MapRecenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    if (!isMapAlive(map)) return;
    try {
      map.stop();
      const current = map.getCenter();
      const same =
        Math.abs(current.lat - center[0]) < 1e-7 &&
        Math.abs(current.lng - center[1]) < 1e-7 &&
        map.getZoom() === zoom;
      if (same) return;
      map.setView(center, zoom, { animate: false });
    } catch {
      /* map may already be tearing down */
    }
    return () => {
      try {
        if (isMapAlive(map)) map.stop();
      } catch {
        /* ignore */
      }
    };
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Stops in-flight pan/zoom when the map unmounts (modal close / Esc). */
function MapUnloadGuard() {
  const map = useMap();
  useEffect(() => {
    return () => {
      try {
        map.stop();
      } catch {
        /* already removed */
      }
    };
  }, [map]);
  return null;
}

export interface LocationMapSelection {
  latitude: number;
  longitude: number;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
  formattedAddress: string;
}

interface LocationMapPickerProps {
  latitude?: number;
  longitude?: number;
  onChange: (selection: LocationMapSelection) => void;
  className?: string;
}

const INDIA_OVERVIEW: [number, number] = [20.5937, 78.9629];
const DEFAULT_ZOOM = 5;
const PIN_ZOOM = 16;

function toSelection(
  lat: number,
  lng: number,
  resolved: ResolvedLocation | null,
): LocationMapSelection {
  return {
    latitude: lat,
    longitude: lng,
    line1: resolved?.line1 || "",
    line2: resolved?.line2 || "",
    city: resolved?.city || "",
    state: resolved?.state || "",
    pincode: resolved?.pincode || "",
    formattedAddress:
      resolved?.formattedAddress ||
      `${lat.toFixed(6)}, ${lng.toFixed(6)}`,
  };
}

export function LocationMapPicker({
  latitude,
  longitude,
  onChange,
  className,
}: LocationMapPickerProps) {
  const hasPin =
    latitude != null && longitude != null && !Number.isNaN(latitude) && !Number.isNaN(longitude);
  const initialCenter = useMemo<[number, number]>(
    () => (hasPin ? [latitude!, longitude!] : INDIA_OVERVIEW),
    // Mount-only initial view — later moves go through MapRecenter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const initialZoom = useMemo(() => (hasPin ? PIN_ZOOM : DEFAULT_ZOOM), []);

  const [center, setCenter] = useState<[number, number]>(initialCenter);
  const [zoom, setZoom] = useState(initialZoom);
  const [pin, setPin] = useState<[number, number] | null>(hasPin ? [latitude!, longitude!] : null);
  const [addressLabel, setAddressLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const mapInstanceKey = useRef(`map-${Date.now()}`).current;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Sync external pin (edit existing address) without render-phase setState.
  useEffect(() => {
    if (!hasPin || latitude == null || longitude == null) return;
    setPin((prev) => {
      if (prev && Math.abs(prev[0] - latitude) < 1e-7 && Math.abs(prev[1] - longitude) < 1e-7) {
        return prev;
      }
      return [latitude, longitude];
    });
    setCenter((prev) => {
      if (Math.abs(prev[0] - latitude) < 1e-7 && Math.abs(prev[1] - longitude) < 1e-7) {
        return prev;
      }
      return [latitude, longitude];
    });
    setZoom((z) => (z === PIN_ZOOM ? z : PIN_ZOOM));
  }, [hasPin, latitude, longitude]);

  const applyCoords = useCallback(
    async (lat: number, lng: number) => {
      if (!mountedRef.current) return;
      setBusy(true);
      setError(null);
      setPin([lat, lng]);
      setCenter([lat, lng]);
      setZoom(PIN_ZOOM);
      try {
        const resolved = await reverseGeocode(lat, lng);
        if (!mountedRef.current) return;
        const selection = toSelection(lat, lng, resolved);
        setAddressLabel(selection.formattedAddress);
        onChange(selection);
        if (!resolved) {
          setError("Coordinates set, but address lookup failed. You can still fill the form manually.");
        }
      } catch {
        if (!mountedRef.current) return;
        const selection = toSelection(lat, lng, null);
        setAddressLabel(selection.formattedAddress);
        onChange(selection);
        setError("Could not reverse-geocode this point. Fill address fields manually.");
      } finally {
        if (mountedRef.current) setBusy(false);
      }
    },
    [onChange],
  );

  const detectCurrentLocation = async () => {
    if (!mountedRef.current) return;
    setBusy(true);
    setError(null);
    try {
      const { coords, resolved } = await detectAndResolveLocation();
      if (!mountedRef.current) return;
      setPin([coords.latitude, coords.longitude]);
      setCenter([coords.latitude, coords.longitude]);
      setZoom(PIN_ZOOM);
      const selection = toSelection(coords.latitude, coords.longitude, resolved);
      setAddressLabel(selection.formattedAddress);
      onChange(selection);
      if (!resolved) {
        setError("Location found, but address lookup failed. Fill fields manually.");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      const message =
        err instanceof GeolocationError
          ? err.message
          : "Could not detect your location";
      setError(message);
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const markerEventHandlers = useMemo(
    () => ({
      dragend(e: L.DragEndEvent) {
        try {
          const marker = e.target as L.Marker;
          const { lat, lng } = marker.getLatLng();
          void applyCoords(lat, lng);
        } catch {
          /* marker/map already gone */
        }
      },
    }),
    [applyCoords],
  );

  return (
    <div className={cn("flex flex-col gap-2.5", className)}>
      <div className="relative z-0 h-[220px] w-full overflow-hidden rounded-xl border border-line sm:h-[260px]">
        <MapContainer
          key={mapInstanceKey}
          center={initialCenter}
          zoom={initialZoom}
          scrollWheelZoom
          className="h-full w-full"
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapUnloadGuard />
          <MapRecenter center={center} zoom={zoom} />
          <MapClickHandler onPick={(lat, lng) => void applyCoords(lat, lng)} />
          {pin ? (
            <Marker
              position={pin}
              icon={markerIcon}
              draggable
              eventHandlers={markerEventHandlers}
            />
          ) : null}
        </MapContainer>
        {busy ? (
          <div className="absolute inset-0 z-[500] flex items-center justify-center bg-white/55 text-sm font-bold text-muted">
            <Loader2 size={18} className="mr-2 animate-spin" /> Updating location…
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => void detectCurrentLocation()}
        disabled={busy}
        className="flex items-center justify-center gap-2 rounded-xl border-[1.5px] border-accent bg-accent-tint px-3 py-2.5 text-[13px] font-bold text-accent-dark disabled:opacity-60"
      >
        {busy ? <Loader2 size={15} className="animate-spin" /> : <MapPin size={15} />}
        Use my current location
      </button>

      <div className="rounded-xl bg-black/[0.03] px-3 py-2.5 text-[12px] leading-relaxed">
        <div className="font-semibold text-muted">Selected location</div>
        <div className="mt-0.5 font-bold text-ink">
          {addressLabel || (pin ? "Coordinates set — reverse geocoding…" : "Tap the map or use current location")}
        </div>
        {pin ? (
          <div className="mt-1 font-mono text-[11px] text-muted">
            Lat {pin[0].toFixed(6)} · Lng {pin[1].toFixed(6)}
          </div>
        ) : null}
      </div>

      {error ? <p className="text-[12.5px] font-semibold text-warn">{error}</p> : null}
    </div>
  );
}
