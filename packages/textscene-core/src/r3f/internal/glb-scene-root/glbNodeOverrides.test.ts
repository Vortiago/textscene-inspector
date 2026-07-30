/**
 * Applying a host scene's overrides onto nodes inside a loaded GLB.
 *
 * Two shapes reach here. A SHALLOW override names a GLB node directly
 * (`ceiling_lamp.tscn`'s `plafoniera`) and resolves by name, as it always has.
 * A DEEP one carries `instanceSubPath` because its authored path descended into
 * the instance, and resolves through `matchGlbTarget` — which matters because
 * Godot's importer invents nodes three's does not.
 *
 * The property that made this urgent is `layers`: the platformer player's blob
 * shadow clears layer 2 and the robot sets it, so without the override applied
 * the decal paints the robot — the exact class of bug the cull_mask fix was for.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyGlbNodeOverrides } from './glbNodeOverrides';
import { visualLayersOf } from '../../visualLayers';
import type { TscnNode } from '../../../parser/types';

function graph(paths: string[]): THREE.Object3D {
  const root = new THREE.Object3D();
  root.name = 'Scene';
  for (const path of paths) {
    let node: THREE.Object3D = root;
    for (const segment of path.split('/')) {
      let next = node.children.find((c) => c.name === segment);
      if (!next) {
        next = new THREE.Mesh();
        next.name = segment;
        node.add(next);
      }
      node = next;
    }
  }
  return root;
}

const override = (name: string, extra: Partial<TscnNode> = {}): TscnNode => ({
  type: '',
  name,
  properties: {},
  children: [],
  overridesExistingNode: true,
  ...extra,
});

describe('applyGlbNodeOverrides', () => {
  it('applies layers from a deep override, across the level Godot synthesised', () => {
    const root = graph(['Skeleton/Robot']);

    applyGlbNodeOverrides(root, [
      override('Robot', { instanceSubPath: 'Skeleton/Skeleton3D', rawProperties: { layers: '2' } }),
    ]);

    const robot = root.children[0]!.children[0]!;
    expect(robot.name).toBe('Robot');
    expect(visualLayersOf(robot)).toBe(2);
  });

  it('stamps layers over the matched object’s whole subtree', () => {
    // One glTF node with several primitives becomes a Group of Meshes.
    const root = graph(['Body/Part1', 'Body/Part2']);

    applyGlbNodeOverrides(root, [override('Body', { rawProperties: { layers: '4' } })]);

    const body = root.children[0]!;
    expect(visualLayersOf(body)).toBe(4);
    expect(body.children.map(visualLayersOf)).toEqual([4, 4]);
  });

  it('resolves a deep override by PATH, not by bare name', () => {
    // Two objects share a name; only the one whose path agrees may be touched.
    const root = graph(['Weapons/Body', 'Character/Torso/Body']);

    applyGlbNodeOverrides(root, [
      override('Body', { instanceSubPath: 'Character/Torso', rawProperties: { layers: '2' } }),
    ]);

    const [weapons, character] = root.children;
    expect(visualLayersOf(character!.children[0]!.children[0]!)).toBe(2);
    expect(visualLayersOf(weapons!.children[0]!)).toBe(1);
  });

  it('still applies a shallow by-name transform override', () => {
    // The original case, unchanged: no instanceSubPath, flat name lookup.
    const root = graph(['plafoniera']);
    root.children[0]!.position.set(1.11, -9.73, -9.73);

    const applied = applyGlbNodeOverrides(root, [
      {
        type: '',
        name: 'plafoniera',
        properties: {
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: { x: 0, y: 0, z: 0 },
          },
        },
        children: [],
      },
    ]);

    expect(applied.has('plafoniera')).toBe(true);
    expect(root.children[0]!.position.toArray()).toEqual([0, 0, 0]);
  });

  it('applies visible', () => {
    const root = graph(['Hidden']);

    applyGlbNodeOverrides(root, [override('Hidden', { rawProperties: { visible: 'false' } })]);

    expect(root.children[0]!.visible).toBe(false);
  });

  it('leaves everything alone when nothing matches', () => {
    const root = graph(['Body']);

    expect(() =>
      applyGlbNodeOverrides(root, [
        override('Ghost', { instanceSubPath: 'No/Such', rawProperties: { layers: '2' } }),
      ])
    ).not.toThrow();
    expect(visualLayersOf(root.children[0]!)).toBe(1);
  });

  it('reports only transform overrides as applied — a layers-only override moves nothing', () => {
    const root = graph(['Robot']);

    const applied = applyGlbNodeOverrides(root, [
      override('Robot', { rawProperties: { layers: '2' } }),
    ]);

    expect(applied.has('Robot')).toBe(false);
  });
});
