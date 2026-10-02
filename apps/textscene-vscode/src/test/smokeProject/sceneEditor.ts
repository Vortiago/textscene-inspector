/**
 * The editor actions that the installed-package and web suites share. It imports only
 * `vscode`, so the web suite can bundle it for a browser worker.
 */

import * as vscode from 'vscode';

export const EXTENSION_ID = 'vortiago.textscene-inspector';
export const PREVIEW_COMMAND = 'textscene.openPreviewToSide';

/** The extension under test. Throws when VS Code has not loaded it, which fails every test. */
export function extensionUnderTest(): vscode.Extension<unknown> {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  if (!extension) throw new Error(`expected VS Code to load ${EXTENSION_ID}, found none`);
  return extension;
}

/** Opens a scene of the workspace in an editor. */
export async function openScene(name: string): Promise<vscode.TextDocument> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) throw new Error('expected the launcher to open the workspace folder, found none');
  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, name));
  await vscode.window.showTextDocument(document);
  return document;
}

/** Opens a scene and waits for the activation it starts, so a test runs alone or in any order. */
export async function openSceneAndActivate(name: string): Promise<vscode.TextDocument> {
  const document = await openScene(name);
  await extensionUnderTest().activate();
  return document;
}

/** The commands the manifest contributes that VS Code has not registered. */
export async function unregisteredCommands(): Promise<string[]> {
  const contributed = (
    extensionUnderTest().packageJSON.contributes.commands as Array<{ command: string }>
  ).map((entry) => entry.command);
  if (contributed.length === 0) throw new Error('expected the manifest to contribute a command, found none');
  const registered = new Set(await vscode.commands.getCommands(true));
  return contributed.filter((command) => !registered.has(command));
}

/** The code of every diagnostic the linter reports on `document`. */
export function lintCodes(document: vscode.TextDocument): unknown[] {
  return vscode.languages
    .getDiagnostics(document.uri)
    .filter((d) => d.source === 'tscn-lint')
    .map((d) => d.code);
}

/** The label of every open preview tab. VS Code prefixes a webview tab's viewType with its own namespace. */
export function previewTabLabels(): string[] {
  return vscode.window.tabGroups.all
    .flatMap((group) => group.tabs)
    .filter(
      (tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith('tscnPreview')
    )
    .map((tab) => tab.label);
}
