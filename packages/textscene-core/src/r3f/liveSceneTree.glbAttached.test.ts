/**
 * The node that instances a GLB is the GLB root (`packed_scene.cpp:261-264`), so the GLB's objects
 * sit directly below it in the live tree. A typed node an instancing scene adds inside the GLB sits
 * where Godot adds it: below the GLB node its parent path resolves to (`packed_scene.cpp:157-165`,
 * `:541`), so its path is that node's path and its name.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { collectLiveNodes, type LiveTreeContext } from './liveSceneTree';
import { makeNode } from '../parser/testing/parserKit';
import type { TscnNode, TscnScene } from '../parser/types';
import '../nodes/node/index';

const GLB_PATH = 'res://rig.glb';

function rigGlb(): THREE.Object3D {
  const named = (name: string) => Object.assign(new THREE.Group(), { name });
  const root = named('Scene');
  root.animations = [new THREE.AnimationClip('idle', 1, [])];
  const skeleton = named('Skeleton');
  skeleton.add(named('Torso'), named('Arm'));
  root.add(skeleton);
  return root;
}

const GLB_SCENE: TscnScene = {
  nodes: [makeNode('rig', 'GLBSceneRoot', { properties: { glbPath: GLB_PATH } as Record<string, unknown> })],
  externalResources: [],
  internalResources: [],
};

const CTX: LiveTreeContext = {
  externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
  internalResources: [],
  sceneCache: { getCached: (path) => (path === GLB_PATH ? GLB_SCENE : undefined) },
  glbCache: { getCached: (path) => (path === GLB_PATH ? rigGlb() : undefined) },
};

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

describe('a GLB instanced by the root of a sub-scene, in the live tree', () => {
  it('lists its objects below the merged node', () => {
    const wrapper: TscnScene = {
      nodes: [makeNode('WrapperRoot', 'Node', { instance: 'ExtResource("rig")' })],
      externalResources: [{ id: 'rig', path: GLB_PATH, type: 'PackedScene' }],
      internalResources: [],
    };
    const ctx: LiveTreeContext = {
      ...CTX,
      externalResources: [{ id: 'wrapper', path: 'res://wrapper.tscn', type: 'PackedScene' }],
      sceneCache: {
        getCached: (path) => (path === 'res://wrapper.tscn' ? wrapper : CTX.sceneCache.getCached(path)),
      },
    };
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
