# CUSTOMER_RESPONSIVE_AUDIT.md — Responsive and layout audit

Target range taken from the prototype's own device matrix: **320 × 568 → 640 × 860**.

Reference widths used throughout:
`320` (iPhone SE) · `360` (Galaxy S24 / Pixel 8a) · `390` (iPhone 15) · `412` (Pixel 8 Pro) · `430` (15 Pro Max) · `600`/`640` (tablet).

---

## 1. Defects found

| # | Screen / component | Defect | Repro | Severity |
|---|---|---|---|---|
| R1 | `categories/index.tsx` | Sub-tile is `width:'22%'` but the thumbnail inside is a **fixed 66 × 66**. At 320 px: `(320 − 32) × 0.22 = 63.4 px < 66` → the image overflows its tile and the 4-column row breaks. | Categories on iPhone SE / any 320 px device | **High** |
| R2 | `home/index.tsx` | Product grid is `flexDirection:row, flexWrap, gap:12` with items at `flexBasis:'48%'`. `48 + 48 = 96 %` plus a 12 px gap exceeds 100 % of the 358 px content box → the second column wraps to its own row on narrow devices. | Home sections at ≤ 360 px | **High** |
| R3 | `home/index.tsx` | `styles.sectionTitle` carries `marginBottom: 12` **and** sits inside `sectionHeader` which also has `marginBottom: 12` → 24 px under the "Curated for you" heading only. Inconsistent rhythm. | Home | Low |
| R4 | `ProductCard.tsx` | Image is a **fixed `height: 118`** inside a flexible card. On a 320 px screen the card is ~140 px wide → the image is 118 tall (near-square); on a 640 px tablet the card is ~300 px wide but the image stays 118 → badly letterboxed. Design specifies `aspect-ratio: 1/1`. | Any grid, tablet especially | **High** |
| R5 | `ProductCard.tsx` | `nameFlex` has `flex:1` but no `minWidth:0`; a long unbroken product name can push the rating pill off the card. | Long product names | Medium |
| R6 | `categories/CategoryProducts.tsx` | Grid items are `flexBasis:'47%'` **and** `maxWidth:'48.5%'` inside a container that is already narrowed by a 92 px sidebar. At 320 px the main column is ~206 px → each card is ~97 px wide, below the 38 px add button + price line comfortably fitting. | Category grid at 320 px | Medium |
| R7 | `categories/CategoryProducts.tsx` | Sidebar is a **hard `width: 92`** — 29 % of a 320 px screen, and only 14 % of a 640 px tablet. Design uses 94 px on a 390 px frame (24 %). | 320 px and tablet | Medium |
| R8 | `onboarding/Onboarding.tsx` | Carousel is a **fixed `height: 320`** and its page width is computed once from `Dimensions.get('window')` at module scope. Does not react to rotation or split-screen, and on a 568 px-tall device the 320 px carousel + text + button overflows. Design uses a flex-filling area anchored 96 px above the bottom. | iPhone SE, rotation | **High** |
| R9 | `Splash/index.tsx` | `logo` is `width:120, height:120` inside a 120 px box — fine, but `wordmark` at 34 px plus three text lines with `gap:12` has no `maxWidth`, so a long tagline can wrap awkwardly at 320 px. | 320 px | Low |
| R10 | `orders/Tracking.tsx` | `mapBox` is a **fixed `height: 160`**; the design's map is 210 px and the sheet below it flexes. | All | Low |
| R11 | `wallet/index.tsx` | `customWrap` has `maxWidth: 200` — at 320 px that is 62 % of the content width; acceptable, but the `chipRow` (3 chips + Custom) with `paddingHorizontal:15` overflows to two rows below 360 px. Design accepts wrapping (`flexWrap` present) — verify visually. | 320 px | Low |
| R12 | `AppBottomNav.tsx` | Bar is full-width with `justifyContent:'space-between'` and the cart slot uses `flex:1` + `marginTop:-20`, so the FAB's 62 px glow can collide with adjacent labels at 320 px. Design solves this with a **mask notch** and no labels. | 320 px | Medium |

**RESPONSIVE ISSUES FOUND: 12.**

---

## 2. Checks that already pass

| Check | Status | Evidence |
|---|---|---|
| Safe-area handling | Pass | `ScreenContainer` wraps every screen in `SafeAreaView` with per-screen `edges`; `AppBottomNav` uses `useSafeAreaInsets().bottom`. |
| Keyboard avoidance | Pass | `KeyboardAvoidingView` on EnterMobile, ProfileSetup, AddAddress; `keyboardShouldPersistTaps="handled"` on the scrollers. |
| Status bar | Pass | `edges={['top']}` on tab screens; translucent status bar configured in `AndroidManifest.xml`. |
| Horizontal overflow from rails | Pass | All rails are `<ScrollView horizontal>`. |
| Long addresses | Pass | Address lines wrap with `lineHeight`; no fixed heights. |
| Long ticket subjects | Pass | `numberOfLines={1}`. |
| Long product names | Pass on card (`numberOfLines={2}`), at risk on the rating row (R5). |
| Scroll behaviour | Pass | Every long screen is a `ScrollView` with `contentContainerStyle` padding. |
| List performance | Acceptable | `@shopify/flash-list` available; current lists are short (≤ 80 items) and use `ScrollView` + `.map`. Not a defect at current data volumes. |
| Image distortion | Mostly pass | `resizeMode` set everywhere; R4 is the exception. |
| Hardcoded 390 / 844 | Pass | No occurrence of `width: 390` or `height: 844` in `src/`. |

---

## 3. Rules applied when fixing

1. **No fixed pixel widths on flexible children.** Percentage or `flex`, with `minWidth: 0` wherever a sibling must stay visible.
2. **Square media uses `aspectRatio: 1`,** never a fixed height.
3. **Two-column grids** use `width: '48%'` with `justifyContent:'space-between'` (no `gap` double-count), or a `gap`-aware basis of `'47%'` — never `48% + gap`.
4. **Rails** keep `paddingHorizontal` on the content container so cards bleed to the edge, matching the design's negative margins.
5. **`useWindowDimensions()`** where a layout genuinely depends on width (onboarding carousel), so rotation and split-screen are handled — never module-scope `Dimensions.get`.
6. **Sheets** cap at a percentage of screen height with an internal scroll view.
7. **Sticky bottom bars** respect `useSafeAreaInsets().bottom`.
8. **Sidebar widths** scale within a clamp rather than being a hard constant.
