# ADR-AI-012: AI observability data model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Platform Engineering |
| Reviewers | SRE, Security, FinOps, Compliance |
| Sources | SPEC-AI §22 (observability), §23 (cost), ADR-0014 (observability backend), §34 |

## Context

SPEC-AI §22 lists six telemetry categories: request metadata, quality, safety, cost, reliability, compliance. Telemetry must be tenant-aware and privacy-safe. Backend choice deferred to ADR-0014.

## Options Considered

1. **OpenTelemetry semantic conventions for AI (`gen_ai.*` attributes)** — recommended; vendor-neutral.
2. **Vendor-proprietary AI observability (Langfuse, Helicone, Arize)** — richer UX, vendor lock.
3. **Custom schema** — rejected; reinvents OTel.

## Decision

TBD. Recommended: Option 1 with vendor-specific dashboards layered on top. Schema must include tenant_id, prompt_version, model_version, output_class, oversight_mode, cost_units.

## Consequences

- Reversibility: **cheap if OTel**, **expensive if vendor-proprietary**.

## Compliance and Governance

PII scrubbing required before telemetry export. Compliance telemetry retained per SPEC-AI §30 high-risk evidence retention.
