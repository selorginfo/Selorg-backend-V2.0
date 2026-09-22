"use client";

import { useAddresses } from "@/context/AddressContext";
import { useUI } from "@/context/UIContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function DeleteAddressModal() {
  const { modal, closeModal } = useUI();
  const { deleteAddress } = useAddresses();
  const open = modal?.type === "deleteAddress";

  if (!open) return null;

  return (
    <Modal open={open} onClose={closeModal} title="Remove this address?">
      <p className="mb-5 text-sm text-muted">
        This address will be permanently removed from your saved addresses.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={closeModal} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            deleteAddress(modal.addressId);
            closeModal();
          }}
          className="flex-1"
        >
          Remove
        </Button>
      </div>
    </Modal>
  );
}
