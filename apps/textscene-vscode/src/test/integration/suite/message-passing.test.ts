/**
 * Integration tests for messages between the extension host and a panel over a
 * fake `vscode.WebviewPanel` (`createTestPanel`). `vscode.workspace` and
 * `vscode.window` are the real APIs of the extension test host.
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
import type { LoadTscnMessage } from '../../../protocol';

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

    // Let the async _loadTscnContent finish.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Ready replays the pending loadTscn through dispatchWebviewMessage.
    triggerMessage({ type: 'webviewReady' });

    await waitForMessage(sentMessages, 'loadTscn');
    assertFullReloadSent(sentMessages);
  });

  test('webviewReady handshake: loadTscn posted before ready is replayed', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const extensionUri = getExtensionUri();

    const { sentMessages, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    // Let the async _loadTscnContent finish: the payload is pending, not sent.
    await new Promise((resolve) => setTimeout(resolve, 200));

    const loadsBefore = sentMessages.filter((m) => m.type === 'loadTscn');
    assert.strictEqual(
      loadsBefore.length,
      0,
      'loadTscn must not fire before webviewReady',
    );

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

    // resourceNeeded logs to the output channel and does not throw.
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

    triggerMessage({ type: 'error', message: 'Test error from webview' });

    assertPanelActive(panel);
  });

  test('Should post a new loadTscn when updated to a different scene', async function () {
    this.timeout(10000);

    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const otherPath = getFixturePath('unit-box-mesh.tscn');
    const extensionUri = getExtensionUri();

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, fixturePath);

    assertPanelActive(panel);

    await new Promise((resolve) => setTimeout(resolve, 200));
    triggerMessage({ type: 'webviewReady' });
    await waitForMessage(sentMessages, 'loadTscn');

    const loadsBefore = sentMessages.filter((m) => m.type === 'loadTscn');
    assert.strictEqual(loadsBefore.length, 1, 'Exactly one loadTscn for the initial scene');

    // A different scene's text passes the content-diff guard in _loadTscnContent,
    // so a fresh loadTscn carries the new file's text as read off disk.
    const expected = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(otherPath),
    );

    panel.update(otherPath);
    await new Promise((resolve) => setTimeout(resolve, 500));

    const loadsAfter = sentMessages.filter(
      (m): m is LoadTscnMessage => m.type === 'loadTscn',
    );
    assert.strictEqual(loadsAfter.length, 2, 'A second loadTscn fires for the new scene');
    assert.strictEqual(
      loadsAfter[1]!.content,
      expected,
      "The new loadTscn carries the second scene's text",
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

    // An unknown type has no dispatch-table entry, and dispatchWebviewMessage
    // ignores it.
    assert.doesNotThrow(() =>
      triggerMessage({ type: 'unknownMessageType', data: 'test data' })
    );

    assertPanelActive(panel);
  });
});
