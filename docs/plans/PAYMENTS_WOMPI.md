# Feature Plan — Payments via Wompi (in-app checkout)

**Status:** Draft for review
**Date:** 2026-09-17
**Decisions locked:** in-app checkout at order time; processor = Wompi (Bancolombia).

---

## 0. Linear context

Project: **[Pasarela de Pagos](https://linear.app/al-gramo/project/pasarela-de-pagos-95d29ca2208d)** (team _Al Gramo._, status Backlog).

| Issue  | Title                                                         | Status      | Bearing on this plan                                                                                                                                                                                                                            |
| ------ | ------------------------------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AL-32  | Investigación pasarela de pagos → became project              | Done        | Candidates were Mercado Pago / PayU / ePayco / Wompi. Dev preference was Mercado Pago; **Wompi won on financial terms.**                                                                                                                        |
| AL-36  | Crear cuenta en pasarela seleccionada                         | Done        | **Wompi account already exists** — keys should be obtainable now.                                                                                                                                                                               |
| AL-33  | Cómo queremos que se vea el método de pagos                   | In Review   | **The UX spec.** Three mockups; drives §3 below.                                                                                                                                                                                                |
| AL-45  | Estimación de costos — uso y ajuste                           | Done        | Deliverable was _"la valoración de la herramienta… de ser positivo, se puede llegar a un modelo predictivo implementable al proceso regular de checkout"_. **It closed Done — so promoting the estimator into checkout is already sanctioned.** |
| AL-34  | Costo domicilio — estimación                                  | In Progress | Delivery cost work, still open.                                                                                                                                                                                                                 |
| AL-52  | Integración del costo de domicilio: ¿Yango o geolocalización? | Todo        | Unresolved: whether to keep the in-house model or call a courier API.                                                                                                                                                                           |
| ENG-13 | Actualizar ajuste redondeo de costo                           | **Blocked** | Rounding delta (±50 COP/order) is never persisted. See §2.3.                                                                                                                                                                                    |
| AL-55  | Journey para estudiantes                                      | Backlog     | Due 2026-09-28. Adds **pago en sede** (pay on-site) + next-day pickup — a second, non-Wompi payment path.                                                                                                                                       |

### What the AL-33 mockups actually specify

1. **Checkout summary** — line items, then `Subtotal`, **`Costo de envío`**, **`Tarifa de servicio`**, then `TOTAL`, with a `Pagar ahora - $X` CTA. A coupon field sits directly above the summary.
2. **Wompi hosted checkout** — screenshot is Wompi's own page in `MODO DE PRUEBAS` (sandbox), offering: card (Visa/Mastercard/Amex), **Nequi**, **DaviPlata**, **QR Interoperable**, **Transferencia Bancolombia**, **PSE**. This confirms the redirect/widget approach rather than a bespoke form.
3. **Confirmation screen** — `PEDIDO CONFIRMADO`, order number in the form **`AG-4970`**, `Estado: En preparación`, `Tiempo estimado: 25 – 35 min`.

Three things there are new requirements, not restatements:

- **`Tarifa de servicio` is a line item.** There is no service-fee concept anywhere in the codebase today. It needs a source (fixed COP? percentage?) — see §7.
- **Order numbers are displayed as `AG-####`,** not the raw autoincrement `Order.id`. Needs a display formatter, and a decision on whether the number shown is the checkout or an order.
- **The confirmation screen shows a prep-time estimate** (`25–35 min`). Nothing computes that today.

---

## 1. What exists today

| Piece                  | Where                                             | Notes                                                                           |
| ---------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------- |
| Price calculation      | `backend/src/lib/nutrition.ts`                    | Server-side authority. Packaging base + Σ `pricePerG` × g, rounded to 100 COP.  |
| Price mirror (client)  | `frontend/src/lib/utils/bowl.ts`                  | Must stay in lockstep with the server.                                          |
| Order creation         | `backend/src/handlers/orders.ts` (`POST`)         | Creates **one** order = **one** bowl.                                           |
| Cart submission        | `frontend/src/lib/components/Delivery.svelte:126` | `Promise.allSettled(requests.map(createOrder))` — N bowls ⇒ N orders.           |
| Delivery cost estimate | `backend/src/handlers/delivery.ts`                | Exists, but marked _"Admin/ops only. Customer checkout is unchanged."_          |
| Payment                | —                                                 | None. Today: WhatsApp confirms final price and collects payment (`en.json:45`). |

## 2. Two blockers that must be resolved before any Wompi code

These are not Wompi problems; they are pre-conditions that in-app checkout creates.

### 2.1 A cart of N bowls is N independent orders

`Delivery.svelte:126` fires N `POST /api/orders` calls with `allSettled`, so a 3-bowl cart becomes orders 101/102/103 — and partial failure is a tolerated outcome today. A payment is a single transaction over a single amount, so there must be **one entity the payment attaches to**.

**Recommendation: introduce a `Checkout` aggregate.** One `Checkout` row owns N orders, carries the money fields, and is what Wompi's `reference` points at. This is cleaner than bolting payment fields onto every `Order` and keeps `Order` focused on kitchen/robot concerns.

```prisma
model Checkout {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  user            User     @relation(fields: [userId], references: [id])

  subtotal        Decimal  @db.Decimal(10, 2)   // Σ order totalPrice
  deliveryFee     Decimal  @map("delivery_fee") @db.Decimal(10, 2)
  serviceFee      Decimal  @map("service_fee") @db.Decimal(10, 2)  // "Tarifa de servicio" per AL-33
  discount        Decimal  @default(0) @db.Decimal(10, 2)  // ← coupons land here
  total           Decimal  @db.Decimal(10, 2)   // subtotal + deliveryFee + serviceFee - discount, rounded to 100

  // Displayed as AG-#### on the confirmation screen (AL-33)
  orderNumber     Int      @unique @default(autoincrement()) @map("order_number")

  paymentStatus   String   @default("pending") @db.VarChar(30)
  // pending -> awaiting_payment -> paid | declined | voided | error | expired

  wompiReference  String   @unique @map("wompi_reference") @db.VarChar(64)
  wompiTxId       String?  @map("wompi_tx_id") @db.VarChar(64)
  paymentMethod   String?  @map("payment_method") @db.VarChar(30)
  paidAt          DateTime? @map("paid_at")

  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  orders          Order[]

  @@index([userId])
  @@index([paymentStatus])
  @@map("checkouts")
}
```

`Order` gains `checkoutId String? @map("checkout_id") @db.Uuid` + relation + index.

**Order lifecycle change — the important one.** Orders must _not_ enter the robot queue until money is confirmed. Today `POST /api/orders` ends with `tryAssignRobot(order.id)`. Under checkout, orders are created in a new `awaiting_payment` status, and `tryAssignRobot` is called **from the webhook handler** on `APPROVED`. Without this, a customer who abandons Wompi's checkout still gets a bowl made.

### 2.2 The delivery fee is an estimate with a confidence tier

Charging at order time means committing to a shipping number before the courier quotes it. `delivery.ts` returns `confidence: high | good | medium | low` derived from the geocode match tier, and the model is a LOO-CV fit — it will be wrong sometimes.

Options, in order of preference:

1. **Charge the estimate, absorb the delta.** Simplest, best UX. Add a margin to the estimate (e.g. `estimate × 1.15`, or the model's MAE) so most variance lands in your favour. Needs a decision on the margin.
2. **Charge the estimate only when confidence is `high`/`good`;** fall back to the WhatsApp flow for `medium`/`low`. Preserves today's behaviour for hard addresses but means two checkout paths.
3. **Flat fee per zone.** Predictable, ignores the model you just built.

**This needs your decision — it's a pricing/margin call, not an engineering one.** The plan below assumes option 1.

AL-45 closing Done is the green light for using the estimator in checkout — its stated deliverable was exactly that judgement. But **AL-52 is still Todo** ("¿integrar Yango o geolocalización?"), so whether the fee ultimately comes from our fitted model or a courier API is unsettled. Build §4 against a `getDeliveryFee(address)` seam so swapping the source later doesn't touch checkout.

Also required: promote `POST /api/delivery/estimate` from admin-only to a customer-facing endpoint (rate-limited), since checkout now calls it.

**Coupons raise the stakes here, but no longer block.** Product decided 2026-09-21 not to launch with `envío gratis` (`COUPONS.md` §0), so the first campaign won't be one whose budget is drawn down by the delivery estimate. The exposure still exists for whenever a free-shipping campaign _does_ run: campaign budget is decremented by the benefit actually granted, so an estimate that runs high silently over-consumes it. Worth settling AL-52 (Yango vs. in-house model) before that campaign, not before this checkout.

### 2.3 ENG-13 stops being cosmetic once real money moves

ENG-13 (Blocked) records that `roundToNearestCoin` discards the rounding delta — up to ±50 COP per order, never persisted, so the books can't reconcile. Today that's an accounting annoyance. Under in-app checkout the rounded number becomes **the amount actually charged through Wompi**, and coupons add a second rounding step on top. Two further points from that ticket land directly on this work:

- `roundToNearestCoin` is duplicated in `frontend/src/lib/utils/bowl.ts:50` and `backend/src/lib/nutrition.ts:84`. Two copies of the rounding rule, with a hard requirement that client and server agree — move it to `@aristaeus/shared` as part of this work.
- Rounding is applied to the grand total, so per-item prices don't sum to `totalPrice`.

**Recommendation: unblock ENG-13 and land it inside slice 1.** Retrofitting a rounding-audit column after you've taken real payments is materially worse. (The ticket also notes its blocker was never written down — worth resolving that.)

## 3. Wompi integration design

### Why Web Checkout (redirect), not the API

The frontend is `adapter-static` on GitHub Pages — there is no server-side render step, so **the integrity secret can never touch the frontend bundle**. The signature must be produced by a Lambda. Web Checkout also keeps card data entirely off our infrastructure, which drops PCI scope to the minimum (SAQ-A). Direct API integration would mean tokenizing cards ourselves — not worth it here.

### Flow

```
1. Customer fills cart + address
2. FE  → POST /api/checkout            { customer, address, bowls[], includeCutlery }
3.        Lambda: recompute every bowl price server-side (nutrition.ts),
                  call delivery estimate, add service fee, apply coupon,
                  create Checkout + N Orders (status: awaiting_payment),
                  build reference = checkout uuid,
                  sign integrity = SHA256(reference + amountInCents + "COP" + INTEGRITY_SECRET)
4.   ← { checkoutId, amountInCents, reference, signature, publicKey, redirectUrl }
5. FE  → redirects to https://checkout.wompi.co/p/ with those params
6. Customer pays on Wompi
7. Wompi → POST /api/payments/webhook   (transaction.updated)  ← SOURCE OF TRUTH
          verify X-Event-Checksum, mark Checkout paid, tryAssignRobot() per order
8. Wompi → redirects customer to /order/{checkoutId}?id=<tx>  (display only)
```

**Never trust step 8 for state.** Wompi's docs are explicit: the redirect is not a validation method. The webhook is the only thing that flips `paymentStatus` to `paid`.

### Signature details (verified against Wompi docs, Sept 2026)

- **Integrity (outbound):** `SHA256(reference + amountInCents + currency + integritySecret)`. If `expiration-time` is used it is inserted before the secret: `reference + amount + currency + expiration + secret`. The integrity secret is **not** the public or private key — it's a separate value from the dashboard.
- **Checksum (inbound webhook):** concatenate the values at the paths listed in `signature.properties` **in the order given**, then `event.timestamp`, then the **events secret**; `SHA256` it; compare to `X-Event-Checksum`. Wompi warns that `properties` may change over time — read it from the event, never hardcode the field list.
- **Amounts:** `amount-in-cents` = COP × 100. Our `totalPrice` is already rounded to the nearest 100 COP, so cents are always `…00`. Compute the amount as an integer; never send a float.
- **Final statuses:** `APPROVED`, `DECLINED`, `VOIDED`, `ERROR`.

### Idempotency & safety

- `wompiReference` is `@unique` — the checkout uuid, generated once, never reused (Wompi requires non-reusable references).
- The webhook will be delivered more than once. Handler must be idempotent: if `paymentStatus` is already `paid`, verify the tx id matches and return 200 without re-assigning robots.
- Return 200 on any successfully-verified event, even ones we ignore, so Wompi stops retrying. Return 401 only on checksum failure.
- Re-verify the amount in the webhook against `Checkout.total` before marking paid — guards against a tampered reference.
- The webhook Lambda needs **no auth on the API Gateway route** (Wompi can't send our credentials) — the checksum _is_ the authentication. Do not skip it.

## 4. Files to touch

Following the 6-file deployment checklist in `CLAUDE.md` for each new endpoint.

**New endpoints:** `POST /api/checkout`, `POST /api/payments/webhook`, `GET /api/checkout/{id}`

| File                                                  | Change                                                                                                                       |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `backend/prisma/schema.prisma`                        | `Checkout` model; `Order.checkoutId`; `Order.status` allows `awaiting_payment`                                               |
| `backend/prisma/migrations/<ts>_add_checkout/`        | **Required** — `db:push` alone breaks production (see CLAUDE.md)                                                             |
| `backend/src/handlers/checkout.ts`                    | create checkout, sign, return params; get checkout status                                                                    |
| `backend/src/handlers/payments.ts`                    | webhook: verify checksum → mark paid → `tryAssignRobot` per order                                                            |
| `backend/src/lib/wompi.ts`                            | `signIntegrity()`, `verifyEventChecksum()`, status mapping                                                                   |
| `backend/src/lib/pricing.ts`                          | new: cart-level totals (subtotal + fee − discount, round to 100)                                                             |
| `backend/src/handlers/orders.ts`                      | leave orders `pending` until payment clears when part of a checkout                                                          |
| `backend/src/handlers/delivery.ts`                    | expose `estimate` to customers; add margin                                                                                   |
| `backend/src/dev-server.ts`                           | routes for all three; a `/dev/wompi/simulate` to fake webhooks locally                                                       |
| `backend/scripts/build-lambda.sh`                     | local + CI — add `checkout`, `payments` entry points                                                                         |
| `backend/infra/lambda.tf`                             | 3 log groups + 3 functions; env: `WOMPI_PUBLIC_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENTS_SECRET`, `WOMPI_ENV`            |
| `backend/infra/api_gateway.tf`                        | 3 × (integration + route + lambda permission)                                                                                |
| `backend/infra/variables.tf` / `terraform.tfvars`     | Wompi secrets as `sensitive = true`; **tfvars is gitignored — keep it so**                                                   |
| `frontend/src/lib/api/client.ts`                      | `createCheckout()`, `getCheckoutStatus()`                                                                                    |
| `frontend/src/lib/components/Delivery.svelte`         | replace the `allSettled` fan-out with one `createCheckout()` call                                                            |
| `frontend/src/routes/order/[checkoutId]/+page.svelte` | new: post-redirect result page, polls `GET /api/checkout/{id}`                                                               |
| `frontend/src/lib/i18n/{en,es}.json`                  | payment copy; **rewrite `en.json:45` / `:264`** — the WhatsApp-payment and "shipping calculated later" messages become wrong |

> Note: `adapter-static` needs `/order/[checkoutId]` prerendered as a fallback route, or the redirect 404s on GitHub Pages. Use a query param (`/order?c=<id>`) if the fallback proves awkward.

## 5. Secrets

Three values from the Wompi dashboard: **public key**, **integrity secret**, **events secret**. Sandbox and production keys are distinct (`pub_test_…` / `pub_prod_…`).

- Only the public key may reach the frontend bundle.
- The other two go in Lambda env vars via Terraform variables marked `sensitive`.
- `backend/infra/terraform.tfvars` is not committed — verify before the first apply.
- For CI, add them as GitHub Actions secrets consumed by the backend deploy workflow.

## 6. Suggested sequencing

| #   | Slice                                                                                                        | Depends on     |
| --- | ------------------------------------------------------------------------------------------------------------ | -------------- |
| 0   | ENG-13: shared `roundToNearestCoin` + persist rounding delta                                                 | unblock ENG-13 |
| 1   | `Checkout` schema + migration + cart-level pricing lib (incl. service fee)                                   | 0, Q1          |
| 2   | Customer-facing delivery estimate + margin decision                                                          | §2.2 call      |
| 3   | `POST /api/checkout` returning signed Wompi params (sandbox)                                                 | 1, 2           |
| 4   | Webhook handler + checksum verification + robot assignment move + **coupon budget commit** (`COUPONS.md` §5) | 3              |
| 5   | Frontend: single-checkout submit + redirect + result page                                                    | 3              |
| 6   | i18n rewrite, admin orders page shows payment status                                                         | 4, 5           |
| 7   | Sandbox end-to-end, then production keys                                                                     | all            |

Slices 1–2 are independent of Wompi entirely and can start now.

## 7. Open questions

1. **`Tarifa de servicio` — what is it?** AL-33 shows it as a line item ($1.00 next to a $5.00 bowl) but nothing defines it. Fixed COP amount, percentage of subtotal, or per-bowl? Does a coupon ever discount it? This blocks the pricing lib in slice 1.
2. **Delivery fee margin** — which of the three options in §2.2, and what margin?
3. **Order number `AG-####`** — is it per checkout or per order? With a multi-bowl cart producing N orders, the customer should see one number, which argues for putting it on `Checkout`. Confirm, and confirm whether it may simply be the DB id or must be non-sequential (sequential ids leak order volume to customers).
4. **Prep-time estimate `25–35 min`** — static copy, or computed? Nothing produces it today.
5. **Failed payment:** delete the orders, or keep them as `payment_failed` for retry? (Retry is friendlier and lets you see abandonment.)
6. **Refunds / cancellation** — currently out of scope per `CLAUDE.md`. A paid order that the kitchen can't fulfil needs _some_ answer, even if it's manual via the Wompi dashboard.
7. **Student journey (AL-55, due 2026-09-28)** introduces _pago en sede_ — paying on-site, next day, at a pickup point. That's a second payment path that bypasses Wompi entirely. It's due 11 days after this plan was written, so **the `Checkout` model should allow `paymentMethod: 'on_site'` with no Wompi transaction from the start**, rather than being retrofitted.
8. Does taking payment online change anything for the Law 1581 `/privacy` text or the `DELETE /api/users` flow? (Payment records usually can't be deleted on request — they're a commercial/tax record.)
9. AL-33 is still **In Review**, not Done — is the UX spec settled enough to build against?

---

## Sources

- [Wompi — Widget & Checkout Web](https://docs.wompi.co/en/docs/colombia/widget-checkout-web/)
- [Wompi — Eventos (webhooks)](https://docs.wompi.co/en/docs/colombia/eventos/)
- [Wompi — Transacciones](https://docs.wompi.co/en/docs/colombia/transacciones/)
- [Wompi — Inicio rápido](https://docs.wompi.co/docs/colombia/inicio-rapido/)
