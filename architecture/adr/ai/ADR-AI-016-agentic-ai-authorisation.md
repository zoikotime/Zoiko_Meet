# ADR-AI-016: Agentic AI authorisation model

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Engineering / Security |
| Reviewers | Head of AI, Compliance, ARB |
| Sources | SPEC-AI §26 (agents), §15 (oversight), §33 (prohibitions), §34 |

## Context

Agentic AI is the highest-risk surface (SPEC-AI §26). Authorisation must be explicit, scoped, time-bounded, revocable, auditable, non-transferable. Critical actions are prohibited to autonomous agents.

## Options Considered

1. **Per-agent capability token issued by AI Gateway, scoped by tenant policy + tool-risk class** — recommended.
2. **Reuse user OAuth token** — rejected; can't bound scope per agent run.
3. **Long-lived service account** — rejected; violates SPEC-AI §33 (no self-authorisation).

## Decision

TBD. Recommended: Option 1. Capability tokens contain principal, tools, scope, expiry, max-cost, max-iterations, revocation token. Tokens are non-transferable.

## Consequences

- Reversibility: **moderate** — token format binds runtime contracts.

## Compliance and Governance

Token issuance + every action under that token is audited; SEV-0 if a token is observed acting outside its scope.
