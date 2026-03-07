const ui = {
  imageInput: document.getElementById('imageInput'),
  prompts: document.getElementById('prompts'),
  orientation: document.getElementById('orientation'),
  mode: document.getElementById('mode'),
  mockMode: document.getElementById('mockMode'),
  retryLimit: document.getElementById('retryLimit'),
  selectors: document.getElementById('selectors'),
  progress: document.getElementById('progress'),
  logs: document.getElementById('logs')
};

async function send(type, payload = {}) {
  return chrome.runtime.sendMessage({ type, ...payload });
}

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs[0]?.id;
}

function readPrompts() {
  return ui.prompts.value.split('\n').map((p) => p.trim()).filter(Boolean).slice(0, 10);
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function collectConfig() {
  let selectors;
  try {
    selectors = JSON.parse(ui.selectors.value || '{}');
  } catch {
    throw new Error('Selectors JSON is invalid.');
  }

  let imageDataUrl = '';
  const file = ui.imageInput.files[0];
  if (file) imageDataUrl = await fileToDataUrl(file);

  return {
    orientation: ui.orientation.value,
    mode: ui.mode.value,
    prompts: readPrompts(),
    imageDataUrl,
    mockMode: ui.mockMode.checked,
    retryLimit: Number(ui.retryLimit.value || 2),
    selectors
  };
}

async function saveConfig() {
  const existing = await send('GET_STATUS');
  const fromForm = await collectConfig();

  const merged = {
    ...(existing.config || DEFAULT_CONFIG),
    ...fromForm,
    imageDataUrl: fromForm.imageDataUrl || existing.config?.imageDataUrl || ''
  };

  await send('UPDATE_CONFIG', { config: merged });
  await refresh();
}

function hydrate(config) {
  ui.prompts.value = (config.prompts || []).join('\n');
  ui.orientation.value = config.orientation || 'vertical';
  ui.mode.value = config.mode || 'automatic';
  ui.mockMode.checked = Boolean(config.mockMode);
  ui.retryLimit.value = config.retryLimit ?? 2;
  ui.selectors.value = JSON.stringify(config.selectors || DEFAULT_SELECTORS, null, 2);
}

function render(runState, logs) {
  const snapshot = {
    status: runState?.status || 'idle',
    currentStep: (runState?.currentIndex || 0) + 1,
    completed: runState?.completed || 0,
    errors: runState?.errors || 0,
    waitingForManualAdvance: runState?.waitingForManualAdvance || false,
    startedAt: runState?.startedAt || null,
    updatedAt: runState?.updatedAt || null
  };
  ui.progress.textContent = JSON.stringify(snapshot, null, 2);

  ui.logs.textContent = (logs || [])
    .slice(-30)
    .map((item) => `[${new Date(item.timestamp).toLocaleTimeString()}] ${item.level.toUpperCase()} ${item.message}`)
    .join('\n');
}

async function refresh() {
  const status = await send('GET_STATUS');
  hydrate(status.config || DEFAULT_CONFIG);
  render(status.runState || {}, status.logs || []);
}

document.getElementById('saveConfig').addEventListener('click', async () => {
  try {
    await saveConfig();
  } catch (error) {
    alert(error.message);
  }
});

document.getElementById('start').addEventListener('click', async () => {
  await saveConfig();
  const tabId = await getActiveTabId();
  await send('START_RUN', { tabId });
  await refresh();
});

document.getElementById('resume').addEventListener('click', async () => {
  const tabId = await getActiveTabId();
  await send('RESUME_RUN', { tabId });
  await refresh();
});

document.getElementById('next').addEventListener('click', async () => {
  await send('MANUAL_NEXT');
  await refresh();
});

document.getElementById('pause').addEventListener('click', async () => {
  await send('STOP_RUN');
  await refresh();
});

document.getElementById('reset').addEventListener('click', async () => {
  await send('RESET_RUN');
  await refresh();
});

chrome.storage.onChanged.addListener(() => refresh());
refresh();
