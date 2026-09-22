# selorg-customer-app

React Native CLI customer app for Selorg. Architecture (navigation, auth flow, contexts,
screens) ported from the reference `ecommerce_rn_app` project — UI/branding is a placeholder
pending redesign.

## Setup TODO

The following still need to be supplied before the corresponding features work — everything
else (native project, dependencies, navigation, screens) is already wired up and builds/runs.

- **Firebase (push notifications)**: create a Firebase project for `com.selorg.customer`,
  download `google-services.json` into `android/app/`, uncomment the
  `apply plugin: "com.google.gms.google-services"` line in `android/app/build.gradle`
  (and the matching `classpath` in the root `android/build.gradle` is already in place),
  and download `GoogleService-Info.plist` into `ios/`. Until then, push registration
  silently no-ops (see `src/services/pushNotifications.ts`).
- **Google Maps**: get a real Maps API key restricted to `com.selorg.customer` (Android
  package name + SHA-1, iOS bundle ID) and:
  - replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` in `android/app/src/main/AndroidManifest.xml`
  - replace `YOUR_GOOGLE_MAPS_API_KEY_HERE` in `ios/Selorg/AppDelegate.swift`
  - set `GOOGLE_MAPS_API_KEY` in `.env` (used by `ProductDetail.tsx` / `AddAddress.tsx`
    for pincode geocoding and place autocomplete)
- **Razorpay**: supply a real key where the app currently expects one from
  `apiService.getRazorpayKey()` / your backend config.
- **Android release signing**: generate a release keystore and fill in the
  `SELORG_RELEASE_STORE_FILE` / `SELORG_RELEASE_STORE_PASSWORD` /
  `SELORG_RELEASE_KEY_ALIAS` / `SELORG_RELEASE_KEY_PASSWORD` values in
  `android/gradle.properties`, then switch `android/app/build.gradle`'s
  `buildTypes.release.signingConfig` from `signingConfigs.debug` to `signingConfigs.release`.
- **API backend**: `.env` currently points at `http://localhost:4000/api` (dev) and a
  placeholder `https://api.selorg.in/api` (prod) — update to wherever the real backend is
  reachable when ready to wire it up.

## Running locally

```
npm install
cd ios && pod install && cd ..
npm run ios      # or: npm run android
```
