/* global window */
// `window` is stubbed per test, as the probe sees it in a webview frame.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAPTURE_STATE_OF_MESSAGE, installCaptureStateProbe, waitForCaptureReady } from './captureState.mjs';
import { frameReading } from './frameReading.testkit.mjs';

const PROTOCOL = readFileSync(
  join(import.meta.dirname, '../../apps/textscene-vscode/src/protocol.ts'),
  'utf8'
);

const QUICK = { timeoutMs: 200, intervalMs: 1 };

describe('CAPTURE_STATE_OF_MESSAGE', () => {
  it('names only message types the webview protocol declares', () => {
    for (const type of Object.keys(CAPTURE_STATE_OF_MESSAGE)) expect(PROTOCOL).toContain(`type: '${type}'`);
  });
});

describe('installCaptureStateProbe', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('records the latest capture state the webview posts, and still posts it to the host', () => {
    vi.stubGlobal('window', {});
    installCaptureStateProbe(CAPTURE_STATE_OF_MESSAGE);
    const postMessage = vi.fn();
    window.acquireVsCodeApi = () => ({ postMessage, getState: () => null });

    const api = window.acquireVsCodeApi();
    api.postMessage({ type: 'previewCapturePending' });
    api.postMessage({ type: 'previewCaptureReady' });

    expect(window.__previewCaptureState).toBe('ready');
    expect(postMessage).toHaveBeenCalledTimes(2);
  });

  it('records nothing for a message that is no capture state (edge case)', () => {
    vi.stubGlobal('window', {});
    installCaptureStateProbe(CAPTURE_STATE_OF_MESSAGE);
    window.acquireVsCodeApi = () => ({ postMessage: () => {} });

    window.acquireVsCodeApi().postMessage({ type: 'log', level: 'info' });

    expect(window.__previewCaptureState).toBeNull();
  });
});

describe('waitForCaptureReady', () => {
  it('waits through pending until the preview reports ready', async () => {
    const frame = frameReading(['pending', 'pending', 'ready']);

    expect(await waitForCaptureReady(frame, QUICK)).toBe('ready');
  });

  it('answers the last state when ready never arrives (error path)', async () => {
    const frame = frameReading(['unavailable']);

    expect(await waitForCaptureReady(frame, QUICK)).toBe('unavailable');
  });

  it('keeps polling through a frame that cannot be read (edge case)', async () => {
    let reads = 0;
    const frame = {
      evaluate: async () => {
        reads += 1;
        if (reads === 1) throw new Error('frame detached');
        return 'ready';
      },
    };

    expect(await waitForCaptureReady(frame, QUICK)).toBe('ready');
  });
});
