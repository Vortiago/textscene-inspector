/**
 * A host scene's overrides on nodes inside a loaded GLB. A shallow override names a GLB node and
 * resolves by name. A deep one carries `instanceSubPath` and resolves through `matchGlbTarget`,
 * since Godot's importer invents nodes three's does not.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyGlbNodeOverrides } from './glbNodeOverrides';
import { visualLayersOf } from '../../visualLayers';
import type { TscnNode } from '../../../parser/types';
import { buildTestGlbGraph } from './testGraph';
import { tagGodotNodeNames } from '../../../resources/formats/glb/nodeNames';
import { tagMeshInstances } from '../../../resources/formats/glb/meshInstances';
import type { GLTFReference } from 'three/addons/loaders/GLTFLoader.js';

const override = (name: string, extra: Partial<TscnNode> = {}): TscnNode => ({
  rawProperties: {},
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

  it('stamps layers on a mesh’s surfaces, but not on the node under it', () => {
    // One glTF node with two primitives is a Group of two Meshes, here with a child node too.
    const root = buildTestGlbGraph(['Hand']);
    const [hand] = root.children;
    const body = Object.assign(new THREE.Group(), { name: 'Body' });
    const [part1, part2] = [new THREE.Mesh(), new THREE.Mesh()];
    body.add(part1, part2, hand!);
    root.add(body);
    tagMeshInstances(
      root,
      new Map<unknown, GLTFReference>([
        [body, { nodes: 0, meshes: 0 }],
        [part1, { meshes: 0, primitives: 0 }],
        [part2, { meshes: 0, primitives: 1 }],
        [hand, { nodes: 1, meshes: 1 }],
      ])
    );

    applyGlbNodeOverrides(root, [override('Body', { rawProperties: { layers: '4' } })]);

    expect([body, part1, part2, hand].map((object) => visualLayersOf(object!))).toEqual([4, 4, 4, 1]);
  });

  it("resolves an override by Godot's name for a node three spells otherwise", () => {
    const root = buildTestGlbGraph(['Cube001']);
    const cube = root.children[0]!;
    tagGodotNodeNames(root, new Map([[cube, { nodes: 0 }]]), [{ name: 'Cube_001', role: 'node' }]);

    applyGlbNodeOverrides(root, [override('Cube_001', { rawProperties: { layers: '2' } })]);

    expect(visualLayersOf(cube)).toBe(2);
  });

  it("resolves a shallow override to the root by Godot's name for it", () => {
    const root = buildTestGlbGraph([]);
    root.name = 'Cube001';
    tagGodotNodeNames(root, new Map([[root, { nodes: 0 }]]), [{ name: 'Cube_001', role: 'node' }]);

    applyGlbNodeOverrides(root, [override('Cube_001', { rawProperties: { visible: 'false' } })]);

    expect(root.visible).toBe(false);
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
        rawProperties: {},
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
        rawProperties: {},
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

    const applied = applyGlbNodeOverrides(root, [override('Robot', { rawProperties: { layers: '2' } })]);

    expect(applied.has('Robot')).toBe(false);
  });
});
