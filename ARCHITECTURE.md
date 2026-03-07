# Architecture

## Components

- **Popup (`src/popup`)**
  - Collects config (image, prompts, orientation, mode, retries, selectors)
  - Sends commands (`START_RUN`, `PAUSE`, `RESUME`, `RESET`, `MANUAL_NEXT`)
  - Renders current state and logs

- **Background service worker (`src/background/service-worker.js`)**
  - Source of truth for run lifecycle
  - Stores/reads `config`, `runState`, and `logs` from `chrome.storage.local`
  - Dispatches each step to content script
  - Handles success/failure, retries, and next-step transitions

- **Content script (`src/content/content-script.js`)**
  - Interacts with Grok page via configurable selectors
  - Uploads seed image, sets prompt/orientation, triggers generation
  - Waits for completion signal
  - Captures last frame from latest video
  - Reports results back to background

- **Shared defaults (`src/shared/defaults.js`)**
  - Default config and selectors

## State model

- `grok.config`
  - User-defined run configuration
- `grok.runState`
  - `status`, `currentIndex`, `completed`, `errors`, `retries`, `videoFrames`, etc.
- `grok.logs`
  - rolling structured log history

## Execution flow

1. Popup saves config and sends `START_RUN`.
2. Background validates state and dispatches step `n`.
3. Content script executes step and returns `STEP_DONE`.
4. Background persists frame/error and decides:
   - auto mode: run next step immediately
   - step mode: wait for `MANUAL_NEXT`
5. Stops at completion, pause, or fatal error.

## Resumability

Because state is persisted in `chrome.storage.local`, a run can resume after popup close, tab refresh, or browser restart (if tab is still accessible and user resumes).
