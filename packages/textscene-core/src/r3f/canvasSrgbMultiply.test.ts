/**
 * The sRGB multiply rides three's own map and colour chunks. A three release that rewrites either
 * multiply line fails here, not silently in a capture.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { applyChunkEdits } from './shaderPatch/chunkPatch';
import { CANVAS_SRGB_MULTIPLY, CANVAS_SRGB_MULTIPLY_EDITS } from './canvasSrgbMultiply';

const threeChunks = () => ({
  map_fragment: THREE.ShaderChunk.map_fragment,
  color_fragment: THREE.ShaderChunk.color_fragment,
});

describe('CANVAS_SRGB_MULTIPLY_EDITS', () => {
  it("finds each linear multiply in three's chunks", () => {
    expect(applyChunkEdits(threeChunks(), CANVAS_SRGB_MULTIPLY_EDITS)).not.toBeNull();
  });

  it('keeps the linear multiply for a material without the define', () => {
    const patched = applyChunkEdits(threeChunks(), CANVAS_SRGB_MULTIPLY_EDITS)!;
    expect(patched.map_fragment).toContain(`#else\n\t\tdiffuseColor *= sampledDiffuseColor;`);
    expect(patched.color_fragment).toContain(`#else\n\t\tdiffuseColor *= vColor;`);
  });

  it('multiplies the sRGB numbers and decodes the product once under the define', () => {
    const patched = applyChunkEdits(threeChunks(), CANVAS_SRGB_MULTIPLY_EDITS)!;
    expect(patched.map_fragment).toContain(`#ifdef ${CANVAS_SRGB_MULTIPLY}`);
    expect(patched.map_fragment).toContain(
      'sRGBTransferEOTF( vec4( sRGBTransferOETF( diffuseColor ).rgb * sampledDiffuseColor.rgb, 1.0 ) )'
    );
  });

  it('encodes once and decodes once for a map with vertex colours, carrying sRGB between the chunks', () => {
    const patched = applyChunkEdits(threeChunks(), CANVAS_SRGB_MULTIPLY_EDITS)!;
    const keepsSrgb = patched.map_fragment.split(
      '#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )'
    )[1]!;
    expect(keepsSrgb.split('#else')[0]).not.toContain('sRGBTransferEOTF');
    const fromSrgb = patched.color_fragment.split('#ifdef USE_MAP')[1]!;
    expect(fromSrgb.split('#else')[0]).not.toContain('sRGBTransferOETF');
    expect(fromSrgb.split('#else')[0]).toContain('sRGBTransferEOTF');
  });

  it("guards the shared path with the condition under which three's other chunk multiplies", () => {
    const patched = applyChunkEdits(threeChunks(), CANVAS_SRGB_MULTIPLY_EDITS)!;
    expect(patched.map_fragment).toContain(THREE.ShaderChunk.color_fragment.trim().split('\n')[0]);
    expect(patched.color_fragment).toContain(THREE.ShaderChunk.map_fragment.trim().split('\n')[0]);
  });

  it('refuses chunks that lack a multiply line', () => {
    expect(applyChunkEdits({ map_fragment: '', color_fragment: '' }, CANVAS_SRGB_MULTIPLY_EDITS)).toBeNull();
  });
});
