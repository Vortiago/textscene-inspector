import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { PARTICLE_COLOR_OFFSET, PARTICLE_FLOATS } from './particleBuffer';
import { skinTrailGeometry } from './skinTrails';

/** Two vertices: the first bound to section 0 alone, the second half to section 0 and half to section 1. */
function sourceGeometry(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0, 1, 0]), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 1]), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 1]), 2));
  geometry.setAttribute(
    'skinIndex',
    new THREE.BufferAttribute(new Float32Array([0, 1, 0, 0, 0, 1, 0, 0]), 4)
  );
  geometry.setAttribute(
    'skinWeight',
    new THREE.BufferAttribute(new Float32Array([1, 0, 0, 0, 0.5, 0.5, 0, 0]), 4)
  );
  geometry.setIndex([0, 1, 0]);
  return geometry;
}

/** Section rows that only translate along X, each with its own colour. */
function sections(...x: number[]): Float32Array {
  const rows = new Float32Array(x.length * PARTICLE_FLOATS);
  x.forEach((offset, row) => {
    const at = row * PARTICLE_FLOATS;
    rows.set([1, 0, 0, offset, 0, 1, 0, 0, 0, 0, 1, 0], at);
    rows.set([row, row, row, 1], at + PARTICLE_COLOR_OFFSET);
  });
  return rows;
}

describe('skinTrailGeometry', () => {
  it('takes each vertex through the section matrices it is bound to, by weight', () => {
    const merged = skinTrailGeometry(sourceGeometry(), sections(1, 3), 2);
    const position = merged.getAttribute('position');
    expect(position.getX(0)).toBeCloseTo(1, 6);
    // Half the vertex at x 1 and half at x 3.
    expect(position.getX(1)).toBeCloseTo(2, 6);
    expect(position.getY(1)).toBeCloseTo(1, 6);
  });

  it('draws one copy of the surface for each particle, with its own sections', () => {
    const merged = skinTrailGeometry(sourceGeometry(), sections(1, 3, 10, 20), 2);
    expect(merged.getAttribute('position').count).toBe(4);
    expect(merged.getAttribute('position').getX(2)).toBeCloseTo(10, 6);
    expect(Array.from(merged.getIndex()!.array)).toEqual([0, 1, 0, 2, 3, 2]);
    expect(merged.getAttribute('uv').count).toBe(4);
  });

  it('multiplies the vertex colour by the weighted colour of the sections', () => {
    const colour = skinTrailGeometry(sourceGeometry(), sections(1, 3), 2).getAttribute('color');
    expect(colour.getX(0)).toBeCloseTo(0, 6);
    expect(colour.getX(1)).toBeCloseTo(0.5, 6);
    expect(colour.getW(1)).toBeCloseTo(1, 6);
  });

  it('skips a bone slot whose weight is at most 0.001, except the first (edge case)', () => {
    const geometry = sourceGeometry();
    geometry.setAttribute(
      'skinWeight',
      new THREE.BufferAttribute(new Float32Array([0.0005, 0, 0, 0, 1, 0.0005, 0, 0]), 4)
    );
    const position = skinTrailGeometry(geometry, sections(1, 3), 2).getAttribute('position');
    expect(position.getX(0)).toBeCloseTo(0.0005, 6);
    expect(position.getX(1)).toBeCloseTo(1, 6);
  });

  it('rejects a surface with no bones (error case)', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(3), 3));
    expect(() => skinTrailGeometry(geometry, sections(0, 0), 2)).toThrow('skinIndex');
  });
});
