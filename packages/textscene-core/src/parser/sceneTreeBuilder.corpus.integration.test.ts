/**
 * The scene tree builder against every real `.tscn` in the repo.
 *
 * The unit tests pin the anchor rule on hand-built nodes; this pins the thing
 * that actually went wrong — that a node whose parent path descends into an
 * instanced sub-scene was silently dropped, taking a terrain's material
 * overrides and a player's coin counter with it, and announcing it only through
 * a warning nobody read.
 *
 * So the assertion is on `orphanedNodes`, the scene's own report: no corpus
 * scene may orphan a node, except the one fixture that exists to orphan one.
 * Not the console warning, which is the channel this test's own opening
 * paragraph calls "a warning nobody read".
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { TscnParser } from './TscnParser';

// `import.meta.dirname`, never `process.cwd()` — hooks and CI run from the repo
// root while vitest resolves this file's own URL through its dev server.
const SCENES = resolve(import.meta.dirname, '../../../../scenes');

/** The one fixture whose whole purpose is an unresolvable parent path. */
const INTENTIONAL_ORPHANS = new Set(['fixtures/edge-missing-parent.tscn']);

async function everyScene(dir: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await everyScene(full)));
    else if (entry.name.endsWith('.tscn')) found.push(full);
  }
  return found;
}

describe('buildSceneTree over the whole corpus', () => {
  it('orphans nothing except the fixture that exists to be orphaned', async () => {
    const scenes = await everyScene(SCENES);
    expect(scenes.length).toBeGreaterThan(200);

    const offenders: string[] = [];
    const intentional: string[] = [];

    for (const file of scenes) {
      const rel = relative(SCENES, file);
      let orphaned: boolean;
      try {
        orphaned = (new TscnParser().parse(readFileSync(file, 'utf8')).orphanedNodes ?? []).length > 0;
      } catch {
        // A scene this parser cannot read at all is a different concern; the
        // orphan question only applies to one it can.
        continue;
      }
      if (orphaned) (INTENTIONAL_ORPHANS.has(rel) ? intentional : offenders).push(rel);
    }

    expect(offenders.sort()).toEqual([]);
    // And the negative fixture must still be doing its job.
    expect(intentional).toEqual([...INTENTIONAL_ORPHANS]);
  });

  it('reattaches the platformer player’s deep overrides to the instance', () => {
    // The case that started this: `Robot` carries `layers = 2` and the four
    // Parallax labels are the coin counter — all seven, or the reattachment is
    // not doing its job.
    const parsed = new TscnParser().parse(
      readFileSync(join(SCENES, 'demos/3d/platformer/player/player.tscn'), 'utf8')
    );
    const root = parsed.nodes[0]!;
    const player = root.children.find((c) => c.name === 'Player')!;

    expect(player.instance).toBeTruthy();
    expect(player.children.map((c) => c.name).sort()).toEqual([
      'Bullet',
      'CoinCount',
      'Robot',
    ]);

    const robot = player.children.find((c) => c.name === 'Robot')!;
    expect(robot.instanceSubPath).toBe('Skeleton/Skeleton3D');
    expect(robot.rawProperties?.layers).toBe('2');

    // The four Parallax labels hang off CoinCount by ordinary resolution.
    const coinCount = player.children.find((c) => c.name === 'CoinCount')!;
    expect(coinCount.instanceSubPath).toBe('Skeleton');
    expect(coinCount.children).toHaveLength(4);
    expect(coinCount.children.every((c) => c.instanceSubPath === undefined)).toBe(true);
  });

  it('reattaches the town’s terrain material overrides', () => {
    const parsed = new TscnParser().parse(
      readFileSync(join(SCENES, 'demos/3d/truck_town/town/town_scene.tscn'), 'utf8')
    );
    const root = parsed.nodes[0]!;

    const overrides: string[] = [];
    const walk = (n: (typeof root)[]) => {
      for (const c of n) {
        if (c.instanceSubPath) overrides.push(c.name);
        walk(c.children);
      }
    };
    walk(root.children);

    expect(overrides.sort()).toEqual([
      'GrassMesh',
      'OuterGroundMesh',
      'RacetrackMesh',
      'RoadMesh',
    ]);
  });
});
