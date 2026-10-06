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
  arrangeFiles(['/game/scenes/Door.tscn', '/game/icon.svg'], []);
}

/** Answers the listing search with `files` and the stop-file search with `stopFiles`. */
function arrangeFiles(files: readonly string[], stopFiles: readonly string[]): void {
  vscodeMocks.workspace.findFiles.mockImplementation((pattern: { pattern: string }) =>
    Promise.resolve((pattern.pattern === '**/*' ? files : stopFiles).map(createMockUri))
  );
}

/** The listing searches made so far, the stop-file searches left out. */
function listingSearches(): number {
  return vscodeMocks.workspace.findFiles.mock.calls.filter(
    ([pattern]: [{ pattern: string }]) => pattern.pattern === '**/*'
  ).length;
}

/** A scene inside the /game project that `arrangeProject` sets up. */
function sceneInProject() {
  return createMockDocument('[node name="R" type="Node"]', '/game/scenes/main.tscn');
}

describe('TscnResPathListing', () => {
  it('maps the project files under the Godot root to res:// paths', async () => {
    arrangeProject();
    const paths = await new TscnResPathListing().pathsFor(sceneInProject());
    expect(paths).toEqual(['res://icon.svg', 'res://scenes/Door.tscn']);
  });

  it('lists once per project root, so a completion does not walk the workspace', async () => {
    arrangeProject();
    const listing = new TscnResPathListing();
    const document = sceneInProject();
    await listing.pathsFor(document);
    await listing.pathsFor(document);
    expect(listingSearches()).toBe(1);
  });

  it('lists again after clear(), so a created file is offered', async () => {
    arrangeProject();
    const listing = new TscnResPathListing();
    const document = sceneInProject();
    await listing.pathsFor(document);
    listing.clear();
    await listing.pathsFor(document);
    expect(listingSearches()).toBe(2);
  });

  it('leaves out a nested project and a .gdignore directory, as the editor scan does', async () => {
    arrangeProject();
    arrangeFiles(
      ['/game/a.tscn', '/game/vendor/other/b.tscn', '/game/raw/c.png'],
      ['/game/project.godot', '/game/vendor/other/project.godot', '/game/raw/.gdignore']
    );
    const paths = await new TscnResPathListing().pathsFor(sceneInProject());
    expect(paths).toEqual(['res://a.tscn']);
  });

  it('lists nothing, and searches nothing, when no directory holds project.godot', async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    const paths = await new TscnResPathListing().pathsFor(sceneInProject());

    expect(paths).toEqual([]);
    expect(listingSearches()).toBe(0);
  });

  it('returns nothing outside a workspace folder', async () => {
    (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(await new TscnResPathListing().pathsFor(sceneInProject())).toEqual([]);
  });
});
