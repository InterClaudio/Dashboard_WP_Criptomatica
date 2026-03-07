const DEFAULT_SELECTORS = {
  imageInput: 'input[type="file"]',
  promptInput: 'textarea',
  orientationVerticalButton: '[data-orientation="vertical"]',
  orientationHorizontalButton: '[data-orientation="horizontal"]',
  generateButton: 'button[data-action="generate"]',
  generationDone: '[data-generation-status="done"]',
  latestVideo: 'video',
  fallbackDoneText: 'Generation complete'
};

const DEFAULT_CONFIG = {
  orientation: 'vertical',
  mode: 'automatic',
  prompts: [],
  imageDataUrl: '',
  maxVideos: 10,
  mockMode: true,
  retryLimit: 2,
  waitTimeoutMs: 180000,
  pollIntervalMs: 1500,
  selectors: DEFAULT_SELECTORS
};

if (typeof self !== 'undefined') {
  self.DEFAULT_CONFIG = DEFAULT_CONFIG;
  self.DEFAULT_SELECTORS = DEFAULT_SELECTORS;
}
