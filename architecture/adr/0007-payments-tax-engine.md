# ADR-0007: Payments and Tax Engine

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Billing Engineering Lead |
| Reviewers | Finance, Legal, Product |
| Sources | SPEC §16 (billing), §22 (FinOps), §25 (99.99% billing accuracy) |

## Context

SPEC §16 requires global payments, taxes, VAT, invoice evidence, reconciliation and Free/Pro/Business/Enterprise tiers. The platform must handle subscription billing, seat billing, AI/storage/meeting-minute usage metering, trial logic, upgrades and downgrades.

## Options Considered

1. **Stripe Billing + Stripe Tax** — fastest to launch, broadest geo coverage, weaker enterprise invoicing.
2. **Stripe + Avalara / TaxJar** — Stripe for payments, dedicated tax engine for VAT/sales-tax accuracy.
3. **Chargebee / Recurly** — purpose-built subscription billing on top of Stripe/Adyen.
4. **Build in-house ledger on top of Stripe Connect** — required for high-touch enterprise but expensive to start.
5. **Adyen** — strong global coverage, enterprise-grade, higher integration cost.

## Decision

TBD. Default for first build: **Stripe Billing + Stripe Tax**. Re-evaluate when ARR crosses a threshold the ARB defines. Constraints regardless of choice:
- Usage events must be idempotent and replayable from the event bus (SPEC §16).
- Reconciliation between metering events and invoices must be auditable.

## Consequences

- Reversibility: **expensive** (customer payment instruments migrate poorly).
- All metering must go through ADR-0019 ledger before reaching the payments engine.

## Compliance and Governance

- PCI scope minimised: card data never touches Zoiko services.
- VAT/sales-tax compliance must cover EU OSS, UK, US sales tax, India GST, Australia GST at minimum.
