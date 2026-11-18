import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withGodotSurface } from './spatialSurface';

/** A triangle whose first UV set holds `v` at each corner, from the bottom row as the previewer stores it. */
function triangleWithV(...v: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(Float32Array.from(v.flatMap((y) => [0.25, y])), 2));
  geometry.setAttribute('uv1', new THREE.BufferAttribute(Float32Array.from(v.flatMap((y) => [0.5, y])), 2));
  return geometry;
}

describe('withGodotSurface', () => {
  it("hands the shader's UV the first UV set from the top row, as Godot stores it", () => {
    const geometry = triangleWithV(0, 0.25, 1);
    withGodotSurface(geometry);
    const uv = geometry.getAttribute('uv_attrib');

    expect([0, 1, 2].map((i) => [uv.getX(i), uv.getY(i)])).toEqual([
      [0.25, 1],
      [0.25, 0.75],
      [0.25, 0],
    ]);
  });

  it('flips a first UV set once, however many passes of the surface attach it', () => {
    const geometry = triangleWithV(0, 0.25, 1);
    withGodotSurface(geometry);
    const first = geometry.getAttribute('uv_attrib');
    withGodotSurface(geometry);

    expect(geometry.getAttribute('uv_attrib')).toBe(first);
    expect(first.getY(0)).toBe(1);
  });

  it('flips the first UV set again when its values change in place, as a sprite frame does', () => {
    const geometry = triangleWithV(0, 0.25, 1);
    withGodotSurface(geometry);
    const uv = geometry.getAttribute('uv') as THREE.BufferAttribute;
    uv.setY(0, 0.5);
    uv.needsUpdate = true;
    withGodotSurface(geometry);

    expect(geometry.getAttribute('uv_attrib').getY(0)).toBe(0.5);
  });

  it('writes the attributes again for a UV set that replaces the first', () => {
    const geometry = triangleWithV(0, 0.25, 1);
    withGodotSurface(geometry);
    geometry.setAttribute('uv', new THREE.BufferAttribute(Float32Array.of(0, 0.75, 0, 0, 0, 0), 2));
    withGodotSurface(geometry);

    expect(geometry.getAttribute('uv_attrib').getY(0)).toBe(0.25);
  });

  it('hands on the second UV set as it is, which the previewer already stores from the top row', () => {
    const geometry = triangleWithV(0, 0.25, 1);
    withGodotSurface(geometry);
    const uv2 = geometry.getAttribute('uv2_attrib');

    expect([0, 1, 2].map((i) => uv2.getY(i))).toEqual([0, 0.25, 1]);
  });
});
