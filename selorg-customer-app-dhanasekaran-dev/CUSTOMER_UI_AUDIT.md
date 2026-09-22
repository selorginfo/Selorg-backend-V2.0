# CUSTOMER_UI_AUDIT.md — Source-of-truth audit of the provided UI package

**Package audited:** `Selorg Customer App (3).zip` (26.2 MB, extracted 2026-09-02)
**Role:** SOURCE OF TRUTH FOR DESIGN (visual + interaction).
**Not** a source of truth for API integration — the prototype runs on in-memory sample data by design.

---

## 1. Package contents

| Path | Type | Notes |
|------|------|-------|
| `Customer App.dc.html` | 253 KB | **The design source.** A single-file interactive prototype: `<x-dc>` shell + a `text/x-dc` class component (`DCLogic`) that renders every screen with `React.createElement`. This is the file that was read line-by-line for this audit. |
| `Selorg Customer App.html` | 7.08 MB | Self-extracting **bundled build of the same prototype** (assets inlined as base64 + a runtime unpacker). Same markup, same screens — not a second design. |
| `support.js` | 69 KB | `DCLogic` runtime (state, `setState`, `forceUpdate`, `<sc-if>`, template interpolation). |
| `image-slot.js` | 65 KB | `<image-slot>` custom element (drag-to-replace placeholder used on onboarding / auth-success / profile avatar). |
| `assets/` | 16 files | `app-logo.png`, `banner.png`, `deal-banner.png`, `empty-cart.png`, `lifestyle-header.png`, `onboard-1/2/3.png`, `organic-tagline.png`, `rider.png`, `tiny-tummies.png`, `wellbeing.png`, `selorg-logo.svg`, `splash-logo.svg`, `success-bg.svg` |
| `assets/cat/` | 11 files | Category tiles: atta-rice-dal, dairy-bread-eggs, dry-fruits-seeds, fresh-fruits, fresh-vegetables, masalas-spices, oil-ghee, salt-sugar-jaggery, sauces-spreads, tea-coffee, vermicelli-noodles |
| `docs/` | 13 `.md` | The prototype author's own audit pack (`00-README` … `12-FINAL_IMPLEMENTATION_SUMMARY`, `REDESIGN_SPEC`). |
| `uploads/` | ~120 files | Working scratch: screenshots, a stale Expo scaffold, keystore, `google-services.json`, backend docs. **Not part of the design.** |

**TOTAL HTML FILES: 2** (1 design source + 1 bundled build of the same design).

### 1a. Conflict found between the ZIP's own docs and the ZIP's own HTML

`docs/REDESIGN_SPEC.md` and `docs/00-README.md` state the prototype uses `#034703` / `#F5F5F5` / **Inter** / **3 tabs (HOME/CATEGORY/CART)**.
The actual `Customer App.dc.html` in *this* (3rd) ZIP uses `#5E8C3A` / `#EEF2E9` / **Plus Jakarta Sans** / **4 tabs + centre cart FAB**.

**Resolution used for this audit:** the HTML is the source of truth (per instruction), *except* for the brand green. The ZIP's own spec says the palette is "unchanged from repo" (`#034703`), and the shipping RN app, Android splash, notification icon and store listing already use `#034703`. Swapping the primary brand colour is a **brand decision, not a UI gap**, so the RN token `primary: #034703` is preserved and every `#5E8C3A` in the prototype maps onto it. Every *structural* difference (layout, spacing, radius, component composition, states, interactions) **is** treated as a gap and is fixed. Restated in `CUSTOMER_UI_COMPARISON.md` §0.

---

## 2. Design tokens extracted from the HTML

From `C()` in `Customer App.dc.html`:

| Token | HTML value | Role | RN mapping |
|-------|-----------|------|-----------|
| `G` | `#5E8C3A` | primary | `colors.primary` (`#034703`, brand-locked) |
| `GD` | `#456E29` | primary dark | `colors.primaryDark` (`#023502`) |
| `INK` | `#2A3326` | text | `colors.text` (`#1A1A1A`) |
| `MUT` | `#7B857A` | muted text | `colors.textMuted` — exact match |
| `BOR` | `#E7EBE0` | border | `colors.border` (`#E0E0E0`) |
| `BG` | `#EEF2E9` | screen bg | `colors.surfaceAlt` — exact match |
| `CARD` | `#fff` | card | `colors.card` — exact match |
| `TINT` | `#EAF1E1` | soft green | `colors.tint` (`#E8F0E8`) |
| `DANGER` | `#D64C3B` | error | `colors.danger` (`#D32F2F`) |
| `AMBER` | `#C4771E` | warning | `colors.amber` (`#B5741A`) |
| star | `#F5A623` | rating | `colors.star` — exact match |

