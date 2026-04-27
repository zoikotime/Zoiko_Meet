# ADR-AI-021: Provider risk classification and exit conditions

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Head of AI |
| Reviewers | Legal, Security, Finance, ARB |
| Sources | SPEC-AI §18 (provider risk dimensions), §17, §34 |

## Context

SPEC-AI §18 defines six risk dimensions: commercial, capability, availability, geopolitical, data handling, concentration. The 70% concentration cap is the default exit trigger.

## Options Considered

1. **Quarterly provider risk review with scored dimensions and predefined exit triggers** — recommended.
2. **Ad-hoc review on incidents** — fails SPEC §18 cadence requirement.

## Decision

TBD. Recommended: quarterly review owned by Head of AI; exit triggers tied to concrete metrics (concentration breach, eval regression > X, outage hours > Y, contract change material to DPA).

## Consequences

- Reversibility: **moderate** — exit is expensive; pre-positioning matters.

## Compliance and Governance

Risk register entries are SOC 2 vendor-management evidence.
