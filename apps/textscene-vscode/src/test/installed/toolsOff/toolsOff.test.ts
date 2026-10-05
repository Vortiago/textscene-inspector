/**
 * The installed package with `textscene.agentTools.enabled` set to false before the window
 * opens. The setting promises to keep the extension out of agent tool lists, and it must
 * turn off only the tools: the editor features still answer.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CLEAN_SCENE } from '../../smokeProject/scenes';
import { openSceneAndActivate } from '../../smokeProject/sceneEditor';
import { hoverText } from '../../languageFeatures/sharedAnswersSuite.testkit';
import { TOOLS_OFF_SETTINGS } from '../installedLaunch';

const TOOL_PREFIX = 'textscene_';

suite('Installed package with the agent tools off', function () {
  suiteSetup(async () => {
    await openSceneAndActivate(CLEAN_SCENE);
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('the window reads the setting the launcher wrote', () => {
    const [key, value] = Object.entries(TOOLS_OFF_SETTINGS)[0]!;

    assert.strictEqual(vscode.workspace.getConfiguration().get(key), value);
  });

  test('VS Code lists none of the extension tools', function () {
    if (!vscode.lm?.tools) {
      console.log('    skipped: this VS Code predates vscode.lm.tools');
      this.skip();
    }

    const listed = vscode.lm.tools.map((tool) => tool.name).filter((name) => name.startsWith(TOOL_PREFIX));

    assert.deepStrictEqual(listed, []);
  });

  test('invoking a tool fails, because the extension registered none', async function () {
    if (typeof vscode.lm?.invokeTool !== 'function') {
      console.log('    skipped: this VS Code predates vscode.lm.invokeTool');
      this.skip();
    }

    const scene = vscode.Uri.joinPath(vscode.workspace.workspaceFolders![0]!.uri, CLEAN_SCENE).fsPath;

    await assert.rejects(async () =>
      vscode.lm.invokeTool('textscene_scene_tree', { input: { path: scene } })
    );
  });

  test('the editor features still answer: hover names a node class', async () => {
    const document = await openSceneAndActivate(CLEAN_SCENE);
    const line = document
      .getText()
      .split('\n')
      .findIndex((text) => text.startsWith('[node name="Scene"'));
    const column = document.lineAt(line).text.indexOf('Node3D') + 1;

    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      new vscode.Position(line, column)
    );

    assert.ok(hoverText(hovers).includes('**Node3D**'), `hover: ${hoverText(hovers)}`);
  });
});
