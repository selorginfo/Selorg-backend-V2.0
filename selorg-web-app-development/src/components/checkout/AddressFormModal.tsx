"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { useAddresses } from "@/context/AddressContext";
import { useUI } from "@/context/UIContext";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { AddressFormValues, AddressType } from "@/types";
import { isValidLatitude, isValidLongitude } from "@/services/locationService";
import { storeService } from "@/services/storeService";
import type { LocationMapSelection } from "./LocationMapPicker";

const LocationMapPicker = dynamic(
  () => import("./LocationMapPicker").then((m) => m.LocationMapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[220px] items-center justify-center rounded-xl border border-line bg-[#f7f7f2] text-sm text-muted sm:h-[260px]">
        Loading map…
      </div>
    ),
  },
);

const TYPES: AddressType[] = ["Home", "Work", "Other"];
const EMPTY: AddressFormValues = {
  type: "Home",
  line1: "",
  line2: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
};

function isValidCoordPair(lat: unknown, lng: unknown): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

export function AddressFormModal() {
  const { modal, closeModal, showToast } = useUI();
  const { addresses, addAddress, updateAddress } = useAddresses();
  const open = modal?.type === "address";
  const editingId = open ? modal.addressId : undefined;
  const draft = open ? modal.draft : undefined;
  const editing = editingId ? addresses.find((a) => a.id === editingId) : undefined;

  const [values, setValues] = useState<AddressFormValues>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const instanceKey = open
    ? `${editingId ?? "new"}:${draft?.latitude ?? ""}:${draft?.longitude ?? ""}:${draft?.line1 ?? ""}:${draft?.line2 ?? ""}`
    : null;

  if (open && instanceKey !== loadedFor) {
    setLoadedFor(instanceKey);
    setFormError(null);
    setValues(
      editing
        ? {
            type: editing.type,
            line1: editing.line1,
            line2: editing.line2,
            landmark: editing.landmark,
            city: editing.city,
            state: editing.state,
            pincode: editing.pincode,
            latitude: editing.latitude,
            longitude: editing.longitude,
          }
        : {
            ...EMPTY,
            ...draft,
            type: (draft?.type as AddressType) || "Home",
            line1: draft?.line1 || "",
            line2: draft?.line2 || "",
            landmark: draft?.landmark || "",
            city: draft?.city || "",
            state: draft?.state || "",
            pincode: draft?.pincode || "",
            latitude: draft?.latitude,
            longitude: draft?.longitude,
          },
    );
  }

  const setField = (field: keyof AddressFormValues, value: string) =>
    setValues((s) => ({ ...s, [field]: value }));

  const onMapChange = (selection: LocationMapSelection) => {
    setValues((s) => {
      const hasGeo = Boolean(
        selection.city || selection.state || selection.pincode || selection.line2 || selection.line1,
      );
      return {
        ...s,
        latitude: selection.latitude,
        longitude: selection.longitude,
        // Keep typed house/flat when geocoder has no street/premise for the pin.
        line1: selection.line1 || s.line1,
        ...(hasGeo
          ? {
              line2: selection.line2,
              city: selection.city || s.city,
              state: selection.state || s.state,
              pincode: selection.pincode || s.pincode,
            }
          : {}),
      };
    });
    setFormError(null);
  };

  const save = async () => {
    if (!values.line1.trim() || !values.line2.trim() || !values.city.trim()) {
      setFormError("Address line 1, area, and city are required.");
      return;
    }
    if (!isValidCoordPair(values.latitude, values.longitude)) {
      setFormError("Select a location on the map (or Use my current location) before saving.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const check = await storeService.assignStore(values.latitude!, values.longitude!);
      if (!check.serviceable) {
        setFormError(
          check.message ||
            "We don't deliver to this location yet. Pick an address inside our service area.",
        );
        return;
      }
      if (editingId) {
        await updateAddress(editingId, values);
      } else {
        await addAddress(values);
      }
      closeModal();
    } catch {
      showToast("Could not save address. Please try again.");
      setFormError("Save failed. Your location was not stored.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={closeModal}
      title={editingId ? "Edit address" : "Add new address"}
      className="max-w-[min(100%,28rem)] sm:max-w-xl"
    >
      <div className="flex max-h-[min(80dvh,720px)] flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain pr-0.5 sm:gap-3.5">
          <LocationMapPicker
            latitude={values.latitude}
            longitude={values.longitude}
            onChange={onMapChange}
          />

          <div className="flex gap-2">
            {TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setField("type", t)}
                className={cn(
                  "min-w-0 flex-1 rounded-[10px] border-[1.5px] px-1 py-2 text-xs font-bold sm:text-sm",
                  values.type === t ? "border-accent bg-accent-tint text-accent-dark" : "border-line",
                )}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            label="Address line 1"
            value={values.line1}
            onChange={(e) => setField("line1", e.target.value)}
            placeholder="House no., street"
          />
          <Input
            label="Area"
            value={values.line2}
            onChange={(e) => setField("line2", e.target.value)}
            placeholder="e.g. Adyar"
          />
          <Input
            label="Landmark (optional)"
            value={values.landmark}
            onChange={(e) => setField("landmark", e.target.value)}
            placeholder="Near park, opposite temple…"
          />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input label="City" value={values.city} onChange={(e) => setField("city", e.target.value)} />
            <Input label="State" value={values.state} onChange={(e) => setField("state", e.target.value)} />
          </div>
          <Input
            label="PIN code"
            value={values.pincode}
            onChange={(e) => setField("pincode", e.target.value)}
          />

          {isValidCoordPair(values.latitude, values.longitude) ? (
            <p className="break-all font-mono text-[10px] text-muted sm:text-[11px]">
              Lat {values.latitude!.toFixed(6)} · Lng {values.longitude!.toFixed(6)}
            </p>
          ) : null}

          {formError ? <p className="text-[12.5px] font-semibold text-warn">{formError}</p> : null}
        </div>

        <div className="shrink-0 border-t border-line pt-3 sm:pt-3.5">
          <Button
            onClick={() => void save()}
            disabled={saving}
            className="w-full max-w-full"
          >
            {saving ? "Saving…" : editingId ? "Save address" : "Select & save address"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
