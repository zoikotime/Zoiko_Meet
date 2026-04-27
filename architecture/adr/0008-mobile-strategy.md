# ADR-0008: Mobile Strategy

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Client Engineering Lead |
| Reviewers | Platform, Security, Product, Media |
| Sources | SPEC §18 (clients), §24 (release / app store cadence), §26 (default: native or cross-platform by ADR) |

## Context

SPEC §18 mandates iOS and Android clients with offline tolerance, encrypted local state, server-authoritative reconciliation, and core messaging/meeting parity. The current repo has no mobile codebase — Electron desktop and browser only.

## Options Considered

1. **Native Swift (iOS) + Native Kotlin (Android)** — best media/notification quality, two codebases, two teams.
2. **React Native** — single team, mature, weak background-task support on iOS.
3. **Flutter** — single team, excellent UI, weakest WebRTC/SFU SDK story today.
4. **KMM (Kotlin Multiplatform Mobile)** — share business logic, native UI; smaller ecosystem.
5. **Capacitor / Ionic** — fastest to ship, unacceptable media performance.

## Decision

TBD. Hiring and time-to-market drive this decision. Constraint: whichever path, the SDK choice for the chosen ADR-0002 media provider must support it natively.

## Consequences

- Reversibility: **expensive** — porting to native after shipping React Native is a multi-quarter project.
- App-store cadence binds release strategy (SPEC §24): minimum-supported-version policy required.

## Compliance and Governance

- Local store must be encrypted per OS-provided primitives (Keychain / Keystore).
- Push notifications use minimal payloads (SPEC §18) — no message content in payload by default.
