import { describe, expect, it } from 'vitest';
import { OPEN_SANS_FONT_METRICS } from '../../../r3f/controls/native/text/openSansFontMetrics';
import { parseSfntOutlines } from '../../../r3f/controls/native/text/sfntOutlines';
import { fixtureFontBytes } from '../../../r3f/controls/native/text/sfntOutlines.testkit';
import type { TextMeshFace } from './build';
import type { TscnInternalResource } from '../../../parser/types';
import { textMeshSurface } from './surface';

const face: TextMeshFace = {
  outlines: parseSfntOutlines(fixtureFontBytes('open-sans-semibold-subset.ttf'))!,
  metrics: OPEN_SANS_FONT_METRICS,
};

const TEXEL_SIZE = 0.2;
const meshOf = (extra: Record<string, string> = {}): TscnInternalResource => ({
  id: 'text',
  type: 'TextMesh',
  data: { text: '"H"', font_size: '32', ...extra },
});

describe('textMeshSurface', () => {
  it('writes no UV2 unless add_uv2 is set', () => {
    expect(textMeshSurface(meshOf(), face, TEXEL_SIZE).uv2s).toBeUndefined();
  });

  it('scales the UV into a UV2 padded to the lightmap size hint when add_uv2 is set', () => {
    const surface = textMeshSurface(
      meshOf({ add_uv2: 'true', uv2_padding: '2', lightmap_size_hint: 'Vector2i(100, 50)' }),
      face,
      TEXEL_SIZE
    );
    const [u, v] = [surface.uvs![2]!, surface.uvs![3]!];
    // `get_uv2_scale` is (hint - padding) / hint on each axis (`primitive_meshes.cpp:100-118`).
    expect([surface.uv2s![2], surface.uv2s![3]]).toEqual([
      expect.closeTo(u * 0.98, 6),
      expect.closeTo(v * 0.96, 6),
    ]);
  });

  it('negates the normals and swaps two corners of each triangle when flip_faces is set', () => {
    const plain = textMeshSurface(meshOf(), face, TEXEL_SIZE);
    const flipped = textMeshSurface(meshOf({ flip_faces: 'true' }), face, TEXEL_SIZE);
    // `+ 0` turns -0 into 0: only the sign of a zero differs.
    expect(Array.from(flipped.normals!, (value) => value + 0)).toEqual(
      Array.from(plain.normals!, (value) => -value + 0)
    );
    expect([flipped.indices[0], flipped.indices[1], flipped.indices[2]]).toEqual([
      plain.indices[1],
      plain.indices[0],
      plain.indices[2],
    ]);
  });
});

describe('textMeshSurface sharing', () => {
  it('builds a resource once for its holders, so the geometry and the box of one mesh share it', () => {
    const mesh = meshOf();
    expect(textMeshSurface(mesh, face, TEXEL_SIZE)).toBe(textMeshSurface(mesh, face, TEXEL_SIZE));
  });

  it('builds again when the font or the metrics it was built from change', () => {
    const mesh = meshOf();
    const first = textMeshSurface(mesh, face, TEXEL_SIZE);
    const otherMetrics = { ...face, metrics: { ...OPEN_SANS_FONT_METRICS } };
    expect(textMeshSurface(mesh, otherMetrics, TEXEL_SIZE)).not.toBe(first);
  });
});
