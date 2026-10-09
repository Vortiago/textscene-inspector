/* global window */
// `window` is stubbed per test, as the probe sees it in a webview frame.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CAPTURE_STATE_OF_MESSAGE,
  forgetCaptureState,
  installCaptureStateProbe,
  waitForCaptureSettled,
} from './captureState.mjs';
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

  it('records nothing for a type that names an inherited member (edge case)', () => {
    vi.stubGlobal('window', {});
    installCaptureStateProbe(CAPTURE_STATE_OF_MESSAGE);
    window.acquireVsCodeApi = () => ({ postMessage: () => {} });

    window.acquireVsCodeApi().postMessage({ type: 'constructor' });

    expect(window.__previewCaptureState).toBeNull();
  });

  it('passes on the error of an API that refuses a second acquisition (error path)', () => {
    vi.stubGlobal('window', {});
    installCaptureStateProbe(CAPTURE_STATE_OF_MESSAGE);
    window.acquireVsCodeApi = () => {
      throw new Error('An instance of the VS Code API has already been acquired');
    };

    expect(() => window.acquireVsCodeApi()).toThrow('already been acquired');
  });
});

/** A frame that runs what it evaluates against the stubbed `window`. */
const frameRunning = { evaluate: async (fn) => fn() };

describe('forgetCaptureState', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('clears the recorded state, so a wait reads only what the preview posts next', async () => {
    vi.stubGlobal('window', { __previewCaptureState: 'ready' });

    await forgetCaptureState(frameRunning);

    expect(window.__previewCaptureState).toBeNull();
  });

  it('leaves a state that was never recorded cleared (edge case)', async () => {
    vi.stubGlobal('window', {});

    await forgetCaptureState(frameRunning);

    expect(window.__previewCaptureState).toBeNull();
  });

  it('passes on the error of a frame that cannot be reached (error path)', async () => {
    const detached = { evaluate: async () => Promise.reject(new Error('frame detached')) };

    await expect(forgetCaptureState(detached)).rejects.toThrow('frame detached');
  });
});

describe('waitForCaptureSettled', () => {
  it('waits through pending until the preview reports ready', async () => {
    const frame = frameReading(['pending', 'pending', 'ready']);

    expect(await waitForCaptureSettled(frame, QUICK)).toBe('ready');
  });

  it('stops at unavailable, which ready never follows (error path)', async () => {
    const frame = frameReading(['pending', 'unavailable', 'ready']);

    expect(await waitForCaptureSettled(frame, QUICK)).toBe('unavailable');
  });

  it('answers the last state when the timeout ends first (edge case)', async () => {
    const frame = frameReading(['pending']);

    expect(await waitForCaptureSettled(frame, QUICK)).toBe('pending');
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

    expect(await waitForCaptureSettled(frame, QUICK)).toBe('ready');
  });
});
