"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useUI } from "@/context/UIContext";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export function LogoutModal() {
  const { modal, closeModal } = useUI();
  const { logout } = useAuth();
  const router = useRouter();
  const open = modal?.type === "logout";

  return (
    <Modal open={open} onClose={closeModal} title="Log out of Selorg?">
      <p className="mb-5 text-sm text-muted">
        You can always log back in to access your orders, wallet, and saved addresses.
      </p>
      <div className="flex gap-3">
        <Button variant="outline" onClick={closeModal} className="flex-1">
          Cancel
        </Button>
        <Button
          variant="danger"
          onClick={() => {
            logout();
            router.push("/");
          }}
          className="flex-1 border-warn bg-warn text-white hover:bg-warn/90"
        >
          Log out
        </Button>
      </div>
    </Modal>
  );
}
