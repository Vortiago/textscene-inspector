/**
 * The linter's provider reads a `res://` path under the document's project root and
 * nowhere else, so the Problems panel reports the files the CLI reports.
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
  '/workspace/game/scenes/beside.glb': new Uint8Array([1, 2, 3]),
  '/workspace/secret.txt': createMockFileData('outside the project'),
};

function onDisk(uri: vscode.Uri): Promise<Uint8Array> {
  const bytes = DISK[uri.fsPath];
  return bytes ? Promise.resolve(bytes) : Promise.reject(new Error(`ENOENT: ${uri.fsPath}`));
}

function providerForLevel(): LintResourceProvider {
  return new LintResourceProvider(createMockUri('/workspace'), createMockUri('/workspace/game/scenes/level.tscn'));
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

  it("gives null for a file beside the document, which Godot never reads for a res:// path", async () => {
    expect(await providerForLevel().loadResource('res://beside.glb', 'PackedScene')).toBeNull();
  });

  it('refuses a path that escapes the project root, reading nothing', async () => {
    expect(await providerForLevel().loadResource('res://../secret.txt', 'TextFile')).toBeNull();
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('refuses a path that is not res://', async () => {
    expect(await providerForLevel().loadResource('/workspace/secret.txt', 'TextFile')).toBeNull();
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('walks for the project root once across reads', async () => {
    const provider = providerForLevel();
    await provider.loadResource('res://models/tree.glb', 'PackedScene');
    const walked = (vscode.workspace.fs.stat as Mock).mock.calls.length;

    await provider.loadResource('res://scenes/level.tscn', 'PackedScene');

    expect(walked).toBeGreaterThan(0);
    expect(vscode.workspace.fs.stat).toHaveBeenCalledTimes(walked);
  });
});
