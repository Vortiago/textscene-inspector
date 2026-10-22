import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { partsPlacement } from './placements';

const geometryAt = (x: number) =>
  new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 0, 0), new THREE.Vector3(x + 1, 1, 1)]);

const nodeRef = { current: new THREE.Group() };

describe('partsPlacement', () => {
  it('measures every part as one box', () => {
    const box = new THREE.Box3();

    const measured = partsPlacement(nodeRef, [geometryAt(0), geometryAt(5)]).ownAabb(box);

    expect(measured).toBe(true);
    expect(box.min.x).toBe(0);
    expect(box.max.x).toBe(6);
  });

  it('measures no box before a part has vertices (edge case)', () => {
    expect(partsPlacement(nodeRef, [new THREE.BufferGeometry()]).ownAabb(new THREE.Box3())).toBe(false);
  });
});
