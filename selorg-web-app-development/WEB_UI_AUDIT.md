# WEB_UI_AUDIT.md — Phase 1: audit of the provided HTML UI

Source archive: `Selorg webapp.zip`

## 1. Files in the archive

| File | Size | Role |
|---|---|---|
| `selorg-standalone-src.html` | 261 KB / 1973 lines | **Source of truth.** Readable single-file design-canvas app (markup + `<script type="text/x-dc">` logic class). |
| `Selorg Web.dc.html` | 254 KB | Same document as a design-canvas file (asset ids instead of URLs). |
| `Selorg Webapp.html` | 3.8 MB | Design-canvas bundle: line 377 is a JSON blob of base64 images, line 389 is the same HTML doc JSON-escaped. |
| `uploads/Selorg Customer App.html` | 7.1 MB | Older bundle of the same app (242 KB doc + 6.8 MB image blob). |
| `ProductCard.dc.html` | 4.3 KB | The `ProductCard` sub-component imported by `<dc-import name="ProductCard">`. |
| `selorg-data.js` / `selorg-data-standalone.js` | 12 KB | Demo catalogue: 9 categories, ~90 products, promos, trust badges, coupons, banners. |
| `support.js` | 69 KB | Design-canvas runtime (`sc-if`, `sc-for`, `dc-import`, `{{ }}` binding, `DCLogic`). Not application code. |
| `image-slot.js` | 65 KB | `<image-slot>` custom element (lazy image with placeholder). Not application code. |
| `selorg-logo.png`, `uploads/*` | — | Logo + scratch screenshots. |

**Conclusion:** the archive is one design prototype, not a multi-page static site. It is a client-side SPA with a `route` state variable. Everything below is extracted from `selorg-standalone-src.html` + `ProductCard.dc.html`.

## 2. Design tokens (`:root`)

```
--accent      #5E8C3A      --ink    #1b1d17
--accentDark  #446a20      --muted  #6f7268
--accentTint  #eef4e6      --line   #e8e9e2
--radius      16px         --bg     #ffffff
--warn        #e4572e      --star   #f5a623
```

Font: **Plus Jakarta Sans** 400/500/600/700/800.
Dark ground used for footer / gateway header / category promo card: `#20241c`, secondary `#2e3327`, footer rules `#333a2c`, footer text `#c9ccc0` / `#9ba093` / `#8a8f81`.
Error surface: bg `#fff2ef`, border `#ffd9cf`, text `var(--warn)`.
Skeleton shimmer: `#eeefe7 → #f6f6f0 → #eeefe7`, 760px sweep, 1.25s.

## 3. Layout primitives

| Class | Rule |
|---|---|
| `.wrap` | `max-width:1680px; padding:0 34px` (→ `0 15px` ≤560) |
| `.pgrid` | `auto-fill minmax(196px,1fr)`, gap 16 (→ `minmax(150px,1fr)`, gap 11 ≤560) |
| `.catgrid` | `auto-fill minmax(148px,1fr)`, gap 14 |
| `.homeShell` / `.catShell` | `252px minmax(0,1fr) 320px` → `210px 1fr` ≤1220 (rail hidden) → `1fr` ≤940 |
| `.two-col` (cart, checkout) | `1fr 372px` → `1fr` ≤1040 |
| `.pdp` | `1.02fr 1fr` gap 46 → `1fr` gap 26 ≤900 |
| `.acct` | `250px 1fr` gap 26 → `1fr` ≤860 |
| `.odShell` (order detail) | `minmax(0,1fr) 396px` → `1fr` ≤1080, **side column moves above main** |
| `.g3` | `repeat(3,1fr)` → `1fr` ≤900 |
| `.trustGrid` | `repeat(3,1fr)` → 2 ≤860 → 1 ≤520 |
| `.railStick` | `sticky; top:135px` → static ≤860 |
| `.hide-md` | hidden ≤940 · `.hide-rail` hidden ≤1220 · `.hide-sm` hidden ≤860 · `.show-sm` shown ≤860 |

## 4. Routes / screens

`state.route` ∈ `auth · home · category · offers · product · cart · checkout · gateway · confirm · orders · orderDetail · account`.
`account` has 7 tabs: `profile · orders · addresses · wallet · payments · notifications · prefs`.
There is **no search screen** in the markup (search state exists in `renderVals()` but no `isSearch` block is rendered).

