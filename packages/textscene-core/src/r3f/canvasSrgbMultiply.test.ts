/**
 * The sRGB multiply rides three's own map and colour chunks. A three release that rewrites either
 * multiply line fails here, not silently in a capture.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CANVAS_SRGB_DEFINES, installCanvasSrgbMultiply } from './canvasSrgbMultiply';
import { warningsOf } from './testing/logWarnings';

const threeMap = THREE.ShaderChunk.map_fragment;
const threeColor = THREE.ShaderChunk.color_fragment;

/** The define a material sets, as the patched chunks must test it. */
const [DEFINE] = Object.keys(CANVAS_SRGB_DEFINES);

afterEach(() => {
  THREE.ShaderChunk.map_fragment = threeMap;
  THREE.ShaderChunk.color_fragment = threeColor;
});

function patchedChunks() {
  installCanvasSrgbMultiply();
  return { map: THREE.ShaderChunk.map_fragment, color: THREE.ShaderChunk.color_fragment };
}

describe('installCanvasSrgbMultiply', () => {
  it("guards each chunk's sRGB multiply with the define a canvas material sets", () => {
    const { map, color } = patchedChunks();
    expect(map).toContain(`#ifdef ${DEFINE}`);
    expect(color).toContain(`#ifdef ${DEFINE}`);
  });

  it('keeps the linear multiply for a material without the define', () => {
    const { map, color } = patchedChunks();
    expect(map).toContain(`#else\n\t\tdiffuseColor *= sampledDiffuseColor;`);
    expect(color).toContain(`#else\n\t\tdiffuseColor *= vColor;`);
  });

  it('multiplies the sRGB numbers and decodes the product once under the define', () => {
    expect(patchedChunks().map).toContain(
      'sRGBTransferEOTF( vec4( sRGBTransferOETF( diffuseColor ).rgb * sampledDiffuseColor.rgb, 1.0 ) )'
    );
  });

  it('encodes once and decodes once for a map with vertex colours, carrying sRGB between the chunks', () => {
    const { map, color } = patchedChunks();
    const keepsSrgb = map.split('#if defined( USE_COLOR ) || defined( USE_COLOR_ALPHA )')[1]!;
    expect(keepsSrgb.split('#else')[0]).not.toContain('sRGBTransferEOTF');
    const fromSrgb = color.split('#ifdef USE_MAP')[1]!;
    expect(fromSrgb.split('#else')[0]).not.toContain('sRGBTransferOETF');
    expect(fromSrgb.split('#else')[0]).toContain('sRGBTransferEOTF');
  });

  it("guards the shared path with the condition under which three's other chunk multiplies", () => {
    const { map, color } = patchedChunks();
    expect(map).toContain(threeColor.trim().split('\n')[0]);
    expect(color).toContain(threeMap.trim().split('\n')[0]);
  });

  it('changes nothing on a second call', () => {
    const first = patchedChunks();
    expect(patchedChunks()).toEqual(first);
  });

  it("keeps three's chunks and warns when they lack a multiply line", () => {
    THREE.ShaderChunk.map_fragment = '';
    THREE.ShaderChunk.color_fragment = '';
    const warnings = warningsOf(installCanvasSrgbMultiply);
    expect(THREE.ShaderChunk.map_fragment).toBe('');
    expect(warnings).toEqual([expect.stringContaining('no linear multiply to replace')]);
  });
});
