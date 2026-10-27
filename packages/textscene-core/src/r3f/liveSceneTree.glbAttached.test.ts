/**
 * The node that instances a GLB is the GLB root (`packed_scene.cpp:261-264`), so the GLB's objects
 * sit directly below it in the live tree. A typed node an instancing scene adds inside the GLB sits
 * where Godot adds it: below the GLB node its parent path resolves to (`packed_scene.cpp:157-165`,
 * `:541`), so its path is that node's path and its name.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { collectLiveNodes } from './liveSceneTree';
import { contextOver } from './liveSceneTree.testkit';
import { makeNode } from '../parser/testing/parserKit';
import type { TscnNode, TscnScene } from '../parser/types';
import { tagAsLoadedGlb } from '../resources/formats/glb/testing/loadedGlbTags';
import '../nodes/node/index';

const GLB_PATH = 'res://rig.glb';

function rigGlb(): THREE.Object3D {
  const named = (name: string) => Object.assign(new THREE.Group(), { name });
  const root = named('Scene');
  root.animations = [new THREE.AnimationClip('idle', 1, [])];
  const skeleton = named('Skeleton');
  skeleton.add(named('Torso'), named('Arm'));
  root.add(skeleton);
  tagAsLoadedGlb(root);
  return root;
}

const GLB_SCENE: TscnScene = {
  nodes: [makeNode('rig', 'GLBSceneRoot', { properties: { glbPath: GLB_PATH } as Record<string, unknown> })],
  externalResources: [],
  internalResources: [],
};

const SCENES = { [GLB_PATH]: GLB_SCENE };
const GLBS = { [GLB_PATH]: rigGlb() };
const CTX = contextOver(
  { externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }], internalResources: [] },
  SCENES,
  GLBS
);

function typed(name: string, instanceSubPath: string): TscnNode {
  return { ...makeNode(name, 'Marker3D'), instanceSubPath };
}

function pathsBelowRig(children: TscnNode[], keep: (node: TscnNode) => boolean): string[] {
  const roots = [{ ...makeNode('Rig', 'Node', { instance: 'ExtResource("rig")' }), children }];
  return collectLiveNodes(roots, CTX, keep).map((entry) => entry.path);
}

function pathsOfMarkers(children: TscnNode[]): string[] {
  return pathsBelowRig(children, (node) => node.type === 'Marker3D');
}

describe('an instanced GLB, in the live tree', () => {
  it('lists its objects, its AnimationPlayer and an attached node below the instancing node', () => {
    expect(pathsBelowRig([typed('Marker', 'Skeleton/Torso')], () => true)).toEqual([
      'Rig',
      'Rig/Skeleton',
      'Rig/Skeleton/Torso',
      'Rig/Skeleton/Torso/Marker',
      'Rig/Skeleton/Arm',
      'Rig/AnimationPlayer',
    ]);
  });

  it('keeps the other children of the instancing node after the GLB objects', () => {
    expect(pathsBelowRig([makeNode('Extra', 'Node')], () => true)).toEqual([
      'Rig',
      'Rig/Skeleton',
      'Rig/Skeleton/Torso',
      'Rig/Skeleton/Arm',
      'Rig/AnimationPlayer',
      'Rig/Extra',
    ]);
  });
});

describe('a node that states index=, in the live tree of an instanced GLB', () => {
  it('sits among the GLB nodes of its parent at that index (packed_scene.cpp:543-544)', () => {
    const first = { ...typed('First', 'Skeleton'), index: 0 };
    const between = { ...typed('Between', 'Skeleton'), index: 1 };

    expect(pathsOfMarkers([first, between])).toEqual(['Rig/Skeleton/First', 'Rig/Skeleton/Between']);
    expect(
      pathsBelowRig([first, between], () => true).filter((path) => path.startsWith('Rig/Skeleton/'))
    ).toEqual(['Rig/Skeleton/First', 'Rig/Skeleton/Between', 'Rig/Skeleton/Torso', 'Rig/Skeleton/Arm']);
  });

  it('sits before the GLB objects when the instancing node holds it at index 0', () => {
    const marker = { ...makeNode('Marker', 'Marker3D'), index: 0 };

    expect(pathsBelowRig([marker], () => true)).toEqual([
      'Rig',
      'Rig/Marker',
      'Rig/Skeleton',
      'Rig/Skeleton/Torso',
      'Rig/Skeleton/Arm',
      'Rig/AnimationPlayer',
    ]);
  });

  it('sits before the AnimationPlayer at index 1', () => {
    const marker = { ...makeNode('Marker', 'Marker3D'), index: 1 };

    expect(pathsBelowRig([marker], () => true)).toEqual([
      'Rig',
      'Rig/Skeleton',
      'Rig/Skeleton/Torso',
      'Rig/Skeleton/Arm',
      'Rig/Marker',
      'Rig/AnimationPlayer',
    ]);
  });
});

describe('a property override of an instanced GLB, in the live tree', () => {
  /** `[node name="Torso" parent="Skeleton"]`: Godot takes the node by name and adds none (`packed_scene.cpp:280-283`). */
  function override(name: string, instanceSubPath?: string): TscnNode {
    return { ...makeNode(name, 'Node'), overridesExistingNode: true, instanceSubPath };
  }

  it('is no node, so a GLB object keeps its one path', () => {
    expect(pathsBelowRig([override('Skeleton'), override('Torso', 'Skeleton')], () => true)).toEqual([
      'Rig',
      'Rig/Skeleton',
      'Rig/Skeleton/Torso',
      'Rig/Skeleton/Arm',
      'Rig/AnimationPlayer',
    ]);
  });
});

