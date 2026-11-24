import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emulatedPointGeometry, POINT_VERTEX_ATTRIBUTE, withGodotAttributes } from './meshAttributes.js';

/** The names `scene_forward_clustered.glsl` gives its first two vertex inputs. */
const VERTEX_ANGLE_ATTRIBUTE = 'vertex_angle_attrib';
const AXIS_TANGENT_ATTRIBUTE = 'axis_tangent_attrib';

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

  it('turns each triangle so its first corner draws last, as WebGL takes a flat value from the last', () => {
    expect([...withGodotAttributes(triangle()).getIndex()!.array]).toEqual([1, 2, 0]);
  });

  it('turns the corners of an indexed geometry by its index', () => {
    const geometry = triangle();
    geometry.setIndex([2, 0, 1]);
    expect([...withGodotAttributes(geometry).getIndex()!.array]).toEqual([0, 1, 2]);
  });

  it('turns no triangle again when it prepares a geometry twice', () => {
    const geometry = withGodotAttributes(triangle());
    expect([...withGodotAttributes(geometry).getIndex()!.array]).toEqual([1, 2, 0]);
  });

  it('turns no triangle of a clone of a prepared geometry again', () => {
    const clone = withGodotAttributes(triangle()).clone();
    expect([...withGodotAttributes(clone).getIndex()!.array]).toEqual([1, 2, 0]);
  });

  it('turns each line so its first vertex draws last, as on a triangle', () => {
    const geometry = triangle();
    geometry.setIndex([0, 1, 1, 2]);
    expect([...withGodotAttributes(geometry, 'lines').getIndex()!.array]).toEqual([1, 0, 2, 1]);
  });

  it('refuses a line list of an odd count of vertices (error case)', () => {
    expect(() => withGodotAttributes(triangle(), 'lines')).toThrow(
      'expected a line list of a multiple of 2 corners, got 3 corners'
    );
  });

  it('gives points no index, as one vertex provokes each', () => {
    expect(withGodotAttributes(triangle(), 'points').getIndex()).toBeNull();
  });

  it('keeps the vertex order of a geometry with no index, so each vertex keeps its index', () => {
    const geometry = triangle();
    const positions = [...geometry.getAttribute('position').array];
    withGodotAttributes(geometry);
    expect([...geometry.getAttribute('position').array]).toEqual(positions);
  });

  it('reads the custom arrays from the attributes custom0 to custom3', () => {
    const geometry = triangle();
    const custom = new THREE.Float32BufferAttribute(
      Array.from({ length: 12 }, (_, lane) => lane / 12),
      4
    );
    geometry.setAttribute('custom2', custom);
    expect(withGodotAttributes(geometry).getAttribute('custom2_attrib')).toBe(custom);
  });

  it("writes three's skin indices as 16-bit integers that GL reads as integers", () => {
    const geometry = triangle();
    geometry.setAttribute(
      'skinIndex',
      new THREE.Float32BufferAttribute([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 4)
    );
    const bones = withGodotAttributes(geometry).getAttribute('bone_attrib') as THREE.BufferAttribute;
    expect([bones.array.constructor, bones.gpuType]).toEqual([Uint16Array, THREE.IntType]);
    expect([...bones.array.slice(4, 8)]).toEqual([5, 6, 7, 8]);
  });

  it("gives an array the geometry lacks Godot's default value, white for the colour", () => {
    const color = withGodotAttributes(triangle()).getAttribute(
      'color_attrib'
    ) as THREE.InstancedBufferAttribute;
    expect([color.isInstancedBufferAttribute, [...color.array]]).toEqual([true, [1, 1, 1, 1]]);
  });

  it('refuses a corner count that is no triangle list, by the count', () => {
    const geometry = triangle();
    geometry.setIndex([0, 1]);
    expect(() => withGodotAttributes(geometry)).toThrow('got 2 corners');
  });

  it('refuses a tangent with no lane for the sign, by its lane count', () => {
    const geometry = triangle();
    geometry.setAttribute('tangent', new THREE.Float32BufferAttribute([1, 0, 0, 1, 0, 0, 1, 0, 0], 3));
    expect(() => withGodotAttributes(geometry)).toThrow('got 3');
  });

  it('writes a colour as four bytes, each cut down from 255 times its lane, with alpha 1 for three lanes', () => {
    const geometry = triangle();
    geometry.setAttribute('color', new THREE.Float32BufferAttribute([0.5, 1, 0.999, 0, 0, 0, 0, 0, 0], 3));
    const color = withGodotAttributes(geometry).getAttribute('color_attrib') as THREE.BufferAttribute;
    expect([color.normalized, ...color.array.slice(0, 4)]).toEqual([true, 127, 255, 254, 255]);
  });

  it("reads three's first and second UV sets as Godot's UV and UV2", () => {
    const geometry = triangle();
    const uv = new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2);
    const uv1 = new THREE.Float32BufferAttribute([1, 1, 0, 1, 1, 0], 2);
    geometry.setAttribute('uv', uv);
    geometry.setAttribute('uv1', uv1);
    const godot = withGodotAttributes(geometry);
    expect([godot.getAttribute('uv_attrib'), godot.getAttribute('uv2_attrib')]).toEqual([uv, uv1]);
  });
});

