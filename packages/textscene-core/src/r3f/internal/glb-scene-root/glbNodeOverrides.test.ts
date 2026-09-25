/**
 * A host scene's overrides on nodes inside a loaded GLB. A shallow override names a GLB node and
 * resolves by name. A deep one carries `instanceSubPath` and resolves through `matchGlbTarget`,
 * since Godot's importer invents nodes three's does not.
 */

import { describe, expect, it } from 'vitest';
import { applyGlbNodeOverrides } from './glbNodeOverrides';
import { visualLayersOf } from '../../visualLayers';
import type { TscnNode } from '../../../parser/types';
import { buildTestGlbGraph } from './testGraph';

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
    const root = buildTestGlbGraph(['Skeleton/Robot']);

    applyGlbNodeOverrides(root, [
      override('Robot', { instanceSubPath: 'Skeleton/Skeleton3D', rawProperties: { layers: '2' } }),
    ]);

    const robot = root.children[0]!.children[0]!;
    expect(robot.name).toBe('Robot');
    expect(visualLayersOf(robot)).toBe(2);
  });

  it('stamps layers over the matched object’s whole subtree', () => {
    // One glTF node with several primitives becomes a Group of Meshes.
    const root = buildTestGlbGraph(['Body/Part1', 'Body/Part2']);

    applyGlbNodeOverrides(root, [override('Body', { rawProperties: { layers: '4' } })]);

    const body = root.children[0]!;
    expect(visualLayersOf(body)).toBe(4);
    expect(body.children.map(visualLayersOf)).toEqual([4, 4]);
  });

  it('resolves a deep override by PATH, not by bare name', () => {
    // Two objects share a name; only the one whose path agrees may be touched.
    const root = buildTestGlbGraph(['Weapons/Body', 'Character/Torso/Body']);

    applyGlbNodeOverrides(root, [
      override('Body', { instanceSubPath: 'Character/Torso', rawProperties: { layers: '2' } }),
    ]);

    const [weapons, character] = root.children;
    expect(visualLayersOf(character!.children[0]!.children[0]!)).toBe(2);
    expect(visualLayersOf(weapons!.children[0]!)).toBe(1);
  });

  it('still applies a shallow by-name transform override', () => {
    // No instanceSubPath: a flat name lookup.
    const root = buildTestGlbGraph(['plafoniera']);
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
    const root = buildTestGlbGraph(['Hidden']);

    applyGlbNodeOverrides(root, [override('Hidden', { rawProperties: { visible: 'false' } })]);

    expect(root.children[0]!.visible).toBe(false);
  });

  it('leaves everything alone when nothing matches', () => {
    const root = buildTestGlbGraph(['Body']);

    expect(() =>
      applyGlbNodeOverrides(root, [
        override('Ghost', { instanceSubPath: 'No/Such', rawProperties: { layers: '2' } }),
      ])
    ).not.toThrow();
    expect(visualLayersOf(root.children[0]!)).toBe(1);
  });

  it('never applies a TYPED deep child as an override', () => {
    // A typed `CoinCount` Label3D is a new node inside the GLB, not an override. Its path aliases
    // to `Skeleton`, and applying it would write its 3.33x scale and 7.5-unit offset onto the
    // whole robot.
    const root = buildTestGlbGraph(['Skeleton/Robot']);
    const skeleton = root.children[0]!;

    applyGlbNodeOverrides(root, [
      {
        type: 'Label3D',
        name: 'CoinCount',
        instanceSubPath: 'Skeleton',
        children: [],
        properties: {
          transform: {
            basis_x: { x: 3.33, y: 0, z: 0 },
            basis_y: { x: 0, y: 3.33, z: 0 },
            basis_z: { x: 0, y: 0, z: 3.33 },
            origin: { x: 0, y: 7.51, z: 0.53 },
          },
        },
      },
    ]);

    expect(skeleton.position.toArray()).toEqual([0, 0, 0]);
    expect(skeleton.scale.toArray()).toEqual([1, 1, 1]);
  });

  it('reports only transform overrides as applied — a layers-only override moves nothing', () => {
    const root = buildTestGlbGraph(['Robot']);

    const applied = applyGlbNodeOverrides(root, [
      override('Robot', { rawProperties: { layers: '2' } }),
    ]);

    expect(applied.has('Robot')).toBe(false);
  });
});
