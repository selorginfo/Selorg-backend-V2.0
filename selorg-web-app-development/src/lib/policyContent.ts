/**
 * Customer-facing policy bodies for sections not yet served by `/legal/*`.
 * Terms & Privacy are loaded from the API; these cover the rest of Selorg’s
 * quick-commerce policies (refund, delivery, wallet, etc.).
 */

export type PolicySectionId =
  | "terms"
  | "privacy"
  | "refund"
  | "cancellation"
  | "delivery"
  | "payments"
  | "wallet"
  | "quality"
  | "account"
  | "grievance";

export interface PolicySectionMeta {
  id: PolicySectionId;
  label: string;
  short: string;
  /** When true, body is fetched from `/legal/terms` or `/legal/privacy`. */
  fromApi?: "terms" | "privacy";
}

export const POLICY_SECTIONS: PolicySectionMeta[] = [
  { id: "terms", label: "Terms of Service", short: "Using Selorg", fromApi: "terms" },
  { id: "privacy", label: "Privacy Policy", short: "Your data", fromApi: "privacy" },
  { id: "refund", label: "Refund Policy", short: "Money back" },
  { id: "cancellation", label: "Cancellation Policy", short: "Stop an order" },
  { id: "delivery", label: "Delivery Policy", short: "How we deliver" },
  { id: "payments", label: "Payments Policy", short: "Cards, UPI & COD" },
  { id: "wallet", label: "Wallet Policy", short: "Selorg Wallet" },
  { id: "quality", label: "Quality & Returns", short: "Freshness promise" },
  { id: "account", label: "Account Policy", short: "Your profile" },
  { id: "grievance", label: "Grievance Redressal", short: "Escalate issues" },
];

export const STATIC_POLICY_CONTENT: Record<
  Exclude<PolicySectionId, "terms" | "privacy">,
  { title: string; updated: string; body: string }
