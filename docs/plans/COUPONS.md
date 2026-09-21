# Feature Plan — Coupons

**Status:** Complete — ready for review
**Date:** 2026-09-17 · **amended 2026-09-21** (product: no free-shipping-first; build the type system + an admin create screen)
**Sources:** AL-58 / AL-31 / AL-44 (Linear) + the [coupon spec doc](https://docs.google.com/document/d/1-eWyBbYV8t3kEQ_xQZ9N11JNUIXxuxQR0x3CJKOXArY/edit) (Google Docs, linked from AL-31)

---

## 0. Read this first

### Decided 2026-09-21 — no MVP type; build the type system

Product has ruled out leading with **envío gratis** (doc §4's stated first case). **No single type ships first.** Instead: implement the coupon types the doc defines, plus a small admin screen to create a coupon of a chosen type, and let Product pick the campaign to run later.

Two consequences, both good:

- **The delivery-fee coupling relaxes.** Free shipping was the thing that made coupons depend on a final delivery fee at checkout, and made budget consumption a variable amount per address. Neither is true for percent/fixed-amount coupons. Payments still needs the fee settled for its own reasons (`PAYMENTS_WOMPI.md` §2.2) — but that's no longer a coupon blocker.
- **The old "which type first?" open question is closed.** `benefitType` must be a real dimension from day one, which is what doc §11 asked for anyway.

### Recommended split of the five types

The doc's type list (§4) is not one feature. Three of them are arithmetic on a number checkout already has; two need item-level machinery that doesn't exist:

| Type                              | Cost                                                                                                   | Verdict                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------- |
| `percent` — descuento en %        | `subtotal × n%`                                                                                        | ✅ build now                                                                       |
| `fixed_amount` — valor fijo $     | `min(n, subtotal)`                                                                                     | ✅ build now                                                                       |
| `free_shipping` — envío gratis    | `discount = deliveryFee`                                                                               | ✅ build now (one line; needs the fee at checkout, which payments delivers anyway) |
| `free_product` — producto gratis  | needs product selection in admin, an `OrderItem` the customer didn't pick, robot assembly implications | ⏸ defer                                                                            |
| `buy_x_get_y` — compra X recibe Y | same, plus cart-matching rules                                                                         | ⏸ defer                                                                            |

The first three are one `switch` in `computeDiscount()` over a `benefitType` + `benefitValue` pair — genuinely all three for the price of one. The last two change what's _in_ the bowl, which touches `OrderItem`, the robot's assembly sequence, and the admin UI's shape. **Recommend shipping the three value types now and treating the two item types as a separate ticket.** The `benefitType` column and the `switch` are the extension point doc §11 wants — adding them later needs no migration.

If Product wants all five in this pass, say so and I'll plan the item-scoped pair properly.

### Still unresolved

1. **`Tarifa de servicio` appears in AL-33 but in neither the doc nor AL-44.** The doc's worked examples are `Subtotal / Cupón / Envío / TOTAL` — no service fee. Does a coupon ever discount it?

2. **Scope is much larger than AL-58 implies.** AL-58 is titled _"Implementar Cupones en la pagina"_ with an empty description and a due date of 2026-09-14 (**overdue**). The doc specifies a full Marketing admin panel (§8), a budget system (§5), a metrics suite (§10), and an explicit requirement that **new rules and types be configurable without code changes** (§11). That is not one ticket. The admin screen below is deliberately the small version — see §8a.

---

## 1. What the spec actually asks for

**Goal (§1):** let Marketing and Sales run discount campaigns autonomously — defining rules, budget and validity — with automatic validation at checkout.

**Actors (§3):**

- **Marketing** — owns coupons: creates them, sets rules and budget, activates/deactivates, monitors use.
- **Ventas** — requests campaigns for specific clients, companies or partnerships.
- **Cliente** — enters a code at checkout.

This answers AL-31's brief directly: **Marketing owns and administers; Sales requests; the customer only redeems.**

### Coupon types (§4)

| Type                        | This pass                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Envío gratis                | ✅ (doc calls it the first case; **Product has deselected it as the launch campaign** — the type still gets built) |
| Descuento en porcentaje (%) | ✅                                                                                                                 |
| Descuento de valor fijo ($) | ✅                                                                                                                 |
| Producto gratis             | ⏸ deferred (§0)                                                                                                    |
| Compra X y recibe Y         | ⏸ deferred (§0)                                                                                                    |
| Otros                       | future                                                                                                             |

> _"La arquitectura debe permitir agregar nuevos tipos sin modificar la lógica principal."_

### Budget — the most consequential requirement (§5)

Each campaign carries a **maximum budget in COP** (example: `$500.000`). Every redemption **decrements it by the benefit actually granted**, and when it reaches zero the coupon **deactivates automatically**.

This is not a simple use-counter, and it's the hardest part of the feature:

- For `percent` and `fixed_amount` the consumed amount is a function of the subtotal, known the moment the cart is priced. For `envío gratis` it's **the delivery fee for that specific address** — variable, different every order, only known at checkout. The budget column handles both the same way (store the COP actually granted), but only the free-shipping case makes budget burn depend on the accuracy of the delivery model.
- It's a **contended counter**. Two concurrent checkouts against a nearly-exhausted budget must not both succeed. Needs an atomic conditional decrement (`UPDATE … SET remaining = remaining - $x WHERE remaining >= $x`), not read-then-write.
- Combined with §11's _"la actualización del presupuesto debe ejecutarse después de cada compra exitosa"_, the budget must move on **payment success**, not on APLICAR — which is exactly the reserve/commit split the Wompi webhook forces anyway.

### Usage limit (§5) — MVP

- **First purchase only.** Later: max total uses, one per registered user, unlimited.

### Business rules (§6) — all four are MVP

- **Compra mínima** — e.g. _"mínimo 2 bowls"_. A **cart-level** condition.
- **Primera compra** — first order only.
- **Vigencia** — valid only between start and end dates.
- **Estado** — only `Activo` coupons apply.
- **Acumulación** — **one coupon per order**, never more.

### Validation checklist (§9) — run before applying

Code exists · coupon active · campaign not expired · campaign has started · customer meets conditions · order meets conditions · budget still available · no other coupon applied.

§11 requires this to run **twice**: live when the code is entered, **and again before confirming payment**, to avoid inconsistency.

### Metrics to persist (§10)

Uses, budget consumed, budget remaining, total discounted, average ticket with coupon, last-used date, utilisation rate.

## 2. What exists today

No coupon implementation. What exists is a coupon-shaped hole: `frontend/src/lib/i18n/en.json:258` labels a free-text field **"Delivery Instructions or Coupons (Optional)"** writing to `Order.deliveryInstructions` (`VarChar(500)`, unvalidated) — a human reads the code off the order and honours it manually.

Two existing pieces are directly reusable:

- **`GET /api/users/check-phone`** already does returning-customer lookup — that _is_ the "primera compra" check, since `User.phone` is `@unique`.
- **`backend/src/handlers/delivery.ts`** produces the delivery fee that `envío gratis` discounts.

## 3. UX (AL-44 mockup + doc §7)

Doc and mockup agree on the mechanics:

- A **`Cupón de Descuento`** section above the order summary — its own field, placeholder `INGRESA TU CUPÓN`, with a discrete **`APLICAR`** button.
- Success: `✓ ¡Cupón aplicado! 10% de descuento` / `✅ Cupón aplicado correctamente`; summary updates.
- A dedicated discount row showing the code as a chip and a negative amount, with the pre-discount `TOTAL` struck through.
- The CTA carries the discounted amount.

**`APLICAR` is a discrete action**, so validation is a server round-trip — a `POST /api/coupons/validate` _preview_ endpoint, distinct from redemption. It needs pending and error states the mockup doesn't draw.

**Error copy is specified (§7, Paso 5B)** and must be distinguishable, not a generic failure — in **both** languages:

| Reason                      | Message                                               |
| --------------------------- | ----------------------------------------------------- |
| expired                     | Cupón expirado                                        |
| malformed                   | Cupón inválido                                        |
| unknown code                | Cupón no encontrado                                   |
| not first purchase          | Este cupón solo aplica para la primera compra         |
| minimum not met             | Debes comprar mínimo 2 bowls para utilizar este cupón |
| budget exhausted / inactive | Este cupón ya no se encuentra disponible              |

Note the last one deliberately does **not** reveal that the budget ran out.

The doc's summary layout for the MVP case (§7, Paso 6):

```
Subtotal              $42.000
Cupón Envío Gratis    -$5.000
Envío                      $0
TOTAL                 $42.000
```

The discount is shown as its own line _and_ `Envío` is zeroed — so the free-shipping benefit is rendered twice. Worth confirming that's intended rather than double-counting.

## 4. Data model

```prisma
model Coupon {
  id              Int       @id @default(autoincrement())
  code            String    @unique @db.VarChar(40)   // case-insensitive on lookup
  campaignName    String    @map("campaign_name") @db.VarChar(200)
  internalNotes   String?   @map("internal_notes") @db.Text

  benefitType     String    @map("benefit_type") @db.VarChar(30)
  // 'free_shipping' | 'percent' | 'fixed_amount' | 'free_product' | 'buy_x_get_y'
  benefitValue    Decimal?  @map("benefit_value") @db.Decimal(10, 2)  // null for free_shipping

  startsAt        DateTime  @map("starts_at")
  endsAt          DateTime  @map("ends_at")

  budgetTotal     Decimal   @map("budget_total") @db.Decimal(12, 2)
  budgetRemaining Decimal   @map("budget_remaining") @db.Decimal(12, 2)

  active          Boolean   @default(true)
  rules           Json      @default("{}")   // { minBowls?: 2, firstPurchaseOnly?: true, ... }

  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")

  redemptions     CouponRedemption[]

  @@index([code])
  @@index([active, startsAt, endsAt])
  @@map("coupons")
}

model CouponRedemption {
  id             Int       @id @default(autoincrement())
  couponId       Int       @map("coupon_id")
  coupon         Coupon    @relation(fields: [couponId], references: [id])
  checkoutId     String    @map("checkout_id") @db.Uuid
  userId         String    @map("user_id") @db.Uuid

  discountAmount Decimal   @map("discount_amount") @db.Decimal(10, 2)  // budget actually consumed
  state          String    @default("reserved") @db.VarChar(20)  // reserved | committed | released
  reservedAt     DateTime  @default(now()) @map("reserved_at")
  expiresAt      DateTime  @map("expires_at")   // TTL so abandoned checkouts release
  committedAt    DateTime? @map("committed_at")

  @@unique([checkoutId])            // enforces §6 "one coupon per order"
  @@index([couponId, state])
  @@index([userId])
  @@map("coupon_redemptions")
}
```

`Checkout.couponId` + `Checkout.discount` (the payments plan already reserves `discount`).

**On `rules Json`:** §11 demands rules be configurable from the panel _without code changes_, which argues for data-driven rules rather than columns. A JSON blob with a Zod schema per rule key is the pragmatic middle ground — it keeps validation typed while letting Marketing add a `minBowls` to a campaign without a migration. A fully general rules engine is over-building for two MVP rules; this shape grows into one if needed.

## 5. Lifecycle — reserve then commit

The doc (§11) wants validation at entry _and_ again before payment, and budget updated only after a successful purchase. With Wompi's redirect checkout there's a real window between the two, so:

```
APLICAR            → validate only, no writes. Returns the computed discount for display.
Create checkout    → re-validate (§11) + atomically decrement budget
                     + insert CouponRedemption(state=reserved, expiresAt=now+30min)
Wompi APPROVED     → state=committed
Wompi DECLINED /
  expired TTL      → state=released, budget credited back
```

Without reservation, a nearly-exhausted campaign would over-spend across concurrent abandoned checkouts. Releasing needs a sweeper (scheduled Lambda) or a lazy check at validation time — lazy is simpler and adequate at this volume.

**Auto-deactivation** (`budgetRemaining == 0`, or `now > endsAt`) should be **derived at read time**, not a cron flipping `active`. A coupon that expired at midnight shouldn't depend on a job having run. Keep `active` as the manual Marketing on/off switch, and treat effective availability as `active AND now BETWEEN startsAt AND endsAt AND budgetRemaining > 0`.

## 6. Where the discount sits in pricing

`backend/src/lib/nutrition.ts` is the pricing authority and ends with `roundToNearestCoin` (nearest 100 COP).

1. **Never client-authoritative.** `frontend/src/lib/utils/bowl.ts` mirrors the server calc; a discount applied only there is trivially tampered with.

2. **Free shipping doesn't touch `nutrition.ts` at all** — it zeroes the delivery fee from `handlers/delivery.ts`. Coupon evaluation therefore belongs in the **checkout layer**, above both.

   ```
   subtotal   = Σ round100(bowl price)
   deliveryFee= getDeliveryFee(address)
   discount   = benefitType === 'free_shipping' ? deliveryFee
                                                : round100(f(subtotal))
   total      = round100(subtotal + deliveryFee + serviceFee - discount)
   total      = max(total, 0)
   ```

3. **Budget consumed = `discount`**, the real COP granted — so for free shipping it varies per address, per §5.

4. **Coupons compound ENG-13.** That ticket (Blocked) notes the rounding delta is never persisted; a discount adds a second rounding step, and under in-app checkout these are amounts really charged. See `PAYMENTS_WOMPI.md` §2.3.

## 7. Sequencing — `Checkout` must land first

Non-negotiable: the minimum-purchase rule (_"mínimo 2 bowls"_) and the discount itself are **cart-level**, and free shipping needs the delivery fee at checkout time. Today `Delivery.svelte:126` fans a cart out into N independent orders via `Promise.allSettled` — there is no cart entity to attach a discount or a rule to.

| #   | Slice                                                                                                                                                                          | Depends on                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 1   | `Checkout` aggregate + customer-facing delivery fee                                                                                                                            | `PAYMENTS_WOMPI.md` slices 1–2 |
| 2   | `Coupon`/`CouponRedemption` schema + migration + `computeDiscount()` switch over the three value types + rule evaluation for `minBowls`, `firstPurchase`, `vigencia`, `estado` | 1                              |
| 3   | **Admin create/list screen (§8a)** + `POST`/`GET`/`PATCH /api/coupons`                                                                                                         | 2                              |
| 4   | `POST /api/coupons/validate` + the APLICAR UI and error copy                                                                                                                   | 2                              |
| 5   | Reserve/commit + atomic budget decrement, wired to the Wompi webhook                                                                                                           | 4, payments slice 4            |
| 6   | Full Marketing panel + metrics (§8, §10) — _separate ticket, Back-office project_                                                                                              | 2                              |
| 7   | `free_product` / `buy_x_get_y` — _separate ticket_ (§0)                                                                                                                        | 2                              |

Slice 3 moved ahead of the customer-facing flow deliberately: Product needs to be able to create candidate campaigns before deciding which one to run, and a seeded coupon is what slice 4 gets tested against.

## 8a. Admin screen (added 2026-09-21)

Scope: **create a coupon of a given type, and list what exists.** Not the full §8 Marketing panel.

Lives at `frontend/src/routes/admin/coupons/+page.svelte`, alongside the existing `admin/orders/` and `admin/delivery-calculator/` pages — same shell, same conventions, no new layout.

**Create form** — one field per doc §5:

| Field                 | Control               | Notes                                                                            |
| --------------------- | --------------------- | -------------------------------------------------------------------------------- |
| Nombre de la campaña  | text                  |                                                                                  |
| Código                | text                  | uppercased on input; uniqueness checked server-side                              |
| Descripción interna   | textarea, optional    |                                                                                  |
| Tipo de beneficio     | `<select>`            | `percent` / `fixed_amount` / `free_shipping`                                     |
| Valor del beneficio   | number                | hidden when type is `free_shipping` — that's the only type-conditional bit of UI |
| Fecha de inicio / fin | `<input type="date">` | native picker, no date library                                                   |
| Presupuesto (COP)     | number                | seeds both `budgetTotal` and `budgetRemaining`                                   |
| Compra mínima (bowls) | number, optional      | writes `rules.minBowls`                                                          |
| Solo primera compra   | checkbox              | writes `rules.firstPurchaseOnly`                                                 |
| Activo                | checkbox, default on  |                                                                                  |

**List** — a table of existing coupons showing code, type, vigencia, `budgetRemaining / budgetTotal`, redemption count, estado, with an activate/deactivate toggle.

Deliberately **out** of this screen, per doc §8 — add when Marketing actually asks:

- edit, delete, the §10 metrics suite (average ticket, utilisation rate, last-used)
- per-campaign redemption drill-down

Endpoints: `POST /api/coupons` (create), `GET /api/coupons` (list), `PATCH /api/coupons/{id}` (the active toggle only). All three are admin handlers in the same `coupons.ts` as the customer-facing validate.

> **Auth caveat.** `/admin/orders` today is an unauthenticated static route — anyone with the URL can use it. That's survivable for order status; it is **not** survivable for a screen that mints discount codes against a budget. This screen needs at least a shared secret on the write endpoints. Flagged as open question 5; don't ship the create endpoint without an answer.

## 8. Files to touch

Per the `CLAUDE.md` 6-file checklist.

| File                                                 | Change                                                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `backend/prisma/schema.prisma`                       | `Coupon`, `CouponRedemption`; `Checkout.couponId`                                                 |
| `backend/prisma/migrations/<ts>_add_coupons/`        | **required** — `db:push` alone breaks production                                                  |
| `backend/src/lib/coupons.ts`                         | validation chain (§9), benefit computation, budget reserve/commit/release                         |
| `backend/src/handlers/coupons.ts`                    | `POST /api/coupons/validate`; `POST`/`GET`/`PATCH /api/coupons` (§8a)                             |
| `backend/src/handlers/checkout.ts`                   | re-validate + reserve; webhook commits                                                            |
| `backend/src/dev-server.ts` + **both** build scripts | new handler wiring — **CI uses `build-lambda.sh`**                                                |
| `backend/infra/lambda.tf`, `api_gateway.tf`          | 5 resources per new endpoint                                                                      |
| `frontend/src/lib/components/Delivery.svelte`        | coupon field + APLICAR; discount row; struck-through total                                        |
| `frontend/src/lib/api/client.ts`                     | `validateCoupon()`                                                                                |
| `frontend/src/routes/admin/coupons/+page.svelte`     | create form + list (§8a)                                                                          |
| `frontend/src/lib/i18n/{en,es}.json`                 | **fix `en.json:258`** — split the combined field; add all six §7 error messages in both languages |

## 9. Open questions

1. ~~Which type ships first?~~ **Closed 2026-09-21** — no launch type; build the type system (§0).
2. **Are `free_product` / `buy_x_get_y` in this pass?** Recommending deferral (§0); they change what's in the bowl, not just what it costs.
3. **Does any coupon discount `Tarifa de servicio`?** It appears only in AL-33.
4. **Is the §7 Paso 6 layout right** — showing both a `Cupón Envío Gratis -$5.000` line _and_ `Envío $0`?
5. **How is `/admin/coupons` protected?** `/admin/orders` is currently unauthenticated. A screen that mints discount codes against a budget can't be. Blocks the create endpoint (§8a).
6. **Budget when a single order's benefit exceeds the remainder** — reject the coupon, or grant partial? (Mostly bites `free_shipping`.)
7. **Scope of AL-58.** Slices 6 and 7 look like separate tickets, the panel plausibly in the Back-office project. AL-58 is overdue with an empty description.
8. **Is a student/audience-scoped coupon needed** for AL-55 (journey para estudiantes, due 2026-09-28)? Not in the doc's type list, and `pago en sede` bypasses Wompi.
9. Are coupon codes **case-insensitive**? (Assume yes; the mockup shows uppercase, and the admin form uppercases on input.)

---

## Sources

- [Coupon spec doc (Google Docs)](https://docs.google.com/document/d/1-eWyBbYV8t3kEQ_xQZ9N11JNUIXxuxQR0x3CJKOXArY/edit)
- [AL-58 Implementar Cupones en la pagina](https://linear.app/al-gramo/issue/AL-58/implementar-cupones-en-la-pagina)
- [AL-31 Crear documento sobre cupones](https://linear.app/al-gramo/issue/AL-31/crear-documento-sobre-cupones)
- [AL-44 Mock-ups uso de cupones](https://linear.app/al-gramo/issue/AL-44/mock-ups-uso-de-cupones)
- [AL-55 Implementar journey para estudiantes](https://linear.app/al-gramo/issue/AL-55/implementar-journey-para-estudiantes)
