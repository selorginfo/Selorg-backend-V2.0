# CUSTOMER_INTERACTION_AUDIT.md — Interactions, navigation and states

Every interactive affordance in the HTML design, checked against the RN app.
`✔` present · `✖` missing · `~` present but wrong.

---

## 1. Navigation graph

### 1a. Broken navigation found

| Issue | Detail | Impact |
|---|---|---|
| **4 unregistered routes** | `LoginPassword`, `CreatePassword`, `Forgot`, `ResetPassword` are declared in `src/navigation/routes.ts` **and** `RootStackParamList`, and the screen files exist — but none is added to `RootNavigator`. | `LoginPassword.tsx:99` calls `navigation.navigate('Forgot')`. Any navigation into this cluster throws `The action 'NAVIGATE' … was not handled`. Latent crash. |
| **CategoryProducts has no back affordance** | The screen renders only a `SearchBar` above the sidebar + grid; the design has a 36 px circular back chip to the left of the search bar. | On Android the hardware back still works; on iOS there is no way back except the tab bar. |
| **Dead file** | `src/screens/auth/Welcome.tsx` re-exports `EnterMobile` and has zero references. | Dead code. |

### 1b. Navigation actions — design vs RN

| From | Action | Design target | RN | Status |
|---|---|---|---|---|
| Splash | auto | Onboarding / EnterMobile / Main | same (auth-aware) | ✔ |
| Onboarding | Skip / Get Started | Login | EnterMobile | ✔ |
| Onboarding | tap dot *n* | slide *n* | — | ✖ |
| Login | Log In / Create Account | OTP | Otp | ✔ |
| Login | flag / `+91` | country-code sheet | — | ✖ |
| Login | Skip · guest | Home | Main (reset) | ✔ |
| OTP | Change | back | goBack | ✔ |
| OTP | verify | ProfileSetup (signup) / Location | same | ✔ |
| AuthSuccess | CTA | Home | auto-timer, no CTA | ~ |
| Location | Enter address manually | new-address form | Main | ~ |
| Home | location bar | address list | Addresses | ✔ |
| Home | search / bell | Search / Notifications | same | ✔ |
| Home | active-order strip | Tracking | Tracking | ✔ |
| Home | hero CTA | Fruits category | first category | ✔ |
| Home | See all (category) | Categories tab | Categories tab | ✔ |
| Home | See all (section) | Collection | Collection | ✔ |
| Home | curated card | collection toast | toast | ✔ |
| Categories | See All (n) | Category | CategoryProducts | ✔ |
| Categories | sub-tile | Category filtered by sub | CategoryProducts + `sub` | ✔ |
| Category | back | previous | — | ✖ |
| Category | filter | filters sheet | combined sheet | ~ |
| Category | sort | sort sheet | same combined sheet | ~ |
| Category | sub rail | filter grid in place | ✔ | ✔ |
| Collection | filter / sort | 2 sheets | 1 sheet | ~ |
| Search | back / clear | previous / reset | ✔ | ✔ |
| Search | suggestion | run search | ✔ | ✔ |
| Search | empty query | browse-all grid | blank | ✖ |
| Product | back / wish / **share** | back / toggle / share toast | back / toggle / — | ~ |
| Product | tap image | zoom overlay | — | ✖ |
| Product | swipe gallery | next image | — | ✖ |
| Product | variant pill | reprice | — | ✖ |
| Product | rating row | reviews | Reviews | ✔ |
| Product | See all → | Reviews | Reviews | ✔ |
| Product | related card | that product | — | ✖ |
| Product | Add to cart / **Go to cart** | add / Cart tab | add only | ~ |
| Reviews | — | — | — | ✔ |
| Cart | stepper / remove | mutate cart | ✔ | ✔ |
| Cart | Apply coupon | validate | ✔ | ✔ |
| Cart | Proceed to Checkout | Checkout (auth-gated) | Checkout | ✔ |
| Checkout | address card | address list | Addresses | ✔ |
| Checkout | **gift toggle** | reveal receiver fields | — | ✖ |
| Checkout | **payment method** | select method | — | ✖ |
| Checkout | tip chip | set tip | ✔ | ✔ |
| Checkout | CTA | Payment / place order | Payment | ~ (static label) |
| Payment | method / Top up | select / Wallet | ✔ | ✔ |
| Payment | Pay | create order → gateway | ✔ | ✔ |
| Payment (failed) | Retry | retry | ✔ | ✔ |
| Payment (failed) | **Choose another method** | back to idle | — | ✖ |
| OrderPlaced | Track / Continue | Tracking / Home | ✔ | ✔ |
| Tracking | back / **help** | back / new ticket | back / — | ~ |
| Tracking | **chat / call rider** | ticket / dial | wide ghost buttons | ~ |
| Tracking | Cancel order | cancel flow | sheet | ✔ |
| Tracking | **Report an issue / return** | ReturnRequest | — | ✖ |
| Tracking | **star tap (delivered)** | Rate order | — | ✖ |
| Orders | **filter chip** | filter list | — | ✖ |
| Orders | card / Track / Reorder | detail / tracking / rebuild cart | ✔ | ✔ |
| OrderDetail | **⋮** | options sheet | — | ✖ |
| OrderDetail | invoice / help / cancel | ✔ | ✔ | ✔ |
| OrderDetail | **Reorder / Write a review** | rebuild cart / rate prompt | — | ✖ |
| Refunds → detail | ✔ | ✔ | ✔ | ✔ |
| Account | Edit chip / stat tiles / Terms row / Log out | 4 targets | — | ✖ |
| Account | rows | ✔ | ✔ | ✔ |
| Wallet | chips / Custom / Add ₹X / Refresh | ✔ | ✔ | ✔ |
| Notifications | tap / read-all / delete | ✔ | ✔ | ✔ |
| Support | Chat with us | new ticket | ✔ | ✔ |
| Support | **FAQ row** | new ticket | — | ✖ |
| Ticket | send / **Reopen** | ✔ | ✔ | ✔ |
| Settings | toggles / legal / delete / logout | ✔ | ✔ | ✔ |

