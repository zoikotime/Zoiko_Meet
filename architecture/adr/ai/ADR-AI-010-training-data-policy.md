# ADR-AI-010: AI training data policy implementation

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Legal, Compliance, Security, Data |
| Sources | SPEC-AI §19 (training data), §8 (isolation), §31 (compliance), §34 |

## Context

SPEC-AI §19 sets the default: tenant content not used for training general models without explicit opt-in, lawful basis, contract coverage and ARB-approved control set. Provider contracts must reflect this.

## Options Considered

1. **Hard "no training" stance with all providers, opt-in per tenant for evaluation only** — strongest, simplest contract.
2. **Per-tier opt-in (Free tier shares prompts; paid tiers don't)** — explicitly rejected unless surfaced in DPA.

## Decision

TBD. Recommended: Option 1. Implementation: provider adapters set `allow_training=false` on every request; tenants who opt in flip a server-side flag captured in audit.

## Consequences

- Reversibility: **moderate** — flipping later requires customer DPA amendments.
- Synthetic and licensed datasets cover the gap for internal eval/SFT work.

## Compliance and Governance

Per-tenant opt-in state, consent version and effective date are mandatory audit fields.
