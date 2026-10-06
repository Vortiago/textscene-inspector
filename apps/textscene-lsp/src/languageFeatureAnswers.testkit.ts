/**
 * Where the `tscn-lsp` end-to-end test finds the shared Godot fixture project. The answers and
 * their readers live in `@textscene/dev-kit`, which the VS Code suites read too (ADR-0049).
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { answersFixtureDir } from '@textscene/dev-kit';
import { repoRoot } from './lspClient.testkit';

export const FIXTURE_DIR = answersFixtureDir(repoRoot);
export const PROJECT_DIR = join(FIXTURE_DIR, 'project');

/** The text of a project file, as committed. */
export function projectText(file: string): string {
  return readFileSync(join(PROJECT_DIR, file), 'utf8');
}
