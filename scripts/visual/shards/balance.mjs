/**
 * Splits the golden scenes into CI shards that finish close together. Each shard runs on its own
 * runner and computes the same split, so the split depends only on the manifest and the table.
 */

import SCENE_SECONDS from './sceneSeconds.json' with { type: 'json' };

/**
 * The scenes of shard `index` of `count`, in manifest order. The split is longest first: each
 * scene, slowest first, goes to the shard with the least seconds so far. A scene the table has not
 * measured counts as the table's median. The shards of one count cover each scene exactly once.
 *
 * @param {{ name: string }[]} scenes
 * @param {{ index: number, count: number }} shard - `index` counts from 1.
 * @param {Record<string, number>} [secondsByScene] - capture seconds on a CI runner, by name.
 */
export function shardOf(scenes, { index, count }, secondsByScene = SCENE_SECONDS) {
  const unmeasuredSeconds = median(Object.values(secondsByScene));
  const secondsOf = (scene) => secondsByScene[scene.name] ?? unmeasuredSeconds;
  // Manifest order breaks a tie, so equal seconds split the same way on every runner.
  const slowestFirst = scenes
    .map((scene, order) => ({ scene, order, seconds: secondsOf(scene) }))
    .sort((a, b) => b.seconds - a.seconds || a.order - b.order);

  const shardSeconds = new Array(count).fill(0);
  const shardOfScene = new Map();
  for (const { scene, seconds } of slowestFirst) {
    const lightest = shardSeconds.indexOf(Math.min(...shardSeconds));
    shardSeconds[lightest] += seconds;
    shardOfScene.set(scene, lightest);
  }
  return scenes.filter((scene) => shardOfScene.get(scene) === index - 1);
}

/** The middle value, or 1 for an empty table, so every scene then weighs the same. */
function median(values) {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
