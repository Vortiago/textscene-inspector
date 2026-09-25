/**
 * End-to-end dependency hot-reload: served-map relevance gate, `resourceChanged`,
 * webview re-fetch. `loadResource` reads the real filesystem into the served map,
 * and each test calls `handleDependencyChange` as the watcher does, with no watcher
 * latency. The suite is serial, and each test makes fresh panels, so no map bleeds.
 */

import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  createTestPanel,
  getExtensionUri,
  waitForMessage,
  type TestPanel,
  type TestPanelOptions,
} from '../helpers/panelHelpers';
import {
  setupDepChainWorkspace,
  teardownDepChainWorkspace,
  depChainFile,
  primePanelForDepChain,
  primeResource,
  waitForResourceChanged,
  assertNoResourceChanged,
  RES_TEXTURE,
  RES_MATERIAL,
} from '../helpers/depChainHelpers';
import type { HostToWebviewMessage } from '../../../protocol';

suite('Dependency Hot-Reload E2E', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('vortiago.textscene-inspector');
    await extension?.activate();
    // The launcher has already populated the workspace, so this adds the
    // dep-chain files into it.
    setupDepChainWorkspace();
  });

  suiteTeardown(() => {
    teardownDepChainWorkspace();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise<void>((r) => setTimeout(r, 100));
  });

  test('scenario 1: texture change at the deepest dependency layer reaches the main.tscn panel', async function () {
    this.timeout(30000);

    const { panel, sentMessages, triggerMessage } = await openPanel(depChainFile('main.tscn'));
    await primePanelForDepChain(triggerMessage, sentMessages);

    await panel.handleDependencyChange(vscode.Uri.file(depChainFile('texture.png')));

    await waitForResourceChanged(sentMessages, RES_TEXTURE, 8000);
  });

  test('scenario 2a: panel for an unrelated scene receives no resourceChanged when texture changes', async function () {
    this.timeout(30000);

    const { panel, sentMessages } = await openPanel(depChainFile('unrelated.tscn'));
    // No loadResource: the panel never requested texture.png.
    await new Promise<void>((r) => setTimeout(r, 100));

    await assertNoResourceChanged(
      sentMessages,
      () => panel.handleDependencyChange(vscode.Uri.file(depChainFile('texture.png'))),
      400,
    );
  });

  test('scenario 2b: panel for sub.tscn (which also served texture) receives resourceChanged', async function () {
    this.timeout(30000);

    const { panel, sentMessages, triggerMessage } = await openPanel(depChainFile('sub.tscn'));

    // sub.tscn references texture.png.
    await primeResource(triggerMessage, sentMessages, {
      path: RES_TEXTURE,
      resourceType: 'Texture2D',
      requestId: 'sub-prime-tex',
    });

    await panel.handleDependencyChange(vscode.Uri.file(depChainFile('texture.png')));

    await waitForResourceChanged(sentMessages, RES_TEXTURE, 8000);
  });

  // `retainContextWhenHidden` keeps a hidden panel's webview live.
  test('scenario 3: a panel whose visible flag is false still receives resourceChanged', async function () {
    this.timeout(30000);

    const { panel, sentMessages, triggerMessage } = await openPanel(depChainFile('main.tscn'), {
      visible: false, // hidden behind another editor
    });

    await primeResource(triggerMessage, sentMessages, {
      path: RES_TEXTURE,
      resourceType: 'Texture2D',
      requestId: 'hidden-prime-tex',
    });

    // Watcher fires while panel is hidden.
    await panel.handleDependencyChange(vscode.Uri.file(depChainFile('texture.png')));

    await waitForResourceChanged(sentMessages, RES_TEXTURE, 8000);
  });

  test('scenario 4: creating a previously-missing resource delivers resourceChanged', async function () {
    this.timeout(30000);

    const { panel, sentMessages, triggerMessage } = await openPanel(depChainFile('main.tscn'));

    // A texture not on disk yet.
    const missingTexPath = depChainFile('missing-heal.png');
    const missingTexUri = vscode.Uri.file(missingTexPath);
    const RES_MISSING = 'res://missing-heal.png';

    // The first loadResource fails (ENOENT), but VSCodeResourceProvider records the
    // path before the read, so a later onDidCreate recovers it.
    triggerMessage({
      type: 'loadResource',
      path: RES_MISSING,
      resourceType: 'Texture2D',
      requestId: 'heal-prime',
    });
    await waitForMessage(sentMessages, 'resourceLoadError', 5000);
    await new Promise<void>((r) => setTimeout(r, 100));

    fs.writeFileSync(missingTexPath, Buffer.alloc(4, 0));

    try {
      // The watcher's onDidCreate.
      await panel.handleDependencyChange(missingTexUri);

      await waitForResourceChanged(sentMessages, RES_MISSING, 8000);
    } finally {
      try { fs.unlinkSync(missingTexPath); } catch { /* already gone */ }
    }
  });

  test('scenario 5: changing a file the scene never referenced produces no resourceChanged', async function () {
    this.timeout(30000);

    const { panel, sentMessages, triggerMessage } = await openPanel(depChainFile('main.tscn'));
    // A provider with served entries, so the miss is a real one.
    await primePanelForDepChain(triggerMessage, sentMessages);
    await new Promise<void>((r) => setTimeout(r, 100));

    const irrelevantPath = depChainFile('completely-irrelevant.png');
    fs.writeFileSync(irrelevantPath, Buffer.alloc(4, 0));

    try {
      await assertNoResourceChanged(
        sentMessages,
        () => panel.handleDependencyChange(vscode.Uri.file(irrelevantPath)),
        300,
      );
    } finally {
      try { fs.unlinkSync(irrelevantPath); } catch { /* already gone */ }
    }
  });

  test('scenario 6: deleting a served dependency sends resourceChanged so the webview shows missing placeholder', async function () {
    this.timeout(30000);

    const { panel, sentMessages, triggerMessage } = await openPanel(depChainFile('main.tscn'));

    await primeResource(triggerMessage, sentMessages, {
      path: RES_MATERIAL,
      resourceType: 'Material',
      requestId: 'del-prime-mat',
    });

    // Delete the file for real, then fire the watcher's onDidDelete.
    // handleDependencyChange reads only the served map, never the disk.
    const materialPath = depChainFile('material.tres');
    const materialBytes = fs.readFileSync(materialPath);
    fs.unlinkSync(materialPath);

    try {
      await panel.handleDependencyChange(vscode.Uri.file(materialPath));

      await waitForResourceChanged(sentMessages, RES_MATERIAL, 8000);
    } finally {
      // Restore the fixture for the tests after this one.
      fs.writeFileSync(materialPath, materialBytes);
    }
  });
});

/**
 * Opens a fresh test panel on `scenePath` and completes the webview handshake.
 */
async function openPanel(scenePath: string, options?: TestPanelOptions): Promise<TestPanel> {
  const testPanel = createTestPanel(getExtensionUri(), vscode.Uri.file(scenePath), options);
  await handshake(testPanel.triggerMessage, testPanel.sentMessages);
  return testPanel;
}

/**
 * Triggers webviewReady and waits for the first loadTscn, after which the panel
 * receives dependency notifications.
 */
async function handshake(
  triggerMessage: (msg: Record<string, unknown>) => void,
  sentMessages: HostToWebviewMessage[],
): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 200));
  triggerMessage({ type: 'webviewReady' });
  await waitForMessage(sentMessages, 'loadTscn', 8000);
}