describe('nodes below a property override of an instanced GLB, in the live tree', () => {
  it('sit where Godot adds them: below the GLB node the override chain names', () => {
    const override = (name: string, children: TscnNode[]): TscnNode => ({
      ...makeNode(name, 'Node'),
      overridesExistingNode: true,
      children,
    });
    const marker = makeNode('Marker', 'Marker3D');
    const nested = [override('Skeleton', [override('Torso', [marker])])];

    expect(pathsBelowRig(nested, () => true)).toEqual([
      'Rig',
      'Rig/Skeleton',
      'Rig/Skeleton/Torso',
      'Rig/Skeleton/Torso/Marker',
      'Rig/Skeleton/Arm',
      'Rig/AnimationPlayer',
    ]);
  });
});

describe('a GLB instanced by the root of a sub-scene, in the live tree', () => {
  it('lists its objects below the merged node', () => {
    const wrapper: TscnScene = {
      nodes: [makeNode('WrapperRoot', 'Node', { instance: 'ExtResource("rig")' })],
      externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    const ctx = contextOver(
      {
        externalResources: [{ id: 'wrapper', path: 'res://wrapper.tscn', type: 'PackedScene' }],
        internalResources: [],
      },
      { ...SCENES, 'res://wrapper.tscn': wrapper },
      GLBS
    );
    const roots = [makeNode('Body', 'Node', { instance: 'ExtResource("wrapper")' })];

    expect(collectLiveNodes(roots, ctx, () => true).map((entry) => entry.path)).toEqual([
      'Body',
      'Body/Skeleton',
      'Body/Skeleton/Torso',
      'Body/Skeleton/Arm',
      'Body/AnimationPlayer',
    ]);
  });
});

describe('a typed node addressed into an instanced GLB, in the live tree', () => {
  it('sits below the GLB node its parent path names', () => {
    expect(pathsOfMarkers([typed('Marker', 'Skeleton/Torso')])).toEqual(['Rig/Skeleton/Torso/Marker']);
  });

  it('gives two nodes of one name under different GLB nodes two paths', () => {
    expect(pathsOfMarkers([typed('Marker', 'Skeleton/Torso'), typed('Marker', 'Skeleton/Arm')])).toEqual([
      'Rig/Skeleton/Torso/Marker',
      'Rig/Skeleton/Arm/Marker',
    ]);
  });

  it('keeps a node whose path names no GLB object below the instance', () => {
    expect(pathsOfMarkers([typed('Marker', 'Nowhere/Else')])).toEqual(['Rig/Marker']);
  });
});
