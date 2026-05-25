# POS — Partial payment success and advance default

## Behaviour

- **Payment amount (LAB/MIXED):** Defaults to **100%** of order total on the payment screen; minimum advance remains the floor.
- **After any payment** (full or partial): Navigate to **order success**, show balance due when applicable, **clear cart**.
- **Collect balance later:** Order history or **Collect balance** on confirm screen.

See implementation in `src/public/js/pos.js` (`completePosCheckoutAfterPayment`, `showPaymentScreen`, `submitPayment`).
