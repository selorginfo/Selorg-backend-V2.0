# WEB_RESPONSIVE_AUDIT.md — Phases 7 & 18

## 1. Breakpoint strategy

The design source uses non-Tailwind breakpoints. Rather than approximate them with `sm/md/lg/xl`, the app now uses the **source's own pixel values** via arbitrary variants, so the layout switches exactly where the prototype does.

| Source rule | Meaning | Tailwind used here |
|---|---|---|
| `@media(max-width:560px)` | `.wrap` gutter 34 → 15, `.pgrid` 196 → 150, auth brand hidden | `.wrap` CSS + `sm-alt`/`min-[561px]:` |
| `@media(max-width:520px)` | trust grid → 1 column | `xs` (520) |
| `.hide-sm` / `.show-sm` (860) | header location + Offers/Orders hide, mobile category rail shows; `.acct` → 1 col | `min-[861px]:` |
| `@media(max-width:900px)` | `.g3` → 1 col, `.pdp` → 1 col, review block → 1 col | `pdp` (900) |
| `.hide-md` (940) | home category sidebar hides; `homeShell`/`catShell` → 1 col | `min-[941px]:` |
| `@media(max-width:1040px)` | `.two-col` (cart / checkout) → 1 col | `min-[1041px]:` |
| `@media(max-width:1080px)` | `.odShell` → 1 col, side column moves above main | `min-[1081px]:` |
| `.hide-rail` (1220) | home + category right rails hide; shells → `210px 1fr` | `min-[1221px]:` |

`.wrap` itself is a real utility in `globals.css` (`max-width:1680px; padding-inline:34px`, 15px below 560) and is now used by **every** page shell, replacing the ad-hoc `mx-auto max-w-[…] px-4 sm:px-8` variants that made page gutters inconsistent.

## 2. Bugs found and fixed

| # | Where | Problem | Fix |
|---|---|---|---|
| 1 | Home right rail | `hidden lg:flex` (1024) rendered the rail into a **two-column** grid (`lg:grid-cols-[210px_1fr]`), so between 1024 and 1279 px it dropped onto a second row underneath the sidebar. | Rail moved to `min-[1221px]`, grid gains its third column at the same point. |
| 2 | Header | Location picker, Offers, Orders and Alerts hid below **1024**, and the mobile category rail appeared below 1024 — 164 px earlier than the design (860). Tablets lost the location control for no reason. | All switched to `min-[861px]`, matching `.hide-sm` / `.show-sm`. |
| 3 | Location panel (mobile) | The compact trigger lives inside the header's `overflow-x-auto` chip row, so an absolutely positioned 352 px dropdown was clipped and scrolled away with the row. | Compact panel is `position: fixed`, centred under the header. |
| 4 | Category filters | The full filter panel stacked at full height above the product grid below 1024 — several screens of checkboxes before the first product. | Below 941 px the panel collapses into a **Filters** button (with an active-filter count) that opens a scrollable sheet ending in a "Show N products" CTA. Desktop is unchanged. |
| 5 | Home hero | The design's fixed `aspect-ratio:1000/300` leaves ~108 px of height at 360 px wide; the headline (`clamp(26px,…)`) plus the CTA pill overflowed the banner and collided with the dots. | Ratio is `16/9` under 520, `21/9` to 900, then the design's `1000/300`; headline clamp min lowered to 20 px; CTA padding/margins scale down. |
| 6 | Cart item row | Fixed `flex items-center` row (82 px image + copy + stepper column) squeezed the name to 2–3 characters below ~420 px. | Row wraps: image shrinks to 70 px under 520, the text block keeps a 150 px floor, the qty/total column moves to its own line. |
| 7 | Auth card | Brand panel hid at 768 instead of the design's 560, so 561–767 px lost the panel unnecessarily. | `min-[561px]` on both the grid and the panel. |
| 8 | Checkout / account / offers / orders / payment | Page shells used four different max-widths (1100 / 1200 / 820 / `max-w-lg`) with `px-4 sm:px-8` gutters, so gutters jumped between pages. | All use `.wrap`; content-width caps (820 orders list, 1240 order detail, 560 gateway, 720 confirmation/FAQ/legal) are applied to the inner block, as in the source. |
| 9 | Category page | Rail appeared at `xl` (1280) instead of 1220 and was 280 px instead of 320. | `min-[1221px]`, 320 px. |

## 3. Verification

Measured live against the running app (dev server on :3000, real backend on :3333) with the browser viewport emulated at each width. The check flags any element whose box extends past the viewport, ignoring elements inside a deliberately scrollable/clipped parent.

```js
document.querySelectorAll('body *') → r.right > innerWidth + 2 || r.left < -2
```

| Page | 1920 | 1440 | 1280 | 1024 | 768 | 600 | 480 | 390 | 360 |
|---|---|---|---|---|---|---|---|---|---|
| Home | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Category (`/category/vegetables`) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Product detail | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Cart | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Offers | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Auth | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Search | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| FAQ / Legal | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

`document.documentElement.scrollWidth` never exceeds `innerWidth` on any of the above (the −9 px readings at desktop widths are the vertical scrollbar).

### Checklist

- [x] No horizontal overflow — measured, 0 offending elements on every page/width above
- [x] No clipped content — hero headline fix (#5) was the only case found
- [x] No overlapping elements — hero CTA vs. carousel dots fixed
- [x] No text cutoff — cart row fix (#6)
- [x] No broken cards — promo/trust/coupon/banner grids collapse 3 → 2 → 1
- [x] No broken tables — the app has no data tables; list/card layouts used throughout, as in the source
- [x] No buttons outside viewport
- [x] No dropdown overflow — location panel fix (#3); search suggestions are width-bound to the field
- [x] No modal overflow — `Modal` is `p-4` inset with `max-w`; the filter sheet caps at `85vh` and scrolls
- [x] No drawer overflow — cart drawer is `w-[410px] max-w-[92vw]`
- [x] Sidebar responsive — home category sidebar hides at 940, category filters become a sheet
- [x] Header responsive — 860 breakpoint, scrolling category rail with active state
- [x] Navigation responsive — mobile category rail + account nav stacks at 860
- [x] Search responsive — search field flexes from 120 px min
- [x] Filters responsive — mobile filter sheet
- [x] Forms responsive — receiver grid, address modal, payment forms all collapse to one column
- [x] Cards responsive — `pgrid` 196 → 150 min track
- [x] Images responsive — every image is `next/image` with `fill` + `sizes`
- [x] Charts responsive — the tracking map is an SVG with `viewBox` + `w-full h-auto`
- [x] Pagination responsive — no paginated views in the design; category/search load full result sets

## 4. Not verified in the browser

Signed-in screens — **orders list, order detail (live tracking), account tabs, checkout, gateway, confirmation** — could not be opened in the browser because logging in sends a real OTP to a real phone number through the running backend, which is not an action to take unprompted. They were verified by code review, type-check and production build only. To visually verify them, log in on `http://localhost:3000/auth` and say so; the same measurement sweep can then be run over those routes.
