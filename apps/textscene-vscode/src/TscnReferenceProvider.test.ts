/**
 * Find All References on a `res://` path: the engine matches, and this host lists the project, reads each file
 * (an open editor's unsaved text first) and maps each match to a location under the document's `res://` root.
 */

import { describe, expect, it, vi } from 'vitest';
import * as vscode from 'vscode';
import { TscnReferenceProvider } from './TscnReferenceProvider';
import { createMockDocument } from './TscnDefinitionProvider.testkit';
import { createMockFileData, createMockUri, vscode as vscodeMocks } from './test-setup';

const LINE = '[ext_resource type="Texture2D" path="res://art/a.png" id="1"]';
const ON_PATH = new vscode.Position(0, LINE.indexOf('art/'));

/** The text of each file under /workspace by its path. A file not named rejects when read, as an unreadable file does. */
function arrangeProject(files: Record<string, string>): void {
  (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
    uri: createMockUri('/workspace'),
  });
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: { fsPath: string }) =>
    uri.fsPath === '/workspace/project.godot'
      ? Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 })
      : Promise.reject(new Error('Not found'))
  );
  vscodeMocks.workspace.fs.readFile.mockImplementation((uri: { fsPath: string }) => {
    const text = files[uri.fsPath];
    return text === undefined
      ? Promise.reject(new Error('unreadable'))
      : Promise.resolve(createMockFileData(text));
  });
}

/** A token that has not been cancelled. */
const LIVE_TOKEN = { isCancellationRequested: false } as vscode.CancellationToken;

/** The references found from `position` in `door.tscn`, as `path:line:character`. */
async function referencesFound(
  listing: readonly string[],
  position: vscode.Position = ON_PATH,
  token: vscode.CancellationToken = LIVE_TOKEN
): Promise<string[]> {
  const provider = new TscnReferenceProvider({ pathsFor: async () => listing });
  const locations = await provider.provideReferences(
    createMockDocument(LINE, '/workspace/scenes/door.tscn'),
    position,
    { includeDeclaration: true },
    token
  );
  return locations.map(
    (location) => `${location.uri.fsPath}:${location.range.start.line}:${location.range.start.character}`
  );
}

describe('TscnReferenceProvider', () => {
  it('locates each occurrence in the files under the root of the document', async () => {
    arrangeProject({
      '/workspace/scenes/door.tscn': LINE,
      '/workspace/levels/one.tscn': `\n${LINE}\n`,
    });

    expect(await referencesFound(['res://levels/one.tscn', 'res://scenes/door.tscn'])).toEqual([
      '/workspace/levels/one.tscn:1:37',
      '/workspace/scenes/door.tscn:0:37',
    ]);
  });

  it("reads an open document's text in place of its file", async () => {
    arrangeProject({ '/workspace/levels/one.tscn': LINE });
    vscodeMocks.workspace.textDocuments = [createMockDocument(`\n\n${LINE}`, '/workspace/levels/one.tscn')];

    try {
      expect(await referencesFound(['res://levels/one.tscn'])).toEqual(['/workspace/levels/one.tscn:2:37']);
    } finally {
      vscodeMocks.workspace.textDocuments = [];
    }
  });

  it('skips a file it cannot read', async () => {
    arrangeProject({ '/workspace/levels/two.tscn': LINE });

    expect(await referencesFound(['res://levels/one.tscn', 'res://levels/two.tscn'])).toEqual([
      '/workspace/levels/two.tscn:0:37',
    ]);
  });

  it('gives nothing for a document outside every workspace folder', async () => {
    arrangeProject({ '/workspace/levels/one.tscn': LINE });
    (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);

    expect(await referencesFound(['res://levels/one.tscn'])).toEqual([]);
  });

  it('lists nothing when the cursor is off a res:// path', async () => {
    arrangeProject({});
    const pathsFor = vi.fn(async () => []);

    const locations = await new TscnReferenceProvider({ pathsFor }).provideReferences(
      createMockDocument(LINE, '/workspace/scenes/door.tscn'),
      new vscode.Position(0, 3),
      { includeDeclaration: true },
      LIVE_TOKEN
    );

    expect(locations).toEqual([]);
    expect(pathsFor).not.toHaveBeenCalled();
  });

  it('reads no file once the request is cancelled', async () => {
    arrangeProject({ '/workspace/levels/one.tscn': LINE });
    const cancelled = { isCancellationRequested: true } as vscode.CancellationToken;

    expect(await referencesFound(['res://levels/one.tscn'], ON_PATH, cancelled)).toEqual([]);
    expect(vscodeMocks.workspace.fs.readFile).not.toHaveBeenCalled();
  });
});
