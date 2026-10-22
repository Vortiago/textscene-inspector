/** The `res://` paths of the files a workspace search found, as the editor's scan reaches them. */

import { describe, expect, it } from 'vitest';
import { scannedResPaths } from './scannedResPaths';
import { createMockUri } from './test-setup';

describe('scannedResPaths', () => {
  it('names each file by its res:// path under the root', () => {
    const files = [createMockUri('/game/a.tscn'), createMockUri('/game/art/b.png')];

    expect(scannedResPaths(createMockUri('/game'), files, [])).toEqual(['res://a.tscn', 'res://art/b.png']);
  });

  it('names each file under a root at the top of the filesystem', () => {
    expect(scannedResPaths(createMockUri('/'), [createMockUri('/a.tscn')], [])).toEqual(['res://a.tscn']);
  });

  it('trims the root in linear time, however many slashes its path holds', () => {
    // A backtracking `/\/+$/` spends about 3 s on this path.
    const root = `${'/'.repeat(100_000)}a`;
    const startedAt = performance.now();

    expect(scannedResPaths(createMockUri(root), [createMockUri(`${root}/b.tscn`)], [])).toEqual([
      'res://b.tscn',
    ]);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
