# ADR-0017: Data Residency Enforcement Model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Security Lead |
| Reviewers | Legal/Compliance, Platform, Data, AI |
| Sources | SPEC §10 (tenancy), §11 (data residency), §19 (regional failover), §31 (prohibitions) |

## Context

SPEC §10 makes tenant region a primitive. SPEC §11 mandates per-domain residency. SPEC §19 requires US, EU, APAC regions. SPEC §31 prohibits failing data over to a non-permitted region for convenience. This ADR specifies how residency is *enforced*, not merely declared.

## Options Considered

1. **Region-pinned services per tenant** — workspace lives entirely in one region; cross-region calls require explicit policy.
2. **Globally replicated with tenant-key encryption per region** — replication everywhere, but only the regional key can decrypt.
3. **Logical partitioning with policy-only enforcement** — weakest; rejected for SPEC compliance.

## Decision

TBD. Recommended: **Option 1 (region-pinned)** for messages, files, recordings, audit, search. Identity and entitlement are global with tenant-region overlay. AI inference uses Model Router with residency constraints (SPEC §14).

## Consequences

- Reversibility: **expensive** — migrating a tenant between regions is a multi-step DSAR-grade operation.
- Cross-region collaboration requires shared-channel patterns (SPEC §10).

## Compliance and Governance

- Residency enforcement evidence must satisfy GDPR, UK GDPR, CCPA/CPRA at minimum.
- AI inference logs residency decision per request.
