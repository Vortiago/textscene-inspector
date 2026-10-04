import { describe, expect, it, vi } from 'vitest';
import { createMockDocument } from './TscnDefinitionProvider.testkit';
import { TscnResPathListing } from './TscnResPathListing';
import { createMockUri, vscode as vscodeMocks } from './test-setup';

function arrangeProject(): void {
  (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue({
    uri: createMockUri('/game'),
  });
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: { fsPath: string }) =>
    uri.fsPath.replace(/\\/g, '/') === '/game/project.godot'
      ? Promise.resolve({ type: 1, size: 1, ctime: 0, mtime: 0 })
      : Promise.reject(new Error('Not found'))
  );
  vscodeMocks.workspace.findFiles.mockResolvedValue([
    createMockUri('/game/scenes/Door.tscn'),
    createMockUri('/game/icon.svg'),
  ]);
}

describe('TscnResPathListing', () => {
  it('maps the project files under the Godot root to res:// paths', async () => {
    arrangeProject();
    const paths = await new TscnResPathListing().pathsFor(createMockDocument('[node name="R" type="Node"]'));
    expect(paths).toEqual(['res://icon.svg', 'res://scenes/Door.tscn']);
  });

  it('lists once per project root, so a completion does not walk the workspace', async () => {
    arrangeProject();
    const listing = new TscnResPathListing();
    const document = createMockDocument('[node name="R" type="Node"]');
    await listing.pathsFor(document);
    await listing.pathsFor(document);
    expect(vscodeMocks.workspace.findFiles).toHaveBeenCalledTimes(1);
  });

  it('lists again after clear(), so a created file is offered', async () => {
    arrangeProject();
    const listing = new TscnResPathListing();
    const document = createMockDocument('[node name="R" type="Node"]');
    await listing.pathsFor(document);
    listing.clear();
    await listing.pathsFor(document);
    expect(vscodeMocks.workspace.findFiles).toHaveBeenCalledTimes(2);
  });

  it('returns nothing outside a workspace folder', async () => {
    (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(
      await new TscnResPathListing().pathsFor(createMockDocument('[node name="R" type="Node"]'))
    ).toEqual([]);
  });
});
