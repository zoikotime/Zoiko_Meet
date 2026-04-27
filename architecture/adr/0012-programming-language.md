# ADR-0012: Programming Language Baseline

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Platform Engineering Lead |
| Reviewers | All engineering leads, Hiring |
| Sources | SPEC §26 (Go primary; Python for AI; Rust by exception) |

## Context

The current codebase is **Python (FastAPI)** for backend and **TypeScript (React)** for client. SPEC §26 default is **Go** for backend services with Python reserved for AI workloads. This ADR governs whether to migrate, re-platform, or carve out per service.

## Options Considered

1. **Migrate all backend services to Go incrementally as services are split** — aligns with SPEC, expensive.
2. **Keep Python for v1, adopt Go only for performance-critical services (Real-Time Gateway, Messaging at scale)** — pragmatic.
3. **Stay Python end-to-end** — explicitly contrary to SPEC §26.
4. **Adopt Rust** — only by exception per SPEC.

## Decision

TBD. Recommended path:
- **Python** stays for AI Orchestration, low-volume control-plane services and internal tooling.
- **Go** becomes the language for new services on the high-throughput data plane (Real-Time Gateway, Messaging Service, Media Control) when they are separated from the monolith.
- **TypeScript** for all clients.
- **Rust** only by ADR amendment for a specific component.

## Consequences

- Reversibility: **expensive once production code exists** in a chosen language.
- Hiring impact: dual stack requires a polyglot engineering culture.

## Compliance and Governance

- Each service's language choice declared in its service manifest.
- Shared protobuf schemas (per ADR-0011) keep cross-language interop typed.
