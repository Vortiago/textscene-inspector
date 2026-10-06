/**
 * The installed package with `textscene.agentTools.enabled` set to false before the window
 * opens. The setting hides the tools from chat and refuses every call, and it turns off only
 * the tools: the editor features still answer.
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import { CLEAN_SCENE } from '../../smokeProject/scenes';
import { extensionUnderTest, openSceneAndActivate } from '../../smokeProject/sceneEditor';
import { contributedTools, skipBecause } from '../../languageFeatures/agentToolAnswersSuite.testkit';
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

  // `vscode.lm.tools` lists a tool whose `when` is false too (`getAllToolsIncludingDisabled`
  // in `MainThreadLanguageModelTools`). Chat's own list drops it, and no API exposes that list,
  // so the test checks the clause the installed manifest gives chat.
  test("every installed tool hides from chat behind the setting's when clause", () => {
    const tools = contributedTools(extensionUnderTest()).filter((tool) => tool.name.startsWith(TOOL_PREFIX));

    assert.ok(tools.length > 0, 'expected the manifest to contribute the agent tools');
    for (const tool of tools) assert.strictEqual(tool.when, 'config.textscene.agentTools.enabled', tool.name);
  });

  test('invoking a tool fails while the setting is off', async function () {
    if (typeof vscode.lm?.invokeTool !== 'function') {
      skipBecause(this, 'this VS Code predates vscode.lm.invokeTool');
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
