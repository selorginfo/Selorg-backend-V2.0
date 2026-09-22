export interface ToastState {
  id: number;
  message: string;
}

export type ModalKind =
  | {
      type: "address";
      addressId?: string;
      /** Prefill when opening add-address from detect/search. */
      draft?: Partial<import("./address").AddressFormValues>;
    }
  | { type: "logout" }
  | { type: "deleteAddress"; addressId: string }
  | { type: "phoneOtp" }
  | { type: "walletTopup" }
  | { type: "cancelOrder"; orderId: string }
  | null;
