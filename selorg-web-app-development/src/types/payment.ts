export type PaymentMethod = "upi" | "card" | "netbanking" | "cod";
export type DeliverySlotId = "now";

export interface DeliverySlotOption {
  id: DeliverySlotId;
  title: string;
  sub: string;
}

export interface ReceiverInfo {
  name: string;
  phone: string;
  note: string;
}

export interface PayFormState {
  vpa: string;
  upiApp: string;
  cardNo: string;
  exp: string;
  cvv: string;
  cardName: string;
  bank: string;
  otp: string;
}

export type PayStep = "details" | "processing" | "failed";
