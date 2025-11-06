/**
 * Test helpers for working with TSCN fixture files.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { readFileSync, writeFileSync } from 'fs';

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
 * Get the content of a fixture file.
 * @param fixtureName Name of the fixture file
 * @returns File content as string
 */
export function getFixtureContent(fixtureName: string): string {
  const fixtureUri = getFixturePath(fixtureName);
  return readFileSync(fixtureUri.fsPath, 'utf-8');
}

/**
 * Modify a fixture file and save it.
 * Useful for testing incremental updates.
 * @param fixtureName Name of the fixture file
 * @param modifier Function that modifies the content
 * @returns Promise that resolves when the file is saved
 */
export async function modifyFixture(
  fixtureName: string,
  modifier: (content: string) => string,
): Promise<void> {
  const fixtureUri = getFixturePath(fixtureName);
  const doc = await vscode.workspace.openTextDocument(fixtureUri);

  const originalContent = doc.getText();
  const newContent = modifier(originalContent);

  // Use VS Code's WorkspaceEdit API to properly edit the document
  const edit = new vscode.WorkspaceEdit();
  const fullRange = new vscode.Range(
    doc.positionAt(0),
    doc.positionAt(originalContent.length),
  );
  edit.replace(fixtureUri, fullRange, newContent);

  // Apply the edit
  const success = await vscode.workspace.applyEdit(edit);
  if (!success) {
    throw new Error(`Failed to apply edit to ${fixtureName}`);
  }

  // Save the document to trigger the onDidSaveTextDocument event
  await doc.save();

  // Give file watcher time to detect the change
  await new Promise((resolve) => setTimeout(resolve, 300));
}

/**
 * Create a temporary test fixture from a template.
 * @param template TSCN content template
 * @param fileName Name for the temporary file
 * @returns URI to the created file
 */
export async function createTempFixture(
  template: string,
  fileName: string,
): Promise<vscode.Uri> {
  // __dirname in compiled JS points to out/test/integration/helpers
  const workspaceRoot = path.resolve(
    __dirname,
    '../../../../.test-workspace',
  );
  const filePath = path.join(workspaceRoot, 'fixtures', fileName);

  writeFileSync(filePath, template, 'utf-8');

  return vscode.Uri.file(filePath);
}

/**
 * Clean up a temporary fixture file.
 * @param fileName Name of the file to delete
 */
export async function cleanupTempFixture(fileName: string): Promise<void> {
  const fixtureUri = getFixturePath(fileName);
  try {
    await vscode.workspace.fs.delete(fixtureUri);
  } catch {
    // Ignore if file doesn't exist
  }
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