**Type:** Plus Jakarta Sans 400/500/600/700/800. Weights actually used: 600 (body), 700 (labels), 800 (everything emphatic — the design is 800-heavy). RN ships Poppins; the *weight ladder* is what must be matched.

**Radii observed:** 6, 8, 9, 10, 11, 12, 13, 14, 16, 18, 20, 22 (sheets), 28 (auth hero), 30 (nav pill), 999 (pills), 50% (avatars/FABs).

**Spacing:** 2/4/6/8/10/12/14/16/18/20/22/24/26 — a 2 px grid, **not** an 8 px grid. The existing RN `spacing` scale (4/8/16/24/32/48) is too coarse for several of these and is used alongside literals.

**Shadows:** card `0 8px 22px -16px rgba(20,35,26,.5)`; nav `0 16px 34px -10px rgba(20,35,26,.32)`; primary button `0 10px 22px -12px rgba(69,110,41,.65)`; sticky bottom bar `0 -10px 30px -18px rgba(20,35,26,.4)`.

**Motion:** `screenin .34s`, `rise .28s`, `pop .35s`, `stepin .32s` (qty 0→1), `numin .18s` (number change), `heartpop .4s`, `slideup .35s`, `shimmer 1.3s` (skeleton), `toastin`. `prefers-reduced-motion` is respected.

**Device matrix shipped in the prototype (12 presets):** iPhone SE 320×568 · iPhone 13 mini 360×780 · iPhone 15 390×844 · 15 Plus 414×896 · 15 Pro Max 430×900 · iPad mini 600×820 · Pixel 8a 360×800 · Pixel 8 Pro 412×892 · Galaxy S24 360×780 · S24 Ultra 412×915 · OnePlus 12 400×870 · Android Tablet 640×860. **The design is explicitly expected to survive 320 px width and tablet width.**

---

## 3. Complete HTML screen inventory — 47 screens

Enumerated from the `_scr_*` render methods of the prototype class.

### Onboarding / auth (12)

| # | Screen key | Purpose | Reachable |
|---|-----------|---------|-----------|
| 1 | `splash` | Gradient logo + wordmark + tagline + **spinner**, auto-advances after 1.5 s | yes |
| 2 | `onboarding` | 3 slides, **auto-advance every 3.2 s**, **tappable dots**, slide 2 is an **8-tile category mosaic**, Skip | yes |
| 3 | `login` | Combined Log In / Sign Up. Sliding pill toggle, method toggle (**3-way for login, 2-way for signup**), **country-code picker**, guest skip | yes |
| 4 | `otp` | 4 boxes, phone+lock illustration, `00:SS` resend timer, 3 trust badges | yes |
| 5 | `profileSetup` | Avatar image-slot + camera FAB, name, optional email | yes |
| 6 | `location` | Pin tile, 3 CTAs (current location / manual / skip) | yes |
| 7 | `loginSuccess` | Check circle + **210×160 hero image** + **"Continue to Home" CTA** | yes |
| 8 | `signupSuccess` | Same shell, "Account Created!" + **"Start Shopping" CTA** | yes |
| 9 | `enterMobile` | Simpler phone-only variant | dead — only `chooseAuth()` reaches it, never called |
| 10 | `loginPassword` | Email/mobile + password + forgot link | dead |
| 11 | `createPassword` | Password + rules checklist | dead |
| 12 | `forgot` + `resetPassword` | Password reset flow (2 screens) | dead |

### Shopping (8)

| # | Screen | Key UI |
|---|--------|--------|
| 13 | `home` | Sticky gradient header (location bar + search + bell w/ badge) · active-order strip · **hero banner with eyebrow chip + CTA** · category rail (72 px circles) · **3 product sections, each 2×2 grid + See all** · curated rail (3 cards) · organic strip · **shimmer skeleton loading state** |
| 14 | `categories` | Sticky title + search · per-category block: 34 px icon + name + "See All (n) ›" + **4-col sub-category grid** (66 px circles) |
| 15 | `category` | Back chip + search · **94 px left sidebar rail** (40 px thumbs, 3 px green bottom-border active) · title + count · **filter button with active-count badge** + **separate sort button** · 2-col grid · loading / empty / no-match states |
| 16 | `collection` | Header with search · full-width **Filters** and **Sort** buttons · 2-col grid · empty state |
| 17 | `search` | Green-bordered input with back + clear · suggestions list · results grid + count · **"BROWSE ALL PRODUCTS" default grid** · loading / empty |
| 18 | `product` | See §4a — the largest screen (19 blocks) |
| 19 | `reviews` | **Score card (38 px) + stars + 5-bar histogram with %** · review cards with avatar initial, stars, Verified/You badge, quote |
| 20 | `writeReview` | Product chip · 5 × 38 px stars with scale animation · label (Poor…Excellent) · textarea card · sticky Post |

