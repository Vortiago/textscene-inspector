/**
 * `TscnPreviewPanel.capture()` through the production dispatch. The panel holds a request
 * until the webview reports its capture state: `ready` posts it, `unavailable` answers the
 * reason, and `pending` keeps it waiting. While a request waits, the panel pings the webview,
 * and only an unanswered ping ends it. The fake panel's `postMessage` is the only probe.
 */
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { PING_INTERVAL_MS, WEBVIEW_LOAD_DEADLINE_MS } from './previewCaptureQueue';
import { createMockUri, createMockFileData, setupMockPanel, type MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';
const PNG = 'data:image/png;base64,AA==';

async function openPanel(): Promise<{
  panel: TscnPreviewPanel;
  webview: MockWebview;
  triggerMessage: (msg: unknown) => void;
}> {
  const { webview, triggerMessage } = setupMockPanel();
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/workspace/scene.tscn'));
  await vi.waitFor(() => expect(vscode.workspace.fs.readFile).toHaveBeenCalled());
  return { panel, webview, triggerMessage };
}

function captureRequestIds(webview: MockWebview): string[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0] as { type: string; requestId?: string })
    .filter((m) => m.type === 'capturePreview')
    .map((m) => m.requestId!);
}

function pingIds(webview: MockWebview): string[] {
  return webview.postMessage.mock.calls
    .map((c) => c[0] as { type: string; pingId?: string })
    .filter((m) => m.type === 'capturePing')
    .map((m) => m.pingId!);
}

/** Answers every ping posted so far, as a live webview does. */
function answerPings(webview: MockWebview, triggerMessage: (msg: unknown) => void): void {
  for (const pingId of pingIds(webview)) triggerMessage({ type: 'capturePong', pingId });
}

/** Lets every settled promise run its continuation. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** The capture's answer if it has settled, or `'waiting'`, without waiting on a timer. */
function settledOrWaiting(captured: Promise<unknown>): Promise<unknown> {
  return Promise.race([captured, Promise.resolve().then(() => 'waiting')]);
}

