# ADR-0013: Deployment Model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of SRE |
| Reviewers | Platform, Security, All service owners |
| Sources | SPEC §19, §24 (release), §26 (Kubernetes primary) |

## Context

Current deployment is **single-host docker-compose** via SSH from GitHub Actions (`.github/workflows/deploy.yml`). SPEC §26 default is Kubernetes primary, serverless by exception. SPEC §19 requires US/EU/APAC regions. Current model cannot satisfy SPEC.

## Options Considered

1. **Managed Kubernetes (EKS / GKE / AKS)** — SPEC default; tied to ADR-0001.
2. **Serverless-first (Cloud Run / ECS Fargate / Lambda)** — faster to operate, weaker control over networking/state.
3. **Stay on docker-compose / single VM** — only valid for MVA dev/preview environments.
4. **Nomad / ECS-only** — uncommon; reduces hiring pool.

## Decision

TBD. Recommended:
- **Production**: managed Kubernetes (cluster per region) once first revenue customer requires multi-region.
- **MVA / preview**: docker-compose (current state) is acceptable until first paying customer.
- **Serverless**: permitted for stateless edge functions, webhooks, image processing.

## Consequences

- Reversibility: **moderate** — service Docker images run on either; the operational tooling (Helm, Argo, GitOps) is the lock-in.
- Cost: K8s control plane + node baseline is meaningful at low traffic.

## Compliance and Governance

- Cluster network policies enforce service mesh boundaries (ADR-0006).
- Secret management via cloud KMS + sealed secrets / external-secrets — never in repo (SPEC §31).