### Cart to order (9)

| # | Screen | Key UI |
|---|--------|--------|
| 21 | `cart` | Title + count · dark ETA banner · items card with steppers · **CLEAN FOOD PROMISE chip rail (5 chips)** · coupon row · bill card · CTA · empty state |
| 22 | `checkout` | Address card (red border when missing) · **"This order is for someone else" checkbox → receiver name + phone** · order summary · tip chips · **payment-method radio list (3)** · **coupon row** · bill · sticky bar with **dynamic CTA label** |
| 23 | `payGateway` | Simulated Worldline gateway page |
| 24 | `payment` | Method cards, Low-balance badge, insufficient-balance banner + Top up, bill, **processing** full screen, **failed** screen with Retry **and "Choose another method"** |
| 25 | `addressList` | + Add in header · cards with home/building icon, DEFAULT badge, Edit / Set default / Delete · empty state |
| 26 | `addressEdit` | **Place-search field** · **map-pin placeholder box** · **Home/Work/Other label chips** · line1 / line2 / city / pincode / **receiver name** / **receiver phone** |
| 27 | `orderPlaced` | Check circle · copy · **"You've chosen life. Thank you."** · clean-food strip card · order-number card · Track + Continue |
| 28 | `tracking` | See §4b |
| 29 | `cancel` | **Full screen** · free-cancellation notice · 5 reason radios · **blocked/error state when not cancellable** |

### Orders and after-sales (8)

| # | Screen | Key UI |
|---|--------|--------|
| 30 | `orders` | **Filter chips: All / Active / Completed / Cancelled with counts** · cards with status pill, 4 thumbs, Track→ / Reorder→ + View details · per-filter empty state · loading state |
| 31 | `orderDetail` | Header **⋮ menu button** · items card · bill card · address card · Reorder + Write a review (delivered) |
| 32 | `invoice` | Tax-invoice card: Selorg header, BILLED TO, line items, totals, "Payment: …", Download PDF |
| 33 | `refunds` | List with amount·#order, reason·destination, **5 status pills (Pending / Approved / Processed / Completed / Rejected)** |
| 34 | `refundDetail` | Big amount card + 3-step vertical timeline |
| 35 | `return` | 5 reason radios + note card + Submit |
| 36 | `rate` | 5 × 38 px stars + comment card + Submit |
| 37 | `rateSuccess` | Star circle + thanks + Back to home |

### Account (8)

| # | Screen | Key UI |
|---|--------|--------|
| 38 | `account` | Profile card **+ Edit chip** · **3 quick-stat tiles (Wallet / Orders / Refunds)** · rows group 1 (Wallet with balance, Orders, Addresses, Refunds, Notifications with badge) · rows group 2 (Help, Settings, **Terms & privacy**) · **Log out danger button** · guest empty state |
| 39 | `editProfile` | Avatar initial + camera chip · name / email / **disabled phone with "Verified" note** |
| 40 | `settings` | 4 notification toggles · Terms / Privacy / **Delete account** · Log out · version |
| 41 | `wallet` | **Gradient balance card with watermark icon**, Refresh, amount chips ₹100/₹250/₹500 + Custom, "Add ₹X" · transaction list |
| 42 | `notifications` | Read-all action · cards with type icon, unread tint, timestamp, delete X · empty state |
| 43 | `support` | Dark "Chat with us" card · **QUICK HELP 4-FAQ list** · conversations list with Open/Resolved pill |
| 44 | `ticket` | Chat bubbles (asymmetric radii) · composer with send FAB · **Reopen ticket** when resolved |
| 45 | `legal` | Terms + Privacy in one card |

### System (2)

| # | Screen | Key UI |
|---|--------|--------|
| 46 | `noInternet` | Red wifi-off circle + copy + Try again |
| 47 | *(router)* | `_renderScreen()` — flush layout for `tracking` / `onboarding`, `screenin` entry animation |

