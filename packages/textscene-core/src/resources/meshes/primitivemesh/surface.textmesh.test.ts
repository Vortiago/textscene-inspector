import { describe, expect, it } from 'vitest';
import { meshContentKey } from '../meshSource';
import {
  FONT_PATH,
  readyTextMesh,
  systemFontResource,
  textMeshWith,
  trueTypeFontFile,
} from '../textmesh/textMeshFont.testkit';
import { isDrawablePrimitiveMesh, primitiveMeshSurface, referencesKey } from './surface';
import { scopedMesh } from './surface.testkit';

const TEXEL_SIZE = 0.2;

describe('primitiveMeshSurface for a TextMesh', () => {
  it('is null while its font is not loaded', () => {
    expect(primitiveMeshSurface(textMeshWith(), TEXEL_SIZE)).toBeNull();
  });

  it('is null while the metrics of its font are to settle', () => {
    expect(
      primitiveMeshSurface(textMeshWith({}, { [FONT_PATH]: trueTypeFontFile() }), TEXEL_SIZE)
    ).toBeNull();
  });

  it('builds the glyphs of the text once its font is ready', async () => {
    const surface = primitiveMeshSurface(await readyTextMesh(), TEXEL_SIZE);

    expect(surface!.positions.length).toBeGreaterThan(0);
  });

  it('writes no UV2 unless add_uv2 is set', async () => {
    expect(primitiveMeshSurface(await readyTextMesh(), TEXEL_SIZE)!.uv2s).toBeUndefined();
  });

  it('scales the UV into a UV2 padded to the lightmap size hint when add_uv2 is set', async () => {
    const mesh = await readyTextMesh({
      add_uv2: 'true',
      uv2_padding: '2',
      lightmap_size_hint: 'Vector2i(100, 50)',
    });

    const surface = primitiveMeshSurface(mesh, TEXEL_SIZE)!;

    const [u, v] = [surface.uvs![2]!, surface.uvs![3]!];
    // `get_uv2_scale` is (hint - padding) / hint on each axis (`primitive_meshes.cpp:100-118`).
    expect([surface.uv2s![2], surface.uv2s![3]]).toEqual([
      expect.closeTo(u * 0.98, 6),
      expect.closeTo(v * 0.96, 6),
    ]);
  });

  it('negates the normals and swaps two corners of each triangle when flip_faces is set', async () => {
    const plain = primitiveMeshSurface(await readyTextMesh(), TEXEL_SIZE)!;
    const flipped = primitiveMeshSurface(await readyTextMesh({ flip_faces: 'true' }), TEXEL_SIZE)!;

    // `+ 0` turns -0 into 0: only the sign of a zero differs.
    expect(Array.from(flipped.normals!, (value) => value + 0)).toEqual(
      Array.from(plain.normals!, (value) => -value + 0)
    );
    expect([flipped.indices[0], flipped.indices[1]]).toEqual([plain.indices[1], plain.indices[0]]);
  });

  it('builds one surface for the geometry and the box of one mesh', async () => {
    const mesh = await readyTextMesh();

    expect(primitiveMeshSurface(mesh, TEXEL_SIZE)).toBe(primitiveMeshSurface(mesh, TEXEL_SIZE));
  });

  it('builds again for a font file that reloads', async () => {
    const first = await readyTextMesh();
    const reloaded = await readyTextMesh();

    expect(primitiveMeshSurface(reloaded, TEXEL_SIZE)).not.toBe(primitiveMeshSurface(first, TEXEL_SIZE));
  });
});

describe('isDrawablePrimitiveMesh', () => {
  it('is false for a TextMesh whose font has no readable outlines', () => {
    expect(isDrawablePrimitiveMesh(textMeshWith({}, { [FONT_PATH]: systemFontResource() }))).toBe(false);
  });

  it('is true for a TextMesh with no loaded font, which draws the bundled font', () => {
    expect(isDrawablePrimitiveMesh(textMeshWith())).toBe(true);
  });

  it('is true for a TextMesh whose font awaits its metrics, and for a mesh of another type', () => {
    const awaiting = textMeshWith({}, { [FONT_PATH]: trueTypeFontFile() });
    const box = scopedMesh({ id: 'box', type: 'BoxMesh', data: {} });

    expect([isDrawablePrimitiveMesh(awaiting), isDrawablePrimitiveMesh(box)]).toEqual([true, true]);
  });

  it('is false for a type with no slice here', () => {
    expect(isDrawablePrimitiveMesh(scopedMesh({ id: 'future', type: 'FutureMesh', data: {} }))).toBe(false);
  });
});

describe('the content key of a TextMesh', () => {
  it('follows its font, which another TextMesh of the same content may not share', async () => {
    const first = await readyTextMesh();
    const other = await readyTextMesh();

    expect(referencesKey(first)).not.toBe(referencesKey(other));
    expect(meshContentKey(first)).not.toBe(meshContentKey(other));
  });

  it('moves when the metrics settle, for a mesh object read afterwards', async () => {
    const awaiting = textMeshWith({}, { [FONT_PATH]: trueTypeFontFile() });
    const before = referencesKey(awaiting);

    const ready = await readyTextMesh();

    expect(referencesKey(ready)).not.toBe(before);
  });
});
