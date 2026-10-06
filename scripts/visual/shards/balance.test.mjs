/** Tests the CI shard split: full coverage, equal seconds, and a stable result. */
import { describe, expect, it } from 'vitest';
import { GOLDEN_SCENES } from '../scenes.mjs';
import { shardOf } from './balance.mjs';
import SCENE_SECONDS from './sceneSeconds.json' with { type: 'json' };

const scenes = (...names) => names.map((name) => ({ name }));
const namesOf = (shard) => shard.map((scene) => scene.name);

describe('shardOf', () => {
  it('covers each golden scene exactly once across the shards of one count', () => {
    const shards = Array.from({ length: 12 }, (_, k) => shardOf(GOLDEN_SCENES, { index: k + 1, count: 12 }));
    const covered = shards.flatMap(namesOf).sort();
    expect(covered).toEqual(namesOf(GOLDEN_SCENES).sort());
  });

  it('gives the slowest scene a shard of its own when it outweighs the rest', () => {
    const table = { slow: 10, a: 2, b: 2, c: 2 };
    const all = scenes('a', 'slow', 'b', 'c');
    expect(namesOf(shardOf(all, { index: 1, count: 2 }, table))).toEqual(['slow']);
    expect(namesOf(shardOf(all, { index: 2, count: 2 }, table))).toEqual(['a', 'b', 'c']);
  });

  it('keeps manifest order inside a shard', () => {
    const table = { a: 1, b: 3, c: 2 };
    expect(namesOf(shardOf(scenes('a', 'b', 'c'), { index: 1, count: 1 }, table))).toEqual(['a', 'b', 'c']);
  });

  it('weighs an unmeasured scene as the median of the table', () => {
    const table = { a: 1, b: 5, c: 9 };
    const all = scenes('a', 'b', 'c', 'new');
    // `new` weighs 5, so c (9) and b (5) open the shards, `new` joins b, and a joins c.
    expect(namesOf(shardOf(all, { index: 2, count: 2 }, table))).toEqual(['b', 'new']);
  });

  it('splits equal seconds in manifest order', () => {
    const all = scenes('a', 'b', 'c', 'd');
    expect(namesOf(shardOf(all, { index: 1, count: 2 }, {}))).toEqual(['a', 'c']);
  });

  it('keeps the slowest of 12 measured shards within 10% of the mean', () => {
    const seconds = (scene) => SCENE_SECONDS[scene.name] ?? 0;
    const totals = Array.from({ length: 12 }, (_, k) =>
      shardOf(GOLDEN_SCENES, { index: k + 1, count: 12 }).reduce((t, s) => t + seconds(s), 0)
    );
    const mean = totals.reduce((t, s) => t + s, 0) / totals.length;
    expect(Math.max(...totals)).toBeLessThan(mean * 1.1);
  });
});
