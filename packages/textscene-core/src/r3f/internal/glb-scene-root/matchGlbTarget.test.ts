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
import { matchGlbTarget } from './matchGlbTarget';
import { flattenGlbObjects } from './glbHierarchy';
import { buildTestGlbGraph } from './testGraph';
import * as logger from '../../../logger';

describe('matchGlbTarget', () => {
  it('matches an exact relPath', () => {
    // Truck Town's terrain: `TownModel/Terrain/GrassMesh` lines up 1:1.
    const root = buildTestGlbGraph(['Terrain/GrassMesh', 'Terrain/RoadMesh']);
    const match = matchGlbTarget(flattenGlbObjects(root), 'Terrain/GrassMesh');

    expect(match?.object.name).toBe('GrassMesh');
    expect(match?.relPath).toBe('Terrain/GrassMesh');
  });

  it('matches across a level Godot synthesised but three did not', () => {
    // The player: three has Skeleton/Robot, Godot says Skeleton/Skeleton3D/Robot.
    const root = buildTestGlbGraph(['Skeleton/Robot', 'Skeleton/MASTER/hip']);
    const match = matchGlbTarget(flattenGlbObjects(root), 'Skeleton/Skeleton3D/Robot');

    expect(match?.relPath).toBe('Skeleton/Robot');
  });

  it('aliases to the nearest matching ancestor when the node itself has no counterpart', () => {
    // The enemy/ragdoll: `Skeleton3D` exists ONLY in Godot's tree, so an
    // override naming it can only mean the node three does have above it.
    const root = buildTestGlbGraph(['root/root_001/Body']);
    const match = matchGlbTarget(flattenGlbObjects(root), 'root/root_001/Skeleton3D');

    expect(match?.relPath).toBe('root/root_001');
  });

  it('prefers the deepest candidate when several could match', () => {
    // Two objects named `Body`; the one whose path shares more with Godot's wins.
    const root = buildTestGlbGraph(['Body', 'Rig/Armature/Body']);
    const match = matchGlbTarget(flattenGlbObjects(root), 'Rig/Armature/Skeleton3D/Body');

    expect(match?.relPath).toBe('Rig/Armature/Body');
  });

  it('does not match a same-named node on an unrelated branch', () => {
    // A bare-name matcher would happily return this one. The path has to agree.
    const root = buildTestGlbGraph(['Weapons/Body']);
    const match = matchGlbTarget(flattenGlbObjects(root), 'Character/Torso/Body');

    expect(match).toBeNull();
  });

  it('returns null and warns when nothing matches at all', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const root = buildTestGlbGraph(['Terrain/GrassMesh']);

    expect(matchGlbTarget(flattenGlbObjects(root), 'NoSuch/Thing')).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('NoSuch/Thing'));
    warnSpy.mockRestore();
  });

  it('matches a top-level node', () => {
    const root = buildTestGlbGraph(['Robot']);
    expect(matchGlbTarget(flattenGlbObjects(root), 'Robot')?.relPath).toBe('Robot');
  });

  describe('allowAncestor: false', () => {
    it('drops a path whose leaf has no counterpart instead of landing on an ancestor', () => {
      const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});
      const root = buildTestGlbGraph(['Rig/Armature/Body']);
      const entries = flattenGlbObjects(root);

      expect(matchGlbTarget(entries, 'Rig/Armature/NoSuchMesh')?.relPath).toBe('Rig/Armature');
      expect(matchGlbTarget(entries, 'Rig/Armature/NoSuchMesh', { allowAncestor: false })).toBeNull();
      warnSpy.mockRestore();
    });

    it('still takes an exact and a subsequence match', () => {
      const root = buildTestGlbGraph(['Skeleton/Robot']);
      const entries = flattenGlbObjects(root);

      expect(matchGlbTarget(entries, 'Skeleton/Robot', { allowAncestor: false })?.relPath).toBe(
        'Skeleton/Robot'
      );
      expect(
        matchGlbTarget(entries, 'Skeleton/Skeleton3D/Robot', { allowAncestor: false })?.relPath
      ).toBe('Skeleton/Robot');
    });
  });
});
