/** Tests the harness's scene selection: `--shard` parsing and the split of the scene list. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GOLDEN_SCENES } from '../scenes.mjs';
import { parseArgs, selectScenes, shardOf } from './cli.mjs';

/** Makes `process.exit` throw, so a usage error stops the parse and the test can assert it. */
function exitThrows() {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation((code) => {
    throw new Error(`exit ${code}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe('parseArgs --shard', () => {
  it('reads <index>/<count>', () => {
    expect(parseArgs(['--shard', '2/4']).shard).toEqual({ index: 2, count: 4 });
  });

  it.each([['0/4'], ['5/4'], ['2'], ['a/b'], [undefined]])('refuses "%s" with exit 2', (value) => {
    exitThrows();
    const argv = value === undefined ? ['--shard'] : ['--shard', value];
    expect(() => parseArgs(argv)).toThrow('exit 2');
  });

  it('refuses --scene together with --shard', () => {
    exitThrows();
    expect(() => parseArgs(['--scene', 'label3d', '--shard', '1/2'])).toThrow('exit 2');
  });
});

describe('shardOf', () => {
  it('covers each scene exactly once across the shards of one count', () => {
    const scenes = GOLDEN_SCENES;
    const shards = [1, 2, 3, 4].map((index) => shardOf(scenes, { index, count: 4 }));
    const covered = shards.flat().map((s) => s.name).sort();
    expect(covered).toEqual(scenes.map((s) => s.name).sort());
  });

  it('takes every count-th scene from index', () => {
    expect(shardOf(['a', 'b', 'c', 'd', 'e'], { index: 2, count: 2 })).toEqual(['b', 'd']);
  });
});

describe('selectScenes', () => {
  it('returns the shard when --shard is set', () => {
    const selected = selectScenes({ scene: null, shard: { index: 1, count: 4 } });
    expect(selected).toEqual(shardOf(GOLDEN_SCENES, { index: 1, count: 4 }));
  });
});
