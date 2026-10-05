/**
 * `TscnPreviewPanel.capture()` through the production dispatch. The panel holds a request
 * until the webview reports its capture state: `ready` posts it, `unavailable` answers the
 * reason, and `pending` keeps it waiting. The fake panel's `postMessage` is the only probe.
 */
import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { CAPTURE_DEADLINE_MS } from './previewCaptureQueue';
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

/** Lets every settled promise run its continuation. */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

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

  it('names the canvas when no state answers a request before the deadline', async () => {
    const { panel, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    const captured = panel.capture();

    vi.advanceTimersByTime(CAPTURE_DEADLINE_MS);

    await expect(captured).resolves.toEqual({
      error: 'The preview canvas did not create its renderer within 30 s.',
    });
  });

  it('names the webview when it never posts webviewReady before the deadline', async () => {
    const { panel } = await openPanel();
    vi.useFakeTimers();
    const captured = panel.capture();

    vi.advanceTimersByTime(CAPTURE_DEADLINE_MS);

    await expect(captured).resolves.toEqual({ error: 'The preview webview did not load within 30 s.' });
  });

  it('names the capture when the webview never answers a posted request', async () => {
    const { panel, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    const captured = panel.capture();

    vi.advanceTimersByTime(CAPTURE_DEADLINE_MS);

    await expect(captured).resolves.toEqual({ error: 'The preview did not answer the capture within 30 s.' });
  });

  it('drops an answer that arrives after its request expired', async () => {
    const { panel, webview, triggerMessage } = await openPanel();
    vi.useFakeTimers();
    triggerMessage({ type: 'webviewReady' });
    triggerMessage({ type: 'previewCaptureReady' });
    const expired = panel.capture();
    vi.advanceTimersByTime(CAPTURE_DEADLINE_MS);
    await expired;
    vi.useRealTimers();
    const [expiredId] = captureRequestIds(webview);

    const next = panel.capture();
    triggerMessage({ type: 'previewCaptured', requestId: expiredId, dataUrl: PNG });
    await flush();
    const [, nextId] = captureRequestIds(webview);
    triggerMessage({ type: 'previewCaptured', requestId: nextId, dataUrl: 'data:image/png;base64,BB==' });

    await expect(next).resolves.toEqual({ dataUrl: 'data:image/png;base64,BB==' });
  });
});