describe('emulatedPointGeometry', () => {
  const emulated = () => emulatedPointGeometry(withGodotAttributes(triangle()));

  it('draws six vertices for each point, one point an instance', () => {
    const geometry = emulated();
    expect(geometry.instanceCount).toBe(3);
    expect(geometry.getAttribute('position').count).toBe(6);
    expect(geometry.getIndex()).toBeNull();
  });

  it("reads each of Godot's arrays once a point, by instance, in Godot's order before the loader's swap", () => {
    const vertex = emulated().getAttribute(VERTEX_ANGLE_ATTRIBUTE) as THREE.InstancedBufferAttribute;
    expect(vertex.isInstancedBufferAttribute).toBe(true);
    expect([...vertex.array]).toEqual([0, 0, 0, 0, 1, 0, 1, 0, 0]);
  });

  it('shares the one value of an array the surface lacks across every point', () => {
    const color = emulated().getAttribute('color_attrib') as THREE.InstancedBufferAttribute;
    expect([color.count, color.meshPerAttribute]).toEqual([1, 3]);
    expect([...color.array]).toEqual([1, 1, 1, 1]);
  });

  it("keeps the source's bounds, which three culls by", () => {
    const source = withGodotAttributes(triangle());
    source.computeBoundingSphere();
    expect(emulatedPointGeometry(source).boundingSphere).toEqual(source.boundingSphere);
  });
});

describe('emulatedPointGeometry of an indexed surface', () => {
  /** Two triangles sharing the vertices 0 and 2, loaded with each triangle's last two corners swapped. */
  function quad(): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0], 3)
    );
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    return withGodotAttributes(geometry);
  }
  const pointVertices = (geometry: THREE.BufferGeometry) => [
    ...geometry.getAttribute(POINT_VERTEX_ATTRIBUTE).array,
  ];

  it('draws a point for each index, so a shared vertex draws once for each corner', () => {
    expect(pointVertices(emulatedPointGeometry(quad()))).toEqual([0, 2, 1, 0, 3, 2]);
  });

  it('draws only the corners of the range', () => {
    expect(pointVertices(emulatedPointGeometry(quad(), { start: 3, count: 3 }))).toEqual([0, 3, 2]);
  });

  it("reads each point's arrays from the vertex it draws", () => {
    const vertex = emulatedPointGeometry(quad(), { start: 3, count: 3 }).getAttribute(VERTEX_ANGLE_ATTRIBUTE);
    expect([...vertex.array]).toEqual([0, 0, 0, 0, 1, 0, 1, 1, 0]);
  });
});
