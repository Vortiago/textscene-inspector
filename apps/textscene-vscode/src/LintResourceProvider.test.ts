/**
 * The linter's provider reads a `res://` path under its project root and nowhere else,
 * so the Problems panel reports the files the CLI reports.
 */

import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { setLogAdapter } from '@textscene/core/logger';
import { LintResourceProvider } from './LintResourceProvider';
import { createMockFileData, createMockUri } from './test-setup';

/** Files on the mocked workspace disk, by fsPath. The project root is `/workspace/game`. */
const DISK: Record<string, Uint8Array> = {
  '/workspace/game/project.godot': createMockFileData('config_version=5\n'),
  '/workspace/game/models/tree.glb': new Uint8Array([0x67, 0x6c, 0x54, 0x46]),
  '/workspace/game/scenes/level.tscn': createMockFileData('[gd_scene format=3]\n'),
  '/workspace/secret.txt': createMockFileData('outside the project'),
};

function onDisk(uri: vscode.Uri): Promise<Uint8Array> {
  const bytes = DISK[uri.fsPath];
  return bytes ? Promise.resolve(bytes) : Promise.reject(new Error(`ENOENT: ${uri.fsPath}`));
}

function providerForLevel(): LintResourceProvider {
  return new LintResourceProvider(createMockUri('/workspace/game'));
}

beforeEach(() => {
  (vscode.workspace.fs.stat as Mock).mockImplementation(onDisk);
  (vscode.workspace.fs.readFile as Mock).mockImplementation(onDisk);
});

afterEach(() => {
  (vscode.workspace.fs.stat as Mock).mockResolvedValue({ type: 1, size: 0, ctime: 0, mtime: 0 });
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(new Uint8Array());
});

describe('LintResourceProvider', () => {
  it('reads a binary resource under the project root as bytes', async () => {
    const data = await providerForLevel().loadResource('res://models/tree.glb', 'PackedScene');

    expect(data).toBeInstanceOf(ArrayBuffer);
    expect([...new Uint8Array(data as ArrayBuffer)]).toEqual([0x67, 0x6c, 0x54, 0x46]);
  });

  it('reads a text resource as a string', async () => {
    expect(await providerForLevel().loadResource('res://scenes/level.tscn', 'PackedScene')).toBe(
      '[gd_scene format=3]\n'
    );
  });

  it('gives null for a file the project does not hold, and logs nothing', async () => {
    const log = { trace: vi.fn(), debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    setLogAdapter(log);
    try {
      expect(await providerForLevel().loadResource('res://models/missing.glb', 'PackedScene')).toBeNull();
    } finally {
      setLogAdapter(null);
    }
    for (const level of Object.values(log)) expect(level).not.toHaveBeenCalled();
  });

  it('refuses a path that escapes the project root, reading nothing', async () => {
    expect(await providerForLevel().loadResource('res://../secret.txt', 'TextFile')).toBeNull();
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('refuses a path that is not res://', async () => {
    expect(await providerForLevel().loadResource('/workspace/secret.txt', 'TextFile')).toBeNull();
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('names the workspace file of a res:// path, and nothing for one that escapes the root', () => {
    expect(providerForLevel().fileOf('res://models/tree.glb')?.fsPath).toBe('/workspace/game/models/tree.glb');
    expect(providerForLevel().fileOf('res://../secret.txt')).toBeNull();
    expect(providerForLevel().fileOf('/workspace/secret.txt')).toBeNull();
  });
});

describe('LintResourceProvider holds', () => {
  it('holds a file under the project root and none outside it', () => {
    const provider = providerForLevel();

    expect(provider.holds(createMockUri('/workspace/game/bin/a.gdextension'))).toBe(true);
    expect(provider.holds(createMockUri('/workspace/other/a.gdextension'))).toBe(false);
  });
});

describe('LintResourceProvider stamp', () => {
  /** A stat of a file on the mocked disk, with the modification time and size of its bytes. */
  function statOnDisk(uri: vscode.Uri) {
    return onDisk(uri).then((bytes) => ({ type: 1, ctime: 0, mtime: 1_700_000_000_000, size: bytes.length }));
  }

  beforeEach(() => {
    (vscode.workspace.fs.stat as Mock).mockImplementation(statOnDisk);
  });

  it("stamps a file under the project root with its modification time and size", async () => {
    expect(await providerForLevel().stamp('res://models/tree.glb')).toBe('1700000000000:4');
  });

  it('reads no byte of the file', async () => {
    await providerForLevel().stamp('res://models/tree.glb');
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('gives null for a file the project does not hold', async () => {
    expect(await providerForLevel().stamp('res://models/missing.glb')).toBeNull();
  });

  it('gives null for a path that escapes the project root, or is not res://', async () => {
    const provider = providerForLevel();
    expect(await provider.stamp('res://../secret.txt')).toBeNull();
    expect(await provider.stamp('/workspace/secret.txt')).toBeNull();
  });
});

describe('LintResourceProvider listFiles', () => {
  /** Arranges the files `findFiles` finds for each glob: the GDExtension files, and the scan's stop files. */
  function found(gdextensions: readonly string[], stopFiles: readonly string[]): void {
    (vscode.workspace.findFiles as Mock).mockImplementation(async (include: vscode.RelativePattern) =>
      (include.pattern.includes('gdignore') ? stopFiles : gdextensions).map((path) => createMockUri(path))
    );
  }

  it("lists each GDExtension under the project root as a res:// path, in any case", async () => {
    found(['/workspace/game/bin/a.gdextension', '/workspace/game/addons/x/B.GDExtension'], ['/workspace/game/project.godot']);

    expect(await providerForLevel().listFiles('gdextension')).toEqual([
      'res://bin/a.gdextension',
      'res://addons/x/B.GDExtension',
    ]);
  });

  it("leaves out one the editor's scan skips: under a dot-named directory, another project or a .gdignore", async () => {
    found(
      [
        '/workspace/game/.godot/a.gdextension',
        '/workspace/game/vendor/other/b.gdextension',
        '/workspace/game/ignored/deep/c.gdextension',
        '/workspace/game/kept/d.gdextension',
      ],
      ['/workspace/game/project.godot', '/workspace/game/vendor/other/project.godot', '/workspace/game/ignored/.gdignore']
    );

    expect(await providerForLevel().listFiles('gdextension')).toEqual(['res://kept/d.gdextension']);
  });

  it('searches under the project root with no excludes, so neither files.exclude nor .gitignore hides a file', async () => {
    found([], []);

    await providerForLevel().listFiles('gdextension');

    const calls = (vscode.workspace.findFiles as Mock).mock.calls as [vscode.RelativePattern, unknown][];
    expect(calls.map(([include]) => include.baseUri.fsPath)).toEqual(['/workspace/game', '/workspace/game']);
    expect(calls.map(([include]) => include.pattern)).toContain(
      '**/*.[gG][dD][eE][xX][tT][eE][nN][sS][iI][oO][nN]'
    );
    expect(calls.map(([, exclude]) => exclude)).toEqual([null, null]);
  });

  it('gives null when the search fails, since nothing is then proven', async () => {
    (vscode.workspace.findFiles as Mock).mockRejectedValue(new Error('search failed'));

    expect(await providerForLevel().listFiles('gdextension')).toBeNull();
  });
});
