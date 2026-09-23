/** Helpers for the TSCN fixtures in the test workspace. */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * @param fixtureName Name of the fixture file, such as 'unit-empty-scene.tscn'
 * @returns URI to the fixture file
 */
export function getFixturePath(fixtureName: string): vscode.Uri {
  // `__dirname` is the bundle's output directory, four levels below the app root.
  const workspaceRoot = path.resolve(
    __dirname,
    '../../../../.test-workspace',
  );
  return vscode.Uri.file(path.join(workspaceRoot, 'fixtures', fixtureName));
}

/**
 * @param fixtureName Name of the fixture file
 * @returns The opened text document
 */
export async function openFixture(
  fixtureName: string,
): Promise<vscode.TextDocument> {
  const fixtureUri = getFixturePath(fixtureName);
  return await vscode.workspace.openTextDocument(fixtureUri);
}

/** @returns The fixture file names in the test workspace */
export function listFixtures(): string[] {
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
