import { describe, expect, it } from 'vitest';
import { existingResFile } from './existingResFile';
import { createMockUri, vscode as vscodeMocks } from './test-setup';

const ROOT = createMockUri('/game');

/** `stat` answers `/game/a.png` as a file and `/game/art` as a directory. Anything else is missing. */
function arrangeDisk(): void {
  vscodeMocks.workspace.fs.stat.mockImplementation((uri: ReturnType<typeof createMockUri>) => {
    if (uri.fsPath === '/game/a.png') return Promise.resolve({ type: 1, ctime: 0, mtime: 0, size: 1 });
    if (uri.fsPath === '/game/art') return Promise.resolve({ type: 2, ctime: 0, mtime: 0, size: 0 });
    return Promise.reject(new Error('Not found'));
  });
}

describe('existingResFile', () => {
  it('answers the file a res:// path names under the project root', async () => {
    arrangeDisk();
    expect((await existingResFile(ROOT, 'res://a.png'))?.fsPath).toBe('/game/a.png');
  });

  it('answers null for a missing file', async () => {
    arrangeDisk();
    expect(await existingResFile(ROOT, 'res://gone.png')).toBeNull();
  });

  it('answers null for a directory', async () => {
    arrangeDisk();
    expect(await existingResFile(ROOT, 'res://art')).toBeNull();
  });

  it('answers null for a path that is not res://', async () => {
    arrangeDisk();
    expect(await existingResFile(ROOT, 'uid://abc')).toBeNull();
  });
});
