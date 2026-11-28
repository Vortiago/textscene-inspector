import { describe, expect, it, vi } from 'vitest';
import { createMockDocument } from '../TscnDefinitionProvider.testkit';
import type * as vscode from 'vscode';
import { createWorkspaceResRoots, type WorkspaceResRoots } from './workspaceResRoots';
import { createMockUriForScheme } from '../vscodeMocks.testkit';
import { createMockUri, vscode as vscodeMocks } from '../test-setup';

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

async function pathsFor(roots: WorkspaceResRoots, document: vscode.TextDocument) {
  return (await roots.rootOf(document.uri))?.root.listPaths() ?? [];
}

function fireWatcher(kind: 'onDidCreate' | 'onDidDelete', path: string): void {
  const watcher = vscodeMocks.workspace.createFileSystemWatcher.mock.results.at(-1).value;
  watcher[kind].mock.calls.at(-1)[0](createMockUri(path));
}

describe('WorkspaceResRoots', () => {
  it('moves between the outer project and the nearest project as the project file comes and goes', async () => {
    arrangeProject();
    const projectFile = '/game/scenes/project.godot';
    let hasInnerProject = false;
    const stat = { type: 1, size: 1, ctime: 0, mtime: 0 };
    vscodeMocks.workspace.fs.stat.mockImplementation((uri: vscode.Uri) =>
      uri.path === '/game/project.godot' || (hasInnerProject && uri.path === projectFile)
        ? Promise.resolve(stat)
        : Promise.reject(new Error('Not found'))
    );
    const roots = createWorkspaceResRoots();
    const { uri } = sceneInProject();
    const outer = await roots.rootOf(uri);
    expect(outer?.uri.path).toBe('/game');
    const observed: Array<Promise<string | undefined>> = [];
    roots.onDidInvalidate(() => observed.push(roots.rootOf(uri).then((root) => root?.uri.path)));

    hasInnerProject = true;
    fireWatcher('onDidCreate', projectFile);
    expect((await roots.rootOf(uri))?.uri.path).toBe('/game/scenes');

    hasInnerProject = false;
    fireWatcher('onDidDelete', projectFile);
    expect(await roots.rootOf(uri)).toBe(outer);
    expect(await Promise.all(observed)).toEqual(['/game/scenes', '/game']);
  });

  it("uses the scene's own directory when there is no project", async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    expect((await createWorkspaceResRoots().rootOf(sceneInProject().uri))?.uri.path).toBe('/game/scenes');
  });

  it('keeps one wrapper for a project until its workspace folder is removed', async () => {
    arrangeProject();
    const roots = createWorkspaceResRoots();
    const first = await roots.rootOf(sceneInProject().uri);
    expect(first?.uri.path).toBe('/game');
    expect(await roots.rootOf(createMockUri('/game/other/scene.tscn'))).toBe(first);

    const onFolders = vscodeMocks.workspace.onDidChangeWorkspaceFolders.mock.calls.at(-1)[0];
    onFolders({ removed: [{ uri: createMockUri('/game') }] });

    const reopened = await roots.rootOf(sceneInProject().uri);
    expect(reopened?.uri.path).toBe('/game');
    expect(reopened).not.toBe(first);
  });

  it('rediscovers a project above the workspace when the window gains focus', async () => {
    arrangeProject();
    vscodeMocks.workspace.getWorkspaceFolder.mockReturnValue({ uri: createMockUri('/game/scenes') });
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    const roots = createWorkspaceResRoots();
    const { uri } = sceneInProject();
    expect((await roots.rootOf(uri))?.uri.path).toBe('/game/scenes');

    vscodeMocks.workspace.fs.stat.mockImplementation((file: vscode.Uri) =>
      file.path === '/game/project.godot'
        ? Promise.resolve({ type: 1, size: 1, ctime: 0, mtime: 0 })
        : Promise.reject(new Error('Not found'))
    );
    const onWindow = vscodeMocks.window.onDidChangeWindowState.mock.calls.at(-1)[0];
    onWindow({ focused: false });
    expect((await roots.rootOf(uri))?.uri.path).toBe('/game/scenes');
    onWindow({ focused: true });
    expect((await roots.rootOf(uri))?.uri.path).toBe('/game');
  });

  it('keeps the scheme and authority of a virtual workspace', async () => {
    const uriAt = (path: string) => createMockUriForScheme(path, 'vscode-vfs', 'repo');
    vscodeMocks.workspace.getWorkspaceFolder.mockReturnValue({ uri: uriAt('/game') });
    vscodeMocks.workspace.fs.stat.mockImplementation((uri: vscode.Uri) =>
      uri.scheme === 'vscode-vfs' &&
      uri.authority === 'repo' &&
      ['/game/project.godot', '/game/icon.svg'].includes(uri.path)
        ? Promise.resolve({ type: 1, size: 1, ctime: 0, mtime: 0 })
        : Promise.reject(new Error('Not found'))
    );

    const root = await createWorkspaceResRoots().rootOf(uriAt('/game/scenes/main.tscn'));

    expect(root?.uri.toString()).toBe('vscode-vfs://repo/game');
    expect(root?.uriOf('res://icon.svg')?.toString()).toBe('vscode-vfs://repo/game/icon.svg');
    expect((await root?.existingFile('res://icon.svg'))?.toString()).toBe('vscode-vfs://repo/game/icon.svg');
    expect(root?.uriOf('res://../outside.svg')).toBeNull();
    expect(await root?.existingFile('res://missing.svg')).toBeNull();
  });

  it('maps the project files under the Godot root to res:// paths', async () => {
    arrangeProject();
    const paths = await pathsFor(createWorkspaceResRoots(), sceneInProject());
    expect([...paths].sort()).toEqual(['res://icon.svg', 'res://scenes/Door.tscn']);
  });

  it('lists once per project root, so a completion does not walk the workspace', async () => {
    arrangeProject();
    const listing = createWorkspaceResRoots();
    const document = sceneInProject();
    await pathsFor(listing, document);
    await pathsFor(listing, document);
    expect(listingSearches()).toBe(1);
  });

  it('offers a created file and drops it when deleted', async () => {
    arrangeProject();
    const roots = createWorkspaceResRoots();
    const document = sceneInProject();
    const initial = await pathsFor(roots, document);

    arrangeFiles(['/game/scenes/Door.tscn', '/game/icon.svg', '/game/late.png'], []);
    fireWatcher('onDidCreate', '/game/late.png');
    expect(await pathsFor(roots, document)).toEqual([...initial, 'res://late.png']);

    arrangeFiles(['/game/scenes/Door.tscn', '/game/icon.svg'], []);
    fireWatcher('onDidDelete', '/game/late.png');
    expect(await pathsFor(roots, document)).toEqual(initial);
    expect(listingSearches()).toBe(3);
  });

  it('invalidates a shared project listing through either workspace folder', async () => {
    arrangeProject();
    vscodeMocks.workspace.getWorkspaceFolder.mockImplementation((uri: vscode.Uri) => ({
      uri: createMockUri(uri.path.startsWith('/game/scenes/') ? '/game/scenes' : '/game/art'),
    }));
    const roots = createWorkspaceResRoots();
    const first = sceneInProject();
    const second = createMockDocument('[node name="R" type="Node"]', '/game/art/other.tscn');
    const initial = await pathsFor(roots, first);
    expect(await pathsFor(roots, second)).toEqual(initial);

    arrangeFiles(['/game/scenes/Door.tscn', '/game/icon.svg', '/game/art/late.png'], []);
    fireWatcher('onDidCreate', '/game/art/late.png');

    expect(await pathsFor(roots, first)).toEqual([...initial, 'res://art/late.png']);
    expect(await pathsFor(roots, second)).toEqual([...initial, 'res://art/late.png']);
  });

  it('rescans when a .gdignore appears and when it is deleted', async () => {
    arrangeProject();
    const roots = createWorkspaceResRoots();
    const document = sceneInProject();
    const files = ['/game/a.tscn', '/game/raw/c.png'];
    arrangeFiles(files, []);
    expect(await pathsFor(roots, document)).toEqual(['res://a.tscn', 'res://raw/c.png']);

    arrangeFiles(files, ['/game/raw/.gdignore']);
    fireWatcher('onDidCreate', '/game/raw/.gdignore');
    expect(await pathsFor(roots, document)).toEqual(['res://a.tscn']);

    arrangeFiles(files, []);
    fireWatcher('onDidDelete', '/game/raw/.gdignore');
    expect(await pathsFor(roots, document)).toEqual(['res://a.tscn', 'res://raw/c.png']);
  });

  it('leaves out a nested project and a .gdignore directory, as the editor scan does', async () => {
    arrangeProject();
    arrangeFiles(
      ['/game/a.tscn', '/game/vendor/other/b.tscn', '/game/raw/c.png'],
      ['/game/project.godot', '/game/vendor/other/project.godot', '/game/raw/.gdignore']
    );
    const paths = await pathsFor(createWorkspaceResRoots(), sceneInProject());
    expect(paths).toEqual(['res://a.tscn']);
  });

  it("offers a file under node_modules, since Godot's scan enters it", async () => {
    arrangeProject();
    arrangeFiles(['/game/a.tscn', '/game/node_modules/pkg/icon.png'], ['/game/project.godot']);

    const paths = await pathsFor(createWorkspaceResRoots(), sceneInProject());

    expect(paths).toEqual(['res://a.tscn', 'res://node_modules/pkg/icon.png']);
  });

  it('leaves out a dot-named directory, which the scan skips', async () => {
    arrangeProject();
    arrangeFiles(['/game/a.tscn', '/game/.godot/imported/a.ctex'], ['/game/project.godot']);

    expect(await pathsFor(createWorkspaceResRoots(), sceneInProject())).toEqual(['res://a.tscn']);
  });

  it('lists every file of a large project, with no cap', async () => {
    arrangeProject();
    const files = Array.from({ length: 6000 }, (_, index) => `/game/tiles/tile_${index}.png`);
    arrangeFiles(files, ['/game/project.godot']);

    expect(await pathsFor(createWorkspaceResRoots(), sceneInProject())).toHaveLength(6000);
  });

  it("lists the files under the document's own directory when no directory holds project.godot", async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    arrangeFiles(['/game/scenes/decorations/banner.png', '/game/scenes/main.tscn'], []);

    const paths = await pathsFor(createWorkspaceResRoots(), sceneInProject());

    expect(paths).toEqual(['res://decorations/banner.png', 'res://main.tscn']);
  });

  it("searches only under the document's own directory when no directory holds project.godot", async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));

    await pathsFor(createWorkspaceResRoots(), sceneInProject());

    const bases = vscodeMocks.workspace.findFiles.mock.calls.map(
      ([pattern]: [{ baseUri: { fsPath: string } }]) => pattern.baseUri.fsPath.replace(/\\/g, '/')
    );
    expect(new Set(bases)).toEqual(new Set(['/game/scenes']));
  });

  it('shares one listing between the loose scenes of one directory', async () => {
    arrangeProject();
    vscodeMocks.workspace.fs.stat.mockRejectedValue(new Error('Not found'));
    const listing = createWorkspaceResRoots();

    await pathsFor(listing, sceneInProject());
    await pathsFor(listing, createMockDocument('[node name="R" type="Node"]', '/game/scenes/other.tscn'));

    expect(listingSearches()).toBe(1);
  });

  it('returns nothing outside a workspace folder', async () => {
    (vscodeMocks.workspace.getWorkspaceFolder as ReturnType<typeof vi.fn>).mockReturnValue(undefined);
    expect(await pathsFor(createWorkspaceResRoots(), sceneInProject())).toEqual([]);
  });
});
