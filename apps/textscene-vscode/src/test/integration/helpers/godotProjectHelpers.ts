/**
 * Writes a small Godot project into the test workspace for a suite that drives the
 * extension through VS Code's own commands, and finds lines in its documents.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * The absolute fsPath of the project named `name` in the test workspace. `__dirname`
 * is the bundle's output directory, four levels below the app root.
 */
export function godotProjectDir(name: string): string {
  return path.resolve(__dirname, '../../../../.test-workspace', name);
}

/**
 * Recreates `.test-workspace/<name>/` from scratch with a `project.godot` and each
 * file in `files`, keyed by its path relative to the project. Call it once in
 * `suiteSetup`. The launcher has already opened the workspace, so the folder is
 * inside a workspace folder and every `res://` path resolves against it.
 */
export function writeGodotProject(name: string, files: Record<string, string>): void {
  const dir = godotProjectDir(name);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, 'project.godot'),
    `config_version=5\n\n[application]\nconfig/name="${name}"\n`
  );
  for (const [relativePath, content] of Object.entries(files)) {
    const file = path.join(dir, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}

/** Call in `suiteTeardown`. */
export function removeGodotProject(name: string): void {
  fs.rmSync(godotProjectDir(name), { recursive: true, force: true });
}

/** Opens a file of the project as a text document, which activates the extension on `onLanguage:tscn`. */
export async function openProjectDocument(name: string, relativePath: string): Promise<vscode.TextDocument> {
  return vscode.workspace.openTextDocument(vscode.Uri.file(path.join(godotProjectDir(name), relativePath)));
}

/**
 * The zero-based index of the first line of `document` that starts with `prefix`.
 * Throws when none does, so a test names the line it means, not a number.
 */
export function lineStartingWith(document: vscode.TextDocument, prefix: string): number {
  for (let line = 0; line < document.lineCount; line++) {
    if (document.lineAt(line).text.startsWith(prefix)) return line;
  }
  throw new Error(`expected a line starting with ${JSON.stringify(prefix)} in ${document.uri.fsPath}`);
}

/** The position just inside the first `needle` on the line that starts with `prefix`. */
export function positionInside(
  document: vscode.TextDocument,
  prefix: string,
  needle: string
): vscode.Position {
  const line = lineStartingWith(document, prefix);
  const column = document.lineAt(line).text.indexOf(needle);
  if (column === -1) {
    throw new Error(`expected ${JSON.stringify(needle)} on line ${line + 1} of ${document.uri.fsPath}`);
  }
  return new vscode.Position(line, column + 1);
}
