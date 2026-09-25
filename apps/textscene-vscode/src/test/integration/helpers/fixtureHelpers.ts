/** Helpers for the TSCN fixtures in the test workspace. */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

// `__dirname` is the bundle's output directory, four levels below the app root.
const FIXTURES_DIR = path.join(path.resolve(__dirname, '../../../../.test-workspace'), 'fixtures');

/**
 * @param fixtureName Name of the fixture file, such as 'unit-empty-scene.tscn'
 * @returns URI to the fixture file
 */
export function getFixturePath(fixtureName: string): vscode.Uri {
  return vscode.Uri.file(path.join(FIXTURES_DIR, fixtureName));
}

/** @returns The fixture file names in the test workspace */
export function listFixtures(): string[] {
  try {
    return fs.readdirSync(FIXTURES_DIR).filter((file: string) => file.endsWith('.tscn'));
  } catch {
    // No test workspace yet: a caller that needs fixtures skips its test.
    return [];
  }
}
