import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { AXIS_TANGENT_ATTRIBUTE, VERTEX_ANGLE_ATTRIBUTE, withGodotAttributes } from './meshAttributes.js';

function triangle(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  return geometry;
}

describe('withGodotAttributes', () => {
  it('reads the position as the vertex attribute', () => {
    const geometry = withGodotAttributes(triangle());
    expect(geometry.getAttribute(VERTEX_ANGLE_ATTRIBUTE)).toBe(geometry.getAttribute('position'));
  });

  it("writes the normal and Godot's made-up tangent as normalised 16-bit lanes", () => {
    const axisTangent = withGodotAttributes(triangle()).getAttribute(
      AXIS_TANGENT_ATTRIBUTE
    ) as THREE.BufferAttribute;
    expect(axisTangent.normalized).toBe(true);
    expect([...axisTangent.array.slice(0, 4)]).toEqual([0x7fff, 0x7fff, 0x7fff, 0x8000]);
  });

  it("writes the geometry's own tangent with its sign", () => {
    const geometry = triangle();
    geometry.setAttribute(
      'tangent',
      new THREE.Float32BufferAttribute([1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1], 4)
    );
    const axisTangent = withGodotAttributes(geometry).getAttribute(AXIS_TANGENT_ATTRIBUTE);
    expect([...(axisTangent.array as Uint16Array).slice(0, 4)]).toEqual([0x7fff, 0x7fff, 0xffff, 0xbfff]);
  });
});
