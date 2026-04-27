# ADR-AI-014: AI security controls for prompt injection and tool abuse

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Security |
| Reviewers | Head of AI, AI Safety |
| Sources | SPEC-AI §21 (safety layers), §25 (security threats), §26 (agents), §34 |

## Context

SPEC-AI §25 lists eight AI-specific threats. Prompt injection and tool abuse have highest blast radius once agents exist (ADR-AI-016).

## Options Considered

1. **Defence in depth across input/retrieval/generation/output/tool/post-output layers** (per SPEC-AI §21) — recommended.
2. **Provider safety only** — explicitly rejected by SPEC-AI §21.

## Decision

Adopt SPEC-AI §21 layered model. Concrete controls: retrieved content tagged as data not instruction; injection scanner on input + retrieved context; output groundedness check; tool calls require registry match + scoped authorisation token.

## Consequences

- Reversibility: **moderate** — layers are portable; classifiers may swap.
- Latency: each layer adds budget; sum must fit AI request SLO.

## Compliance and Governance

Adversarial eval suite (SPEC-AI §20) is the test bench for this control set; required release gate.
