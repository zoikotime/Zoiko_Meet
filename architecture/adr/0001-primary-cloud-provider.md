# ADR-0001: Primary Cloud Provider

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of SRE |
| Reviewers | Security, Data, Engineering, Finance |
| Sources | SPEC §19 (global infrastructure), §22 (cost), §28, §34 |

## Context

SPEC §19 mandates US, EU and APAC regions with regional managed databases, object storage, event bus, search, observability and DR. The platform is "multi-cloud-capable in architecture and single-cloud in initial deployment." This ADR selects the launch cloud and commits to the abstractions that keep multi-cloud viable later.

## Options Considered

1. **AWS** — broadest service catalogue (Aurora, MSK, S3, OpenSearch, EKS, IVS for media). Strongest enterprise procurement story. Highest egress cost.
2. **GCP** — strong data + AI tooling (BigQuery, Pub/Sub, GKE Autopilot, Vertex AI). Native fit for the Anthropic / Vertex model routing. Smaller enterprise footprint.
3. **Azure** — best fit for customers with M365/Entra mandates. Heavier compliance documentation. Lock-in to Microsoft identity stack.
4. **Multi-cloud at launch** — explicitly rejected by SPEC §19 ("single-cloud in initial deployment").

## Decision

TBD — ARB to select. Default constraint: whichever cloud is chosen, the architecture must avoid using cloud-proprietary primitives that have no portable equivalent (e.g. proprietary event-sourcing services). Use managed Postgres, Kafka-compatible event bus, S3-compatible object storage, and OpenTelemetry-compatible observability.

## Consequences

- Reversibility: **expensive** (data migration, IaC rewrite, vendor contracts).
- Operational impact: anchors hiring, on-call runbooks and DR strategy.
- Cost impact: dominant single line item; FinOps model in ADR-0019 depends on this.

## Compliance and Governance

- Tenant region selection must map to provider regions that satisfy GDPR / UK GDPR / data residency constraints.
- Provider must support customer-managed keys (CMK) for at-rest encryption.
- Provider audit reports (SOC 2 Type II, ISO 27001) must be on file before launch.
