import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { shardOf } from '../../shards/shards.mjs';
import { GOLDEN_SCENES } from '../scenes.mjs';
import SCENE_SECONDS from './sceneSeconds.json' with { type: 'json' };

const namesOf = (shard) => shard.map((scene) => scene.name);
/** The shard count the visual job's run line names, as `--shard ${{ matrix.shard }}/<count>`. */
function visualShardCount(workflow) {
  const count = /pnpm test:visual --shard \$\{\{ matrix\.shard \}\}\/(\d+)/.exec(workflow)?.[1];
  if (!count) throw new Error('expected a `pnpm test:visual --shard` line in ci.yml, found none');
  return Number(count);
}

const SHARDS = visualShardCount(
  readFileSync(new URL('../../../.github/workflows/ci.yml', import.meta.url), 'utf8')
);
const goldenShard = (index, count) => shardOf(GOLDEN_SCENES, { index, count }, SCENE_SECONDS);

describe('the golden shards', () => {
  it('covers each golden scene exactly once across the shards of one count', () => {
    const shards = Array.from({ length: SHARDS }, (_, k) => goldenShard(k + 1, SHARDS));
    const covered = shards.flatMap(namesOf).sort();
    expect(covered).toEqual(namesOf(GOLDEN_SCENES).sort());
  });

  it('keeps the slowest measured shard within 10% of the mean', () => {
    const seconds = (scene) => SCENE_SECONDS[scene.name] ?? 0;
    const totals = Array.from({ length: SHARDS }, (_, k) =>
      goldenShard(k + 1, SHARDS).reduce((t, s) => t + seconds(s), 0)
    );
    const mean = totals.reduce((t, s) => t + s, 0) / totals.length;
    expect(Math.max(...totals)).toBeLessThan(mean * 1.1);
  });
});