> = {
  refund: {
    title: "Refund Policy",
    updated: "Effective for all Selorg customer orders on the web and app",
    body: `Selorg aims to resolve every refund fairly and quickly. This policy applies to grocery and related purchases placed through Selorg’s customer platforms in India.

1. When you are eligible for a refund
• Order cancelled within the free-cancellation window before packing starts.
• Items missing, damaged, spoiled, or not matching the description at delivery — reported promptly with photos where requested.
• Duplicate payment or failed payment where money was debited but the order was not confirmed.
• Wallet top-up where payment succeeded at the bank but Selorg did not credit the wallet (after verification).
• Promotional or pricing errors corrected in your favour at Selorg’s discretion.

2. When refunds may be declined or adjusted
• Products accepted after quality check at delivery without a reported issue.
• Perishable goods consumed or altered after successful delivery, except quality complaints raised within the stated window.
• Abuse of cancellation/refund limits, coupon misuse, or fraudulent activity.
• Force majeure events beyond Selorg’s reasonable control (subject to applicable law).

3. Refund timelines
• Wallet refunds: usually instant to a few minutes after approval.
• Original payment method (UPI / card / netbanking): typically 3–5 business days after approval; your bank may take longer to reflect the credit.
• COD orders: refunds are issued to Selorg Wallet or another method confirmed by support.

4. How to request a refund
Open the order in My Orders → raise a refund/issue, or contact Help & Support (call, chat, or email) with your order ID and details. We may ask for photos or a short description to verify quality claims.

5. Partial refunds
If only some items are affected, we refund the item value (and proportional delivery/handling charges where applicable) rather than the full order.

6. Contact
For refund status, use Help & Support or email support@selorg.com with your order number.`,
  },

  cancellation: {
    title: "Cancellation Policy",
    updated: "Aligned with Selorg’s live fulfilment and packing workflow",
    body: `You may cancel an order while it is still eligible under Selorg’s cancellation rules.

1. Free cancellation
Orders can usually be cancelled free of charge while status is Pending / Confirmed / Getting packed — subject to the free window configured for your area (often a short window after placing the order). Once picking or dispatch has progressed beyond the allowed statuses, in-app cancel may be disabled.

2. How to cancel
My Orders → select the order → Cancel order, or contact Help & Support if the button is unavailable. Provide a reason when prompted so we can improve service.

3. After cancellation
• Unpaid / unpaid gateway attempts: no charge.
• Paid online or wallet: refund follows the Refund Policy (wallet or original method).
• Inventory is released and cart items may be restored where applicable.

4. Selorg-initiated cancellations
We may cancel for stock unavailability, address/serviceability issues, payment failure, safety, or suspected fraud. You will be notified and refunded as applicable.

5. Limits
Repeated cancellations may trigger fair-use limits (per day/week) to protect riders and inventory. Support can assist genuine cases.`,
  },

  delivery: {
    title: "Delivery & Shipping Policy",
    updated: "Quick-commerce delivery within Selorg serviceable zones",
    body: `Selorg delivers farm-fresh and organic groceries within configured service areas.

1. Serviceability
Delivery is available only to addresses inside our live zones and dark-store catchments. Enter your location on the home screen to confirm. We do not offer nationwide courier shipping for standard grocery orders.

2. Delivery promise
Estimated delivery times shown in the app/web are targets based on distance, store load, and rider availability. Actual time may vary due to traffic, weather, high demand, or order complexity.

3. Delivery fee & free delivery
Delivery and handling charges (if any) are shown at checkout before you pay. Free-delivery thresholds, when offered, apply to eligible cart values as configured for your session.

4. Receiver & access
Please ensure someone can receive the order at the pin location. Share gate/flat instructions and an alternate phone if needed. Failed delivery attempts due to inaccessible addresses may lead to return-to-store and refund rules as applicable.

5. Contactless & safety
Riders follow local safety guidelines. You can add delivery notes at checkout. Tip the rider only through supported in-app options where available.

6. Delays & issues
Track live status under My Orders. For significant delays, missing items, or wrong address issues, contact Help & Support immediately with your order ID.

7. Out of stock substitutions
We do not silently substitute items unless you opt into a substitution preference where offered. Unavailable items are typically refunded or removed with notification.`,
  },

  payments: {
    title: "Payments Policy",
    updated: "Covers UPI, cards, netbanking, COD, and wallet spend",
    body: `1. Accepted methods
Selorg may offer UPI, cards, netbanking, Cash on Delivery (COD), and Selorg Wallet, subject to availability and risk checks for your account and order.

2. Authorisation & confirmation
Online payments are processed by licensed payment partners (e.g. Worldline/Paynimo). An order is confirmed for fulfilment only after successful payment verification (or COD acceptance). Do not assume success from a bank SMS alone — always check order status in the app/web.

3. Failed or cancelled payments
If you cancel or close the payment screen, no order is placed and no amount should be charged. If your bank still debits you, raise a support ticket with the transaction reference; we will verify and refund if no corresponding paid order exists.

4. COD
COD may be limited by order value, location, or account history. Please keep exact change where possible. Refused COD deliveries may affect future COD eligibility.

5. Invoices & GST
Order invoices/receipts are available from order details where generated. Pricing includes applicable taxes as shown at checkout unless stated otherwise.

6. Security
Never share OTPs, card CVVs, or UPI PINs with anyone claiming to be Selorg. Our team will never ask for your full card number over chat or call.`,
  },

  wallet: {
    title: "Selorg Wallet Policy",
    updated: "Add money, spend at checkout, and top-up protections",
    body: `1. What Wallet is
Selorg Wallet is a prepaid balance linked to your customer account for paying (fully or partly) for eligible orders on Selorg.

2. Adding money
Top-ups use the same secure payment gateway as orders. Money is credited only after Selorg verifies payment success. A cancelled or failed gateway attempt does not credit the wallet. Success, failure, cancel, and pending states are shown on dedicated Wallet screens — not order result pages.

3. Using Wallet
Enable “Use wallet at checkout” (or apply wallet on the checkout page) when balance is available. Wallet spend is deducted when the order is successfully placed/paid as per checkout rules.

4. Refunds to Wallet
Certain refunds (including some COD and promotional adjustments) may be credited to Wallet for faster reuse. Wallet credits from refunds follow the Refund Policy timelines.

5. Non-transferable
Wallet balance is non-transferable between accounts, has no cash withdrawal by default, and may expire only if required by law or clearly communicated promotions.

6. Disputes
For top-ups where the bank charged you but Wallet was not credited, contact Help & Support with your payment reference. Duplicate callbacks are handled idempotently so you are not double-credited.`,
  },

  quality: {
    title: "Quality & Returns Policy",
    updated: "Freshness and organic standards for Selorg products",
    body: `1. Our promise
We source organic and quality-checked groceries. Temperature-sensitive items are handled through our dark-store and delivery workflow to protect freshness.

2. On-delivery check
Please inspect perishables and sealed packs at delivery. Report quality issues as soon as possible (ideally at delivery or immediately after) via order support with clear photos.

3. Returns
Because groceries are perishable, physical returns are limited. Eligible issues are typically resolved via refund, replacement (when stock and logistics allow), or store credit/wallet — not open-ended returns like fashion e-commerce.

4. Non-returnable
Opened personal-care hygiene products, heavily soiled packaging due to customer handling, and items reported long after delivery without evidence may not qualify.

5. Weight & natural variance
Fresh produce may have natural variance in size/colour. Billable weight follows the product listing and weighing practices disclosed on the product page.`,
  },

  account: {
    title: "Account & Acceptable Use Policy",
    updated: "Rules for using your Selorg customer account",
    body: `1. Account responsibility
Keep your phone number and login OTP secure. You are responsible for activity under your account. Update your profile and addresses accurately.

2. One person, fair use
Accounts are for personal/household shopping unless a business programme is expressly offered. Creating multiple accounts to abuse coupons, referral, or free delivery may lead to suspension.

3. Prohibited conduct
Harassment of support or riders, fraudulent payments, resale of restricted offers, scraping, or attempting to breach Selorg systems is prohibited and may be reported to authorities.

4. Communication preferences
Manage SMS, WhatsApp, email, and push preferences under Account → Notifications / Preferences. Transactional messages related to orders and security may still be sent as required.

5. Deletion
You may request account closure via Help & Support. We retain records required for legal, tax, fraud-prevention, and dispute purposes as permitted by law.`,
  },

  grievance: {
    title: "Grievance Redressal",
    updated: "How to escalate unresolved issues",
    body: `1. First level — Help & Support
Use in-app/web chat tickets, phone helpline, or email. Include order ID, payment reference, and a clear description. Most issues are resolved at this level.

2. Response expectations
We aim to acknowledge tickets quickly during working hours and resolve within the published response window where possible. Complex payment reconciliations may take longer while we check with the payment partner/bank.

3. Escalation
If your issue remains unresolved after the first response cycle, reply on the same ticket with “ESCALATE” in the subject/message, or email support@selorg.com with Escalation and your ticket number.

4. Consumer rights
Nothing in these policies limits your statutory rights under applicable Indian consumer protection law. For payment-related disputes you may also approach your bank/UPI app as per their dispute process.

5. Contact channels
Phone, chat, and email details are listed on the Help & Support page and may be updated via Selorg’s live app configuration.`,
  },
};
