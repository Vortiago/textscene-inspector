/**
 * The scene tree builder against every real `.tscn` in the repo. A node whose parent
 * path descends into an instanced sub-scene must not be dropped, so no corpus scene may
 * report an `orphanedNodes` entry, except the one fixture that exists to orphan one.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { TscnParser } from './TscnParser';
import { TscnParserCore } from './TscnParserCore';
import { parseNodeWithRegistry } from '../core/NodeRegistry';
import { sceneFiles, scenesDir } from './testing/parserKit.js';

const SCENES = scenesDir();

/** The one fixture whose whole purpose is an unresolvable parent path. */
const INTENTIONAL_ORPHANS = new Set(['fixtures/edge-missing-parent.tscn']);

describe('buildSceneTree over the whole corpus', () => {
  it('orphans nothing except the fixture that exists to be orphaned', () => {
    const scenes = sceneFiles(SCENES, (path) => path.endsWith('.tscn'));
    expect(scenes.length).toBeGreaterThan(200);

    const offenders: string[] = [];
    const intentional: string[] = [];

    for (const file of scenes) {
      const rel = relative(SCENES, file);
      // The renderer's node creator, so the tree under test is the one the previewer draws.
      const { placement } = new TscnParserCore().parse(readFileSync(file, 'utf8'), parseNodeWithRegistry);
      if (placement.orphanedNodes.length === 0) continue;
      (INTENTIONAL_ORPHANS.has(rel) ? intentional : offenders).push(rel);
    }

    expect(offenders.sort()).toEqual([]);
    // And the negative fixture must still be doing its job.
    expect(intentional).toEqual([...INTENTIONAL_ORPHANS]);
  });

  it('reattaches the platformer player’s deep overrides to the instance', () => {
    // `Robot` carries `layers = 2` and the four Parallax labels are the coin counter:
    // all seven must be reattached.
    const parsed = new TscnParser().parse(
      readFileSync(join(SCENES, 'demos/3d/platformer/player/player.tscn'), 'utf8')
    );
    const root = parsed.nodes[0]!;
    const player = root.children.find((c) => c.name === 'Player')!;

    expect(player.instance).toBeTruthy();
    expect(player.children.map((c) => c.name).sort()).toEqual(['Bullet', 'CoinCount', 'Robot']);

    const robot = player.children.find((c) => c.name === 'Robot')!;
    expect(robot.instanceSubPath).toBe('Skeleton/Skeleton3D');
    expect(robot.rawProperties.layers).toBe('2');

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

    expect(overrides.sort()).toEqual(['GrassMesh', 'OuterGroundMesh', 'RacetrackMesh', 'RoadMesh']);
  });
});
