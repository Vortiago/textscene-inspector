/**
 * The agent tools the extension registers with `vscode.lm`: lint a scene, read its node
 * tree, open its preview, list the resources it cannot load, and capture the preview as
 * a PNG. A coding agent in chat calls them so it can check a `.tscn` it edited without a
 * Godot install. Registration is guarded: the API is newer than the extension's
 * `engines.vscode` floor, the image part is newer still, and a user can turn the tools
 * off.
 */

import * as vscode from 'vscode';
import { Linter, type ResourceProvider } from '@textscene/core/linter';
import type { PreviewCapture } from '../TscnPreviewPanel';
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
  capture: 'textscene_capture',
} as const;

/** What the extension hands a tool that needs to act on the editor. */
export interface TscnToolHost {
  openPreview(uri: vscode.Uri): void;
  /** The viewport as a `data:image/png;base64,…` URL, or why the preview could not answer. */
  capturePreview(uri: vscode.Uri): Promise<PreviewCapture>;
  /** The Problems panel's provider for the project `uri` belongs to, or null outside one. */
  lintProviderFor(uri: vscode.Uri): Promise<ResourceProvider | null>;
}

interface PreparedScene {
  readonly uri: vscode.Uri;
  readonly text: string;
}

/** The file a scene tool input names, or a clear error for a missing or non-scene one. */
function sceneUriOf(input: ScenePathToolInput | undefined): vscode.Uri {
  const path = scenePathOf(input);
  const uri = resolveToolUri(path);
  if (!uri) {
    throw new Error(`No workspace folder is open, so the relative path '${path}' names no file.`);
  }
  return uri;
}

async function prepare(input: ScenePathToolInput | undefined): Promise<PreparedScene> {
  const uri = sceneUriOf(input);
  return { uri, text: await readSceneText(uri) };
}

/** The `.tscn` path an input names, or a clear error for a missing or non-scene one. */
function scenePathOf(input: ScenePathToolInput | undefined): string {
  const path = input?.path;
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('The tool needs a `path` to a .tscn scene.');
  }
  if (!path.endsWith('.tscn')) {
    throw new Error(`Expected a .tscn scene, got '${path}'.`);
  }
  return path;
}

function textResult(value: string): vscode.LanguageModelToolResult {
  return new vscode.LanguageModelToolResult([new vscode.LanguageModelTextPart(value)]);
}

/** A tool that reads the scene an input names and answers with text about it. */
function sceneTextTool(
  answer: (uri: vscode.Uri, text: string) => Promise<string> | string
): vscode.LanguageModelTool<ScenePathToolInput> {
  return {
    async invoke(options) {
      const { uri, text } = await prepare(options.input);
      return textResult(await answer(uri, text));
    },
  };
}

/** The lint answer, over the Problems panel's provider, so an agent and the user see one verdict. */
function lintAnswer(host: TscnToolHost): (uri: vscode.Uri, text: string) => Promise<string> {
  return async (uri, text) =>
    formatLintResult(uri.fsPath, await new Linter().lintComplete(text, await host.lintProviderFor(uri)));
}

async function missingResourcesAnswer(uri: vscode.Uri, text: string): Promise<string> {
  return formatMissingResources(uri.fsPath, await missingResourcePaths(uri, text));
}

class TscnOpenPreviewTool implements vscode.LanguageModelTool<ScenePathToolInput> {
  constructor(private readonly host: TscnToolHost) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = sceneUriOf(options.input);
    this.host.openPreview(uri);
    return textResult(`Opened the TextScene preview for ${uri.fsPath}.`);
  }
}

class TscnCaptureTool implements vscode.LanguageModelTool<ScenePathToolInput> {
  constructor(private readonly host: TscnToolHost) {}

  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = sceneUriOf(options.input);
    const capture = await this.host.capturePreview(uri);
    if ('error' in capture) {
      return textResult(`The preview for ${uri.fsPath} did not return an image: ${capture.error}`);
    }
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Rendered preview of ${uri.fsPath}.`),
      vscode.LanguageModelDataPart.image(pngBytesOf(capture.dataUrl), 'image/png'),
    ]);
  }
}

/** The bytes of a `data:image/png;base64,…` URL. */
function pngBytesOf(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  return Uint8Array.from(atob(comma === -1 ? '' : dataUrl.slice(comma + 1)), (char) => char.charCodeAt(0));
}

function agentToolsEnabled(): boolean {
  return vscode.workspace.getConfiguration('textscene').get<boolean>(ENABLED_SETTING, true);
}

/**
 * Registers the agent tools when VS Code has the API and the user has left them on. The
 * capture tool needs the image part of a tool result, stable from VS Code 1.106, so it
 * registers on its own guard.
 */
export function registerTscnTools(context: vscode.ExtensionContext, host: TscnToolHost): void {
  if (!agentToolsEnabled()) return;
  if (typeof vscode.lm?.registerTool !== 'function') return;

  const tools = [
    vscode.lm.registerTool(TOOL_IDS.lint, sceneTextTool(lintAnswer(host))),
    vscode.lm.registerTool(
      TOOL_IDS.sceneTree,
      sceneTextTool((uri, text) => formatSceneTree(uri.fsPath, text))
    ),
    vscode.lm.registerTool(TOOL_IDS.openPreview, new TscnOpenPreviewTool(host)),
    vscode.lm.registerTool(TOOL_IDS.missingResources, sceneTextTool(missingResourcesAnswer)),
  ];
  if (typeof vscode.LanguageModelDataPart?.image === 'function') {
    tools.push(vscode.lm.registerTool(TOOL_IDS.capture, new TscnCaptureTool(host)));
  }
  context.subscriptions.push(...tools);
}
