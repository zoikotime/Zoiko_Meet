# ADR-0002: Media / SFU Provider

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Media Engineering Lead |
| Reviewers | Mobile, Security, AI, SRE, Finance |
| Sources | SPEC §13 (media plane), §25 (50K→500K concurrent participants/region), §27 (media RTO 10 min), §28, §34 |

## Context

SPEC §13 mandates "buy-first SFU/media infrastructure unless an ADR approves build." The current codebase (`server/app/connect/media_service/`) already has a `livekit_provider.py` stub and a `null_provider.py`. Capacity targets demand a provider proven at 50K concurrent per region in 12 months and 500K in 36 months, with regional routing and provider failover.

## Options Considered

1. **LiveKit Cloud** (managed) — open-source SFU, hosted offering, multi-region edge, free egress between rooms. Stub already exists in repo.
2. **LiveKit self-hosted** — same SDKs, full operational control, bigger SRE burden.
3. **100ms** — managed SFU, strong APAC/Indian-market presence, recording/captions native.
4. **Daily.co** — mature managed SFU, simpler API, narrower customisation.
5. **Agora** — global edge presence, strong mobile, opaque pricing at scale.
6. **Twilio Video** — being deprecated; rejected.
7. **Build mediasoup-based SFU** — explicitly disfavoured by SPEC §13 unless cost / control / scale justify.

## Decision

TBD. Default position per SPEC: **buy-first**. Recommended starting point for evaluation: LiveKit Cloud (architecture already aligned). Final selection requires:
- Concurrent-participants test at 1K and 5K.
- Regional latency test US/EU/APAC.
- Cost projection at 12M target volume.
- Recording / caption / transcript pipeline fit.

## Consequences

- Reversibility: **moderate** if we abstract behind `media_service.provider.MediaProvider`. The repo already does this.
- Single-vendor risk mitigated by ADR-mandated secondary provider per SPEC §27.

## Compliance and Governance

- Provider must support regional media routing pinned to workspace residency.
- Recordings must land in our object storage, not the provider's.
- DPA required; sub-processor list reviewed against tenant DPAs.
