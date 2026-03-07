(() => {
  if (window.__grokSequenceLoaded) return;
  window.__grokSequenceLoaded = true;

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function mustFind(selector, label) {
    const el = document.querySelector(selector);
    if (!el) {
      throw new Error(`Selector not found (${label}): ${selector}`);
    }
    return el;
  }

  async function waitForCompletion(config) {
    const started = Date.now();

    while (Date.now() - started < config.waitTimeoutMs) {
      if (config.selectors.generationDone && document.querySelector(config.selectors.generationDone)) {
        return;
      }

      if (config.selectors.fallbackDoneText && document.body.textContent.includes(config.selectors.fallbackDoneText)) {
        return;
      }

      await wait(config.pollIntervalMs);
    }

    throw new Error('Timed out waiting for generation completion.');
  }

  async function dataUrlToFile(dataUrl, name) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], name, { type: blob.type || 'image/png' });
  }

  async function uploadImage(imageDataUrl, selector) {
    const input = mustFind(selector, 'imageInput');
    const file = await dataUrlToFile(imageDataUrl, 'seed.png');
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function setPrompt(prompt, selector) {
    const field = mustFind(selector, 'promptInput');
    field.focus();
    field.value = prompt;
    field.dispatchEvent(new InputEvent('input', { bubbles: true }));
  }

  function setOrientation(orientation, selectors) {
    const target = orientation === 'vertical' ? selectors.orientationVerticalButton : selectors.orientationHorizontalButton;
    if (!target) return;
    const button = document.querySelector(target);
    button?.click();
  }

  function clickGenerate(selector) {
    const button = mustFind(selector, 'generateButton');
    button.click();
  }

  function captureLastFrame(selector) {
    const video = mustFind(selector, 'latestVideo');

    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1024;
    const height = video.videoHeight || 576;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    return canvas.toDataURL('image/png');
  }

  async function runMockStep(step, total) {
    await wait(1200 + Math.random() * 1000);

    const canvas = document.createElement('canvas');
    canvas.width = 720;
    canvas.height = 1280;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#36fcb9';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText(`Mock frame ${step}/${total}`, 40, 120);
    ctx.fillStyle = '#fff';
    ctx.font = '28px monospace';
    ctx.fillText(new Date().toLocaleTimeString(), 40, 180);

    return canvas.toDataURL('image/png');
  }

  async function executeStep(message) {
    try {
      const { config, prompt, imageDataUrl, step, total } = message;

      let frameDataUrl;
      if (config.mockMode) {
        frameDataUrl = await runMockStep(step, total);
      } else {
        await uploadImage(imageDataUrl, config.selectors.imageInput);
        setPrompt(prompt, config.selectors.promptInput);
        setOrientation(config.orientation, config.selectors);
        clickGenerate(config.selectors.generateButton);
        await waitForCompletion(config);
        frameDataUrl = captureLastFrame(config.selectors.latestVideo);
      }

      await chrome.runtime.sendMessage({
        type: 'STEP_DONE',
        success: true,
        step,
        lastFrameDataUrl: frameDataUrl
      });
    } catch (error) {
      await chrome.runtime.sendMessage({
        type: 'STEP_DONE',
        success: false,
        error: error.message
      });
    }
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'PING') {
      sendResponse({ ok: true });
      return;
    }

    if (message.type === 'EXECUTE_STEP') {
      executeStep(message);
      sendResponse({ ok: true });
    }
  });
})();
