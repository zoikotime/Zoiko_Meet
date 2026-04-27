# ADR-0016: Failure Mode Commitments and RTOs

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of SRE |
| Reviewers | Security, Platform, All service owners |
| Sources | SPEC §27 (FMEA table), §25 (availability targets) |

## Context

SPEC §27 fixes failure modes and RTOs across Identity, Authorisation, Messaging, Real-Time, Meeting Orchestration, Media Provider, AI Orchestration, Search, ZoikoTime Integration, Billing and Regional Cluster. This ADR commits the engineering org to those numbers.

## Options Considered

1. **Adopt SPEC §27 verbatim** — recommended.
2. **Negotiate exceptions per service** — only with ADR amendment per service.

## Decision

Adopt SPEC §27 as the binding RTO baseline. Each service owner per Appendix C must produce a runbook proving the RTO is achievable; runbooks live under `runbooks/<service>/`.

## Consequences

- Reversibility: **moderate** — RTO commitments shape replica counts, multi-AZ topology, failover automation.
- Cost: sub-15-minute RTOs require warm replicas, not cold.

## Compliance and Governance

- Failover testing cadence: quarterly, per service, with evidence captured for SOC 2.
- Cross-region failover must respect data residency (SPEC §19).
