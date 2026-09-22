import { AddressFormModal } from "@/components/checkout/AddressFormModal";
import { DeleteAddressModal } from "@/components/checkout/DeleteAddressModal";
import { LogoutModal } from "@/components/account/LogoutModal";
import { PhoneOtpModal } from "@/components/account/PhoneOtpModal";
import { WalletTopupModal } from "@/components/account/WalletTopupModal";
import { CancelOrderModal } from "@/components/orders/CancelOrderModal";

/** Mounts every modal once; each reads UIContext's `modal` union to decide whether it's open. */
export function ModalHost() {
  return (
    <>
      <AddressFormModal />
      <DeleteAddressModal />
      <LogoutModal />
      <PhoneOtpModal />
      <WalletTopupModal />
      <CancelOrderModal />
    </>
  );
}
