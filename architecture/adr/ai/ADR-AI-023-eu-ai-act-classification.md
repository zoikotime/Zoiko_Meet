# ADR-AI-023: EU AI Act classification approach

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Compliance / Legal |
| Reviewers | Head of AI, CTO, ARB |
| Sources | SPEC-AI §31 (compliance posture), §29 (ZoikoTime high-risk boundary), §34 |

## Context

SPEC-AI §31 states general summarisation/search/drafting/extraction are not high-risk by default; ZoikoTime-integrated workforce analytics may become high-risk when configured for employment-related decision support.

## Options Considered

1. **Per-capability classification recorded in prompt registry, reviewed quarterly** — recommended.
2. **Conservative blanket high-risk classification** — reduces compliance ambiguity, raises operational cost.

## Decision

TBD. Recommended: Option 1. Capabilities marked "high-risk-on-enablement" require explicit tenant admin enablement + transparency disclosure + human oversight log.

## Consequences

- Reversibility: **cheap at the classification level**; **expensive if a feature is reclassified after launch**.

## Compliance and Governance

Per-capability classification, version, and effective date are evidence inputs to conformity assessment.
