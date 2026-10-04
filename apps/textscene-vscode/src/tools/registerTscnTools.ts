/**
 * The agent tools the extension registers with `vscode.lm`: lint a scene, read its node
 * tree, open its preview, and list the resources it cannot load. A coding agent in chat
 * calls them so it can check a `.tscn` it edited without a Godot install. Registration is
 * guarded: the API is newer than the extension's `engines.vscode` floor, and a user can
 * turn the tools off.
 */

import * as vscode from 'vscode';
import { Linter } from '@textscene/core/linter';
import { findGodotProjectRoot } from '../findGodotProjectRoot';
import { LintResourceProvider } from '../LintResourceProvider';
import { formatLintResult } from './formatLintResult';
import { formatMissingResources, missingResourcePaths } from './missingResources';
import { formatSceneTree } from './sceneTree';
import { readSceneText, resolveToolUri, type ScenePathToolInput } from './toolInput';

const ENABLED_SETTING = 'agentTools.enabled';

/** Tool ids, which the `languageModelTools` contribution repeats. */
export const TOOL_IDS = {
  lint: 'textscene_lint',
  sceneTree: 'textscene_scene_tree',
  openPreview: 'textscene_open_preview',
  missingResources: 'textscene_missing_resources',
} as const;

/** What the extension hands a tool that needs to act on the editor. */
export interface TscnToolHost {
  openPreview(uri: vscode.Uri): void;
}

interface PreparedScene {
  readonly uri: vscode.Uri;
  readonly text: string;
}

async function prepare(input: ScenePathToolInput): Promise<PreparedScene> {
  const uri = resolveToolUri(input.path);
  if (!uri) {
    throw new Error(`No workspace folder is open, so the relative path '${input.path}' names no file.`);
  }
  return { uri, text: await readSceneText(uri) };
}

function textResult(value: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}

class TscnLintTool implements vscode.LanguageModelTool<ScenePathToolInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, text } = await prepare(options.input);
    const folder = vscode.workspace.getWorkspaceFolder(uri);
    const provider = folder ? new LintResourceProvider(await findGodotProjectRoot(folder.uri, uri)) : null;
    const diagnostics = await new Linter().lintComplete(text, provider);
    return textResult(formatLintResult(uri.fsPath, diagnostics));
  }
}

class TscnSceneTreeTool implements vscode.LanguageModelTool<ScenePathToolInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, text } = await prepare(options.input);
    return textResult(formatSceneTree(uri.fsPath, text));
  }
}

class TscnMissingResourcesTool implements vscode.LanguageModelTool<ScenePathToolInput> {
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const { uri, text } = await prepare(options.input);
    return textResult(formatMissingResources(uri.fsPath, await missingResourcePaths(uri, text)));
  }
}

class TscnOpenPreviewTool implements vscode.LanguageModelTool<ScenePathToolInput> {
  constructor(private readonly host: TscnToolHost) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = resolveToolUri(options.input.path);
    if (!uri) {
      throw new Error(
        `No workspace folder is open, so the relative path '${options.input.path}' names no file.`
      );
    }
    this.host.openPreview(uri);
    return textResult(`Opened the TextScene preview for ${uri.fsPath}.`);
  }
}

function agentToolsEnabled(): boolean {
  return vscode.workspace.getConfiguration('textscene').get<boolean>(ENABLED_SETTING, true);
}

/**
 * Registers the agent tools when VS Code has the API and the user has left them on.
 * The guard keeps the extension working on the `engines.vscode` floor.
 */
export function registerTscnTools(context: vscode.ExtensionContext, host: TscnToolHost): void {
  if (!agentToolsEnabled()) return;
  if (typeof vscode.lm?.registerTool !== 'function') return;

  context.subscriptions.push(
    vscode.lm.registerTool(TOOL_IDS.lint, new TscnLintTool()),
    vscode.lm.registerTool(TOOL_IDS.sceneTree, new TscnSceneTreeTool()),
    vscode.lm.registerTool(TOOL_IDS.openPreview, new TscnOpenPreviewTool(host)),
    vscode.lm.registerTool(TOOL_IDS.missingResources, new TscnMissingResourcesTool())
  );
}
