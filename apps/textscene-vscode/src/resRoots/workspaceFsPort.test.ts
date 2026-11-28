import { describe, expect, it } from 'vitest';
import * as vscode from 'vscode';
import { anyCase } from '../anyCaseGlob';
import { MAX_READ_BYTES } from '../readWorkspaceFile';
import { createMockUri, vscode as vscodeMocks } from '../test-setup';
import { createMockUriForScheme } from '../vscodeMocks.testkit';
import { SCAN_STOP_FILES_PATTERN } from '../watchPatterns';
import { workspaceFsPort } from './workspaceFsPort';

const uriAt = (path: string) => createMockUriForScheme(path, 'vscode-vfs', 'repo');
const folder = { uri: uriAt('/game'), name: 'game', index: 0 };
const missing = new Error('Not found');

describe('workspaceFsPort', () => {
  it('passes file size and modification time through the folder filesystem', async () => {
    vscodeMocks.workspace.fs.stat.mockResolvedValue({
      type: vscode.FileType.File | vscode.FileType.SymbolicLink,
      size: 23,
      ctime: 1,
      mtime: 3,
    });
    const port = workspaceFsPort(folder);

    expect(await port.stat('/game/icon.svg')).toEqual({ isFile: true, mtimeMs: 3, size: 23 });
    const [uri] = vscodeMocks.workspace.fs.stat.mock.calls[0];
    expect(uri.toString()).toBe('vscode-vfs://repo/game/icon.svg');
    expect(await port.realPath('/game/icon.svg')).toBeNull();
  });

  it('uses the directory Uri when the root is a Windows drive', async () => {
    const drive = { uri: createMockUri('/c:/'), name: 'C', index: 0 };
    vscodeMocks.workspace.fs.stat.mockResolvedValue({
      type: vscode.FileType.Directory,
      size: 0,
      ctime: 1,
      mtime: 3,
    });

    expect(await workspaceFsPort(drive).realPath('/c:')).toBe('/c:');
    const [uri] = vscodeMocks.workspace.fs.stat.mock.calls[0];
    expect(uri.path).toBe('/c:/');
  });

  it('treats directory links as leaves in its directory listing', async () => {
    vscodeMocks.workspace.fs.readDirectory.mockResolvedValue([
      ['art', vscode.FileType.Directory],
      ['loop', vscode.FileType.Directory | vscode.FileType.SymbolicLink],
      ['project.godot', vscode.FileType.File],
    ]);

    expect(await workspaceFsPort(folder).list('/game')).toEqual([
      { name: 'art', isDirectory: true },
      { name: 'loop', isDirectory: false },
      { name: 'project.godot', isDirectory: false },
    ]);
  });

  it('reads permitted files and returns null when the workspace read is refused', async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    vscodeMocks.workspace.fs.stat
      .mockResolvedValueOnce({ type: vscode.FileType.File, size: bytes.length })
      .mockResolvedValueOnce({ type: vscode.FileType.File, size: MAX_READ_BYTES + 1 });
    vscodeMocks.workspace.fs.readFile.mockResolvedValueOnce(bytes);
    const port = workspaceFsPort(folder);

    expect(await port.read('/game/icon.svg')).toBe(bytes);
    expect(await port.read('/game/large.glb')).toBeNull();
    expect(vscodeMocks.workspace.fs.readFile).toHaveBeenCalledTimes(1);
  });

  it('returns empty answers for failed filesystem calls', async () => {
    vscodeMocks.workspace.fs.stat.mockRejectedValue(missing);
    vscodeMocks.workspace.fs.readDirectory.mockRejectedValue(missing);
    const port = workspaceFsPort(folder);

    expect(await port.stat('/game/missing')).toBeNull();
    expect(await port.realPath('/game/missing')).toBeNull();
    expect(await port.list('/game/missing')).toEqual([]);
    expect(await port.read('/game/missing')).toBeNull();
  });

  it('searches for the requested extension and filters candidates under stop files', async () => {
    const candidates = [
      uriAt('/game/addons/a/Addon.GDExtension'),
      uriAt('/game/ignored/b.gdextension'),
      uriAt('/game/nested/c.gdextension'),
      uriAt('/game/.godot/d.gdextension'),
    ];
    const stops = [uriAt('/game/ignored/.gdignore'), uriAt('/game/nested/project.godot')];
    vscodeMocks.workspace.findFiles.mockResolvedValueOnce(candidates).mockResolvedValueOnce(stops);

    expect(await workspaceFsPort(folder).scan?.('/game', 'gdextension')).toEqual([
      'res://addons/a/Addon.GDExtension',
    ]);
    const searches = vscodeMocks.workspace.findFiles.mock.calls.map(
      ([{ baseUri, pattern }, exclude]: [vscode.RelativePattern, string | null]) => [
        baseUri.toString(),
        pattern,
        exclude,
      ]
    );
    expect(searches).toEqual([
      [folder.uri.toString(), `**/*.${anyCase('gdextension')}`, null],
      [folder.uri.toString(), SCAN_STOP_FILES_PATTERN, null],
    ]);
  });

  it('returns null if either workspace search fails', async () => {
    const port = workspaceFsPort(folder);
    vscodeMocks.workspace.findFiles
      .mockRejectedValueOnce(missing)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(missing);

    expect(await port.scan?.('/game')).toBeNull();
    expect(await port.scan?.('/game', 'gdextension')).toBeNull();
  });
});
