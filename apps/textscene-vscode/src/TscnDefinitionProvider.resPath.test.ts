/** Go to definition on a `res://` path, which opens the file the nearest project.godot's root names. */

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

  it('gives nothing when no directory holds project.godot, since Godot then has no res://', async () => {
    arrangeWorkspace(['/workspace/art/a.png']);

    expect(await definitionOnPath()).toBeNull();
  });
});
