/**
 * A host scene's overrides on nodes inside a loaded GLB. A shallow override names a GLB node and
 * resolves by name. A deep one carries `instanceSubPath` and resolves through `matchGlbNode`,
 * since Godot's importer invents nodes three's does not.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyGlbNodeOverrides, resolveGlbAttachments } from './glbNodeOverrides';
import { flattenGlbObjects } from './glbHierarchy';
import { visualLayersOf } from '../../visualLayers';
import type { TscnNode } from '../../../parser/types';
import { addBoneRig, buildTestGlbGraph } from './glbGraph.testkit';
import { tagAsLoadedGlb } from '../../../resources/formats/glb/testing/loadedGlbTags';

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
    const root = buildTestGlbGraph([]);
    addBoneRig(root);

    applyGlbNodeOverrides(root, [
      override('Sword', { instanceSubPath: 'Armature/Skeleton3D/Hip', rawProperties: { layers: '2' } }),
    ]);

    expect(visualLayersOf(root.getObjectByName('Sword')!)).toBe(2);
  });

  describe('on a node Godot makes a bone', () => {
    const move = (position: { x: number; y: number; z: number }): TscnNode =>
      override('Sword', {
        instanceSubPath: 'Armature/Skeleton3D/Sword',
        properties: {
          transform: {
            basis_x: { x: 1, y: 0, z: 0 },
            basis_y: { x: 0, y: 1, z: 0 },
            basis_z: { x: 0, y: 0, z: 1 },
            origin: position,
          },
        },
      });

    function swordUnderBone(namingVersion: number) {
      const root = buildTestGlbGraph([]);
      const { sword } = addBoneRig(root);
      sword.position.set(1.5, 0.5, 0);
      tagAsLoadedGlb(root, { namingVersion });
      return { root, sword };
    }

    it('adds the transform to the rest pose the bone holds', () => {
      const { root, sword } = swordUnderBone(1);

      applyGlbNodeOverrides(root, [move({ x: 0, y: 1.5, z: 0 })]);

      expect(sword.position.toArray()).toEqual([1.5, 2, 0]);
    });

    it('adds it once when the overrides apply again', () => {
      const { root, sword } = swordUnderBone(1);
      const overrides = [move({ x: 0, y: 1.5, z: 0 })];

      applyGlbNodeOverrides(root, overrides);
      applyGlbNodeOverrides(root, overrides);

      expect(sword.position.toArray()).toEqual([1.5, 2, 0]);
    });

    it('replaces the transform of a node Godot keeps as a node', () => {
      const root = buildTestGlbGraph([]);
      const { sword } = addBoneRig(root);
      sword.position.set(1.5, 0.5, 0);
      tagAsLoadedGlb(root);

      applyGlbNodeOverrides(root, [
        { ...move({ x: 0, y: 1.5, z: 0 }), instanceSubPath: 'Armature/Skeleton3D/Hip' },
      ]);

      expect(sword.position.toArray()).toEqual([0, 1.5, 0]);
    });
  });

  it('stamps layers on a mesh’s surfaces, but not on the node under it', () => {
    // One glTF node with two primitives is a Group of two Meshes, here with a child node too.
    const root = buildTestGlbGraph(['Hand']);
    const [hand] = root.children;
    const body = Object.assign(new THREE.Group(), { name: 'Body' });
    const [part1, part2] = [new THREE.Mesh(), new THREE.Mesh()];
    body.add(part1, part2, hand!);
    root.add(body);
    tagAsLoadedGlb(root, { primitives: [part1!, part2!] });

    applyGlbNodeOverrides(root, [override('Body', { rawProperties: { layers: '4' } })]);

    expect([body, part1, part2, hand].map((object) => visualLayersOf(object!))).toEqual([4, 4, 4, 1]);
  });

  it("resolves an override by Godot's name for a node three spells otherwise", () => {
    const root = buildTestGlbGraph(['Cube001'], { gltfNames: { Cube001: 'Cube.001' } });
    const cube = root.children[0]!;

    applyGlbNodeOverrides(root, [override('Cube_001', { rawProperties: { layers: '2' } })]);

    expect(visualLayersOf(cube)).toBe(2);
  });

  it("resolves a shallow override to the root by Godot's name for it", () => {
    // A glTF of one node loads with the node as the scene root.
    const cube = buildTestGlbGraph(['Cube001'], { gltfNames: { Cube001: 'Cube.001' } }).children[0]!;

    applyGlbNodeOverrides(cube, [override('Cube_001', { rawProperties: { visible: 'false' } })]);

    expect(cube.visible).toBe(false);
  });

  it('resolves a deep override by PATH, not by bare name', () => {
    // Godot numbers the second of two glTF nodes named Body `Body2`, which a path elsewhere must not reach.
    const root = buildTestGlbGraph(['Weapons/Body', 'Character/Torso/Body_1'], {
      gltfNames: { Body_1: 'Body' },
    });

    applyGlbNodeOverrides(root, [
      override('Body2', { instanceSubPath: 'Weapons', rawProperties: { layers: '2' } }),
      override('Body2', { instanceSubPath: 'Character/Torso', rawProperties: { layers: '4' } }),
    ]);

    const [weapons, character] = root.children;
    expect(visualLayersOf(character!.children[0]!.children[0]!)).toBe(4);
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

describe('resolveGlbAttachments', () => {
  const boneRigRoot = (): THREE.Object3D => {
    const root = buildTestGlbGraph([]);
    addBoneRig(root);
    return root;
  };

  const lamp = (instanceSubPath: string): TscnNode =>
    override('Lamp', { type: 'Node3D', instanceSubPath, overridesExistingNode: false });

  it('attaches a typed child to the bone a BoneAttachment3D follows, across the level Godot synthesised', () => {
    const entries = flattenGlbObjects(boneRigRoot());

    const { attached } = resolveGlbAttachments(entries, [lamp('Armature/Skeleton3D/Hip')]);

    expect(attached.map(({ node, target }) => [node.name, entries[target]!.relPath])).toEqual([
      ['Lamp', 'Armature/Hip'],
    ]);
  });

  it('attaches a typed child to the object a path names exactly', () => {
    const entries = flattenGlbObjects(boneRigRoot());

    const { attached } = resolveGlbAttachments(entries, [lamp('Armature')]);

    expect(attached.map(({ target }) => entries[target]!.relPath)).toEqual(['Armature']);
  });

  it('attaches no override, which names an existing node rather than adding one', () => {
    const entries = flattenGlbObjects(buildTestGlbGraph(['Skeleton/Robot']));
    const robot = override('Robot', { instanceSubPath: 'Skeleton' });

    expect(resolveGlbAttachments(entries, [robot])).toEqual({ attached: [], rest: [robot] });
  });

  it('keeps a typed child whose parent path names no object among the rest', () => {
    const entries = flattenGlbObjects(buildTestGlbGraph(['Skeleton/Robot']));
    const stray = lamp('Nowhere');

    expect(resolveGlbAttachments(entries, [stray])).toEqual({ attached: [], rest: [stray] });
  });
});