describe('TscnPreviewPanel.capture', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('holds a request made before the canvas is ready, then posts it and answers the image', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    const captured = panel.capture();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCapturePending' });
    expect(captureRequestIds(webview)).toEqual([]);

    triggerMessage({ type: 'previewCaptureReady' });
    const [requestId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId, dataUrl: PNG });

    await expect(captured).resolves.toEqual({ dataUrl: PNG });
  });

  it('posts a request made after ready at once, and answers the image', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });

    const captured = panel.capture();
    const [requestId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId, dataUrl: PNG });

    await expect(captured).resolves.toEqual({ dataUrl: PNG });
  });

  it('answers the unavailable reason, and posts no request', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureUnavailable', reason: 'The viewport crashed: no WebGL.' });

    await expect(panel.capture()).resolves.toEqual({ error: 'The viewport crashed: no WebGL.' });
    expect(captureRequestIds(webview)).toEqual([]);
  });

  it('answers a waiting request when the state turns unavailable', async () => {
    const { panel, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    const captured = panel.capture();

    triggerMessage({ type: 'previewCaptureUnavailable', reason: 'no WebGL' });

    await expect(captured).resolves.toEqual({ error: 'no WebGL' });
  });

  it('answers the reason the webview gives for a request it could not capture', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });

    const captured = panel.capture();
    const [requestId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptureError', requestId, error: 'closed before the capture' });

    await expect(captured).resolves.toEqual({ error: 'closed before the capture' });
  });

  it('ignores a state the old document reported once a remount posts webviewReady', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    triggerMessage({ type: 'webviewReady' });

    void panel.capture();

    expect(captureRequestIds(webview)).toEqual([]);
  });

  it('posts a request again to the document that replaces the one that held it', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    const captured = panel.capture();
    triggerMessage({ type: 'webviewReady' });

    triggerMessage({ type: 'previewCaptureReady' });
    const [first, second] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId: second, dataUrl: PNG });

    expect(second).not.toBe(first);
    await expect(captured).resolves.toEqual({ dataUrl: PNG });
  });

  it('answers "closed" to a waiting request when the panel is disposed', async () => {
    const { panel, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    const captured = panel.capture();

    panel.dispose();

    await expect(captured).resolves.toEqual({ error: 'The preview was closed.' });
  });

  it('answers "closed" to a request made after dispose', async () => {
    const { panel } = await openPanel();
    panel.dispose();

    await expect(panel.capture()).resolves.toEqual({ error: 'The preview was closed.' });
  });

  it('keeps a pending request past the load deadline while the webview answers each ping', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCapturePending' });
    const captured = panel.capture();

    for (let elapsed = 0; elapsed < 2 * WEBVIEW_LOAD_DEADLINE_MS; elapsed += PING_INTERVAL_MS) {
      vi.advanceTimersByTime(PING_INTERVAL_MS);
      answerPings(webview, triggerMessage);
    }
    triggerMessage({ type: 'previewCaptureReady' });
    const [requestId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId, dataUrl: PNG });

    await expect(captured).resolves.toEqual({ dataUrl: PNG });
  });

  it('lifts the load deadline from a request made before the webview loaded', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    const captured = panel.capture();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCapturePending' });

    for (let elapsed = 0; elapsed < 2 * WEBVIEW_LOAD_DEADLINE_MS; elapsed += PING_INTERVAL_MS) {
      vi.advanceTimersByTime(PING_INTERVAL_MS);
      answerPings(webview, triggerMessage);
    }
    triggerMessage({ type: 'previewCaptureReady' });
    const [requestId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId, dataUrl: PNG });

    await expect(captured).resolves.toEqual({ dataUrl: PNG });
  });

  it('ends a pending request when the webview leaves a ping unanswered', async () => {
    const { panel, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCapturePending' });
    const captured = panel.capture();

    vi.advanceTimersByTime(2 * PING_INTERVAL_MS);

    await expect(settledOrWaiting(captured)).resolves.toEqual({
      error: 'The preview stopped answering for 10 s.',
    });
  });

  it('ends a posted request when the webview leaves a ping unanswered', async () => {
    const { panel, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    const captured = panel.capture();

    vi.advanceTimersByTime(2 * PING_INTERVAL_MS);

    await expect(settledOrWaiting(captured)).resolves.toEqual({
      error: 'The preview stopped answering for 10 s.',
    });
  });

  it('pings only while a request waits', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    vi.advanceTimersByTime(2 * PING_INTERVAL_MS);
    expect(pingIds(webview)).toEqual([]);

    const captured = panel.capture();
    const [requestId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId, dataUrl: PNG });
    await captured;
    vi.advanceTimersByTime(2 * PING_INTERVAL_MS);

    expect(pingIds(webview)).toEqual([]);
  });

  it('names the webview when it never posts webviewReady before the load deadline', async () => {
    const { panel } = await openPanel();
    vi.useFakeTimers();
    const captured = panel.capture();

    vi.advanceTimersByTime(WEBVIEW_LOAD_DEADLINE_MS);

    await expect(captured).resolves.toEqual({ error: 'The preview webview did not load within 30 s.' });
  });

  it('answers a cancelled request that it was cancelled, and posts no request for it', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCapturePending' });
    const cancel = new AbortController();
    const captured = panel.capture(cancel.signal);

    cancel.abort();
    triggerMessage({ type: 'previewCaptureReady' });

    await expect(captured).resolves.toEqual({ error: 'The capture was cancelled.' });
    expect(captureRequestIds(webview)).toEqual([]);
  });

  it('answers a request whose signal is already aborted at once', async () => {
    const { panel } = await openPanel();
    const cancel = new AbortController();
    cancel.abort();

    await expect(panel.capture(cancel.signal)).resolves.toEqual({ error: 'The capture was cancelled.' });
  });

  it('drops an answer that arrives after its request ended', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    const cancel = new AbortController();
    const cancelled = panel.capture(cancel.signal);
    cancel.abort();
    await cancelled;
    const [cancelledId] = captureRequestIds(webview);

    const next = panel.capture();
    triggerMessage({ type: 'previewCaptured', requestId: cancelledId, dataUrl: PNG });
    await flush();
    const [, nextId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId: nextId, dataUrl: 'data:image/png;base64,BB==' });

    await expect(next).resolves.toEqual({ dataUrl: 'data:image/png;base64,BB==' });
  });
});
