# ADR-AI-024: Continuous evaluation infrastructure

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | AI Evaluation Lead |
| Reviewers | Head of AI, Security, ARB |
| Sources | SPEC-AI §20, §27 (lifecycle), §32 (incidents), §34 |

## Context

Distinct from ADR-AI-011 (release-time gating), this ADR covers **always-on** infrastructure: shadow runners, online sampling, drift detectors, golden-set test suites in CI, human eval pipelines.

## Options Considered

1. **Dedicated `ai-eval-service` with persistent shadow workers** — recommended.
2. **Cron-based batch evals** — too coarse for drift detection.

## Decision

TBD. Recommended: Option 1. Service owns golden-set storage with strict access controls (no training contamination), shadow traffic generation, sampling controls, drift alerting.

## Consequences

- Reversibility: **moderate** — datasets are portable; runner contracts bind.

## Compliance and Governance

Eval datasets are themselves regulated data (lineage, provenance, consent for any human-generated samples).
