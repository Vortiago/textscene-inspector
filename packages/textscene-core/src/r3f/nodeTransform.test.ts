import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { decomposeForR3F, node3dGroupSpread } from './nodeTransform';
import { parseTransform3D } from '../utils/transform';

const SHEARED = parseTransform3D(
  'Transform3D(0.835518, 0.307015, 0, -0.529877, 1.08924, 0, 0, 0, 1, 0.666667, 0.5, 0)'
);
const ROTATED_AND_SCALED = parseTransform3D('Transform3D(0, -2, 0, 3, 0, 0, 0, 0, -1, 1, 2, 3)');

/** A group the way R3F builds it from the spread: the parts assigned, `updateMatrix` replaced. */
function groupFrom(transform: ReturnType<typeof decomposeForR3F>): THREE.Group {
  const spread = node3dGroupSpread(transform);
  const group = new THREE.Group();
  group.position.set(...spread.position);
  group.rotation.set(...spread.rotation);
  group.scale.set(...spread.scale);
  group.updateMatrix = spread.updateMatrix;
  return group;
}

describe('node3dGroupSpread', () => {
  it('composes a sheared basis to the exact authored matrix, rows as Godot stores them', () => {
    const group = groupFrom(decomposeForR3F(SHEARED));
    group.updateMatrix();
    const expected = new THREE.Matrix4().set(
      0.835518,
      0.307015,
      0,
      0.666667,
      -0.529877,
      1.08924,
      0,
      0.5,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    );
    group.matrix.elements.forEach((value, index) => expect(value).toBeCloseTo(expected.elements[index]!, 6));
  });

  it('keeps the shear when an animation rewrites the position', () => {
    const group = groupFrom(decomposeForR3F(SHEARED));
    group.position.x += 1;
    group.updateMatrix();
    expect(group.matrix.elements[12]).toBeCloseTo(1.666667, 6);
    expect(group.matrix.elements[1]).toBeCloseTo(-0.529877, 6);
  });

  it('composes a rotation with a non-uniform scale to the plain matrix', () => {
    const group = groupFrom(decomposeForR3F(ROTATED_AND_SCALED));
    group.updateMatrix();
    const plain = new THREE.Group();
    plain.position.set(...decomposeForR3F(ROTATED_AND_SCALED).position);
    plain.rotation.set(...decomposeForR3F(ROTATED_AND_SCALED).rotation);
    plain.scale.set(...decomposeForR3F(ROTATED_AND_SCALED).scale);
    plain.updateMatrix();
    expect(group.matrix.elements).toEqual(plain.matrix.elements);
  });
});
