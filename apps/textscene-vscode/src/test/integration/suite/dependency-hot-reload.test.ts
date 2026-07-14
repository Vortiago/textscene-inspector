/**
 * End-to-end regression guard for the Dependency hot-reload contract.
 *
 * The chain under test: FileSystemWatcher -> served-map relevance gate ->
 * `resourceChanged` message -> webview re-fetch.
 *
 * Fixture workspace (dep-chain/ inside .test-workspace):
 *   project.godot
 *   main.tscn  --[ext_resource PackedScene]--> sub.tscn
 *              --[ext_resource Texture2D]----> texture.png
 *              --[ext_resource Material]------> material.tres
 *   sub.tscn   --[ext_resource Texture2D]----> texture.png
 *   material.tres --[ext_resource Texture2D]--> texture.png
 *   unrelated.tscn  (no shared references)
 *
 * Test strategy: panels use a fake `vscode.WebviewPanel` (via `createTestPanel`)
 * so every `postMessage` call is captured in `sentMessages`. `loadResource`
 * messages drive the production `VSCodeResourceProvider.loadResource` path
 * against the REAL filesystem, populating the served-resources map.
 * `handleDependencyChange` is then called directly — exactly what the real
 * FileSystemWatcher calls in production — and the resulting `resourceChanged`
 * posts are asserted. This exercises the complete production code path without
 * requiring a live watcher timer or disk-event latency.
 *
 * Scenarios:
 *   1. Transitive depth   — texture change reaches main.tscn panel
 *   2. Per-panel gate     — unrelated panel is silent; sub.tscn panel fires
 *   3. Hidden panel       — retainContextWhenHidden ensures delivery off-screen
 *   4. Missing-heal       — onDidCreate after initial not-found delivers invalidation
 *   5. Negative           — file the scene never referenced produces no message
 *   6. Deletion           — deleted dependency triggers resourceChanged (missing placeholder)
 *
 * The suite is serial (Mocha's default for `suite`) to avoid cross-test
 * served-map bleed. Each test creates fresh panels.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as vscode from 'vscode';
import {
  createTestPanel,
  getExtensionUri,
  waitForMessage,
} from '../helpers/panelHelpers';
import {
  setupDepChainWorkspace,
  teardownDepChainWorkspace,
  mainTscnPath,
  subTscnPath,
  texturePngPath,
  materialTresPath,
  unrelatedTscnPath,
  primePanelForDepChain,
  waitForResourceChanged,
  assertNoResourceChanged,
  countResourceChanged,
  RES_TEXTURE,
  RES_MATERIAL,
} from '../helpers/depChainHelpers';
import type { TscnPreviewPanel } from '../../../TscnPreviewPanel';
import type { HostToWebviewMessage } from '../../../protocol';

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

suite('Dependency Hot-Reload E2E', () => {
  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension('vortiago.textscene-inspector');
    await extension?.activate();
    // Write the dep-chain fixture workspace files to disk. This runs after
    // setupTestWorkspace (which runs synchronously in suite/index.ts before
    // Mocha starts), so it adds files into the already-initialised workspace.
    setupDepChainWorkspace();
  });

  suiteTeardown(() => {
    teardownDepChainWorkspace();
  });

  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await new Promise<void>((r) => setTimeout(r, 100));
  });

  // -------------------------------------------------------------------------
  // Scenario 1: Transitive depth
  //   open main.tscn preview; modify texture.png (deepest dependency layer)
  //   -> panel receives resourceChanged for the texture's res:// path
  // -------------------------------------------------------------------------

  test('scenario 1: texture change at the deepest dependency layer reaches the main.tscn panel', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const mainUri = vscode.Uri.file(mainTscnPath());

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, mainUri);

    await handshake(triggerMessage, sentMessages);
    await primePanelForDepChain(triggerMessage, sentMessages);

    await panel.handleDependencyChange(vscode.Uri.file(texturePngPath()));

    await waitForResourceChanged(sentMessages, RES_TEXTURE, 8000);
  });

  // -------------------------------------------------------------------------
  // Scenario 2a: Per-panel relevance gate — unrelated panel stays silent
  //   a panel open on an unrelated scene receives nothing when texture changes
  // -------------------------------------------------------------------------

  test('scenario 2a: panel for an unrelated scene receives no resourceChanged when texture changes', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const unrelatedUri = vscode.Uri.file(unrelatedTscnPath());

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, unrelatedUri);

    await handshake(triggerMessage, sentMessages);
    // No loadResource messages — the panel never requested texture.png.
    await new Promise<void>((r) => setTimeout(r, 100));

    await panel.handleDependencyChange(vscode.Uri.file(texturePngPath()));

    await assertNoResourceChanged(sentMessages, 400);
  });

  // -------------------------------------------------------------------------
  // Scenario 2b: Per-panel relevance gate — sub.tscn panel also fires
  //   a second panel on sub.tscn (which also served the texture) receives the
  //   invalidation too
  // -------------------------------------------------------------------------

  test('scenario 2b: panel for sub.tscn (which also served texture) receives resourceChanged', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const subUri = vscode.Uri.file(subTscnPath());

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, subUri);

    await handshake(triggerMessage, sentMessages);

    // sub.tscn references texture.png — prime that resource.
    triggerMessage({
      type: 'loadResource',
      path: RES_TEXTURE,
      resourceType: 'Texture2D',
      requestId: 'sub-prime-tex',
    });
    await Promise.race([
      waitForMessage(sentMessages, 'resourceLoaded', 5000),
      waitForMessage(sentMessages, 'resourceLoadError', 5000),
    ]).catch(() => { /* timeout acceptable */ });
    await new Promise<void>((r) => setTimeout(r, 100));

    await panel.handleDependencyChange(vscode.Uri.file(texturePngPath()));

    await waitForResourceChanged(sentMessages, RES_TEXTURE, 8000);
  });

  // -------------------------------------------------------------------------
  // Scenario 3: Hidden panel
  //   hide one panel (set visible = false) before the disk change — it still
  //   receives the message (`retainContextWhenHidden` keeps the webview live)
  // -------------------------------------------------------------------------

  test('scenario 3: a panel whose visible flag is false still receives resourceChanged', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const mainUri = vscode.Uri.file(mainTscnPath());

    const { panel, sentMessages, triggerMessage } = buildHiddenPanel(extensionUri, mainUri);

    await handshake(triggerMessage, sentMessages);

    // Prime texture.png into the served map.
    triggerMessage({
      type: 'loadResource',
      path: RES_TEXTURE,
      resourceType: 'Texture2D',
      requestId: 'hidden-prime-tex',
    });
    await Promise.race([
      waitForMessage(sentMessages, 'resourceLoaded', 5000),
      waitForMessage(sentMessages, 'resourceLoadError', 5000),
    ]).catch(() => { /* timeout acceptable */ });
    await new Promise<void>((r) => setTimeout(r, 100));

    // Watcher fires while panel is hidden.
    await panel.handleDependencyChange(vscode.Uri.file(texturePngPath()));

    await waitForResourceChanged(sentMessages, RES_TEXTURE, 8000);
  });

  // -------------------------------------------------------------------------
  // Scenario 4: Missing-heal
  //   reference a not-yet-existing texture, open the preview (missing
  //   placeholder), then CREATE the file -> invalidation is delivered
  // -------------------------------------------------------------------------

  test('scenario 4: creating a previously-missing resource delivers resourceChanged', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const mainUri = vscode.Uri.file(mainTscnPath());

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, mainUri);

    await handshake(triggerMessage, sentMessages);

    // Use a path for a texture that does NOT yet exist on disk.
    const missingTexPath = texturePngPath().replace('texture.png', 'missing-heal.png');
    const missingTexUri = vscode.Uri.file(missingTexPath);
    const RES_MISSING = 'res://missing-heal.png';

    // The initial loadResource will fail (ENOENT), but VSCodeResourceProvider
    // records the path BEFORE the read so a later onDidCreate can recover it.
    triggerMessage({
      type: 'loadResource',
      path: RES_MISSING,
      resourceType: 'Texture2D',
      requestId: 'heal-prime',
    });
    await waitForMessage(sentMessages, 'resourceLoadError', 5000);
    await new Promise<void>((r) => setTimeout(r, 100));

    // Now create the file on disk.
    fs.writeFileSync(missingTexPath, Buffer.alloc(4, 0));

    try {
      // Simulate onDidCreate (what the real watcher fires after file creation).
      await panel.handleDependencyChange(missingTexUri);

      await waitForResourceChanged(sentMessages, RES_MISSING, 8000);
    } finally {
      try { fs.unlinkSync(missingTexPath); } catch { /* already gone */ }
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 5: Negative — irrelevant file change
  //   changing a watched-glob file the scene never referenced produces no message
  // -------------------------------------------------------------------------

  test('scenario 5: changing a file the scene never referenced produces no resourceChanged', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const mainUri = vscode.Uri.file(mainTscnPath());

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, mainUri);

    await handshake(triggerMessage, sentMessages);
    // Prime the known resources so the provider is initialised with something.
    await primePanelForDepChain(triggerMessage, sentMessages);
    await new Promise<void>((r) => setTimeout(r, 100));

    // Create a file the scene never referenced.
    const irrelevantPath = texturePngPath().replace('texture.png', 'completely-irrelevant.png');
    fs.writeFileSync(irrelevantPath, Buffer.alloc(4, 0));

    const beforeCount = countResourceChanged(sentMessages);

    try {
      await panel.handleDependencyChange(vscode.Uri.file(irrelevantPath));
      await new Promise<void>((r) => setTimeout(r, 300));

      const afterCount = countResourceChanged(sentMessages);
      assert.strictEqual(
        afterCount,
        beforeCount,
        `Expected no new resourceChanged messages, got ${afterCount - beforeCount}`,
      );
    } finally {
      try { fs.unlinkSync(irrelevantPath); } catch { /* already gone */ }
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 6: Deletion
  //   delete a served dependency -> consumers flip to missing placeholder
  // -------------------------------------------------------------------------

  test('scenario 6: deleting a served dependency sends resourceChanged so the webview shows missing placeholder', async function () {
    this.timeout(30000);

    const extensionUri = getExtensionUri();
    const mainUri = vscode.Uri.file(mainTscnPath());

    const { panel, sentMessages, triggerMessage } = createTestPanel(extensionUri, mainUri);

    await handshake(triggerMessage, sentMessages);

    // Prime material.tres into the served map.
    triggerMessage({
      type: 'loadResource',
      path: RES_MATERIAL,
      resourceType: 'Material',
      requestId: 'del-prime-mat',
    });
    await Promise.race([
      waitForMessage(sentMessages, 'resourceLoaded', 5000),
      waitForMessage(sentMessages, 'resourceLoadError', 5000),
    ]).catch(() => { /* timeout acceptable */ });
    await new Promise<void>((r) => setTimeout(r, 100));

    const beforeCount = countResourceChanged(sentMessages);

    // Simulate watcher's onDidDelete for the material file.
    // handleDependencyChange only consults the served map (no disk read) —
    // deletion cannot block the invalidation even though the file is gone.
    await panel.handleDependencyChange(vscode.Uri.file(materialTresPath()));

    await waitForResourceChanged(sentMessages, RES_MATERIAL, 8000);

    const afterCount = countResourceChanged(sentMessages);
    assert.ok(
      afterCount > beforeCount,
      `resourceChanged count should have increased (before=${beforeCount}, after=${afterCount})`,
    );
  });
});

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

