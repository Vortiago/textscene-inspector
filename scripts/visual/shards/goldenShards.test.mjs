import { describe, expect, it } from 'vitest';
import { shardOf } from '../../shards/shards.mjs';
import { GOLDEN_SCENES } from '../scenes.mjs';
import SCENE_SECONDS from './sceneSeconds.json' with { type: 'json' };

const namesOf = (shard) => shard.map((scene) => scene.name);
const goldenShard = (index, count) => shardOf(GOLDEN_SCENES, { index, count }, SCENE_SECONDS);

describe('the golden shards', () => {
  it('covers each golden scene exactly once across the shards of one count', () => {
    const shards = Array.from({ length: 12 }, (_, k) => goldenShard(k + 1, 12));
    const covered = shards.flatMap(namesOf).sort();
    expect(covered).toEqual(namesOf(GOLDEN_SCENES).sort());
  });

  it('keeps the slowest of 12 measured shards within 10% of the mean', () => {
    const seconds = (scene) => SCENE_SECONDS[scene.name] ?? 0;
    const totals = Array.from({ length: 12 }, (_, k) =>
      goldenShard(k + 1, 12).reduce((t, s) => t + seconds(s), 0)
    );
    const mean = totals.reduce((t, s) => t + s, 0) / totals.length;
    expect(Math.max(...totals)).toBeLessThan(mean * 1.1);
  });
});
