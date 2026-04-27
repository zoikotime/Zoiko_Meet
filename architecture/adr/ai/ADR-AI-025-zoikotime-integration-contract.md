# ADR-AI-025: ZoikoTime integration contract

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Sema Lead + ZoikoTime Lead |
| Reviewers | Legal, Compliance, Security, Data, ARB |
| Sources | SPEC-AI §29, SPEC §15 (master), ADR-0018 (master), §34 |

## Context

SPEC-AI §29 governs the AI-side contract with ZoikoTime: workforce signals into AI context (with consent + purpose limitation), AI outputs into ZoikoTime workflows (with human confirmation for material changes). High-risk controls when employment-relevant.

## Options Considered

1. **Single shared contract with both data planes (master ADR-0018 + AI-specific overlay)** — recommended.
2. **Separate contracts per direction** — duplicates governance overhead.

## Decision

TBD. Recommended: Option 1. AI-specific overlay specifies prompt-time use of ZoikoTime signals (staleness threshold, consent gate, purpose tag) and AI-side outputs (confidence threshold for ZoikoTime ingestion, human confirmation classes).

## Consequences

- Reversibility: **expensive** — bidirectional events bind both products.

## Compliance and Governance

EU AI Act high-risk controls apply when ZoikoTime signals drive employment-relevant outputs; conformity evidence required.