**TOTAL HTML SCREENS: 47** (43 live, 4 dead/unreachable in the prototype).

---

## 4. The two heaviest screens, in full

### 4a. `product` (PDP) — 15.4 KB of markup, 19 distinct blocks

1. **Scroll-reactive floating top bar** — transparent over the gallery, fades to blurred white + product name past 170 px scroll. Three 40 px **frosted-glass circular buttons**: back, wishlist (with `heartpop`), **share**.
2. **Image gallery** — horizontal snap carousel; `galleryImgs()` returns 3 images; tap opens zoom.
3. **Page counter** `1 / 3` pill, top-right of the gallery.
4. **`N% OFF` pill**, bottom-left of the gallery.
5. **Dot indicators** — the active dot widens 6 → 18 px.
6. Brand eyebrow — `SELORG ORGANIC`, uppercase, green, letter-spaced.
7. Product name — 23 px / 800.
8. Rating row — 5 stars + `4.8` + `· 1,248 reviews`, tappable.
9. **Short description paragraph.**
10. Price row — 28 px price + struck MRP + `N% OFF` chip, `numin` crossfade on variant change; "Inclusive of all taxes".
11. **"Select size" variant selector** — 3 pills (unit / Family pack / Bulk save), lift + shadow when selected, **recomputes displayed price**.
12. Delivery info card — 3 rows: ETA + **"Delivering to {city}"**, stock status (3 variants), free-delivery threshold.
13. **"Why you'll love it"** — 2×2 benefit grid.
14. **"CLEAN FOOD PROMISE"** card — leaf icon + clean badges.
15. **4 accordions** — Product details / Nutrition information / Storage & specifications / Return & refund; `+` rotates to `×`; max-height transition.
16. **Reviews block** — summary card (28 px score + stars + "Excellent" + "Based on N verified reviews").
17. **Horizontal review-card rail** — 3 cards, each with stars, Verified badge, quote, reviewer name.
18. **"You may also like"** — horizontal related-product rail (150 px cards with their own mini add button).
19. **Sticky purchase bar** — Total (`price × qty`) + bordered qty stepper + **"Add to cart" / "Go to cart" / "Notify me"** button. Plus a **full-screen zoom overlay**.

### 4b. `tracking` — 9.2 KB

1. **210 px illustrated SVG map** — 5 street lines, park block, dashed green route, **rider marker (44 px green circle + truck)**, **teardrop destination pin**.
2. **Floating map header** — back chip, "Tracking on Map", **help (?) chip**.
3. **Bottom sheet overlapping the map by −18 px**, 22 px top radius, drag handle.
4. Headline — "Your order is coming in `M:SS`" / "This order was cancelled".
5. **Order card** — 58 px thumb, "Selorg Fresh Order", **`ID:` label in red + order number**, "N Items", status label.
6. **Rider row** — avatar (`assets/rider.png`), name, ★ 4.8 (125 Reviews), **green chat button**, **dark-green call button**.
7. **`TRIP` section label** + timeline (starts at `confirmed`, not `pending`), pin icon on the final step, times on completed steps, "About M:SS" on the last.
8. **"HOW IS YOUR SHIPPER?" 5-star block** — shown only when delivered.
9. Actions — Cancel order (danger) / **Report an issue / return** / **Need help with this order** (help icon).

---

## 5. Modals, bottom sheets and overlays — 9

| # | Overlay | Trigger | Contents |
|---|---------|---------|----------|
| 1 | **Country-code sheet** (`_ccSheet`) | Flag / `+91` tap on login | Drag handle, title, **8 countries** with flag image + code + name + check |
| 2 | **Filters sheet** (`_catFilterSheet`) | Filter button on category / collection | Handle · **Clear All** · **dual-thumb price-range slider** with ₹ chips + Reset price · **Discount 3-col pills (10/20/30/40/50 %)** · **Rating 4-col star pills** · **Availability checkboxes** · footer **Apply Filters + "N products found"** |
| 3 | **Sort sheet** (`_catSortSheet`) | Sort button | 4 radio rows (Popularity / Price low→high / Price high→low / Discount high→low) |
| 4 | **Collection sort+filter sheet** (`_colFilterSheet`) | legacy path | Sort radios + MAX PRICE slider + 2 filter chips + Reset / Show results |
| 5 | **Order options sheet** (`_orderMenuOverlay`) | ⋮ on order detail | Up to 4 rows, each = 40 px icon tile + title + description + chevron; Cancel is danger-styled |
| 6 | **Rate-order prompt** (`_reviewPromptOverlay`) | After delivery | Product thumb + order meta + close · 5 stars + label · comment box · Submit · **"Maybe later"** |
| 7 | **Wallet top-up sheet** (`_topupSheet`) | "Add ₹X" | **Green gradient header ("SELORG TECH PRIVATE LTD" + amount + close)** · **"Secured with industry-standard encryption" strip** · 2×2 method grid · **"Powered by Worldline · BHIM UPI supported"** · processing state |
| 8 | **PDP zoom** | Tap gallery image | Dark blurred backdrop, close chip, contained image |
| 9 | **Category video modal** (`_videoModal`) | `openVideo()` | **Dead — never invoked anywhere in the prototype.** 16:10 poster, PREVIEW badge, play button, scrubber. |

