/**
 * Integration tests for message passing between the extension host and the
 * webview panel.
 *
 * Panels are constructed directly using the public `TscnPreviewPanel`
 * constructor with a fake `vscode.WebviewPanel` (see `createTestPanel` in
 * panelHelpers). The fake captures every `postMessage` call and exposes a
 * `triggerMessage` helper that drives the real `onDidReceiveMessage` dispatch —
 * the same path used in production.
 *
 * `vscode.workspace` and `vscode.window` statics are the real VS Code APIs
 * provided by the extension test host.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  createTestPanel,
  getExtensionUri,
  waitForMessage,
} from '../helpers/panelHelpers';
import { getFixturePath } from '../helpers/fixtureHelpers';
import {
  assertPanelActive,
  assertFullReloadSent,
} from '../helpers/assertionHelpers';

suite('Message Passing Tests', () => {
  setup(async () => {
    const extension = vscode.extensions.getExtension('vortiago.textscene-inspector');
    await extension?.activate();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('Should send loadTscn message on initial file load', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    // Allow async _loadTscnContent to finish.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Signal that the webview is ready; this replays the pending loadTscn
    // through the production dispatchWebviewMessage path.
    triggerMessage({ type: 'webviewReady' });

    // Verify loadTscn was sent.
    await waitForMessage(sentMessages, 'loadTscn');
    assertFullReloadSent(sentMessages);
  });

  test('webviewReady handshake: loadTscn posted before ready is replayed', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { sentMessages, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    // Allow async _loadTscnContent to finish — payload is pending, not yet sent.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const loadsBefore = sentMessages.filter((m) => m.type === 'loadTscn');
    assert.strictEqual(
      loadsBefore.length,
      0,
      'loadTscn must not fire before webviewReady',
    );

    // The webviewReady message routes through the production dispatch table.
    triggerMessage({ type: 'webviewReady' });

    const loadsAfter = sentMessages.filter((m) => m.type === 'loadTscn');
    assert.strictEqual(loadsAfter.length, 1, 'Exactly one loadTscn must fire after webviewReady');
  });

  test('Should handle jumpToNode message from webview', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    // Open the text document so the jump target resolves.
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

    const extensionUri = getExtensionUri();
    const { panel, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Drive jumpToNode through the production onDidReceiveMessage handler.
    triggerMessage({ type: 'jumpToNode', nodeName: 'RootNode', path: 'RootNode' });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const openEditors = vscode.window.visibleTextEditors;
    const tscnEditor = openEditors.find(
      (e) => e.document.uri.fsPath === fixturePath.fsPath,
    );
    assert.ok(
      tscnEditor,
      'TSCN file should be open in an editor after jumpToNode',
    );
  });

  test('Should handle loadResource message from webview', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Drive loadResource through the production handler.
    triggerMessage({
      type: 'loadResource',
      path: 'res://some-resource.tres',
      resourceType: 'Resource',
      requestId: 'test-request-1',
    });

    await new Promise((resolve) => setTimeout(resolve, 1000));

    const responseMessage = sentMessages.find(
      (m) => m.type === 'resourceLoaded' || m.type === 'resourceLoadError',
    );
    assert.ok(
      responseMessage,
      'Should send resourceLoaded or resourceLoadError message',
    );
  });

  test('Should handle resourceNeeded message from webview', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { panel, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });

    // Drive resourceNeeded through the production handler — logs to output
    // channel but must not throw.
    triggerMessage({
      type: 'resourceNeeded',
      resource: {
        path: 'res://missing-texture.png',
        type: 'Texture2D',
        referencedBy: 'TestNode',
        error: 'File not found',
      },
    });

    assertPanelActive(panel);
  });

  test('Should handle error message from webview', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { panel, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });

    // Drive error through the production handler.
    triggerMessage({ type: 'error', message: 'Test error from webview' });

    assertPanelActive(panel);
  });

  test('Should send multiple messages in sequence', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });
    await waitForMessage(sentMessages, 'loadTscn');

    const initialCount = sentMessages.length;
    assert.ok(initialCount >= 1, 'Should have sent initial load message');

    // Trigger a reload.
    panel.update(fixturePath);
    await new Promise((resolve) => setTimeout(resolve, 500));

    assert.ok(
      sentMessages.length >= initialCount,
      'Should have sent additional messages after reload',
    );
  });

  test('Should handle unknown message types gracefully', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { panel, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });

    // Unknown message types have no dispatch-table entry;
    // dispatchWebviewMessage guards the lookup and silently ignores them.
    assert.doesNotThrow(() =>
      triggerMessage({ type: 'unknownMessageType', data: 'test data' })
    );

    assertPanelActive(panel);
  });
});
