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
 * Installed before the webview's scripts run, with `CAPTURE_STATE_OF_MESSAGE` as its argument.
 * VS Code assigns `globalThis.acquireVsCodeApi` in the content frame before the bundle runs
 * (`webview/browser/pre/index.html`), so a setter wraps the API it hands out. Self-contained,
 * since `Function.prototype.toString` serialises it.
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
            // `hasOwn`, not a bare lookup: a type such as `constructor` names an inherited member.
            if (Object.hasOwn(stateOfMessage, message?.type ?? '')) {
              window.__previewCaptureState = stateOfMessage[message.type];
            }
            return api.postMessage(message, transfer);
          },
        });
      };
    },
  });
}

/** Clears the recorded state, so a later wait reads only what the preview posts after this. */
export async function forgetCaptureState(frame) {
  await frame.evaluate(() => {
    window.__previewCaptureState = null;
  });
}

/** `unavailable` means the viewport crashed, so waiting longer for `ready` only spends the timeout. */
const SETTLED_STATES = new Set(['ready', 'unavailable']);

/** Waits until the preview reports `ready` or `unavailable`, and returns the last state it posted. */
export async function waitForCaptureSettled(frame, { timeoutMs, intervalMs }) {
  const deadline = Date.now() + timeoutMs;
  let state = null;
  while (Date.now() < deadline) {
    state = await frame.evaluate(() => window.__previewCaptureState ?? null).catch(() => state);
    if (SETTLED_STATES.has(state)) return state;
    await sleep(intervalMs);
  }
  return state;
}
