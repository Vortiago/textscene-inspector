import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { emulatedPointGeometry } from '../template/emulatedPoints.js';
import { canvasInstances, instancedGeometry, instancedPoints, instancingFlags } from './canvasMultiMesh.js';

const ROWS = new Float32Array([1, 0, 0, 7, 0, 1, 0, 9]);
const COLOR = new Float32Array([1, 0.5, 0.25, 0.75]);
const CUSTOM = new Float32Array([0, 0, 0.5, 0]);

const floatsOf = (words: Uint32Array) => [...new Float32Array(words.buffer)];

describe('canvasInstances', () => {
  it('writes each instance as its transform rows, then its colour, then its custom data', () => {
    const { words } = canvasInstances([{ transform: ROWS, color: COLOR, customData: CUSTOM }]);

    expect(floatsOf(words)).toEqual([...ROWS, ...COLOR, ...CUSTOM]);
  });

  it('leaves out the colour of a multimesh that does not use colours, as the stride does', () => {
    const { words } = canvasInstances([
      { transform: ROWS, color: null, customData: CUSTOM },
      { transform: ROWS, color: null, customData: CUSTOM },
    ]);

    expect(floatsOf(words)).toEqual([...ROWS, ...CUSTOM, ...ROWS, ...CUSTOM]);
  });

  it('refuses a 3D instance, which a canvas batch does not draw', () => {
    expect(() =>
      canvasInstances([{ transform: new Float32Array(12), color: null, customData: null }])
    ).toThrow('expected 8 transform floats a 2D instance, got 12');
  });
});

describe('instancingFlags', () => {
  it.each([
    [false, false, 0b1],
    [true, false, 0b10000001],
    [false, true, 0b100000001],
    [true, true, 0b110000001],
  ])(
    'sets instancing 1 with colours %s and custom data %s as Godot does',
    (usesColors, usesCustomData, flags) => {
      expect(instancingFlags({ count: 1, words: new Uint32Array(), usesColors, usesCustomData })).toBe(flags);
    }
  );
});

describe('instancedGeometry', () => {
  it('draws the geometry once for each instance, with its own attributes and index', () => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('vertex_attrib', new THREE.BufferAttribute(new Float32Array(6), 2));
    geometry.setIndex([0, 1, 2]);
    const instanced = instancedGeometry(geometry, 5);

    expect([instanced.instanceCount, instanced.getAttribute('vertex_attrib'), instanced.getIndex()]).toEqual([
      5,
      geometry.getAttribute('vertex_attrib'),
      geometry.getIndex(),
    ]);
  });
});

describe('instancedPoints', () => {
  function pointsOf(vertices: number) {
    const surface = new THREE.BufferGeometry();
    surface.setAttribute('vertex_attrib', new THREE.BufferAttribute(new Float32Array(vertices * 2), 2));
    surface.setAttribute(
      'vertex_id_attrib',
      new THREE.BufferAttribute(
        Float32Array.from({ length: vertices }, (_, i) => i),
        1
      )
    );
    surface.setAttribute('instance_id_attrib', new THREE.BufferAttribute(new Float32Array(vertices), 1));
    // A canvas draw always has an index (`attributesGeometry`), which the emulated points read.
    surface.setIndex([...Array(vertices).keys()]);
    return emulatedPointGeometry(surface);
  }

  it('draws every point of instance 0, then of instance 1, with the instance each belongs to', () => {
    const instanced = instancedPoints(pointsOf(3), 2);

    expect([
      instanced.instanceCount,
      [...instanced.getAttribute('vertex_id_attrib').array],
      [...instanced.getAttribute('instance_id_attrib').array],
    ]).toEqual([6, [0, 1, 2, 0, 1, 2], [0, 0, 0, 1, 1, 1]]);
  });

  it('keeps the points as they are for one instance', () => {
    const points = pointsOf(3);

    expect(instancedPoints(points, 1)).toBe(points);
  });
});
