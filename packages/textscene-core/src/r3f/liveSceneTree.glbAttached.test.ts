/**
 * A typed node an instancing scene adds inside a GLB sits in the live tree where Godot adds it:
 * below the GLB node its parent path resolves to (`packed_scene.cpp:157-165`, `:541`), so its
 * path is that node's path and its name.
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

function pathsOfMarkers(children: TscnNode[]): string[] {
  const roots = [{ ...makeNode('Rig', 'Node', { instance: 'ExtResource("rig")' }), children }];
  return collectLiveNodes(roots, CTX, (node) => node.type === 'Marker3D').map((entry) => entry.path);
}

describe('a typed node addressed into an instanced GLB, in the live tree', () => {
  it('sits below the GLB node its parent path names', () => {
    expect(pathsOfMarkers([typed('Marker', 'Skeleton/Torso')])).toEqual(['Rig/rig/Skeleton/Torso/Marker']);
  });

  it('gives two nodes of one name under different GLB nodes two paths', () => {
    expect(pathsOfMarkers([typed('Marker', 'Skeleton/Torso'), typed('Marker', 'Skeleton/Arm')])).toEqual([
      'Rig/rig/Skeleton/Torso/Marker',
      'Rig/rig/Skeleton/Arm/Marker',
    ]);
  });

  it('keeps a node whose path names no GLB object below the instance', () => {
    expect(pathsOfMarkers([typed('Marker', 'Nowhere/Else')])).toEqual(['Rig/Marker']);
  });
});
