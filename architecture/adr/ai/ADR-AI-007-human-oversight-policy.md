# ADR-AI-007: Human oversight policy by risk class

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Legal, Compliance, Security, Product |
| Sources | SPEC-AI §15 (oversight modes), §14 (output classes), §34 |

## Context

SPEC-AI §15 defines four oversight modes: human-in-command, human-in-the-loop, human-on-the-loop, autonomous-within-policy. The default doctrine is human-in-command for material decisions.

## Options Considered

1. **Adopt SPEC-AI §15 verbatim** — recommended.
2. **Mode chosen per capability via prompt-registry metadata** — implementation detail, compatible with Option 1.

## Decision

Adopt SPEC-AI §15 verbatim. Each capability registers its default oversight mode; tenant policy may tighten but not loosen.

## Consequences

- Reversibility: **cheap** at the policy level; **expensive** if UI flows assume autonomous mode and have to add human gates retroactively.

## Compliance and Governance

Human oversight log entries are EU AI Act evidence; retained per SPEC-AI §30 high-risk evidence retention.
