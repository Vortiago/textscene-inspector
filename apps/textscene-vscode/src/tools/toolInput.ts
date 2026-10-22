/**
 * Resolves the file a tool's `path` input names and reads it. A path is absolute or
 * workspace-relative. The relative form needs an open workspace folder. This uses no
 * `node:path`, since the browser extension host has no Node built-ins.
 */

import * as vscode from 'vscode';

/** The input every scene tool takes. */
export interface ScenePathToolInput {
  /** A workspace-relative path to a `.tscn`, or an absolute one. */
  readonly path: string;
}

function isAbsolutePath(inputPath: string): boolean {
  return inputPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(inputPath);
}

/** The file the input names, or undefined when it is relative and no folder is open. */
export function resolveToolUri(inputPath: string): vscode.Uri | undefined {
  if (isAbsolutePath(inputPath)) return vscode.Uri.file(inputPath);
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  return vscode.Uri.joinPath(folder.uri, ...inputPath.split(/[\\/]/));
}

/** The open editors' documents by URI. Taken once per request, so a lookup per path costs no scan. */
export function openSceneDocuments(): ReadonlyMap<string, vscode.TextDocument> {
  return new Map(vscode.workspace.textDocuments.map((document) => [document.uri.toString(), document]));
}

/** The text of the file at `uri` on disk. It opens no document, so it starts no lint. */
export async function readSceneFileText(uri: vscode.Uri): Promise<string> {
  return new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
}

/**
 * The text of a scene the tool resolved: an open editor's text, unsaved edits included, as the
 * Problems panel lints it, else the file on disk.
 */
export async function readSceneText(uri: vscode.Uri): Promise<string> {
  return openSceneDocuments().get(uri.toString())?.getText() ?? (await readSceneFileText(uri));
}
