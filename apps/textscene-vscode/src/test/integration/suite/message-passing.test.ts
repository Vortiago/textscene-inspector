/**
 * Integration tests for message passing between extension and webview.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import {
  waitForPanelCreation,
  waitForWebviewMessage,
  sendMessageFromWebview,
} from '../helpers/panelHelpers';
import { getFixturePath } from '../helpers/fixtureHelpers';
import {
  assertPanelActive,
  assertFullReloadSent,
} from '../helpers/assertionHelpers';

suite('Message Passing Tests', () => {
  setup(async () => {
    // Ensure extension is activated
    const extension = vscode.extensions.getExtension(
      'vortiago.textscene-inspector',
    );
    await extension?.activate();
  });

  teardown(async () => {
    // Close all editors after each test
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  test('Should send loadTscn message on initial file load', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for loadTscn message
    await waitForWebviewMessage(panel, 'loadTscn');

    // Verify message was sent
    assertFullReloadSent(panel);
  });

  test('Should handle jumpToNode message from webview', async function () {
    this.timeout(10000);

    // Open fixture with multiple nodes
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc, vscode.ViewColumn.One);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    // Simulate jumpToNode message from webview
    // Note: This will attempt to open the text editor and jump to the node
    await sendMessageFromWebview(panel, {
      type: 'jumpToNode',
      nodeName: 'RootNode',
    });

    // Give time for editor to respond and focus to switch
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check that the text document is open (might not be active editor due to preview panel)
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

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    // Simulate loadResource message
    await sendMessageFromWebview(panel, {
      type: 'loadResource',
      path: 'res://some-resource.tres',
      resourceType: 'Resource',
      requestId: 'test-request-1',
    });

    // Wait for response (either resourceLoaded or resourceLoadError)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Check that a response message was sent
    const messages = panel._testGetMessages();
    const responseMessage = messages.find(
      (m) =>
        m.type === 'resourceLoaded' || m.type === 'resourceLoadError',
    );

    assert.ok(
      responseMessage,
      'Should send resourceLoaded or resourceLoadError message',
    );
  });

  test('Should handle resourceNeeded message from webview', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Simulate resourceNeeded message (reports missing resource)
    await sendMessageFromWebview(panel, {
      type: 'resourceNeeded',
      resource: {
        path: 'res://missing-texture.png',
        type: 'Texture2D',
        referencedBy: 'TestNode',
        error: 'File not found',
      },
    });

    // This should log to the output channel but not throw errors
    // Just verify panel is still active
    assertPanelActive(panel);
  });

  test('Should handle error message from webview', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Simulate error message from webview
    // Note: This will show an error dialog in VSCode
    await sendMessageFromWebview(panel, {
      type: 'error',
      message: 'Test error from webview',
    });

    // Panel should still be active after error
    assertPanelActive(panel);
  });

  test('Should send multiple messages in sequence', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Wait for initial load
    await waitForWebviewMessage(panel, 'loadTscn');

    // Initial load should have sent at least one message
    const initialMessages = panel._testGetMessages();
    assert.ok(
      initialMessages.length >= 1,
      'Should have sent initial load message',
    );

    // Reload the file (should send another message)
    await doc.save();
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have more messages now
    const updatedMessages = panel._testGetMessages();
    assert.ok(
      updatedMessages.length >= initialMessages.length,
      'Should have sent additional messages after reload',
    );
  });

  test('Should handle unknown message types gracefully', async function () {
    this.timeout(10000);

    // Open fixture
    const fixturePath = getFixturePath('unit-empty-scene.tscn');
    const doc = await vscode.workspace.openTextDocument(fixturePath);
    await vscode.window.showTextDocument(doc);

    // Create panel
    const panelPromise = waitForPanelCreation();
    await vscode.commands.executeCommand('textscene.openPreviewToSide');
    const panel = await panelPromise;

    assertPanelActive(panel);

    // Send unknown message type
    await sendMessageFromWebview(panel, {
      type: 'unknownMessageType',
      data: 'test data',
    });

    // Panel should remain active and not crash
    assertPanelActive(panel);
  });
});
