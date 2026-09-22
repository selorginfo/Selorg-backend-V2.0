# WEB_UI_COMPARISON.md — Phase 3 & 4: HTML prototype vs Next.js app

Fidelity % is a judgement of how close the rendered screen is to the prototype (layout + type + colour + component inventory + states). "After" reflects the state at the end of this pass.

## Summary table

| # | Screen | HTML | Before | Missing | Incorrect | Responsive issue | After |
|---|---|---|---|---|---|---|---|
| 1 | Auth | 100% | 72% | Brand hero photo, mode-specific hero copy/perks, signup stepper | Tab pill style (solid green vs white pill) | Brand panel hides at 768 not 560 | **99%** |
| 2 | Header + promo bar | 100% | 88% | — | Mobile nav breakpoint (1024 vs 860) | Location/actions hidden too early | **97%** |
| 3 | Location panel | 100% | 62% | "+ Add a new address" footer CTA, DEFAULT badge, selected-radio row style | Panel width 320 vs 352, heading copy | — | **98%** |
| 4 | Home — hero carousel | 100% | 45% | Gradient scrim, "Shop now →" pill, dot style, hero slot detection | Aspect ratio, bottom-aligned copy | Fixed min-height instead of aspect ratio | **95%** — kicker/sub-line have no field in the CMS payload |
| 5 | Home — promo strip | 100% | 40% | SVG icons, white card, tinted icon chip | Emoji + coloured card | — | **99%** |
| 6 | Home — category banners | 100% | 45% | 3-col cards, scrim, headline + "Shop now →" pill | 2-col image tiles | — | **92%** — the design's kicker/sub lines have no CMS field |
| 7 | Home — deals section | 100% | 60% | Countdown badge, bolt icon on heading | Section heading size | — | **96%** |
| 8 | Home — coupons | 100% | 40% | 3-col dashed cards, desc-as-title, code chip | Horizontal scroll strip | — | **98%** |
| 9 | Home — trust grid | 100% | 45% | SVG icons, tinted 44px chips, 3/2/1 columns | Emoji + bordered tiles | — | **99%** |
| 10 | Home — right rail | 100% | 90% | — | Progress bar divides by 4 not 5 | **Rail rendered at `lg` into a 2-col grid → dropped to a second row** | **99%** |
| 11 | Home — recently viewed | 100% | 80% | — | Heading size | — | **99%** |
| 12 | Category listing | 100% | 92% | Subcategory crumb + heading swap | Rail width 280 vs 320 | Filter panel stacks full-height above the grid on mobile | **99%** |
| 13 | Category filters | 100% | 95% | — | Header icon | Not collapsible on mobile | **99%** |
| 14 | Category right rail | 100% | 96% | — | — | — | **98%** |
| 15 | Product detail | 100% | 90% | — | Emoji "🌿" instead of leaf icon | — | **98%** |
| 16 | Product reviews | 100% | 95% | — | — | — | **97%** |
| 17 | Cart | 100% | 90% | — | — | Item row does not stack < 480 | **98%** |
| 18 | Cart bill / coupon / offers | 100% | 95% | — | — | — | **98%** |
| 19 | Checkout | 100% | 78% | Wallet toggle card in summary | Split summary/bill cards, `text-sm` section headings, 1200 wrap | — | **96%** |
| 20 | Payment gateway | 100% | 94% | — | — | — | **96%** |
| 21 | Confirmation | 100% | 85% | Item thumbnails | Address line vs `type · area` | — | **98%** |
| 22 | Orders list | 100% | 72% | Cancel **and** Reorder together | Circular 36px thumbs vs 42px squares, extra "View details" row | — | **97%** |
| 23 | Order detail | 100% | 68% | Illustrated map, 4-step track list, "N km away", receiver block, item photos, Chat button | Simplified arc map | — | **96%** |
| 24 | Order timeline | 100% | 70% | `✓` / `●` / blank marks | Check icon shown on future steps | — | **99%** |
| 25 | Account shell | 100% | 88% | — | Nav labels, h1 size, 1100 wrap | — | **98%** |
| 26 | Account — profile | 100% | 92% | — | Field labels, VERIFIED pill | — | **98%** |
| 27 | Account — addresses | 100% | 95% | — | — | — | **97%** |
| 28 | Account — wallet | 100% | 82% | ₹ prefix, min-amount hint | Preset pills as 4-col grid, button label | — | **97%** |
| 29 | Account — payments | 100% | 90% | — | — | — | **95%** |
| 30 | Account — notifications / prefs | 100% | 95% | — | — | — | **97%** |
| 31 | Offers | 100% | 55% | Hero kicker + headline, two-part coupon cards, offer tag, min-order line | Section heading sizes, FAQ heading | — | **97%** |
| 32 | Cart drawer | 100% | 96% | — | — | — | **98%** |
| 33 | Address / phone-OTP / top-up modals | 100% | 94% | — | — | — | **94%** (unchanged) |
| 33b | Logout / delete-address confirm modals | 100% | 90% | Warn icon circle, source copy, "Stay logged in"/"Keep it" labels | Generic Cancel/Remove wording | — | **90%** (left as-is at your request) |
| 34 | Footer | 100% | 97% | — | — | — | **99%** |
| 35 | ProductCard | 100% | 96% | — | — | — | **98%** |
| 36 | Search *(no prototype screen)* | n/a | — | — | — | — | kept |
| 37 | Support / ticket / FAQ / legal / refunds *(no prototype screen)* | n/a | — | — | — | — | kept |

