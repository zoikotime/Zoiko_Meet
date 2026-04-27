# ADR-AI-011: Evaluation infrastructure and gating thresholds

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Evaluation Lead |
| Reviewers | Head of AI, Security, ARB |
| Sources | SPEC-AI §20 (evaluation tracks), §27 (lifecycle gates), §34 |

## Context

SPEC-AI §20 defines seven evaluation tracks: pre-deployment, shadow, online, champion/challenger, human, golden set, adversarial. Promotion between environments is gated by automated thresholds; bypass requires documented exception.

## Options Considered

1. **Build in-house eval harness** — full control over tenant-aware sampling and golden-set governance.
2. **Adopt OpenAI Evals / DeepEval / Patronus** — faster to ship, weaker tenant integration.
3. **Hybrid: open framework + Zoiko-specific harness for golden-sets and human eval** — recommended.

## Decision

TBD. Recommended: hybrid. Each capability publishes its eval suite in source control with versioned thresholds. Promotion automation reads thresholds; missing eval = no promotion.

## Consequences

- Reversibility: **moderate** — eval data is portable; harness contracts bind into release tooling.

## Compliance and Governance

Eval evidence per release feeds EU AI Act conformity assessment readiness for high-risk capabilities.
