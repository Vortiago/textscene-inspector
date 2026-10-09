/* global window */
// `window` is stubbed per test, as the probe sees it in a webview frame.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installCaptureStateProbe, latestCaptureState, waitForCaptureReady } from './captureState.mjs';

const QUICK = { timeoutMs: 200, intervalMs: 1 };

/** A frame whose probe history is `states` on each read, the last one repeating. */
function frameWithStates(...histories) {
  let index = 0;
  return { evaluate: async () => histories[Math.min(index++, histories.length - 1)] };
}

describe('installCaptureStateProbe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records each capture state the webview posts, and still posts it to the host', () => {
    vi.stubGlobal('window', {});
    installCaptureStateProbe();
    const postMessage = vi.fn();
    window.acquireVsCodeApi = () => ({ postMessage, getState: () => null });

    const api = window.acquireVsCodeApi();
    api.postMessage({ type: 'previewCapturePending' });
    api.postMessage({ type: 'previewCaptureReady' });

    expect(window.__previewCaptureStates).toEqual(['pending', 'ready']);
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('records nothing for a message that is no capture state (edge case)', () => {
    vi.stubGlobal('window', {});
    installCaptureStateProbe();
    window.acquireVsCodeApi = () => ({ postMessage: () => {} });

    window.acquireVsCodeApi().postMessage({ type: 'log', level: 'info' });

    expect(window.__previewCaptureStates).toEqual([]);
  });
});

describe('latestCaptureState', () => {
  it('is the last state posted', () => {
    expect(latestCaptureState(['pending', 'ready'])).toBe('ready');
  });

  it('is null before the preview posts one, or for an unread history (edge case)', () => {
    expect(latestCaptureState([])).toBeNull();
    expect(latestCaptureState(undefined)).toBeNull();
  });
});

describe('waitForCaptureReady', () => {
  it('waits through pending until the preview reports ready', async () => {
    const frame = frameWithStates(['pending'], ['pending'], ['pending', 'ready']);

    expect(await waitForCaptureReady(frame, QUICK)).toBe('ready');
  });

  it('answers the last state when ready never arrives (error path)', async () => {
    const frame = frameWithStates(['pending', 'unavailable']);

    expect(await waitForCaptureReady(frame, QUICK)).toBe('unavailable');
  });

  it('keeps polling through a frame that cannot be read (edge case)', async () => {
    let reads = 0;
    const frame = {
      evaluate: async () => {
        reads += 1;
        if (reads === 1) throw new Error('frame detached');
        return ['ready'];
      },
    };

    expect(await waitForCaptureReady(frame, QUICK)).toBe('ready');
  });
});