### 4.1 `auth`
Full-viewport radial gradient, 940px card, 2 columns.
* **Brand panel** (hidden ≤560): Pexels hero photo + green gradient overlay, two pulsing white circles, floating 64px logo, mode-dependent title/sub, 3 perk rows with icon chip, footer stats `12 min / 100%`.
* **Form panel**: Log in / Sign up tab pill (white active pill on white bordered track), then one of four steps —
  * `loginPhoneStep`: "Welcome back", method pills (Mobile/WhatsApp/Email) on accent-tint track, dial-code button with flag image + chevron + dropdown (9 countries, flagcdn images), phone input, **Continue**, **Skip for now**.
  * `signupEntryStep`: 3-step stepper (Number → Verify → Details), "Create your account", dial+phone, "Send my code via" SMS/WhatsApp, error box, **Send verification code**, terms line.
  * `authOtpStep`: heading, 4 OTP boxes (active box scales 1.04 + ring, filled box pops), hidden overlay input, demo-code line + Resend, **Verify & continue**, **Change number**.
  * `signupDetailsStep`: stepper, "✓ +91 xxx verified" badge (badgePop), "Almost there", Full name, Email (optional), **Create my account**.

### 4.2 Chrome (all non-auth routes)
* **Promo bar** — accent gradient, bolt icon, free-delivery copy, "Shop Now" pill.
* **Header** (sticky, z 40, 70px): logo 56px → location button (hidden ≤860: pin, "Delivery in 12 min", label, chevron) → search input 46px → Offers → Orders → account avatar+name → green Cart button with count pill.
* **Location panel** (352px): "Delivery location" + ✕, search field, "Use my current location" / detecting spinner, scrollable address list (each a bordered radio row with ✓ mark, type, `DEFAULT` badge, line+area), footer **+ Add a new address**.
* **Mobile nav row** (`show-sm`, ≤860): horizontal scroll — location chip + category chips.
* **Footer**: `#20241c`, 4 columns `1.5fr 1fr 1fr 1.2fr` — logo+blurb, Shop links, Company links, Get the app (App Store / Google Play chips), then copyright rule.

### 4.3 `home`
Sidebar `All Categories` (accent header + gear icon, 30px circular category photos) · main · right rail.
Main sections in order:
1. **Hero carousel** — `aspect-ratio:1000/300`, radius 20, 3 slides, left-to-right dark gradient, kicker (12px/800/ls 2), big `clamp(26px,4.4vw,46px)`, sub, white "Shop now →" pill, 9px dots bottom-centre. Auto-advance 4.5 s.
2. **Promo strip** (`.g3`) — white bordered card, 46px rounded-12 chip tinted per promo, title 15/800, sub 12.5 muted.
3. **Category banners** (`.g3`) — gradient cards, radius 20, min-h 150, kicker/big 30px/sub + translucent "Shop now →" pill.
4. **Flash Deals** — h2 24/800 with bolt icon + `Ends in HH : MM : SS` badge (bg `#fff2ef`, border `#ffd9cf`), `.pgrid` of ProductCards.
5. **Coupons & offers** — h2 + "View all offers →", `.g3` of dashed-accent tinted cards (desc 16/800 accentDark, cond, code chip, "Copy code" button).
6. **Bestsellers this week** — h2 + `.pgrid`.
7. **Trust grid** — white bordered 20px card, 3×2 rows, 44px tinted icon chip.
8. **Recommended for you** — h2 + `.pgrid`.
9. **Recently viewed** — only when non-empty.

Right rail (hidden ≤1220): greeting/wallet gradient card (avatar chip, greeting, wallet row with balance, CTA button) + "Track Your Order" card (status colour, `#SEL…`, progress bar, ETA, item count/total, "Track order →") or empty state.

### 4.4 `category`
Breadcrumb → title + count/promise + **Sort by** select (Popularity / Price ↑ / Price ↓ / Discount / Rating) → `catShell`.
* **Filter aside**: category header row, subcategory list ("All products" + each sub with count), "Filters" + "Clear all", Price bands (4 checkboxes), Customer rating (4 rows with stars + count), Availability & offers (In stock only / On offer).
* **Main**: category hero (photo + 95° dark gradient, "100% CERTIFIED ORGANIC", crumb, heading `clamp(28px,3.4vw,40px)`, blurb, 3 pills) → loading skeleton grid (8) / product grid / empty state.
* **Right rail** (hidden ≤1220): `#20241c` "Flat 10% OFF" card with dashed code box + Shop Now, "Why shop on Selorg?" 4 rows, "Need help?" chat + phone.

