# ADR-0014: Observability Backend

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of SRE |
| Reviewers | Security, Platform, All service owners |
| Sources | SPEC §21, §25 (SLOs), §26 (OpenTelemetry default) |

## Context

SPEC §21 mandates OpenTelemetry-compatible logs, metrics and traces for all services. SLOs in §25 require golden-signal dashboards and error budgets. The current repo has no observability stack.

## Options Considered

1. **Datadog** — strongest UX, highest cost, full coverage.
2. **Grafana Cloud + Tempo + Loki + Mimir** — open standards, lower cost, more setup.
3. **New Relic** — strong APM, weaker logs at scale.
4. **Self-hosted Prometheus + Grafana + Loki + Tempo** — lowest cost, highest ops burden.
5. **Honeycomb** — best-in-class trace analytics, narrower coverage.

## Decision

TBD. Constraint regardless: instrumentation MUST be OpenTelemetry SDK so the backend can change without re-instrumenting code. Backend choice ties to ADR-0001 (cloud) and FinOps in ADR-0019.

## Consequences

- Reversibility: **cheap if instrumentation is OTel**; **expensive if vendor SDK leaks into code**.
- Sampling strategy required from day one to control cost (SPEC §22).

## Compliance and Governance

- Logs must scrub PII before export.
- Audit-relevant events route to the audit store (SPEC §11), not the observability backend.
