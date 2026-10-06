/**
 * Go to definition on a `res://` path, which opens the file under the nearest project.godot's
 * root, or under the document's own directory outside every project.
 */

import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { TscnDefinitionProvider } from './TscnDefinitionProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';
import { createMockUri, vscode as vscodeMocks } from './test-setup';

const TOKEN = {} as vscode.CancellationToken;
const LINE = '[ext_resource type="Texture2D" path="res://art/a.png" id="1"]';

/** A workspace at /workspace whose `stat` finds each of `files`, and nothing else. */
function arrangeWorkspace(files: readonly string[]): void {
  (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
    uri: createMockUri('/workspace'),
  });
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: { fsPath: string }) =>
    files.includes(uri.fsPath.replace(/\\/g, '/'))
      ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
      : Promise.reject(new Error('Not found'))
  );
}

async function definitionOnPath(): Promise<vscode.Location | null> {
  const document = createMockDocument(LINE, '/workspace/scenes/door.tscn');
  return new TscnDefinitionProvider().provideDefinition(
    document,
    new vscode.Position(0, LINE.indexOf('art/')),
    TOKEN
  );
}

describe('TscnDefinitionProvider on a res:// path', () => {
  it('opens the file under the nearest project.godot', async () => {
    arrangeWorkspace(['/workspace/project.godot', '/workspace/art/a.png']);

    const location = await definitionOnPath();

    expect((location?.uri as unknown as { fsPath: string } | undefined)?.fsPath).toBe('/workspace/art/a.png');
  });

  it("opens the file under the document's own directory when no directory holds project.godot", async () => {
    arrangeWorkspace(['/workspace/scenes/art/a.png']);

    const location = await definitionOnPath();

    expect((location?.uri as unknown as { fsPath: string } | undefined)?.fsPath).toBe(
      '/workspace/scenes/art/a.png'
    );
  });

  it('gives nothing outside every project for a file only the workspace root holds', async () => {
    arrangeWorkspace(['/workspace/art/a.png']);

    expect(await definitionOnPath()).toBeNull();
  });

  it("prefers the project root to the document's own directory when both hold the file", async () => {
    arrangeWorkspace(['/workspace/project.godot', '/workspace/art/a.png', '/workspace/scenes/art/a.png']);

    const location = await definitionOnPath();

    expect((location?.uri as unknown as { fsPath: string } | undefined)?.fsPath).toBe('/workspace/art/a.png');
  });
});
