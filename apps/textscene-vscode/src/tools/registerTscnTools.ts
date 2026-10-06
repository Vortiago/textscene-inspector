/**
 * The agent tools the extension registers with `vscode.lm`: lint a scene, read its node
 * tree, open its preview, list the resources it cannot load, and capture the preview as
 * a PNG. A coding agent in chat calls them to check a `.tscn` it edited without Godot.
 */

import * as vscode from 'vscode';
import { Linter, type ResourceProvider } from '@textscene/core/linter';
import type { PreviewCapture } from '../previewCaptureQueue';
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
  /**
   * The viewport as a `data:image/png;base64,…` URL, or why the preview could not answer. An
   * abort of `signal` ends the capture.
   */
  capturePreview(uri: vscode.Uri, signal: AbortSignal): Promise<PreviewCapture>;
  /** The Problems panel's provider for the `res://` root of `uri`, or null outside every workspace folder. */
  lintProviderFor(uri: vscode.Uri): Promise<ResourceProvider | null>;
}

interface SceneFile {
  readonly uri: vscode.Uri;
  readonly text: string;
}

/** The `.tscn` path an input names. Throws for a missing path or one that names no scene. */
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

/** The file a scene tool input names. Throws for a relative path with no workspace folder open. */
function sceneUriOf(input: ScenePathToolInput | undefined): vscode.Uri {
  const path = scenePathOf(input);
  const uri = resolveToolUri(path);
  if (!uri) {
    throw new Error(`No workspace folder is open, so the relative path '${path}' names no file.`);
  }
  return uri;
}

async function readSceneFile(input: ScenePathToolInput | undefined): Promise<SceneFile> {
  const uri = sceneUriOf(input);
  return { uri, text: await readSceneText(uri) };
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
      const { uri, text } = await readSceneFile(options.input);
      return textResult(await answer(uri, text));
    },
  };
}

/** The lint answer, over the Problems panel's provider, so an agent and the user see one verdict. */
function lintAnswer(host: TscnToolHost): (uri: vscode.Uri, text: string) => Promise<string> {
  return async (uri, text) =>
    formatLintResult(uri.fsPath, await new Linter().lintComplete(text, await host.lintProviderFor(uri)));
}

function sceneTreeAnswer(uri: vscode.Uri, text: string): string {
  return formatSceneTree(uri.fsPath, text);
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
    options: vscode.LanguageModelToolInvocationOptions<ScenePathToolInput>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    const uri = sceneUriOf(options.input);
    const capture = await withAbortSignal(token, (signal) => this.host.capturePreview(uri, signal));
    if ('error' in capture) {
      return textResult(`The preview for ${uri.fsPath} did not return an image: ${capture.error}`);
    }
    return new vscode.LanguageModelToolResult([
      new vscode.LanguageModelTextPart(`Rendered preview of ${uri.fsPath}.`),
      vscode.LanguageModelDataPart.image(pngBytesOf(capture.dataUrl), 'image/png'),
    ]);
  }
}

/** Runs `work` with a signal that aborts when `token` is cancelled, and stops listening after. */
async function withAbortSignal<T>(
  token: vscode.CancellationToken,
  work: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const controller = new AbortController();
  if (token.isCancellationRequested) controller.abort();
  const subscription = token.onCancellationRequested(() => controller.abort());
  try {
    return await work(controller.signal);
  } finally {
    subscription.dispose();
  }
}

/** The bytes of a `data:image/png;base64,…` URL. */
function pngBytesOf(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  return Uint8Array.from(atob(comma === -1 ? '' : dataUrl.slice(comma + 1)), (char) => char.charCodeAt(0));
}

function areAgentToolsEnabled(): boolean {
  return vscode.workspace.getConfiguration('textscene').get<boolean>(ENABLED_SETTING, true);
}

/**
 * `tool`, refusing every call while the setting is off. The contribution's `when` clause
 * hides the tool from agents then, but another extension may still invoke it.
 */
function whileEnabled<T>(tool: vscode.LanguageModelTool<T>): vscode.LanguageModelTool<T> {
  return {
    async invoke(options, token) {
      if (!areAgentToolsEnabled()) {
        throw new Error(`The TextScene agent tools are turned off (textscene.${ENABLED_SETTING}).`);
      }
      return await tool.invoke(options, token);
    },
  };
}

/**
 * Registers the agent tools when VS Code has the API, which is newer than the extension's
 * `engines.vscode` floor. The capture tool needs the image part of a tool result, stable
 * from VS Code 1.106, so it registers on its own guard.
 */
export function registerTscnTools(context: vscode.ExtensionContext, host: TscnToolHost): void {
  if (typeof vscode.lm?.registerTool !== 'function') return;

  const register = <T>(id: string, tool: vscode.LanguageModelTool<T>) =>
    vscode.lm.registerTool(id, whileEnabled(tool));
  const tools = [
    register(TOOL_IDS.lint, sceneTextTool(lintAnswer(host))),
    register(TOOL_IDS.sceneTree, sceneTextTool(sceneTreeAnswer)),
    register(TOOL_IDS.openPreview, new TscnOpenPreviewTool(host)),
    register(TOOL_IDS.missingResources, sceneTextTool(missingResourcesAnswer)),
  ];
  if (typeof vscode.LanguageModelDataPart?.image === 'function') {
    tools.push(register(TOOL_IDS.capture, new TscnCaptureTool(host)));
  }
  context.subscriptions.push(...tools);
}