/**
 * Complete the webview handshake: trigger webviewReady and wait for the
 * initial loadTscn to confirm the panel is ready to receive dependency
 * notifications.
 */
async function handshake(
  triggerMessage: (msg: Record<string, unknown>) => void,
  sentMessages: HostToWebviewMessage[],
): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, 200));
  triggerMessage({ type: 'webviewReady' });
  await waitForMessage(sentMessages, 'loadTscn', 8000);
}

/**
 * Build a `TscnPreviewPanel` backed by a fake webview whose `visible` property
 * is `false`. Used for scenario 3 (hidden panel). The fake panel is otherwise
 * identical to the one `createTestPanel` produces — captured messages and
 * `triggerMessage` work the same way.
 */
function buildHiddenPanel(
  extensionUri: vscode.Uri,
  resourceUri: vscode.Uri,
): {
  panel: TscnPreviewPanel;
  sentMessages: HostToWebviewMessage[];
  triggerMessage: (msg: Record<string, unknown>) => void;
} {
  const sentMessages: HostToWebviewMessage[] = [];
  const messageListeners: Array<(msg: unknown) => void> = [];
  const disposeListeners: Array<() => void> = [];
  let disposed = false;

  const fakeWebview = {
    html: '',
    cspSource: 'vscode-webview://fake',
    postMessage: (message: unknown) => {
      sentMessages.push(message as HostToWebviewMessage);
      return Promise.resolve(true);
    },
    asWebviewUri: (uri: vscode.Uri) => uri,
    onDidReceiveMessage: (
      listener: (msg: unknown) => void,
      _thisArg?: unknown,
      _disposables?: vscode.Disposable[],
    ) => {
      messageListeners.push(listener);
      return { dispose: () => { /* no-op */ } };
    },
  };

  const fakePanel = {
    webview: fakeWebview,
    title: '',
    viewColumn: vscode.ViewColumn.Two,
    active: false,
    visible: false, // panel is hidden behind another editor
    options: {} as vscode.WebviewPanelOptions,
    viewType: 'tscnPreview',
    onDidDispose: (
      listener: () => void,
      _thisArg?: unknown,
      _disposables?: vscode.Disposable[],
    ) => {
      disposeListeners.push(listener);
      return { dispose: () => { /* no-op */ } };
    },
    onDidChangeViewState: (_listener: unknown) => ({ dispose: () => { /* no-op */ } }),
    reveal: (_column?: vscode.ViewColumn, _preserveFocus?: boolean) => { /* no-op */ },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      for (const l of disposeListeners) l();
    },
  };

  // Avoid a circular import by requiring the module at call time. The test
  // bundle is CommonJS so `require` is available; the import is synchronous.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TscnPreviewPanel } = require('../../../TscnPreviewPanel') as typeof import('../../../TscnPreviewPanel');
  const panel = new TscnPreviewPanel(
    fakePanel as unknown as vscode.WebviewPanel,
    extensionUri,
    resourceUri,
  );

  const triggerMessage = (msg: Record<string, unknown>) => {
    for (const l of messageListeners) l(msg);
  };

  return { panel, sentMessages, triggerMessage };
}
