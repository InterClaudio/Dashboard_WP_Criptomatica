importScripts('../shared/defaults.js');

const STORAGE_KEYS = {
  config: 'grok.config',
  runState: 'grok.runState',
  logs: 'grok.logs'
};

async function getStorage(keys) {
  return chrome.storage.local.get(keys);
}

async function setStorage(payload) {
  return chrome.storage.local.set(payload);
}

function log(message, level = 'info') {
  const entry = {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message
  };

  chrome.storage.local.get([STORAGE_KEYS.logs]).then((data) => {
    const nextLogs = [...(data[STORAGE_KEYS.logs] || []), entry].slice(-300);
    chrome.storage.local.set({ [STORAGE_KEYS.logs]: nextLogs });
  });
}

function sanitizePrompts(prompts) {
  return (prompts || []).map((p) => p.trim()).filter(Boolean).slice(0, 10);
}

async function readState() {
  const data = await getStorage([STORAGE_KEYS.config, STORAGE_KEYS.runState]);
  const config = { ...DEFAULT_CONFIG, ...(data[STORAGE_KEYS.config] || {}) };
  const runState = data[STORAGE_KEYS.runState] || {
    status: 'idle',
    currentIndex: 0,
    completed: 0,
    errors: 0,
    retries: 0,
    videoFrames: [],
    startedAt: null,
    updatedAt: null,
    waitingForManualAdvance: false,
    activeTabId: null
  };
  return { config, runState };
}

async function writeState(config, runState) {
  runState.updatedAt = new Date().toISOString();
  await setStorage({
    [STORAGE_KEYS.config]: config,
    [STORAGE_KEYS.runState]: runState
  });
}

async function ensureContentScript(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'PING' });
  } catch {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['src/content/content-script.js']
    });
  }
}