**Missing navigation actions: 19. Broken navigation flows: 4 (unregistered routes) + 1 (no back on CategoryProducts).**

---

## 2. Micro-interactions and animations

| Interaction | Design | RN before | Action |
|---|---|---|---|
| Screen enter (`screenin`) | ✔ | native-stack default | Keep |
| Sheet rise (`rise .28s`) | ✔ | `Modal animationType="fade"` | Fix — slide-up |
| Onboarding autoplay 3.2 s | ✔ | ✖ | Add |
| Onboarding dot press | ✔ | ✖ | Add |
| Login pill slide (spring) | ✔ | ✔ (Animated.spring) | Keep |
| Method toggle slide | ✔ | ✔ | Keep |
| PDP header fade on scroll | ✔ | ✖ | Add |
| PDP gallery snap + dots | ✔ | ✖ | Add |
| PDP zoom | ✔ | ✖ | Add |
| PDP variant reprice (`numin`) | ✔ | ✖ | Add |
| PDP accordion max-height | ✔ | ✔ (single) | Extend to 4 |
| Qty `stepin` on 0→1 | ✔ | ✖ | Add |
| Qty `numin` on change | ✔ | ✖ | Add |
| Heart pop | ✔ | ✖ | Add |
| Button press scale `.97` | ✔ | opacity 0.85 | Acceptable |
| Cart-badge pop | ✔ | ✖ | Add |
| Home skeleton shimmer | ✔ | ✖ | Add |
| Wallet refresh spin | ✔ | `ActivityIndicator` | Acceptable |
| Toast slide-in | ✔ | ✔ | Keep |
| `prefers-reduced-motion` | ✔ | n/a on RN | — |

---

## 3. State coverage

`L` loading · `E` empty · `X` error · `S` success · `D` disabled · `SEL` selected

| Screen | Design | RN before | Missing |
|---|---|---|---|
| Home | L (skeleton) E X | — | **L, E, X** |
| Categories | L E X | L | **E, X** |
| CategoryProducts | L E X (+ no-match) | L, no-match | **E, X**, sidebar lost during L |
| Collection | L E | L E | — |
| Search | L E (+ default browse) | L E | **default browse** |
| ProductDetail | L X (OOS D) | L X (OOS D) | — |
| Reviews | E | E | — |
| Cart | E | E | — |
| Checkout | E, address-missing X | E, address-missing X | — |
| Payment | processing, failed, D | processing, failed, D | — |
| Orders | L E (+ per-filter E) | E | **L, per-filter E** |
| OrderDetail | X | X | — |
| Cancel | **blocked X** | — | **blocked X** |
| Tracking | E (no active) | E | — |
| Refunds | E | E | — |
| Wallet | E, refresh L | E, refresh L | — |
| Notifications | E | E | — |
| Support | E | E | — |
| Account | guest E | guest card | — |
| NoInternet | X | X | — |

**Missing states: 11.**

Selected/disabled states already correct: tip chips, payment radios, address cards, sub-category rail, filter chips, cancel/return reasons, star ratings, stepper OOS, primary-button disabled.

---

## 4. Auth gating

| Action | Design | RN |
|---|---|---|
| Bell / Notifications | `requireAuth` | ✔ redirect to login |
| Orders tab | `requireAuth` | ✔ via `goGated` |
| Cart → Checkout | `requireAuth` | ✔ |
| Location bar → address list | `requireAuth` | ✔ |
| Account rows while guest | login prompt | ✔ |
| Browse home / category / product / cart as guest | allowed | ✔ |

Matches the design.

---

## 5. Feedback and error handling (already correct — preserve)

* 401 → `setUnauthorizedHandler` → logout + reset to auth.
* Payment failure keeps the session, the cart and the order draft.
* Single-flight guards on order-create, gateway-complete, cancel, logout, guest-cart merge.
* Confirm dialogs on logout, delete address, delete account.
* Toasts on every non-navigating action.
* Customer-facing status vocabulary only (`pending` → "Order placed", never internal states).
