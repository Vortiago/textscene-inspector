/**
 * Integration tests for all scene fixtures.
 * Tests that each fixture file can be opened in the custom editor.
 */
import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { fixtures } from '../fixtures';

suite('Fixture Loading Tests', () => {
  const workspaceRoot = path.resolve(__dirname, '../../../../.test-workspace');

  // Group fixtures by category for better test organization
  const fixturesByCategory = fixtures.reduce(
    (acc, fixture) => {
      if (!acc[fixture.category]) {
        acc[fixture.category] = [];
      }
      acc[fixture.category]!.push(fixture);
      return acc;
    },
    {} as Record<string, typeof fixtures>
  );

  // Create test suites for each category
  Object.entries(fixturesByCategory).forEach(([category, categoryFixtures]) => {
    suite(category, () => {
      categoryFixtures.forEach((fixture) => {
        test(`should open ${fixture.name}`, async function () {
          // Increase timeout for complex scenes
          this.timeout(10000);

          // All files are in fixtures/ directory (setupWorkspace copies all there)
          const filePath = path.join(workspaceRoot, 'fixtures', fixture.file);

          // Convert to URI
          const fileUri = vscode.Uri.file(filePath);

          // Open the document (this should trigger the custom editor)
          const doc = await vscode.workspace.openTextDocument(fileUri);
          assert.ok(doc, `Should open document for ${fixture.file}`);

          // Show the document (triggers custom editor provider)
          await vscode.window.showTextDocument(doc, {
            preview: false,
            viewColumn: vscode.ViewColumn.One,
          });

          // Wait a bit for custom editor to activate
          await new Promise((resolve) => setTimeout(resolve, 500));

          // Verify the tab is open
          const activeEditor = vscode.window.activeTextEditor;
          if (activeEditor) {
            assert.strictEqual(
              activeEditor.document.uri.fsPath,
              filePath,
              `Active editor should be ${fixture.file}`
            );
          }

          // Close the editor
          await vscode.commands.executeCommand('workbench.action.closeActiveEditor');

          // Wait a bit before opening next file
          await new Promise((resolve) => setTimeout(resolve, 100));
        });
      });
    });
  });
});
