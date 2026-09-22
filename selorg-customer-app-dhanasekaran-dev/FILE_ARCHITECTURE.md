# selorg-customer-app — File Architecture

React Native 0.83.1 · TypeScript · Package ID: `com.selorg.com`

> Excludes: `node_modules/`, build artifacts (`android/build/`, `android/app/build/`, `android/app/.cxx/`, `ios/build/`, `ios/Pods/`)

---

## Root

```
selorg-customer-app/
├── App.tsx
├── index.js
├── app.json
├── package.json
├── package-lock.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
├── react-native.config.js
├── jest.config.js
├── jest.setup.js
├── .eslintrc.js
├── .prettierrc.js
├── .watchmanconfig
├── .gitignore
├── .env
├── .env.example
├── Gemfile
├── Gemfile.lock
├── README.md
├── FILE_ARCHITECTURE.md
│
├── .bundle/
│   └── config
├── .vscode/
│   └── settings.json
├── scripts/
│   └── run-android.js
├── __tests__/
│   └── App.test.tsx
├── docs/
│   ├── api-integration.md
│   └── selorg-ui-review.md
├── assets/
├── src/
├── android/
└── ios/
```

---

## `src/` — Application Source

```
src/
├── api/
│   ├── configs.ts
│   ├── index.ts
│   └── storage.ts
│
├── components/
│   ├── AppBottomNav.tsx
│   ├── BackButton.tsx
│   ├── BillSummaryCard.tsx
│   ├── BottomSheet.tsx
│   ├── BrandSvg.tsx
│   ├── CancelOrderSheet.tsx
│   ├── CleanBadges.tsx
│   ├── Header.tsx
│   ├── Icon.tsx
│   ├── InAppNotificationBanner.tsx
│   ├── OrderTimeline.tsx
│   ├── OtpBoxInput.tsx
│   ├── PasswordField.tsx
│   ├── PasswordRules.tsx
│   ├── PrimaryButton.tsx
│   ├── ProductCard.tsx
│   ├── QuantityStepper.tsx
│   ├── ScreenContainer.tsx
│   ├── SearchBar.tsx
│   ├── Spinner.tsx
│   ├── StateView.tsx
│   ├── StatusPill.tsx
│   ├── ToastHost.tsx
│   ├── WorldlineCheckoutWebView.tsx
│   └── index.ts
│
├── config/
│   └── api.ts
│
├── context/
│   ├── AddressContext.tsx
│   ├── AppProviders.tsx
│   ├── AuthContext.tsx
│   ├── CartContext.tsx
│   ├── NotificationsContext.tsx
│   ├── OrdersContext.tsx
│   ├── RefundsContext.tsx
│   ├── SupportContext.tsx
│   ├── WalletContext.tsx
│   └── WishlistContext.tsx
│
├── lib/
│   ├── localCache.ts
│   └── storage.ts
│
├── navigation/
│   ├── MainTabNavigator.tsx
│   ├── RootNavigator.tsx
│   ├── routes.ts
│   └── types.ts
│
├── screens/
│   ├── Splash/
│   │   └── index.tsx
│   ├── onboarding/
│   │   └── Onboarding.tsx
│   ├── auth/
│   │   ├── AuthSuccess.tsx
│   │   ├── CreatePassword.tsx
│   │   ├── EnterMobile.tsx
│   │   ├── Forgot.tsx
│   │   ├── LoginPassword.tsx
│   │   ├── otp.tsx
│   │   ├── ProfileSetup.tsx
│   │   ├── ResetPassword.tsx
│   │   └── Welcome.tsx
│   ├── location/
│   │   └── LocationPermission.tsx
│   ├── home/
│   │   ├── index.tsx
│   │   └── Search.tsx
│   ├── categories/
│   │   ├── CategoryProducts.tsx
│   │   ├── Collection.tsx
│   │   ├── SortFilterSheet.tsx
│   │   └── index.tsx
│   ├── product/
│   │   ├── ProductDetail.tsx
│   │   ├── Reviews.tsx
│   │   └── WriteReview.tsx
│   ├── cart/
│   │   ├── cart.tsx
│   │   └── checkout.tsx
│   ├── orders/
│   │   ├── Invoice.tsx
│   │   ├── OrderDetail.tsx
│   │   ├── OrderPlaced.tsx
│   │   ├── PaymentScreen.tsx
│   │   ├── RateOrder.tsx
│   │   ├── RatingSuccess.tsx
│   │   ├── Tracking.tsx
│   │   └── index.tsx
│   ├── refunds/
│   │   ├── RefundDetail.tsx
│   │   ├── ReturnRequest.tsx
│   │   └── index.tsx
│   ├── wallet/
│   │   └── index.tsx
│   ├── profile/
│   │   ├── AddAddress.tsx
│   │   ├── TicketDetail.tsx
│   │   ├── addresses.tsx
│   │   ├── helpSupport.tsx
│   │   ├── index.tsx
│   │   ├── notification.tsx
│   │   ├── policy.tsx
│   │   ├── profileDetails.tsx
│   │   ├── settings.tsx
│   │   └── yourWishlist.tsx
│   └── common/
│       └── NoInternet.tsx
│
├── services/
│   ├── address.service.ts
│   ├── app-config.service.ts
│   ├── auth.service.ts
│   ├── bootstrap.service.ts
│   ├── cart.service.ts
│   ├── catalog.service.ts
│   ├── coupons.service.ts
│   ├── delivery.service.ts
│   ├── legal.service.ts
│   ├── location.service.ts
│   ├── locations-api.service.ts
│   ├── notifications.service.ts
│   ├── orders.service.ts
│   ├── payments.service.ts
│   ├── push.service.ts
│   ├── pushNotifications.ts
│   ├── refunds.service.ts
│   ├── store.service.ts
│   ├── support.service.ts
│   ├── wallet.service.ts
│   ├── index.ts
│   └── mockData/
│       ├── addresses.ts
│       ├── async.ts
│       ├── categories.ts
│       ├── index.ts
│       ├── notifications.ts
│       ├── orders.ts
│       ├── products.ts
│       ├── refunds.ts
│       ├── tickets.ts
│       ├── types.ts
│       └── wallet.ts
│
├── theme/
│   ├── colors.ts
│   ├── images.ts
│   ├── index.ts
│   ├── radii.ts
│   ├── shadows.ts
│   ├── spacing.ts
│   └── typography.ts
│
├── types/
│   └── env.d.ts
│
└── utils/
    ├── apiError.ts
    ├── apiResponse.ts
    ├── catalogMappers.ts
    ├── currency.ts
    ├── discounts.ts
    ├── emitter.ts
    ├── format.ts
    ├── mappers.ts
    ├── navigationRef.ts
    ├── notifDedup.ts
    ├── orderTaxDiscounts.ts
    ├── paynimoCheckout.ts
    ├── platform.ts
    ├── toast.ts
    └── worldline.ts
```

