/**
 * Resolves the file a tool's `path` input names and reads it. A path is absolute or
 * workspace-relative; the relative form needs an open workspace folder. No `node:path`,
 * since the browser extension host has no Node built-ins.
 */

import * as vscode from 'vscode';

/** The input every scene tool takes. */
export interface ScenePathToolInput {
  /** A workspace-relative path to a `.tscn`, or an absolute one. */
  readonly path: string;
}

function looksAbsolute(inputPath: string): boolean {
  return inputPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(inputPath);
}

/** The file the input names, or undefined when it is relative and no folder is open. */
export function resolveToolUri(inputPath: string): vscode.Uri | undefined {
  if (looksAbsolute(inputPath)) return vscode.Uri.file(inputPath);
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) return undefined;
  return vscode.Uri.joinPath(folder.uri, ...inputPath.split(/[\\/]/));
}

/** Reads a file the tool resolved, as text. */
export async function readSceneText(uri: vscode.Uri): Promise<string> {
  const bytes = await vscode.workspace.fs.readFile(uri);
  return new TextDecoder().decode(bytes);
}
