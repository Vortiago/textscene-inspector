/**
 * The panel tells its webview whether the tab shows, so the webview stops rendering while it is
 * hidden (`retainContextWhenHidden` keeps the page alive behind another editor).
 */
import { describe, expect, it } from 'vitest';
import { openPreviewPanel, openReadyPreviewPanel } from './previewPanel.testkit';
import type { MockWebview } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

function visibilityMessages(webview: MockWebview): boolean[] {
  return webview.postMessage.mock.calls
    .map((call) => call[0] as { type: string; isVisible?: boolean })
    .filter((message) => message.type === 'previewVisibility')
    .map((message) => message.isVisible!);
}

describe('TscnPreviewPanel visibility', () => {
  it('posts the current visibility once the webview is ready', async () => {
    const { webview } = await openReadyPreviewPanel(MINIMAL_TSCN);

    expect(visibilityMessages(webview)).toEqual([true]);
  });

  it('posts false after ready for a panel created hidden', async () => {
    const { webview, hostPanel, triggerMessage } = await openPreviewPanel(MINIMAL_TSCN);
    hostPanel.visible = false;

    triggerMessage({ type: 'webviewReady' });

    expect(visibilityMessages(webview)).toEqual([false]);
  });

  it('posts false when the panel becomes hidden, and true when it shows again', async () => {
    const { webview, setVisible } = await openReadyPreviewPanel(MINIMAL_TSCN);

    setVisible(false);
    setVisible(true);

    expect(visibilityMessages(webview)).toEqual([true, false, true]);
  });

  it('posts nothing for a view-state change that leaves the visibility as it was', async () => {
    const { webview, setVisible } = await openReadyPreviewPanel(MINIMAL_TSCN);

    setVisible(true);

    expect(visibilityMessages(webview)).toEqual([true]);
  });

  it('holds a change that arrives before the webview is ready, and posts it on ready (edge case)', async () => {
    const { webview, setVisible, triggerMessage } = await openPreviewPanel(MINIMAL_TSCN);

    setVisible(false);
    expect(visibilityMessages(webview)).toEqual([]);
    triggerMessage({ type: 'webviewReady' });

    expect(visibilityMessages(webview)).toEqual([false]);
  });
});
