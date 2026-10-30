import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { writeNodeTransform } from './glbNodeTransform';
import { decomposeForR3F } from '../../nodeTransform';
import { parseTransform3D } from '../../../utils/transform';

const SHEARED = decomposeForR3F(parseTransform3D('Transform3D(1, 0, 0, 0.6, 1, 0, 0, 0, 1, 0, 0, 0)'));

describe('writeNodeTransform', () => {
  it('keeps the shear of a sheared override on a plain node', () => {
    const target = new THREE.Object3D();
    writeNodeTransform(target, SHEARED);
    expect(target.matrix.elements[1]).toBeCloseTo(0.6, 6);
  });

  it('leaves an updateMatrix the node already owns in place', () => {
    const target = new THREE.Object3D();
    const own = () => {};
    target.updateMatrix = own;
    writeNodeTransform(target, SHEARED);
    expect(target.updateMatrix).toBe(own);
  });
});
