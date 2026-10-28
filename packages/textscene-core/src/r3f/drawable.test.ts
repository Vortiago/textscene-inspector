import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { isDrawable } from './drawable';

describe('isDrawable', () => {
  it('holds for a mesh, a line, line segments and points', () => {
    const objects = [new THREE.Mesh(), new THREE.Line(), new THREE.LineSegments(), new THREE.Points()];

    expect(objects.map(isDrawable)).toEqual([true, true, true, true]);
  });

  it('fails for an object that draws nothing, as a group or a light', () => {
    expect([new THREE.Group(), new THREE.PointLight()].map(isDrawable)).toEqual([false, false]);
  });
});
