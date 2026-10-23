/** `csgSolid` reads positions three to a triangle, so it refuses an indexed geometry. */

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { csgSolid } from './csgRegistration';

describe('csgSolid', () => {
  it('closes the solid of a non-indexed tetrahedron', () => {
    const tetrahedron = new THREE.TetrahedronGeometry(1).toNonIndexed();

    expect(csgSolid(tetrahedron, [undefined]).isClosed).toBe(true);
  });

  it('refuses an indexed geometry, whose positions are not three to a triangle', () => {
    const indexed = new THREE.BoxGeometry(1, 1, 1);

    expect(() => csgSolid(indexed, [undefined])).toThrow('expected a non-indexed geometry, got 36 indices');
  });
});
