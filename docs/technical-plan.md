# Technical Plan

## Phase 1 — Foundation (done)

- Create MV3 skeleton (manifest, popup, background, content script)
- Define persistent storage schema (`config`, `runState`, `logs`)
- Implement popup controls and status/log rendering

## Phase 2 — Automation loop (done for MVP)

- Implement chained workflow for up to 10 prompts
- Implement automatic and step-by-step run modes
- Capture frame from generated video for next step seed
- Add retry handling and terminal error state

## Phase 3 — Robustness (next)

- Multi-selector fallbacks and runtime selector diagnostics
- Better completion detection heuristics
- Guardrails for CORS/DRM capture failures

## Phase 4 — Production readiness (next)

- Automated tests
- richer UI feedback
- export/import session snapshots