### 4.5 `offers`
Back button → accent gradient hero (kicker "🍃 COUPONS & OFFERS", h1 34px "Save more on every order", blurb) → **Coupons for you** (`.g3` two-part cards: tinted head with `₹50 OFF`/`10% OFF` 26px + desc, body with cond, min-order line, dashed code box + **Copy**/Applied) → **Bank & payment offers** (`.g3`, 42px tinted card-icon chip, uppercase tag, title, sub) → **Deals by category** (`.g3` gradient banners) → **How offers work** (3 Q/A rows in one bordered card).

### 4.6 `product`
Breadcrumb → `.pdp`.
* **Left (sticky 130)**: 440px image card radius 22 with discount badge / OOS overlay, 4 thumbnails 78px.
* **Right**: brand (uppercase accentDark), h1 32px, rating chip + `N+ sold` + "Certified Organic" leaf, price 34px + struck MRP + `% OFF`, "Inclusive of all taxes", **Select variant** buttons, CTA row (Out of stock | Add to cart + Buy now | stepper + Go to checkout), 2 info cards (12 min delivery / Easy returns), **About this product** paragraph + 6 spec rows in 2 columns.
* **Ratings & reviews** — 230px summary column (46px score, stars, "Based on N reviews", 5 distribution bars) + review list (avatar initial, name, stars, when, body). Collapses to 1 column ≤900.
* **You might also like** — `.pgrid`.

### 4.7 `cart`
h1 "My Cart (N items)". Empty state card. Otherwise `.two-col`:
* Left: delivery-promise banner, item rows (82px image, name, variant·brand, "Assured Organic", price/MRP/You save, Save for later + Remove, accent stepper 40px + line total), "Saved for later (N)" list with **Move to cart**.
* Right (sticky 130): **Bill details** (Item total MRP, Product discount, Coupon, Delivery fee, Handling fee, Wallet, dashed rule, **Pay with wallet** tinted toggle row, "To pay" 18/800, savings banner, **Proceed to checkout →**), **Apply coupon** (applied chip + Remove, or input + Apply + code chips), **Exclusive offers for you** (tag chip, code, desc·cond, Apply/Applied).
* **You may also like** — `.pgrid`.

### 4.8 `checkout`
Back button + h1 28px. `.two-col`:
* Left cards: **Delivery address** (+ Add new; radio rows with type badge, line, phone, Delete), **Receiver details** (Optional badge, name/phone grid → 1 col ≤900, delivery note), **Delivery slot** (Express / Today 6–8 PM / Tomorrow 8–10 AM), **Payment method** (UPI / Card / Netbanking / COD radio rows with icon).
* Right (sticky 130, **one card**): "Order summary" + item count, scrollable 230px item list (44px thumbs), rule, Subtotal / Discount / Coupon / Delivery / Handling & taxes / Wallet, dashed rule, **Pay with wallet** tinted toggle, **Total** 18/800, CTA `Proceed to pay · ₹X` (or `Place order`), 🔒 "100% secure payments".

### 4.9 `gateway`
560px card. Dark header (logo, "Selorg Secure Checkout", "Payments processed over TLS 1.3", amount). Steps:
* `details` — method label + "Change method"; UPI (4 app tiles + VPA field) / Card (number, expiry, CVV, name) / Netbanking (6 bank tiles); error box; **Pay ₹X**; Cancel payment; encryption note.
* `processing` — 52px spinner, "Contacting your bank…".
* `otp` — 6 OTP boxes, demo hint, error, **Confirm payment**, Cancel.
* `failed` — 74px `!` circle, message, "No money was deducted", **Retry payment**, "Use a different payment method".

### 4.10 `confirm`
720px card: 88px tinted check circle (popIn), h1 28px, blurb, Order ID / Arriving chip pair, **Order summary** panel (42px item thumbs, Delivery to, Payment, Transaction ID, Total paid), **Track order** + **Continue shopping**.