async function getTargetTabId(providedTabId) {
  if (providedTabId) return providedTabId;
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

async function dispatchCurrentStep(reason = 'run') {
  const { config, runState } = await readState();
  if (runState.status !== 'running') return;

  const tabId = runState.activeTabId;
  if (!tabId) {
    runState.status = 'error';
    await writeState(config, runState);
    log('No active Grok tab found. Open Grok and resume.', 'error');
    return;
  }

  const prompts = sanitizePrompts(config.prompts);
  const maxCount = Math.min(config.maxVideos, prompts.length);

  if (runState.currentIndex >= maxCount) {
    runState.status = 'completed';
    await writeState(config, runState);
    log('Sequence completed.');
    return;
  }

  const prompt = prompts[runState.currentIndex];
  const seedImage = runState.currentIndex === 0 ? config.imageDataUrl : runState.videoFrames[runState.currentIndex - 1] || config.imageDataUrl;

  if (!prompt || !seedImage) {
    runState.status = 'error';
    await writeState(config, runState);
    log('Missing prompt or seed image. Check configuration.', 'error');
    return;
  }

  await ensureContentScript(tabId);

  const payload = {
    type: 'EXECUTE_STEP',
    step: runState.currentIndex + 1,
    total: maxCount,
    prompt,
    imageDataUrl: seedImage,
    config
  };

  log(`Dispatching step ${runState.currentIndex + 1}/${maxCount} (${reason}).`);
  await chrome.tabs.sendMessage(tabId, payload);
}

async function startRun({ tabId, resume = false }) {
  const resolvedTabId = await getTargetTabId(tabId);
  const { config, runState } = await readState();
  config.prompts = sanitizePrompts(config.prompts);

  if (!resume) {
    runState.currentIndex = 0;
    runState.completed = 0;
    runState.errors = 0;
    runState.retries = 0;
    runState.videoFrames = [];
    runState.waitingForManualAdvance = false;
    runState.startedAt = new Date().toISOString();
  }

  runState.status = 'running';
  runState.activeTabId = resolvedTabId || null;
  await writeState(config, runState);
  log(resume ? 'Resuming run.' : 'Starting new run.');
  await dispatchCurrentStep('start');
}

async function stopRun() {
  const { config, runState } = await readState();
  runState.status = 'paused';
  runState.waitingForManualAdvance = false;
  await writeState(config, runState);
  log('Run paused by user.', 'warn');
}

async function resetRun() {
  const { config } = await readState();
  const runState = {
    status: 'idle',
    currentIndex: 0,
    completed: 0,
    errors: 0,
    retries: 0,
    videoFrames: [],
    startedAt: null,
    updatedAt: null,
    waitingForManualAdvance: false,
    activeTabId: null
  };
  await setStorage({ [STORAGE_KEYS.runState]: runState, [STORAGE_KEYS.logs]: [] });
  await writeState(config, runState);
  log('State reset.');
}

async function handleStepResult(message) {
  const { config, runState } = await readState();
  if (runState.status !== 'running') return;

  if (message.success) {
    runState.videoFrames[runState.currentIndex] = message.lastFrameDataUrl;
    runState.currentIndex += 1;
    runState.completed = runState.currentIndex;
    runState.retries = 0;
    runState.waitingForManualAdvance = config.mode === 'step';
    log(`Step ${runState.completed} completed.`);
    await writeState(config, runState);

    if (config.mode === 'automatic') {
      await dispatchCurrentStep('auto-next');
    }
    return;
  }

  runState.errors += 1;
  runState.retries += 1;

  if (runState.retries <= config.retryLimit) {
    await writeState(config, runState);
    log(`Step ${runState.currentIndex + 1} failed: ${message.error}. Retrying (${runState.retries}/${config.retryLimit}).`, 'warn');
    await dispatchCurrentStep('retry');
    return;
  }

  runState.status = 'error';
  runState.waitingForManualAdvance = false;
  await writeState(config, runState);
  log(`Run stopped after retries exhausted: ${message.error}`, 'error');
}

chrome.runtime.onInstalled.addListener(async () => {
  const initial = await getStorage([STORAGE_KEYS.config, STORAGE_KEYS.runState]);
  if (!initial[STORAGE_KEYS.config]) {
    await setStorage({ [STORAGE_KEYS.config]: DEFAULT_CONFIG });
  }
  if (!initial[STORAGE_KEYS.runState]) {
    await resetRun();
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    switch (message.type) {
      case 'START_RUN':
        await startRun({ tabId: message.tabId, resume: false });
        sendResponse({ ok: true });
        break;
      case 'RESUME_RUN':
        await startRun({ tabId: message.tabId, resume: true });
        sendResponse({ ok: true });
        break;
      case 'STOP_RUN':
        await stopRun();
        sendResponse({ ok: true });
        break;
      case 'RESET_RUN':
        await resetRun();
        sendResponse({ ok: true });
        break;
      case 'STEP_DONE':
        await handleStepResult(message);
        sendResponse({ ok: true });
        break;
      case 'MANUAL_NEXT': {
        const { config, runState } = await readState();
        if (runState.status === 'running' && runState.waitingForManualAdvance) {
          runState.waitingForManualAdvance = false;
          await writeState(config, runState);
          await dispatchCurrentStep('manual-next');
        }
        sendResponse({ ok: true });
        break;
      }
      case 'UPDATE_CONFIG': {
        const { runState } = await readState();
        const merged = {
          ...DEFAULT_CONFIG,
          ...message.config,
          prompts: sanitizePrompts(message.config?.prompts || []),
          selectors: { ...DEFAULT_SELECTORS, ...(message.config?.selectors || {}) }
        };
        await setStorage({ [STORAGE_KEYS.config]: merged });
        await writeState(merged, runState);
        log('Configuration updated.');
        sendResponse({ ok: true });
        break;
      }
      case 'GET_STATUS': {
        const data = await getStorage([STORAGE_KEYS.config, STORAGE_KEYS.runState, STORAGE_KEYS.logs]);
        sendResponse({
          ok: true,
          config: { ...DEFAULT_CONFIG, ...(data[STORAGE_KEYS.config] || {}) },
          runState: data[STORAGE_KEYS.runState],
          logs: data[STORAGE_KEYS.logs] || []
        });
        break;
      }
      default:
        sendResponse({ ok: false, error: 'Unknown message' });
    }
  })().catch((error) => {
    log(`Runtime error: ${error.message}`, 'error');
    sendResponse({ ok: false, error: error.message });
  });

  return true;
});
