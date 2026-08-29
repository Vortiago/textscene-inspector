/**
 * Nothing reaches the webview after `dispose()`.
 *
 * `WebviewPanel.webview` THROWS `Webview is disposed` from its getter, and the
 * panel keeps posting after the user closes the preview: `_webviewReady` stays
 * true, so `invalidateResource` still fires, and a resource load in flight posts
 * from inside its own try/catch — whose catch posts again and throws out of a
 * `void`ed call as an unhandled rejection.
 */
import { describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { TscnPreviewPanel } from './TscnPreviewPanel';
import { createMockUri, createMockFileData, setupMockPanel } from './test-setup';

const MINIMAL_TSCN = '[gd_scene format=3]\n[node name="Root" type="Node3D"]';

async function readyPanel() {
  const mock = setupMockPanel();
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(createMockFileData(MINIMAL_TSCN));
  const panel = TscnPreviewPanel.create(createMockUri('/extension'), createMockUri('/w/test.tscn'));
  await new Promise<void>((r) => setTimeout(r, 10));
  mock.triggerMessage({ type: 'webviewReady' });
  mock.webview.postMessage.mockClear();
  return { ...mock, hostPanel: mock.panel, panel };
}

describe('a disposed preview panel', () => {
  it('posts nothing when a watched resource changes after the panel is gone', async () => {
    const { webview, panel } = await readyPanel();

    panel.dispose();
    panel.invalidateResource('res://icon.png');

    expect(webview.postMessage).not.toHaveBeenCalled();
  });

  it('disposes every subscription it registered with the host panel', async () => {
    // Both registrations pass `this._disposables`; drop either argument and the
    // array stays empty, so `dispose()`'s teardown loop silently does nothing
    // and the listener outlives the closed panel.
    const { messageSubscription, didDisposeSubscription, panel } = await readyPanel();

    expect(messageSubscription.dispose).not.toHaveBeenCalled();
    expect(didDisposeSubscription.dispose).not.toHaveBeenCalled();

    panel.dispose();

    expect(messageSubscription.dispose).toHaveBeenCalledTimes(1);
    expect(didDisposeSubscription.dispose).toHaveBeenCalledTimes(1);
  });

  it('is idempotent, so the close event and a holder both disposing runs teardown once', async () => {
    // The real close path: VS Code fires `onDidDispose`, which calls `dispose()`.
    // A caller still holding the panel calls it too, and that second run would
    // fire `_onDidDispose` after the emitter was disposed.
    const { hostPanel, panel, fireDidDispose } = await readyPanel();

    fireDidDispose();
    panel.dispose();

    expect(hostPanel.dispose).toHaveBeenCalledTimes(1);
  });
});
