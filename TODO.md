# TODO

## Reliability

- Add per-selector fallback chains (multiple selectors by priority)
- Detect stale tab URL and prompt user to reopen Grok
- Add exponential backoff policy for retries

## Video/frame pipeline

- Add deterministic "last rendered frame" extraction based on video duration seek
- Support downloading/exporting intermediate frames and metadata
- Add optional JPEG quality configuration

## UX

- Add prompt list editor with per-step status badges
- Add import/export config JSON
- Add progress bar and ETA estimates

## Testing

- Unit tests for storage/state transitions
- Integration harness with mock DOM fixtures
- E2E flow tests for popup/background message contracts

## Hardening

- Optional encrypted local persistence for sensitive prompts
- Strict URL allow-list beyond host permissions
- Telemetry toggle for debugging (off by default)
