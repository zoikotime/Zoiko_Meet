# ADR-0006: Service Mesh

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of SRE |
| Reviewers | Security, Platform |
| Sources | SPEC §8 (mTLS, retries, circuit breaking, telemetry), §20 (security), §21 (observability) |

## Context

SPEC §8 mandates "service mesh provides mTLS, traffic management, retries, timeouts, circuit breaking, policy enforcement and telemetry." Combined with SPEC §20, the mesh is the enforcement layer for service-to-service auth on Kubernetes.

## Options Considered

1. **Istio** — most feature-complete, highest operational cost.
2. **Linkerd** — simpler, lower CPU/memory, smaller feature surface.
3. **Cilium Service Mesh (eBPF)** — sidecar-less, high performance, newer.
4. **AWS App Mesh / GCP Anthos Service Mesh** — managed; ties to ADR-0001 cloud.
5. **No mesh (mTLS in app code via cert-manager + ingress)** — rejected; SPEC §8 requires a mesh.

## Decision

TBD. Recommended path: start with Linkerd for MVA simplicity, revisit at scale. Hard requirements:
- mTLS by default, with policy denial on missing identity.
- OpenTelemetry trace propagation (SPEC §21).
- Per-route timeout and circuit-breaker policy.

## Consequences

- Reversibility: **moderate** — swap requires re-instrumenting deployment manifests.
- Adds CPU/memory overhead per pod; capacity model in ADR-0015 must account.

## Compliance and Governance

- mTLS satisfies a portion of the SOC 2 encryption-in-transit control.
- Service identity binds to namespace and SPIFFE ID; auditable in mesh telemetry.
