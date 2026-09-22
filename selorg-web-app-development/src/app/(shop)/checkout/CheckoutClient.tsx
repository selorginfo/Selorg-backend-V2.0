"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, CreditCard, Lock, MapPin, Plus, User, Wallet, Zap } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useAddresses } from "@/context/AddressContext";
import { useCart } from "@/context/CartContext";
import { useCartTotals } from "@/hooks/useCartTotals";
import { useWallet } from "@/context/WalletContext";
import { useCheckout } from "@/context/CheckoutContext";
import { useOrders } from "@/context/OrdersContext";
import { getToken } from "@/services/session";
import { AddressCard } from "@/components/checkout/AddressCard";
import { SlotPicker } from "@/components/checkout/SlotPicker";
import { PaymentMethodPicker } from "@/components/checkout/PaymentMethodPicker";
import { ReceiverForm } from "@/components/checkout/ReceiverForm";
import { BillSummary } from "@/components/cart/BillSummary";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { formatMoney } from "@/lib/money";
import { productDisplayName } from "@/lib/products";
import { useUI } from "@/context/UIContext";
import { useEffect, useState } from "react";

export function CheckoutClient() {
  const loggedIn = useRequireAuth();
  const router = useRouter();
  const { openModal, showToast } = useUI();
  const [placingOrder, setPlacingOrder] = useState(false);
  /** Blocks the empty-cart → /cart redirect while we leave for success/payment. */
  const [leavingCheckout, setLeavingCheckout] = useState(false);
  const { addresses, selectedAddr, selectAddr } = useAddresses();
  const { lines, clearCart } = useCart();
  const totals = useCartTotals();
  const { wallet, toggleWalletCheckout } = useWallet();
  const { slot, setSlot, paymentMethod, setPaymentMethod, receiver, setReceiverField, resetPayStep } =
    useCheckout();
  const { placeOrder } = useOrders();

  // Empty cart normally means "go back to cart" — but COD/wallet placeOrder
  // used to clear the cart *before* navigation. Without this lock, the effect
  // raced router.replace("/cart") against the confirmation navigate (SUCCESS → CART).
  useEffect(() => {
    if (leavingCheckout || placingOrder) return;
    if (loggedIn && lines.length === 0) {
      router.replace("/cart");
    }
  }, [loggedIn, lines.length, placingOrder, leavingCheckout, router]);

  if (!loggedIn || (lines.length === 0 && !leavingCheckout && !placingOrder)) {
    return null;
  }

  const startPayment = async () => {
    resetPayStep();
    if (!selectedAddr) {
      showToast("Please select a delivery address before placing your order.");
      return;
    }
    // COD and zero-due carts (full wallet / full coupon) skip the gateway UI.
    // Place the order here so failures surface as toasts instead of the old
    // /checkout/payment?direct=1 path (blank page + silent redirect on error).
    if (paymentMethod === "cod" || totals.grand === 0) {
      setPlacingOrder(true);
      setLeavingCheckout(true);
      try {
        // Navigate with a confirmed order id, then clear cart — clearing
        // before navigation was racing the empty-cart guard into /cart.
        const id = await placeOrder({ clearCartOnSuccess: false });
        router.replace(`/checkout/confirmation?orderId=${encodeURIComponent(id)}`);
        clearCart();
      } catch (err) {
        setLeavingCheckout(false);
        showToast(err instanceof Error ? err.message : "Could not place your order. Please try again.");
      } finally {
        setPlacingOrder(false);
      }
      return;
    }
    if (!getToken()) {
      showToast("Please sign in to place your order.");
      router.push(`/auth?redirect=${encodeURIComponent("/checkout")}`);
      return;
    }
    // The real gateway needs an existing order to create a payment session
    // for — place it now (pending/unpaid) without clearing the cart, since
    // the backend itself only clears the cart once payment is confirmed.
    setPlacingOrder(true);
    setLeavingCheckout(true);
    try {
      const id = await placeOrder({ clearCartOnSuccess: false });
      router.replace(`/checkout/payment?orderId=${encodeURIComponent(id)}`);
    } catch (err) {
      setLeavingCheckout(false);
      showToast(err instanceof Error ? err.message : "Could not place your order. Please try again.");
    } finally {
      setPlacingOrder(false);
    }
  };

  return (
    <div className="wrap pb-9 pt-[18px]">
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          aria-label="Go back"
          className="flex h-[38px] w-[38px] items-center justify-center rounded-[11px] border border-line bg-white"
        >
          <ArrowLeft size={16} />
        </button>
        <h1 className="font-sans text-[28px] font-extrabold tracking-[-0.7px]">Checkout</h1>
      </div>

      <div className="grid grid-cols-1 gap-[28px] min-[1041px]:grid-cols-[minmax(0,1fr)_372px]">
        <div className="flex flex-col gap-4">
          <section className="rounded-app border border-line bg-white p-5">
            <div className="mb-3.5 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-base font-extrabold">
                <MapPin size={18} className="text-accent-dark" /> Delivery address
              </h2>
              <button
                onClick={() => openModal({ type: "address" })}
                className="flex items-center gap-1 text-[13px] font-bold text-accent-dark"
              >
                <Plus size={14} /> Add new
              </button>
            </div>
            <div className="flex flex-col gap-2.5">
              {addresses.map((a) => (
                <AddressCard
                  key={a.id}
                  address={a}
                  selected={a.id === selectedAddr}
                  onSelect={() => void selectAddr(a.id)}
                  onEdit={() => openModal({ type: "address", addressId: a.id })}
                  onDelete={() => openModal({ type: "deleteAddress", addressId: a.id })}
                />
              ))}
            </div>
          </section>

          <section className="rounded-app border border-line bg-white p-5">
            <div className="mb-1 flex items-center gap-2">
              <User size={18} className="text-accent-dark" />
              <h2 className="text-base font-extrabold">Receiver details</h2>
              <span className="rounded-full border border-line bg-black/[0.03] px-2.5 py-0.5 text-[11px] font-bold text-muted">
                Optional
              </span>
            </div>
            <p className="mb-3.5 text-xs text-muted">
              Ordering for someone else? Add their details and we&apos;ll contact them instead.
            </p>
            <ReceiverForm receiver={receiver} setField={setReceiverField} />
          </section>

          <section className="rounded-app border border-line bg-white p-5">
            <h2 className="mb-3.5 flex items-center gap-2 text-base font-extrabold">
              <Zap size={18} className="text-accent-dark" /> Delivery slot
            </h2>
            <SlotPicker selected={slot} onSelect={setSlot} />
          </section>

          <section className="rounded-app border border-line bg-white p-5">
            <h2 className="mb-3.5 flex items-center gap-2 text-base font-extrabold">
              <CreditCard size={18} className="text-accent-dark" /> Payment method
            </h2>
            <PaymentMethodPicker selected={paymentMethod} onSelect={setPaymentMethod} />
          </section>
        </div>

        <div className="flex flex-col gap-4 min-[1041px]:sticky min-[1041px]:top-4 min-[1041px]:self-start">
          <BillSummary
            variant="checkout"
            totals={totals}
            title={null}
            header={
              <>
                <div className="mb-3.5 flex items-baseline justify-between">
                  <span className="text-base font-extrabold">Order summary</span>
                  <span className="text-[12.5px] font-bold text-muted">{totals.count} items</span>
                </div>
                <div className="mb-3.5 flex max-h-[230px] flex-col gap-2.5 overflow-y-auto">
                  {lines.map((l) => (
                    <div key={l.product.id} className="flex items-center gap-2.5">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[10px] bg-[#f6f6f0]">
                        <Image
                          src={l.product.photo}
                          alt={productDisplayName(l.product.name)}
                          fill
                          sizes="44px"
                          className="object-cover"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-bold leading-tight">
                          {productDisplayName(l.product.name)}
                        </div>
                        <div className="text-[11px] text-muted">
                          {l.variant.label} &middot; Qty {l.qty}
                        </div>
                      </div>
                      <span className="text-[13px] font-extrabold">{formatMoney(l.lineTotal)}</span>
                    </div>
                  ))}
                </div>
                <div className="mb-3.5 border-t border-line" />
              </>
            }
            showWalletToggle={
              wallet.balance > 0 ? (
                <div className="flex items-center justify-between gap-3 rounded-[11px] border border-[#dbe6cb] bg-accent-tint px-[13px] py-[11px]">
                  <span className="flex min-w-0 items-center gap-[9px]">
                    <Wallet size={17} className="shrink-0 text-accent-dark" />
                    <span>
                      <span className="block text-[12.5px] font-extrabold text-accent-dark">Pay with wallet</span>
                      <span className="block text-[11.5px] text-muted">Balance {formatMoney(wallet.balance)}</span>
                    </span>
                  </span>
                  <Switch checked={wallet.useAtCheckout} onChange={toggleWalletCheckout} />
                </div>
              ) : undefined
            }
            cta={
              <>
                <Button
                  type="button"
                  size="lg"
                  className="mt-4 w-full"
                  disabled={!selectedAddr || placingOrder}
                  onClick={() => void startPayment()}
                >
                  {placingOrder
                    ? "Placing order…"
                    : `${paymentMethod === "cod" ? "Place order" : "Proceed to pay"} · ${formatMoney(totals.grand)}`}
                </Button>
                {!selectedAddr ? (
                  <p className="mt-2 text-center text-[12.5px] font-semibold text-warn">
                    Select a delivery address to continue
                  </p>
                ) : null}
                <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11.5px] text-muted">
                  <Lock size={12} /> 100% secure payments
                </div>
              </>
            }
          />
        </div>
      </div>
    </div>
  );
}
