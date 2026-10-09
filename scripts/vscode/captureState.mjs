/**
 * Reads the capture state the preview posts to its host, from outside the app: `ready` once the
 * active view has rendered the current scene and every resource and texture it uses has landed.
 * A gate waits for it before it settles the canvas, since two blank readbacks also match.
 */
/* global window */
// `window` exists only in the frames the init script is serialised into.

import { sleep } from './canvasReadback.mjs';

/**
 * The state each capture message names, keyed by the message `type` the webview posts
 * (`PreviewCapture*Message` in apps/textscene-vscode/src/protocol.ts).
 */
export const CAPTURE_STATE_OF_MESSAGE = {
  previewCaptureReady: 'ready',
  previewCapturePending: 'pending',
  previewCaptureUnavailable: 'unavailable',
};

/**
 * Installed before the webview's scripts run, with `CAPTURE_STATE_OF_MESSAGE` as its argument. VS Code assigns `globalThis.acquireVsCodeApi` in the
 * content frame before the bundle runs (`webview/browser/pre/index.html`), so a setter wraps the
 * API it hands out. Self-contained, since `Function.prototype.toString` serialises it.
 */
export function installCaptureStateProbe(stateOfMessage) {
  window.__previewCaptureState = null;
  let acquireWrapped;
  Object.defineProperty(window, 'acquireVsCodeApi', {
    configurable: true,
    get: () => acquireWrapped,
    set(acquire) {
      acquireWrapped = () => {
        const api = acquire();
        return Object.freeze({
          ...api,
          postMessage(message, transfer) {
            const state = stateOfMessage[message?.type];
            if (state) window.__previewCaptureState = state;
            return api.postMessage(message, transfer);
          },
        });
      };
    },
  });
}

/** Waits until the preview reports `ready`, and returns the last state it posted. */
export async function waitForCaptureReady(frame, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await frame.evaluate(() => window.__previewCaptureState ?? null).catch(() => state);
    if (state === 'ready') return state;
    await sleep(intervalMs);
  }
  return state;
}