Plus a **toast host** — bottom-centre pill, 3 kinds (ok / err / info), 2.4 s auto-dismiss.

---

## 6. Interaction inventory (behaviours the design implies)

| Behaviour | Where |
|---|---|
| Auto-advancing carousel, cancelled on first touch | onboarding |
| Tappable pagination dots | onboarding |
| Sliding pill highlight (spring) | login mode toggle, method toggle |
| Scroll-reactive header (background + blur + title fade) | product |
| Horizontal snap gallery with index sync | product |
| Tap-to-zoom overlay | product |
| Variant selection recomputes price with crossfade | product |
| Accordion max-height transition, `+` → `×` icon rotate | product |
| Qty stepper: `stepin` on 0→1, `numin` on each change | product card, cart, PDP |
| Heart pop animation | product card, PDP |
| Debounced (200 ms) suggestions, Enter to search | search |
| Sub-category rail filters the grid client-side | category |
| Dual-thumb range slider with clamping | filters sheet |
| Live "N products found" count in the sheet footer | filters sheet |
| Manual refresh with spin animation | wallet |
| Optimistic read / read-all / delete | notifications |
| Resend cooldown rendered `00:SS` | otp |
| Free-cancellation eligibility gate | cancel |
| Skeleton shimmer while loading | home |
| Toast for every non-navigating action | global |

---

## 7. Responsive behaviour required by the design

* The prototype is exercised at **320 → 640 px** width. Nothing may assume 390 px.
* Every horizontal rail (`categories`, `curated`, `clean chips`, PDP reviews, PDP related) is `overflow-x:auto` with hidden scrollbars and **negative side margins so cards bleed to the screen edge**.
* Product grids use `minmax(0,1fr)` — grid items **must be allowed to shrink below their content width**. The RN equivalent is `minWidth: 0` / `flexShrink`, never a fixed child width.
* All sheets are `max-height: 70–88 %` with an internal scroll area — never full height.
* Sticky bottom bars sit above the safe area; the tab bar is padded 20 px from the bottom.
* Long text is handled with `white-space:nowrap; text-overflow:ellipsis` (header titles, address lines, ticket subjects) or `-webkit-line-clamp:2` (product names).
* Status-bar height is device-dependent (38 px vs 50 px with Dynamic Island) — the RN equivalent is `SafeAreaView` insets.

---

## 8. Assets — all 27 present and already bundled in the RN app

`assets/` (16) and `assets/cat/` (11) in the ZIP correspond one-for-one to `assets/images/` and `assets/images/cat/` in the RN project and are already registered in `src/theme/images.ts`. **No missing assets.**

Remote imagery in the prototype (Unsplash `r1…r31`) stands in for API-supplied product/category images; in RN these correctly come from the API. **They must not be bundled.**

---

## 9. What the HTML is *not* a source of truth for

* All catalog / order / wallet / ticket data (`catData`, `prodData`, `_seedOrders`, `wallet.txns`, `notifications`, `tickets`, `refunds`) is **sample data**.
* `_fetch(key, ms)` is a `setTimeout` — there are no real requests anywhere in the prototype.
* Product reviews (`_allReviews`) and the 4.8 / 1,248 rating are **hard-coded**.
* PDP variants ("Family pack ×1.85", "Bulk save ×4.3") are **synthesised from a multiplier**, not real SKUs.
* Rider identity ("Ravi Kumar", 4.8, 125 reviews) and timeline times (`9:15 AM`…) are **hard-coded**.
* `catMeta` benefit copy and `productBytes` clean-food tags are **static maps**.

In RN these blocks must be rendered from the live API where an endpoint exists, and **hidden rather than faked** where one does not. Tracked per-screen in `CUSTOMER_UI_COMPARISON.md`.
