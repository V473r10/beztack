# lncd doubtful areas: domain coupling

Research for [#43](https://github.com/V473r10/beztack/issues/43), part of map [#37](https://github.com/V473r10/beztack/issues/37).

Source: lncd checkout `w-Beztack/lncd` at `822c038` (2026-09-29). Beztack `origin/main` at `e3016d0` has none of these four areas (no `push`, `sms`, `upload`, `maps` or `phone-verification` code, no `web-push`, `@aws-sdk/client-sns`, `uploadthing` or `maplibre-gl` dependency), and `.beztack/origin.json` tracks none of their files. Every file below is lncd-only, so the A/B/C classification is effectively "A after extraction" or "B".

Domain terms searched: orders, menu, menu-board, delivery, rider, storefront, customers, addresses.

## 1. Push notifications / PWA

What it does: Web Push over VAPID. Browser side registers a scoped service worker, asks permission, subscribes and POSTs the subscription to the API. Server side stores subscriptions and fans a payload out with `web-push`, deleting endpoints that answer 404/410.

| File | Role | Domain references |
|---|---|---|
| `apps/ui/public/customer-sw.js` | SW: `push` → `showNotification`, `notificationclick` → focus/open `data.url` | Comments only ("delivery Order", scoped to `/m/` storefront). Code is generic; fallback title hardcoded `"Beztack"`. |
| `apps/ui/public/rider-sw.js` (out of scope list, same shape) | Rider copy of the same SW | Near-duplicate of `customer-sw.js`; only scope differs. |
| `apps/ui/public/manifest.webmanifest` | PWA manifest | Fully rider: `"name": "Beztack Rider"`, `start_url: /rider`, `scope: /rider/`. Not linked from `apps/ui/index.html` or any `src` file (grep for `manifest` finds nothing). |
| `apps/ui/src/lib/pwa/vapid-key.ts` | base64url → `Uint8Array` for `applicationServerKey` | None. Pure utility. |
| `apps/ui/src/lib/pwa/register-customer-sw.ts` | Register SW at scope `/m/`, subscribe, POST `/api/push/subscribe` with `orderId`, localStorage opt-in memory | Heavy: API is `isOrderPushSupported`, `ensureOrderPushSubscription(orderId)`, `removeOrderPushSubscription(orderId)`, type `OrderPushResult`, storage key `beztack:order-push:<orderId>`, scope `/m/` (storefront). The mechanics (support check, register, permission, subscribe, failure reasons `denied/failed/unconfigured/unsupported`) are generic. |
| `apps/ui/src/lib/pwa/register-rider-sw.ts` (out of scope list) | Same for `/rider/`, account-wide | Rider naming and scope only. |
| `apps/api/server/utils/push.ts` (out of scope list, the actual transport) | `sendPushToUser`, `sendPushToOrderCustomer`, `sendPushToOrganizationStaff`, 404/410 cleanup | `sendPushToUser` and `sendToSubscriptions` are generic. `sendPushToOrderCustomer` keys on `orderId`. `sendPushToOrganizationStaff` is generic in code (members with role `owner/admin/member`) but its comment justifies it by delivery recovery / Rider. |
| `apps/api/server/routes/api/push/subscribe.post.ts`, `unsubscribe.delete.ts` | Store / delete subscription by `endpoint` | Optional `orderId` branch authorized by `assertMayManageOrderPush` (`utils/order-push-access.ts`); the no-`orderId` branch is plain `requireAuth` and generic. |
| `packages/db/src/schema.ts:1140` `pushSubscription` | Table `push_subscription` | Column `order_id` FK → `order.id`; otherwise `user_id`, `endpoint` (unique), `p256dh`, `auth`, `user_agent`. |
| `apps/api/server/utils/customer-notifications.ts` | Decides what a delivery customer hears per Order/Delivery transition; push first, email fallback via `@beztack/email` | Entirely domain: imports `order`, `DeliveryState` (`order-lifecycle`), `OrderStatus`/`OrderPaymentStatus` (`order-events`); `resolveCustomerNotification` switches on order statuses (`accepted`, `in_progress`, `ready`, `delivered`, `rejected`, `cancelled`) and delivery states (`en_route`, `failed`, …); Spanish copy ("Tu pedido #N…", "repartidor", "restaurante"); URL `/m/<orgSlug>/delivery/order/<orderId>`; skips non-`delivery` `fulfillmentType`; payment sentences keyed on `pay_now`. The only generic bits are the "push, then email if push reached nobody" fallback pattern, `escapeHtml`, and fire-and-forget dispatch. |

Callers of the transport: `utils/order-lifecycle.ts:1917,1927` (rider), `utils/lifecycle-transition.ts:137,144` (staff, rider), `customer-notifications.ts` (customer).

Providers hardcoded: none external beyond the Web Push standard. `web-push` npm (`apps/api/package.json`), keys from env `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`packages/env/src/api.ts:90-93`) and `VITE_VAPID_PUBLIC_KEY` (`packages/env/src/ui.ts:33`). Unset keys make every send a silent no-op.

Recommendation: **generic after extracting an adapter.** Port a user-scoped push module (`vapid-key.ts`, one parameterized SW, `sendPushToUser`/`sendToSubscriptions`, subscribe/unsubscribe without `orderId`, `push_subscription` without `order_id`) and let a derived project attach its own "subscription owner" (lncd's `order_id`). `customer-notifications.ts`, `manifest.webmanifest` and the order/rider registration wrappers are lncd-specific.

## 2. Phone verification + `packages/sms`

What it does: a signed-in Consumer submits an E.164 phone, the API sends a 6-digit code by SMS, stores only an HMAC of it with expiry, and a check route marks the phone verified. lncd uses the verified flag to gate cash on delivery.

| File | Role | Domain references |
|---|---|---|
| `packages/sms/src/index.ts` (+ `package.json`, "AWS SNS SMS sender for Beztack") | `SmsSender` interface (`sendSms`), `createAwsSnsSmsSender(config)`, E.164 assertion, injectable `client` for tests | None. |
| `apps/api/server/utils/phone-verify.ts` | Code generation (`randomInt`), HMAC-SHA256 with `PHONE_VERIFICATION_CODE_SECRET` falling back to `BETTER_AUTH_SECRET`, `timingSafeEqual`, TTL, SMS send; dev fallback code `000000` when SNS unset outside production | None. Message text uses `env.APP_NAME`, English. |
| `apps/api/server/routes/api/phone-verification/start.post.ts`, `check.post.ts`, `status.get.ts` | Rate limits (60 s resend cooldown, 8 attempts, `PHONE_VERIFICATION_MAX_CHECK_ATTEMPTS`), upsert of the verification row | No order/menu/delivery terms, but all three call `requireConsumerAuth` (`utils/membership.ts:244`), which 403s unless the user has lncd's `consumer` role (`utils/auth-roles.ts`). The E.164 error example is Uruguayan (`+59899...`). `MAX_DAILY_ATTEMPTS` is named daily but never resets by date (counter only resets on phone change). |
| `packages/db/src/schema.ts:840` `userPhoneVerification` | Table `user_phone_verification` keyed by `user_id` | None (column `provider_sid` is SNS MessageId). |
| `apps/ui/src/features/customer/hooks/use-phone-verification.ts` | React Query hooks for status/start/check | None in code; lives under `features/customer/`. |
| `apps/ui/src/app/account/phone-verify.tsx` (out of scope list) | Page at account `phone-verify` route (`app.tsx:158`) | None; Spanish fallbacks via i18n. |
| Consumer of the flag | `apps/api/server/utils/order-lifecycle.ts:738-748` (cash on delivery requires verified phone), `features/delivery/checkout/delivery-checkout-model.ts:51,427` (`phone_verification_required`) | Domain, but it is the caller, not the module. |

Providers hardcoded: AWS SNS (`@aws-sdk/client-sns`, `PublishCommand`, SNS message attributes `SMSType`/`SenderID`/`OriginationNumber`/`MaxPrice`). `phone-verify.ts` constructs `createAwsSnsSmsSender` directly from env `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SNS_SMS_*` (`packages/env/src/api.ts:95-101`). The `SmsSender` type already exists as the seam, but nothing selects among implementations. Note that `customer-notifications.ts` deliberately does not use SMS.

Recommendation: **generic after extracting an adapter.** `packages/sms` is already provider-shaped (interface + one SNS implementation); `phone-verify.ts` and the three routes are generic once they take an `SmsSender` instead of building SNS inline and use `requireAuth` (or a configurable guard) instead of the lncd `consumer` role. The cash-on-delivery gate stays in lncd.

## 3. Uploads

What it does: image upload/delete for menu product images via UploadThing.

| File | Role | Domain references |
|---|---|---|
| `apps/api/server/routes/api/upload.post.ts` | Reads multipart field `file`, `UTApi().uploadFiles`, returns `{ imageKey, imageUrl }`; default MIME `image/png` | None in code. **No authentication**: no `requireAuth`, and `apps/api/server/` has no `middleware/` dir (plugins: `cors.ts` only). The `method !== "POST"` check is redundant with the `.post.ts` suffix. No size or type limit. |
| `apps/api/server/routes/api/upload.delete.ts` | `UTApi().deleteFiles([imageKey])` | None in code. **Also unauthenticated**: anyone with a key can delete any file in the UploadThing app. |
| `apps/api/server/routes/api/uploadthing/_router.ts`, `index.ts` | UploadThing file router `productImageUploader` (4 MB, 1 image, session required) | Name `productImageUploader` (menu product). This path does authenticate, but no UI calls it (last commit on the upload routes: "Clean unused uploadthing code"; no `@uploadthing/*` package in `apps/ui`). |
| Callers | `apps/ui/src/app/private/menu/product-form.tsx:86,422,435`; `image_key` columns at `packages/db/src/schema.ts:292,519` (menu products); read by `server/modules/menu/*`, `utils/menu.ts`, `storefronts.get.ts`, public menu / board screens | All menu/storefront; they consume `imageKey`/`imageUrl`, the routes do not know about them. |

Providers hardcoded: UploadThing (`uploadthing` ^7, `UTApi`), env `UPLOADTHING_TOKEN` required (`z.string().min(1)`, `packages/env/src/api.ts:112`), so the API does not boot without it.

Recommendation: **generic after extracting an adapter**, but the code itself is not worth porting as-is. The only reusable idea is a thin "store file → `{ key, url }` / delete by key" route behind a storage interface; lncd's version has no auth on the live routes, no limits, and a dead authenticated router. Treat it as a design to rewrite, not files to copy.

## 4. Maps

What it does: MapLibre map component with markers/controls, a tile style config, a browser geolocation hook, and a reverse-geocoding proxy used by the address picker.

| File | Role | Domain references |
|---|---|---|
| `apps/ui/src/components/ui/map.tsx` (541 lines) | shadcn-style MapLibre wrapper: `Map`, `useMap`, `MapMarker`, `MarkerContent`, `MapControls` (zoom, locate, fullscreen), light/dark theme follow | None (grep for order/delivery/rider/customer/address/menu: 0 hits). Appears to be the mapcn registry component. |
| `apps/ui/src/lib/maps/mapcn.ts` | Style URLs, `LngLat`, `DEFAULT_CENTER`, `DEFAULT_ZOOM = 14` | No domain terms, but `DEFAULT_CENTER` is Montevideo (`-56.1645, -34.9011`). `VITE_MAPCN_TILES_URL` overrides both light and dark with the same URL, so setting it loses dark mode. |
| `apps/ui/src/lib/maps/reverse-geocode.ts` | Client for `/api/maps/reverse-geocode` with `AbortSignal` | Comment only ("checkout", "customer drags the pin", issue #71). Code generic. |
| `apps/api/server/routes/api/maps/reverse-geocode.get.ts` | Auth'd (`requireAuth`) proxy to Nominatim, maps result to `{ displayName, line1, line2, city, country }` | None in code; the output shape is address-oriented but generic. `Accept-Language: es,en;q=0.8` hardcoded. No caching or rate limiting (Nominatim usage policy allows ~1 req/s). |
| `apps/ui/src/hooks/use-geolocation.ts` | Opt-in `getCurrentPosition` with typed status/error | Doc comment only ("Delivery checkout", "Address resolver"). Code generic; `watchIdRef` is never assigned, so its cleanup is dead code. |
| Callers | `app/account/addresses/address-form.tsx`, `features/customer/components/address-map-picker.tsx`, `features/delivery/components/delivery-tracking-map.tsx`, `features/delivery/checkout/use-delivery-checkout.ts` | All customer addresses / delivery. These stay in lncd. |

Providers hardcoded: map tiles CARTO basemaps (`basemaps.cartocdn.com` positron / dark-matter styles) as fallback, overridable by `VITE_MAPCN_TILES_URL`; renderer `maplibre-gl` ^5.24; geocoder OpenStreetMap Nominatim public endpoint (`https://nominatim.openstreetmap.org/reverse`), not configurable. `MAPCN_TILES_URL` in the API env (`packages/env/src/api.ts:109`) is declared but unused by the API.

Recommendation: **generic module worth porting** for `map.tsx`, `use-geolocation.ts` and `reverse-geocode.ts` (drop the Montevideo default center, split light/dark overrides); the Nominatim route is **generic after extracting an adapter** (geocoder URL/provider and language as configuration). Address pickers and tracking maps are lncd-specific.

## Could not determine

- Whether `map.tsx` is byte-identical to the current mapcn registry release (not fetched).
- Whether the unauthenticated `/api/upload` routes are exploitable in lncd's deployment (e.g. blocked by a proxy); nothing in the repo protects them.
- Whether `manifest.webmanifest` is served/linked by some path outside `apps/ui/index.html` and `apps/ui/src` (none found).

## One line per area

- Push/PWA: generic after extracting an adapter (user-scoped push transport + SW; order/rider/customer notification copy stays in lncd).
- Phone verification + `packages/sms`: generic after extracting an adapter (`SmsSender` seam exists; decouple from SNS construction and the `consumer` role).
- Uploads: generic after extracting an adapter, rewritten rather than copied (current routes are unauthenticated UploadThing calls).
- Maps: generic module worth porting (component, geolocation hook, geocode client); geocoder route after extracting a provider adapter.
