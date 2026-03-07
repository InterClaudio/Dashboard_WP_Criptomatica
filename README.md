# Grok Video Sequence Automator (Chrome Extension MV3)

This extension automates chained video generation on Grok:

1. Video 1 = initial image + prompt 1.
2. Wait for completion.
3. Capture last frame from resulting video.
4. Use captured frame as input for next prompt.
5. Repeat for up to 10 prompts.

## Features (MVP)

- Manifest V3 extension
- Popup control UI (config + progress + logs)
- Background service worker orchestration
- Content script automation against configurable selectors
- Persistent resumable state in `chrome.storage.local`
- Automatic mode and step-by-step mode
- Retry + error handling with logs
- Mock mode for local testing without Grok dependency
- Configurable selectors to survive Grok UI changes

## Install (Developer Mode)

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this repository root folder
5. Open Grok in an active tab and use popup controls

## Usage

1. Open extension popup.
2. Upload initial image.
3. Add prompts (one line each, max 10).
4. Choose orientation, mode, retries, and selectors.
5. Keep **Mock mode ON** for testing, OFF for real UI automation.
6. Click **Start**.
7. In step mode, click **Next** after each completed step.
8. Use **Pause**, **Resume**, and **Reset** as needed.

## Important Notes

- Grok UI can change frequently; update selector JSON in popup.
- MVP frame extraction captures current pixels from the latest `<video>` element.
- For cross-origin/CORS or DRM restrictions, frame capture may fail.

## Project docs

- `ARCHITECTURE.md` – design and data flow
- `TODO.md` – next improvements
- `docs/technical-plan.md` – phased implementation plan