## Gap list actually fixed in this pass

### A. Missing UI (added)
1. Home hero: left-to-right scrim, headline type scale, "Shop now →" pill, 1000/300 aspect ratio, round dots, and correct hero-slot detection (a `hero` slot mixing `single`/`carousel` banners now renders as the carousel instead of a card grid). The design's kicker and sub-line have no corresponding field on a CMS banner, so they are omitted rather than invented.
2. Home deals: live `HH : MM : SS` countdown badge + bolt icon (only for sections an admin named as a deal/flash/offer section — never invented).
3. Home category (sub-slot) banners: 3-column cards, radius 20, dark scrim, 30px headline and translucent "Shop now →" pill.
4. Home coupons: 3-column dashed-border cards with code chip and "Copy code".
5. Promo strip + trust grid: real SVG icons in tinted chips.
6. Location panel: "+ Add a new address" CTA, `DEFAULT` badge, selected-state row.
7. Auth: brand hero photograph, mode-specific title/sub/perks, 3-step signup stepper.
8. Offers: hero kicker + "Save more on every order", two-part coupon cards, min-order line, offer tag on bank cards.
9. Orders list: `Cancel` and `Reorder` side by side; overlapped 42px square thumbnails.
10. Order detail: illustrated city-map tracking SVG with route/traveled path/store/"You"/pulsing rider, distance-remaining line, 4-step track list, `Chat` action, item photographs. (The design's *receiver* block is **not** added — `selorg-service` returns no receiver data on an order, and inventing it would be fabricated content.)
11. Order timeline: `✓` past / `●` current / blank future marks.
12. Confirmation: item thumbnails, `type · area` delivery line.
13. Checkout: "Pay with wallet" tinted toggle card.
14. Wallet: ₹ prefix and `min ₹50` hint on the amount field.
15. Category: subcategory crumb + heading swap when a subcategory is active.

### B. Incorrect (corrected)
16. Auth tab pill → white active pill on a bordered track.
17. Section headings → 24px (home) / 22px (sub-sections) extrabold, `-0.6px` tracking.
18. Checkout/account/offers page wrappers → 1680 `.wrap` like every other screen.
19. Checkout section headings → 16px extrabold.
20. Home rail progress → `/5` steps.
21. Account nav labels → "My Profile", "My Orders", "Saved Addresses", "Selorg Wallet", "Payment Methods".
22. Profile field labels → "Full name", "Email address", "Mobile number" + uppercase `VERIFIED` pill.
23. PDP "Certified Organic" → leaf icon.
24. Orders list: whole card clickable (redundant "View details" row removed).
25. Wallet presets → wrapped pill row.

### C. Responsive (fixed)
26. **Home right rail rendered from `lg` (1024) into a two-column grid** → rail and the grid's third column both move to `min-[1221px]`, matching the prototype's 1220 breakpoint.
27. Header: location + Offers/Orders/Alerts now appear from 861px (the prototype's `.hide-sm` breakpoint) instead of 1024, and the mobile category rail hides at the same point.
28. Category filters collapse into a **"Filters" sheet** below 941px (the prototype's `catShell` collapse point) instead of a full-height stacked panel.
29. Cart item row wraps below ~520px (smaller thumbnail, 150px text floor, qty/total on its own line).
30. Auth brand panel hides at 560 (prototype breakpoint), not 768.
31. Order-detail column swap moved to the prototype's 1081px breakpoint (already correct — verified).
32. Home hero given a taller aspect ratio below 900px so the headline and CTA no longer overflow the banner or collide with the dots.
33. Location panel pinned to the viewport in compact mode so the header's scrolling chip row can't clip it.
34. Every page shell moved onto the shared `.wrap` utility so gutters are identical across screens.
35. Every page verified for horizontal overflow at 1920 → 360 (see `WEB_RESPONSIVE_AUDIT.md`).

### D. Functional bugs found while verifying (fixed)
36. `CategoriesContext` fetched categories in an async IIFE with no `catch`. With the backend unreachable the rejection escaped as an **unhandled promise rejection** and `loading` never cleared, so every consumer stayed in its skeleton instead of falling back to the static list the provider already holds. Now wrapped in `try/catch/finally`.
37. Home `banner_*` sections: the hero was chosen from `items[0].presentationMode` only. The real payload's `hero` slot mixes `single` and `carousel` banners, so the design's full-bleed hero rendered as a flat 3-up card grid. Detection now keys off the `hero` slot (or any `carousel` banner in the section).

### E. Known gaps deliberately NOT "fixed"
- **Receiver block on order detail** — `selorg-service` returns no receiver fields on an order, so the design's block is omitted rather than fabricated.
- **Home product carousels** — `sectionDefinitions` advertises `collections_deal_in_lowest_price`, `collections_trending_now`, `collections_high_nutrition_products` and `collections_speciality_products`, but `GET /sections/:key/products` returns **404 Section not found** for all four. The frontend correctly renders nothing for them; this is backend/CMS data, not a UI gap.
- **Guest cart persistence** — the guest cart lives in React state only and does not survive a hard refresh. Fixing it is a data-flow change (localStorage or a backend guest-cart session), so it was left alone.
- **Logout / delete-address confirm modals** — left in their current form.
