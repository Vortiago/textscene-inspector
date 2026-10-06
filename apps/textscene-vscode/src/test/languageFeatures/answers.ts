/**
 * The VS Code side of the shared answers for `scenes/language-features/`: the fixture copy each
 * suite edits, and the cursor and path readers over VS Code's types. The answers and their
 * host-neutral readers live in `@textscene/dev-kit`, which the `tscn-lsp` test reads too.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { removeTestDirectory } from '../removeTestDirectory';
import {
  answersFixtureDir,
  cursorIn as sharedCursorIn,
  loadAnswers as loadSharedAnswers,
  type CursorSpec,
  type LanguageFeatureAnswers,
} from '@textscene/dev-kit';

export { rangeTuple, sortedRanges, type CursorSpec, type RangeTuple } from '@textscene/dev-kit';

/** The fixture directory, found by walking up from this bundle's own output directory. */
function fixtureDir(): string {
  return answersFixtureDir(__dirname);
}

export function loadAnswers(): LanguageFeatureAnswers {
  return loadSharedAnswers(fixtureDir());
}

/**
 * Recreates `destination` as a copy of the fixture project. `cpSync` keeps the PNG bytes and
 * the dot-named `.godot` and `.gdignore` entries, which the path-completion answer depends on.
 */
export async function copyFixtureProject(destination: string): Promise<void> {
  await removeFixtureProject(destination);
  fs.cpSync(path.join(fixtureDir(), 'project'), destination, { recursive: true });
}

/** Removes a copy that `copyFixtureProject` made. Async, so a Windows retry can yield. */
export async function removeFixtureProject(destination: string): Promise<void> {
  await removeTestDirectory(destination);
}

/** The zero-based position a cursor spec names in `document`. Throws when the spec matches nothing. */
export function cursorIn(document: vscode.TextDocument, spec: CursorSpec): vscode.Position {
  const lines = Array.from({ length: document.lineCount }, (_, line) => document.lineAt(line).text);
  const { line, character } = sharedCursorIn(lines, spec);
  return new vscode.Position(line, character);
}

/** A path under `projectDir` with forward slashes, so an answer reads the same on Windows. */
export function projectPath(projectDir: string, fsPath: string): string {
  return path.relative(projectDir, fsPath).split(path.sep).join('/');
}
