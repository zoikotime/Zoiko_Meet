# ADR-0009: Desktop Strategy

| Field | Value |
|---|---|
| Status | Proposed |
| Date | 2026-04-27 |
| Owner | Client Engineering Lead |
| Reviewers | Platform, Security, Product |
| Sources | SPEC §18, §24, §26 |

## Context

The current repo ships an **Electron** desktop app via `electron-builder` with auto-update through `electron-updater` (`client/electron/`, `.github/workflows/release.yml`). SPEC §18 requires meetings, notifications and secure updates. SPEC §26 default: TypeScript-based shell **or** native by ADR.

## Options Considered

1. **Continue with Electron** — already shipping, accept memory/disk overhead.
2. **Tauri** — smaller binary, Rust shell, Webview-based; weaker WebRTC story.
3. **Native (Swift macOS / WinUI Windows / GTK Linux)** — best performance, three codebases.
4. **PWA only** — rejected; SPEC requires desktop notifications and OS integration.

## Decision

TBD. Recommended: **continue with Electron** unless and until performance complaints or distribution costs justify Tauri/native. The current `release.yml` and `electron-updater` flow are functional and aligned with SPEC §24 (rollback via channel switching).

## Consequences

- Reversibility: **moderate** — UI ports from React but native bridges (notifications, autostart, deep-link) re-implement.
- Code-signing certificates required for macOS notarisation and Windows SmartScreen.

## Compliance and Governance

- Auto-update channel must respect user/admin control (enterprise pinning).
- Crash reports must not exfiltrate tenant content.
