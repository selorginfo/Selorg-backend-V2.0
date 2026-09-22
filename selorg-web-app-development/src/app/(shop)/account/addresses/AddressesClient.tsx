"use client";

import { MapPinOff, Plus } from "lucide-react";
import { useAddresses } from "@/context/AddressContext";
import { useUI } from "@/context/UIContext";
import { AddressCard } from "@/components/checkout/AddressCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Button } from "@/components/ui/Button";

export function AddressesClient() {
  const { addresses, setDefaultAddress } = useAddresses();
  const { openModal } = useUI();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-extrabold">Saved addresses</h2>
        <Button size="sm" onClick={() => openModal({ type: "address" })}>
          <Plus size={14} /> Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <EmptyState
          icon={MapPinOff}
          title="No saved addresses"
          subtitle="Add an address to speed up checkout."
        />
      ) : (
        <div className={`grid grid-cols-1 gap-3 ${addresses.length > 1 ? "sm:grid-cols-2" : ""}`}>
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              onEdit={() => openModal({ type: "address", addressId: a.id })}
              onDelete={() => openModal({ type: "deleteAddress", addressId: a.id })}
              onSetDefault={() => setDefaultAddress(a.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
