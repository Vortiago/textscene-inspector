import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { vertexColourAttribute, writeVertexColour } from './vertexColour';

describe('writeVertexColour', () => {
  function blankColours(vertexCount: number): THREE.BufferAttribute {
    return new THREE.BufferAttribute(new Uint8Array(vertexCount * 4), 4, true);
  }

  it('gives every vertex the modulate, cut to eight bits and never rounded', () => {
    const colours = blankColours(2);

    writeVertexColour(colours, { r: 0.2, g: 1, b: 0.5, a: 0.999 });

    expect(Array.from(colours.array)).toEqual([51, 255, 127, 254, 51, 255, 127, 254]);
  });

  it('clamps an overbright or negative channel to the byte range', () => {
    const colours = blankColours(1);

    writeVertexColour(colours, { r: 2, g: -1, b: 0, a: 1 });

    expect(Array.from(colours.array)).toEqual([255, 0, 0, 255]);
  });

  it('marks the attribute for upload', () => {
    const colours = blankColours(1);
    const versionBefore = colours.version;

    writeVertexColour(colours, { r: 1, g: 1, b: 1, a: 1 });

    expect(colours.version).toBeGreaterThan(versionBefore);
  });
});

describe('vertexColourAttribute', () => {
  it('holds four normalised bytes of the modulate for each vertex', () => {
    const colours = vertexColourAttribute(2, { r: 1, g: 0.5, b: 0, a: 0.25 });

    expect([colours.count, colours.itemSize, colours.normalized]).toEqual([2, 4, true]);
    expect(Array.from(colours.array)).toEqual([255, 127, 0, 63, 255, 127, 0, 63]);
  });

  it('holds nothing for a mesh with no vertex', () => {
    expect(vertexColourAttribute(0, { r: 1, g: 1, b: 1, a: 1 }).count).toBe(0);
  });
});
