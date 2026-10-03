/**
 * The extension in VS Code for the Web, as vscode.dev runs it: the web extension host
 * loads `dist/extension.web.js` in a browser worker. A Node builtin, a DOM global or a
 * throw in that bundle fails activation here and nowhere else.
 */

import * as vscode from 'vscode';
import { waitFor } from '../../waitFor';
import { assertEqual } from './assertEqual';
import { CLEAN_SCENE, DANGLING_SCENE } from '../../smokeProject/scenes';
import {
  extensionUnderTest,
  lintCodes,
  openScene,
  openSceneAndActivate,
  PREVIEW_COMMAND,
  previewTabLabels,
  unregisteredCommands,
} from '../../smokeProject/sceneEditor';

/** Activation, a lint and a tab update each reach the web extension host well inside this on a loaded runner. */
const SETTLE_TIMEOUT_MS = 10000;

suite('Web extension', () => {
  teardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('the suite runs in VS Code for the Web', () => {
    assertEqual(vscode.env.uiKind, vscode.UIKind.Web, 'the UI kind');
  });

  // Before the other scene tests: they activate the extension for the rest of the run.
  test('opening a scene activates the browser bundle', async () => {
    const extension = extensionUnderTest();
    assertEqual(extension.isActive, false, 'the activation state before a scene opens');

    await openScene(CLEAN_SCENE);

    await waitFor(
      () => extension.isActive,
      SETTLE_TIMEOUT_MS,
      () => 'opening a .tscn did not activate the extension'
    );
    // VS Code sets isActive on a failed activation too. Only activate() rejects with its error.
    await extension.activate();
  });

  test('every command the manifest contributes is registered', async () => {
    await openSceneAndActivate(CLEAN_SCENE);

    assertEqual(await unregisteredCommands(), [], 'the unregistered commands');
  });

  test('the linter reports a dangling reference in the Problems panel', async () => {
    const document = await openSceneAndActivate(DANGLING_SCENE);

    await waitFor(
      () => lintCodes(document).includes('dangling-resource-reference'),
      SETTLE_TIMEOUT_MS,
      () => `expected dangling-resource-reference, found ${JSON.stringify(lintCodes(document))}`
    );
  });

  test('the Outline lists the root node of the scene', async () => {
    const document = await openSceneAndActivate(CLEAN_SCENE);

    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[] | undefined>(
      'vscode.executeDocumentSymbolProvider',
      document.uri
    );

    assertEqual(
      symbols?.map((symbol) => symbol.name),
      ['Scene'],
      'the Outline symbols'
    );
  });

  test('the preview command opens a preview of the scene', async () => {
    const document = await openSceneAndActivate(CLEAN_SCENE);

    await vscode.commands.executeCommand(PREVIEW_COMMAND, document.uri);

    await waitFor(
      () => previewTabLabels().includes(`Preview: ${CLEAN_SCENE}`),
      SETTLE_TIMEOUT_MS,
      () => `expected a preview of ${CLEAN_SCENE}, found the tabs ${JSON.stringify(previewTabLabels())}`
    );
  });
});
