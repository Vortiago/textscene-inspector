/**
 * Resolving a Godot node path onto a loaded GLB's THREE graph.
 *
 * These cannot be matched by string equality, because the two sides are
 * produced by DIFFERENT importers. Godot's glTF importer synthesises a
 * `Skeleton3D` between an armature and its skinned mesh; three's loader does
 * not. Decoding `player.glb` shows the graph is literally
 *
 *     Skeleton
 *       Robot   [MESH]
 *       MASTER/hip/waist/...
 *
 * while `player.tscn` addresses that mesh as `Player/Skeleton/Skeleton3D/Robot`.
 * Exact matching alone would work on Truck Town's terrain and fail on the
 * player, the enemy and the ragdoll — the majority of the affected scenes.
 */

import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { matchGlbTarget } from './matchGlbTarget';
import { flattenGlbObjects } from './glbHierarchy';
import * as logger from '../../../logger';

/** Build a THREE graph from `parent/child` path strings. */
function graph(paths: string[]): THREE.Object3D {
  const root = new THREE.Object3D();
  root.name = 'Scene';
  for (const path of paths) {
    let node = root;
    for (const segment of path.split('/')) {
      let next = node.children.find((c) => c.name === segment);
      if (!next) {
        next = new THREE.Object3D();
        next.name = segment;
        node.add(next);
      }
      node = next;
    }
  }
  return root;
}

const entriesOf = (root: THREE.Object3D) => flattenGlbObjects(root);

describe('matchGlbTarget', () => {
  it('matches an exact relPath', () => {
    // Truck Town's terrain: `TownModel/Terrain/GrassMesh` lines up 1:1.
    const root = graph(['Terrain/GrassMesh', 'Terrain/RoadMesh']);
    const match = matchGlbTarget(entriesOf(root), 'Terrain/GrassMesh');

    expect(match?.object.name).toBe('GrassMesh');
    expect(match?.relPath).toBe('Terrain/GrassMesh');
  });

  it('matches across a level Godot synthesised but three did not', () => {
    // The player: three has Skeleton/Robot, Godot says Skeleton/Skeleton3D/Robot.
    const root = graph(['Skeleton/Robot', 'Skeleton/MASTER/hip']);
    const match = matchGlbTarget(entriesOf(root), 'Skeleton/Skeleton3D/Robot');

    expect(match?.relPath).toBe('Skeleton/Robot');
  });

  it('aliases to the nearest matching ancestor when the node itself has no counterpart', () => {
    // The enemy/ragdoll: `Skeleton3D` exists ONLY in Godot's tree, so an
    // override naming it can only mean the node three does have above it.
    const root = graph(['root/root_001/Body']);
    const match = matchGlbTarget(entriesOf(root), 'root/root_001/Skeleton3D');

    expect(match?.relPath).toBe('root/root_001');
  });

  it('prefers the deepest candidate when several could match', () => {
    // Two objects named `Body`; the one whose path shares more with Godot's wins.
    const root = graph(['Body', 'Rig/Armature/Body']);
    const match = matchGlbTarget(entriesOf(root), 'Rig/Armature/Skeleton3D/Body');

    expect(match?.relPath).toBe('Rig/Armature/Body');
  });

  it('does not match a same-named node on an unrelated branch', () => {
    // A bare-name matcher would happily return this one. The path has to agree.
    const root = graph(['Weapons/Body']);
    const match = matchGlbTarget(entriesOf(root), 'Character/Torso/Body');

    expect(match).toBeNull();
  });

  it('returns null and warns when nothing matches at all', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const root = graph(['Terrain/GrassMesh']);

    expect(matchGlbTarget(entriesOf(root), 'NoSuch/Thing')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NoSuch/Thing'));
    warnSpy.mockRestore();
  });

  it('matches a top-level node', () => {
    const root = graph(['Robot']);
    expect(matchGlbTarget(entriesOf(root), 'Robot')?.relPath).toBe('Robot');
  });
});