---

## `assets/` — Static Assets

```
assets/
├── fonts/
│   ├── OFL.txt
│   ├── Poppins-Bold.ttf
│   ├── Poppins-Medium.ttf
│   ├── Poppins-Regular.ttf
│   └── Poppins-SemiBold.ttf
│
├── images/
│   ├── app-logo.png
│   ├── banner.png
│   ├── deal-banner.png
│   ├── empty-cart.png
│   ├── lifestyle-header.png
│   ├── onboard-1.png
│   ├── onboard-2.png
│   ├── onboard-3.png
│   ├── organic-tagline.png
│   ├── rider.png
│   ├── selorg-logo.svg
│   ├── splash-logo.svg
│   ├── success-bg.svg
│   ├── tiny-tummies.png
│   ├── wellbeing.png
│   └── cat/
│       ├── atta-rice-dal.png
│       ├── dairy-bread-eggs.png
│       ├── dry-fruits-seeds.png
│       ├── fresh-fruits.png
│       ├── fresh-vegetables.png
│       ├── masalas-spices.png
│       ├── oil-ghee.png
│       ├── salt-sugar-jaggery.png
│       ├── sauces-spreads.png
│       ├── tea-coffee.png
│       └── vermicelli-noodles.png
│
└── sounds/
    ├── orderplaced.mp3
    ├── push.mp3
    └── welcome.mp3
```

---

## `android/` — Native Android

```
android/
├── build.gradle
├── settings.gradle
├── gradle.properties
├── gradlew
├── gradlew.bat
├── gradle/
│   └── wrapper/
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
│
└── app/
    ├── build.gradle
    ├── proguard-rules.pro
    ├── debug.keystore
    ├── google-services.json
    ├── selorg-customer-app-keystore.jks
    │
    └── src/main/
        ├── AndroidManifest.xml
        ├── ic_launcher-playstore.png
        │
        ├── java/com/selorg/com/
        │   ├── MainActivity.kt
        │   └── MainApplication.kt
        │
        ├── assets/
        │   ├── index.android.bundle
        │   └── fonts/
        │       ├── Poppins-Bold.ttf
        │       ├── Poppins-Medium.ttf
        │       ├── Poppins-Regular.ttf
        │       └── Poppins-SemiBold.ttf
        │
        └── res/
            ├── drawable/
            │   └── rn_edit_text_material.xml
            ├── drawable-mdpi/          # bundled image assets + nav icons
            ├── drawable-xhdpi/         # React Navigation icons
            ├── drawable-xxhdpi/
            ├── drawable-xxxhdpi/
            ├── mipmap-anydpi-v26/
            │   ├── ic_launcher.xml
            │   └── ic_launcher_round.xml
            ├── mipmap-hdpi/
            ├── mipmap-mdpi/
            ├── mipmap-xhdpi/
            ├── mipmap-xxhdpi/
            ├── mipmap-xxxhdpi/         # ic_launcher*.webp per density
            ├── raw/
            │   ├── keep.xml
            │   ├── orderplaced.mp3
            │   ├── push.mp3
            │   └── welcome.mp3
            ├── values/
            │   ├── ic_launcher_background.xml
            │   ├── strings.xml
            │   └── styles.xml
            └── xml/
                └── network_security_config.xml
```

---

## `ios/` — Native iOS

```
ios/
├── Podfile
├── Podfile.lock
├── .xcode.env
│
├── Selorg.xcodeproj/
│   ├── project.pbxproj
│   └── xcshareddata/xcschemes/
│       └── Selorg.xcscheme
│
├── Selorg.xcworkspace/
│   └── contents.xcworkspacedata
│
└── Selorg/
    ├── AppDelegate.swift
    ├── Info.plist
    ├── GoogleService-Info.plist
    ├── PrivacyInfo.xcprivacy
    ├── LaunchScreen.storyboard
    └── Images.xcassets/
        ├── Contents.json
        └── AppIcon.appiconset/
            └── Contents.json
```

---

## Layer Map

```
index.js
  └── App.tsx
        └── src/context/AppProviders.tsx
              └── src/navigation/RootNavigator.tsx
                    ├── src/navigation/MainTabNavigator.tsx
                    └── src/screens/**

src/screens/        → UI screens (feature folders)
src/components/     → Shared UI components
src/context/        → Global state (React Context)
src/services/       → API & business logic
src/api/            → HTTP client & token storage
src/utils/          → Helpers (formatting, payments, mappers)
src/theme/          → Design tokens
src/navigation/     → Route definitions & navigators
assets/             → Fonts, images, sounds
android/ · ios/     → Native platform projects
```
