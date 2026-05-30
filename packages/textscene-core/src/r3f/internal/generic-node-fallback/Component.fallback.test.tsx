/**
 * Strict-verification harness (WI-R3F-9, group K) — 2 assertions covering
 * the unrecognised-node-type fallback.
 *
 * Assertions: 95–96 of `work_items/STRICT-VERIFICATION.md`.
 */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { GenericNodeFallback } from './Component';
import type { TscnNode } from '../../../parser/types';

const node: TscnNode = {
  name: 'MysteryThing',
  type: 'SomeUnregisteredType',
  children: [],
  properties: {},
};

describe('GenericNodeFallback (assertions 95–96)', () => {
  it('#95 unregistered node type → userData carries nodeType + nodeName', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node} />);
    const group = renderer.scene.findByProps({ name: 'MysteryThing' });
    const userData = group.instance.userData as {
      isPlaceholder: boolean;
      nodeType: string;
      nodeName: string;
    };
    expect(userData.isPlaceholder).toBe(true);
    expect(userData.nodeType).toBe('SomeUnregisteredType');
    expect(userData.nodeName).toBe('MysteryThing');
  });

  it('#96 fallback is visible — non-zero bounding box on the placeholder mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(<GenericNodeFallback node={node} />);
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes.length).toBeGreaterThan(0);
    const mesh = meshes[0]!.instance as THREE.Mesh;
    mesh.geometry.computeBoundingBox();
    const size = new THREE.Vector3();
    mesh.geometry.boundingBox!.getSize(size);
    // Placeholder is a (0.4, 0.4, 0.4) cube — non-zero in all axes.
    expect(size.x).toBeGreaterThan(0);
    expect(size.y).toBeGreaterThan(0);
    expect(size.z).toBeGreaterThan(0);
  });
});
