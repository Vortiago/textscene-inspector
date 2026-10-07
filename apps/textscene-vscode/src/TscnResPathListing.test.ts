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

/** Whether the search's exclude glob drops `file`, for the two directory kinds the listing names. */
function isExcluded(file: string, exclude: string | null | undefined): boolean {
  const directories = file.split('/').slice(1, -1);
  if (exclude?.includes('node_modules') && directories.includes('node_modules')) return true;
  return Boolean(exclude?.includes('.*') && directories.some((name) => name.startsWith('.')));
}

/**
 * Answers the listing search with `files` and the stop-file search with `stopFiles`. The listing
 * search honours its exclude glob and its result limit, as `findFiles` does.
 */
function arrangeFiles(files: readonly string[], stopFiles: readonly string[]): void {
  vscodeMocks.workspace.findFiles.mockImplementation(
    (pattern: { pattern: string }, exclude?: string | null, maxResults?: number) => {
      if (pattern.pattern !== '**/*') return Promise.resolve(stopFiles.map(createMockUri));
      const found = files.filter((file) => !isExcluded(file, exclude)).slice(0, maxResults);
      return Promise.resolve(found.map(createMockUri));
    }
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

  it("offers a file under node_modules, since Godot's scan enters it", async () => {
    arrangeProject();
    arrangeFiles(['/game/a.tscn', '/game/node_modules/pkg/icon.png'], ['/game/project.godot']);

    const paths = await new TscnResPathListing().pathsFor(sceneInProject());

    expect(paths).toEqual(['res://a.tscn', 'res://node_modules/pkg/icon.png']);
  });

  it('leaves out a dot-named directory, which the scan skips', async () => {
    arrangeProject();
    arrangeFiles(['/game/a.tscn', '/game/.godot/imported/a.ctex'], ['/game/project.godot']);

    expect(await new TscnResPathListing().pathsFor(sceneInProject())).toEqual(['res://a.tscn']);
  });

  it('lists every file of a large project, with no cap', async () => {
    arrangeProject();
    const files = Array.from({ length: 6000 }, (_, index) => `/game/tiles/tile_${index}.png`);
    arrangeFiles(files, ['/game/project.godot']);

    expect(await new TscnResPathListing().pathsFor(sceneInProject())).toHaveLength(6000);
  });

  it("lists the files under the document's own directory when no directory holds project.godot", async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    arrangeFiles(['/game/scenes/decorations/banner.png', '/game/scenes/main.tscn'], []);

    const paths = await new TscnResPathListing().pathsFor(sceneInProject());

    expect(paths).toEqual(['res://decorations/banner.png', 'res://main.tscn']);
  });

  it("searches only under the document's own directory when no directory holds project.godot", async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    await new TscnResPathListing().pathsFor(sceneInProject());

    const bases = vscodeMocks.workspace.findFiles.mock.calls.map(
      ([pattern]: [{ baseUri: { fsPath: string } }]) => pattern.baseUri.fsPath.replace(/\\/g, '/')
    );
    expect(new Set(bases)).toEqual(new Set(['/game/scenes']));
  });

  it('shares one listing between the loose scenes of one directory', async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    const listing = new TscnResPathListing();

    await listing.pathsFor(sceneInProject());
    await listing.pathsFor(createMockDocument('[node name="R" type="Node"]', '/game/scenes/other.tscn'));

    expect(listingSearches()).toBe(1);
  });

  it('returns nothing outside a workspace folder', async () => {
    (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(await new TscnResPathListing().pathsFor(sceneInProject())).toEqual([]);
  });
});
