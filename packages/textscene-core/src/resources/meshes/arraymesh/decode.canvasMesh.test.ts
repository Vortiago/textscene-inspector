/**
 * The ArrayMesh decode of the two things a canvas mesh needs and a 3D one did not: 2D vertices and
 * vertex colours. The surfaces are what Godot 4.6.3's `ArrayMesh.add_surface_from_arrays` saves.
 */
import { describe, it, expect } from 'vitest';
import {
  colouredQuadCompressedSurface,
  colouredQuadSurface,
  quad2DVerticesSurface,
} from '../../testing/arrayMeshSurfaces';
import { decodeArrayMeshTres } from '../../testing/decodeArrayMeshTres';

function decodeSurface(surface: string) {
  const tres = `[gd_resource type="ArrayMesh" format=3]\n\n[resource]\n_surfaces = [${surface}]\n`;
  return decodeArrayMeshTres(tres, 'res://mesh.tres').surfaces[0]!;
}

const QUAD_COLOUR_BYTES = [255, 0, 0, 255, 0, 255, 0, 127, 0, 0, 255, 255, 255, 255, 255, 63];

const QUAD_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

describe('a surface with ARRAY_FLAG_USE_2D_VERTICES', () => {
  it('decodes its 8-byte positions as x and y with z = 0', () => {
    const surface = decodeSurface(quad2DVerticesSurface());

    expect(Array.from(surface.positions)).toEqual([0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0]);
  });

  it('decodes the UVs that follow', () => {
    expect(Array.from(decodeSurface(quad2DVerticesSurface()).uvs!)).toEqual(QUAD_UVS);
  });

  it('draws no colour for a surface with none', () => {
    expect(decodeSurface(quad2DVerticesSurface()).colors).toBeUndefined();
  });
});

describe('ARRAY_COLOR', () => {
  it('decodes the stored RGBA8 bytes of an uncompressed surface', () => {
    expect(Array.from(decodeSurface(colouredQuadSurface()).colors!)).toEqual(QUAD_COLOUR_BYTES);
  });

  it('decodes the stored RGBA8 bytes of a compressed surface', () => {
    expect(Array.from(decodeSurface(colouredQuadCompressedSurface()).colors!)).toEqual(QUAD_COLOUR_BYTES);
  });

  it('leaves UV1 where it was, past the colour, uncompressed', () => {
    expect(Array.from(decodeSurface(colouredQuadSurface()).uvs!)).toEqual(QUAD_UVS);
  });

  it('leaves UV1 where it was, past the colour, compressed', () => {
    expect(Array.from(decodeSurface(colouredQuadCompressedSurface()).uvs!)).toEqual(QUAD_UVS);
  });
});
