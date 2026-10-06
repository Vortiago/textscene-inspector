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

/**
 * The text of a scene the tool resolved: an open editor's text, unsaved edits included, as the
 * Problems panel lints it, else the file on disk. It opens no document, so it starts no lint.
 */
export async function readSceneText(uri: vscode.Uri): Promise<string> {
  const key = uri.toString();
  const open = vscode.workspace.textDocuments.find((document) => document.uri.toString() === key);
  if (open) return open.getText();
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder().decode(bytes);
}
