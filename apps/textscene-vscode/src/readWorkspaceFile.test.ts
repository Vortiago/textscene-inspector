/** The host reads a regular file within the size limit, and refuses a symbolic link or a larger file unread. */

import { afterEach, describe, expect, it, type Mock } from 'vitest';
import * as vscode from 'vscode';
import { MAX_READ_BYTES, readRefusal, readWorkspaceFile } from './readWorkspaceFile';
import { createMockFileData, createMockUri } from './test-setup';

const FILE = 1;
const SYMBOLIC_LINK = 64;

/** Arranges the `stat` of every file, and its bytes. */
function onDisk(stat: { type: number; size: number }, bytes: Uint8Array = new Uint8Array()): void {
  (vscode.workspace.fs.stat as Mock).mockResolvedValue({ ...stat, ctime: 0, mtime: 0 });
  (vscode.workspace.fs.readFile as Mock).mockResolvedValue(bytes);
}

afterEach(() => {
  onDisk({ type: FILE, size: 0 });
});

describe('readRefusal', () => {
  it('refuses nothing for a regular file within the limit', () => {
    expect(readRefusal({ type: FILE, size: 1024 })).toBeNull();
  });

  it('refuses a symbolic link, whatever its target', () => {
    expect(readRefusal({ type: FILE | SYMBOLIC_LINK, size: 1024 })).toMatch(/symbolic link/);
  });

  it('refuses a file one byte over the limit, and nothing at the limit', () => {
    expect(readRefusal({ type: FILE, size: MAX_READ_BYTES + 1 })).toBe(
      `is ${MAX_READ_BYTES + 1} bytes, over the limit of ${MAX_READ_BYTES} bytes`
    );
    expect(readRefusal({ type: FILE, size: MAX_READ_BYTES })).toBeNull();
  });
});

describe('readWorkspaceFile', () => {
  it('reads a regular file within the limit', async () => {
    const bytes = createMockFileData('[gd_resource format=3]\n');
    onDisk({ type: FILE, size: bytes.byteLength }, bytes);

    expect(await readWorkspaceFile(createMockUri('/workspace/a.tres'))).toBe(bytes);
  });

  it('throws for a file over the limit, naming it, and reads none of it', async () => {
    onDisk({ type: FILE, size: MAX_READ_BYTES + 1 });

    await expect(readWorkspaceFile(createMockUri('/workspace/huge.glb'))).rejects.toThrow(
      /\/workspace\/huge\.glb is \d+ bytes, over the limit/
    );
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('throws for a symbolic link and reads nothing through it', async () => {
    onDisk({ type: FILE | SYMBOLIC_LINK, size: 10 });

    await expect(readWorkspaceFile(createMockUri('/workspace/textures/a.png'))).rejects.toThrow(
      /a\.png is a symbolic link/
    );
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });

  it('passes on the failure of a stat for a missing file', async () => {
    (vscode.workspace.fs.stat as Mock).mockRejectedValue(new Error('ENOENT'));

    await expect(readWorkspaceFile(createMockUri('/workspace/missing.png'))).rejects.toThrow('ENOENT');
    expect(vscode.workspace.fs.readFile).not.toHaveBeenCalled();
  });
});
