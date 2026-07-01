/**
 * Test helpers for working with TSCN fixture files.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Get the path to a fixture file in the test workspace.
 * @param fixtureName Name of the fixture file (e.g., 'unit-empty-scene.tscn')
 * @returns URI to the fixture file
 */
export function getFixturePath(fixtureName: string): vscode.Uri {
  // __dirname in compiled JS points to out/test/integration/helpers
  // Need to go up to textscene-vscode root, then to .test-workspace
  const workspaceRoot = path.resolve(
    __dirname,
    '../../../../.test-workspace',
  );
  return vscode.Uri.file(path.join(workspaceRoot, 'fixtures', fixtureName));
}

/**
 * Open a fixture file in VS Code.
 * @param fixtureName Name of the fixture file
 * @returns The opened text document
 */
export async function openFixture(
  fixtureName: string,
): Promise<vscode.TextDocument> {
  const fixtureUri = getFixturePath(fixtureName);
  return await vscode.workspace.openTextDocument(fixtureUri);
}

/**
 * List all available fixtures in the test workspace.
 * @returns Array of fixture file names
 */
export function listFixtures(): string[] {
  // __dirname in compiled JS points to out/test/integration/helpers
  const workspaceRoot = path.resolve(
    __dirname,
    '../../../../.test-workspace',
  );
  const fixturesDir = path.join(workspaceRoot, 'fixtures');

  try {
    return fs
      .readdirSync(fixturesDir)
      .filter((file: string) => file.endsWith('.tscn'));
  } catch {
    return [];
  }
}
