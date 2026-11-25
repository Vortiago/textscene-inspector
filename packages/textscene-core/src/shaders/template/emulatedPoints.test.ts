import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { withGodotAttributes } from '../spatial/meshAttributes.js';
import { emulatedPointGeometry } from './emulatedPoints.js';
import { VERTEX_ID_ATTRIBUTE } from './surfaceAttributes.js';

/** The name `scene_forward_clustered.glsl` gives its first vertex input. */
const VERTEX_ANGLE_ATTRIBUTE = 'vertex_angle_attrib';

function triangle(): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  return geometry;
}

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

  it("follows a recompute of the source's box, which three writes in place", () => {
    const source = withGodotAttributes(triangle());
    const geometry = emulatedPointGeometry(source);
    source.getAttribute('position').setX(0, 9);
    source.computeBoundingBox();

    expect(geometry.boundingBox!.max.x).toBe(9);
  });

  it('bounds a source with no position yet by an empty box, not the origin', () => {
    expect(emulatedPointGeometry(new THREE.BufferGeometry()).boundingBox!.isEmpty()).toBe(true);
  });

  it('bounds a source by the points it gains after the quads are built', () => {
    const source = new THREE.BufferGeometry();
    const emulated = emulatedPointGeometry(source);
    source.setAttribute('position', new THREE.BufferAttribute(Float32Array.from([0, 0, 0, 5, 2, 0]), 3));
    source.computeBoundingBox();

    expect(emulated.boundingBox!.max.toArray()).toEqual([5, 2, 0]);
  });

  it('bounds a source with no box by its positions, which the framing box reads', () => {
    const expected = withGodotAttributes(triangle());
    expected.computeBoundingBox();

    expect(emulatedPointGeometry(withGodotAttributes(triangle())).boundingBox).toEqual(expected.boundingBox);
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
    ...geometry.getAttribute(VERTEX_ID_ATTRIBUTE).array,
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