### 4.11 `orders`
h1 28px, empty state, then max-820px column of cards: `#id` + date + status pill; overlapped 42px thumb stack; "N items · ₹X" + ETA; **Cancel** (when allowed) **and Reorder**. Whole card is clickable.

### 4.12 `orderDetail`
Back + `Order #id` + placed-on. `.odShell` (side column first on mobile):
* **Side**: status pill + ETA + 5-step timeline (`✓` past, `●` current, blank future) or cancelled notice; **Live tracking** card — header (`X km away · N% of the route covered`, "ARRIVING IN N min"), 310×260 illustrated city-map SVG (roads, park, lake, buildings, dashed route, traveled path, store pin, "You" pin, pulsing rider marker), rider row (initial chip, name ★ rating, vehicle, **Call rider**, **Chat**), 4 track steps.
* **Main**: Items card (50px thumbs), 2 cards — Delivery address (+ receiver block when present) and Bill details, then **Reorder items** / **Cancel order**.

### 4.13 `account`
h1 28px, `.acct`. Aside: avatar + name/phone, 7 nav rows with icons (My Profile, My Orders, Saved Addresses, Selorg Wallet, Payment Methods, Notifications, Preferences), Logout.
* **profile** — "Personal information" + Edit; read rows (Full name, Email address, Mobile number + `VERIFIED`) or edit form (3 fields, hint about OTP, error, Save/Cancel).
* **orders** — empty state or order cards with Reorder.
* **addresses** — "Saved addresses" + **+ Add address**; 2-col cards (type badge, Default, name, line, phone, Edit / Set as default / Delete) or empty state.
* **wallet** — gradient balance card; **Add money** (4 preset pills + ₹ input + button); two toggle rows (Use wallet at checkout, Auto top-up); **Transaction history**.
* **payments** — UPI row, card row, "+ Add payment method" dashed button.
* **notifications** — 3 toggle rows.
* **prefs** — 2 toggle rows.

## 5. Overlays

| Overlay | Detail |
|---|---|
| **Cart drawer** | 410px / 92vw, `drawerIn .24s`, header + count, empty state, scrollable rows (56px thumb, name, variant, line total, 32px accent stepper), footer: free-delivery note, Subtotal, Delivery, **Checkout · ₹X →**, "View full cart". |
| **Address modal** | 460px, title Add/Edit, Home/Work/Other type pills, 4 inputs, Save button. |
| **Logout confirm** | 390px, 58px warn circle, copy, **Stay logged in** / **Log out**. |
| **Delete address confirm** | 410px, warn icon + copy, address preview card, **Keep it** / **Delete address**. |
| **Phone-change OTP** | 410px, tinted phone circle, 4 OTP boxes, demo hint + Resend, error, **Verify & update** / Cancel. |
| **Wallet top-up** | 430px, dark header with amount; steps `method` (UPI/Card/Netbanking pills + field) → `processing` → `otp` (6 boxes) → `success` (74px check, new balance, ref) / `failed` (retry). |
| **Toast** | fixed bottom-centre, `#20241c`, green ✓, `toastIn .22s`, auto-dismiss 1.8 s. |

## 6. `ProductCard` (`ProductCard.dc.html`)

White card, radius 16, border `#e8e9e2`, hover `translateY(-2px)` + shadow. Absolute discount badge top-left (`#e4572e`). 170px image with OOS overlay. Body: `★ rating · unit` (11px muted), name 13.5/700 min-h 35, "Only N left" (warn), then price block (16/800 + struck MRP) and the action — `Notify` (disabled) / accent stepper 36px / `ADD` outline button.

## 7. Icon set

All icons are inline 24×24 SVG strokes (`stroke-width 1.8`, round caps) generated in `icons()`: search, cart, user, box, pin, chevron, heart, minus, plus, close, check, truck, leaf, bolt, shield, refresh, lock, chat, phone, card, bank, cash, bell, gear, clock, trash, star (filled), back, apple, play, fire, gift, wallet, tag, receipt + 12 category glyphs. **No emoji are used anywhere in the rendered UI** — `promos`/`trust` carry emoji in data but `renderVals()` maps them to SVG icons before render.

## 8. Interaction inventory

See `WEB_INTERACTION_AUDIT.md`.
