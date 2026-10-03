/**
 * Reads the preview's viewport canvas back over CDP, and waits for it to settle or
 * to change. `driveScene.mjs` uses these on the webview frame.
 */
/* global document, HTMLCanvasElement */
// Those globals appear only inside `evaluate` callbacks and init scripts, which are
// serialised and run in the browser, never in this Node process.
import { writeFileSync } from 'node:fs';
import { inkStats } from './pixels.mjs';

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const PNG_DATA_URL_PREFIX = 'data:image/png;base64,';

/** Reads the viewport canvas back as a PNG data URL, or an `error:`/`null` marker. */
export function readCanvasDataUrl(frame) {
  return frame.evaluate(() => {
    // The viewport canvas is the biggest one: offscreen passes mount their
    // own small canvases in the same document.
    const canvas = [...document.querySelectorAll('canvas')].sort(
      (a, b) => b.width * b.height - a.width * a.height
    )[0];
    if (!canvas) return null;
    try {
      return canvas.toDataURL('image/png');
    } catch (error) {
      return `error:${String(error)}`;
    }
  });
}

/**
 * An init script that keeps each WebGL canvas's drawing buffer between frames. three.js
 * leaves `preserveDrawingBuffer` off, so a canvas reads back blank outside the app's own
 * render call. It only preserves what was drawn: it cannot create ink. CDP injects it
 * into every frame, exempt from the webview's CSP, so the app carries no test branch.
 */
export function preserveWebglDrawingBuffer() {
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function patched(type, attributes) {
    if (typeof type === 'string' && type.startsWith('webgl')) {
      return original.call(this, type, { ...(attributes ?? {}), preserveDrawingBuffer: true });
    }
    return original.call(this, type, attributes);
  };
}

const isPng = (dataUrl) => typeof dataUrl === 'string' && dataUrl.startsWith(PNG_DATA_URL_PREFIX);

/**
 * Writes a readback to `file` and returns its ink, or null for a readback that is
 * not a PNG (an `error:` marker or no canvas).
 */
export function writeCanvasPng(dataUrl, file) {
  if (!isPng(dataUrl)) return null;
  const buffer = Buffer.from(dataUrl.slice(PNG_DATA_URL_PREFIX.length), 'base64');
  writeFileSync(file, buffer);
  return inkStats(buffer);
}

/**
 * Waits until two consecutive readbacks are byte-identical, as the golden
 * harness does. Resources arrive over the host channel and the atlas decodes
 * asynchronously, so an early read sees a sized, unpainted canvas with zero
 * ink. Returns the last data URL and whether it stabilised in time.
 */
export async function stabilizeCanvas(frame, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let current = await readCanvasDataUrl(frame).catch(() => null);
  while (Date.now() < deadline) {
    await sleep(intervalMs);
    const previous = current;
    current = await readCanvasDataUrl(frame).catch(() => null);
    if (current && current === previous && isPng(current)) {
      return { dataUrl: current, stable: true };
    }
  }
  return { dataUrl: current, stable: false };
}

/**
 * Waits until a readback differs from `baseline`, after an edit on disk that the
 * preview should pick up. Returns whether it changed in time.
 */
export async function waitForCanvasChange(frame, baseline, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const current = await readCanvasDataUrl(frame).catch(() => null);
    if (isPng(current) && current !== baseline) return true;
    await sleep(intervalMs);
  }
  return false;
}
