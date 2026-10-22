/**
 * Resolves the file a tool's `path` input names and reads it. A path is absolute or
 * workspace-relative. The relative form needs an open workspace folder. This uses no
 * `node:path`, since the browser extension host has no Node built-ins.
 */

import * as vscode from 'vscode';
import { pathKey } from '@textscene/core/resources/resPath';
import { HOST_PATH_CASE } from '../hostPathCase';

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
 * Finds the open editor's document at a file, by the host's path case, as the `tscn-lsp` server matches it. It reads
 * the open documents once, so a request that looks up many files keeps one lookup. The first document at a path wins.
 */
export function openDocumentLookup(): (file: vscode.Uri) => vscode.TextDocument | undefined {
  const byPath = new Map<string, vscode.TextDocument>();
  for (const document of vscode.workspace.textDocuments) {
    const key = documentKey(document.uri);
    if (!byPath.has(key)) byPath.set(key, document);
  }
  return (file) => byPath.get(documentKey(file));
}

/**
 * The scheme and authority too, not the fsPath alone: a diff view's `git:` document of the file has the file's fsPath
 * and holds the committed text.
 */
function documentKey(uri: vscode.Uri): string {
  return `${uri.scheme}://${uri.authority}${pathKey(uri.fsPath, HOST_PATH_CASE)}`;
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
  return openDocumentLookup()(uri)?.getText() ?? (await readSceneFileText(uri));
}
