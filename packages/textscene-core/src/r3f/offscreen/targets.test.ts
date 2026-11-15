/** The targets an offscreen pass draws into, in the storage Godot gives each. */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { createAccumulationTarget, createCanvasTarget, createCopyTarget, createSceneTarget } from './targets';
import { holdsSrgbBytes } from '../srgbByteTextures';
import { canvasColorSpaceOf } from '../canvasColorSpace';

const LINEAR_CANVAS = canvasColorSpaceOf(true);

describe('createSceneTarget', () => {
  /**
   * `renderer_scene_render_rd.cpp` tonemaps every viewport render into its own
   * target, and a shared world (`viewport.cpp`) shares the main environment, so the
   * curve applies twice through a target. `WebGLPrograms.js` tonemaps a target only
   * with `isXRRenderTarget`: without it the quad measured 0.60-0.65x of Godot.
   */
  it('marks the target so three tonemaps the offscreen pass like the main pass', () => {
    const target = createSceneTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect((target as { isXRRenderTarget?: boolean }).isXRRenderTarget).toBe(true);
    target.dispose();
  });

  /**
   * With `isXRRenderTarget`, three takes the output space from `texture.colorSpace`,
   * so LINEAR writes and samples with no encode or decode. An sRGB tag would stack
   * a shader encode on the SRGB8 hardware encode and darken every sample.
   */
  it('stores the working colour space, so write and sample round-trip exactly', () => {
    const target = createSceneTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    target.dispose();
  });

  /**
   * Godot's tonemap pass writes sRGB-encoded 8-bit texels (`tonemap.glsl` `linear_to_srgb`), so a
   * dark value keeps sRGB precision. SRGB8_ALPHA8 storage encodes on write and decodes on sample
   * in hardware, while the LINEAR tag keeps the shader from doing either.
   */
  it('stores a tonemapped pass with sRGB precision', () => {
    const target = createSceneTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(target.texture.internalFormat).toBe('SRGB8_ALPHA8');
    target.dispose();
  });

  it('holds no sRGB bytes for a canvas consumer to multiply (edge case)', () => {
    const target = createSceneTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(holdsSrgbBytes(target.texture)).toBe(false);
    target.dispose();
  });

  /**
   * Linear min/mag with no mipmaps matches Godot's default
   * `canvas_item_default_texture_filter` (1, LINEAR). The world draws into its
   * own buffer, so the target carries neither depth nor stencil.
   */
  it('samples linearly without mipmaps, and carries neither depth nor stencil', () => {
    const target = createSceneTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(target.texture.minFilter).toBe(THREE.LinearFilter);
    expect(target.texture.magFilter).toBe(THREE.LinearFilter);
    expect(target.texture.generateMipmaps).toBe(false);
    expect(target.depthBuffer).toBe(false);
    expect(target.stencilBuffer).toBe(false);
    target.dispose();
  });

  it('names the texture after the sub-viewport and sizes it to the rect', () => {
    const target = createSceneTarget(320, 240, 'Viewport', canvasColorSpaceOf(false));
    expect(target.texture.name).toBe('Viewport::target');
    expect(target.width).toBe(320);
    expect(target.height).toBe(240);
    target.dispose();
  });
});

describe('createSceneTarget in a linear canvas', () => {
  /** An HDR render target is `R16G16B16A16_SFLOAT`, tonemapped with no sRGB encode (`renderer_scene_render_rd.cpp:744`). */
  it('stores the tonemapped world as linear half floats, which keep a value above 1', () => {
    const target = createSceneTarget(64, 64, 'Probe', LINEAR_CANVAS);
    expect(target.texture.type).toBe(THREE.HalfFloatType);
    expect(target.texture.internalFormat).toBe('RGBA16F');
    expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    target.dispose();
  });

  it('has three write the tonemap as it is, with no depth and no stencil', () => {
    const target = createSceneTarget(64, 64, 'Probe', LINEAR_CANVAS);
    expect((target as { isXRRenderTarget?: boolean }).isXRRenderTarget).toBe(true);
    expect(target.depthBuffer).toBe(false);
    expect(target.stencilBuffer).toBe(false);
    target.dispose();
  });

  it('marks its texture for a raw sRGB multiply, as a non-HDR canvas consumer reads the stored numbers', () => {
    const target = createSceneTarget(64, 64, 'Probe', LINEAR_CANVAS);
    expect(holdsSrgbBytes(target.texture)).toBe(true);
    target.dispose();
  });
});

describe('createCanvasTarget', () => {
  /**
   * Godot's canvas writes its sRGB numbers straight into the target
   * (`renderer_canvas_render_rd.cpp:671,729`). Three encodes into a target only with
   * `isXRRenderTarget`, and then into the space `texture.colorSpace` names.
   */
  it('has three encode the pass into sRGB, as into the drawing buffer', () => {
    const target = createCanvasTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect((target as { isXRRenderTarget?: boolean }).isXRRenderTarget).toBe(true);
    expect(target.texture.colorSpace).toBe(THREE.SRGBColorSpace);
    target.dispose();
  });

  /**
   * A non-HDR target is `R8G8B8A8_UNORM` (`texture_storage.cpp:3568-3569`), so a blend and a filter
   * work on the stored sRGB numbers. An sRGB tag alone allocates SRGB8_ALPHA8, which would encode a
   * second time and blend in linear light.
   */
  it('stores the encoded bytes in plain RGBA8', () => {
    const target = createCanvasTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(target.texture.internalFormat).toBe('RGBA8');
    target.dispose();
  });

  it('marks its texture as holding sRGB bytes, which a canvas consumer multiplies in sRGB', () => {
    const target = createCanvasTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(holdsSrgbBytes(target.texture)).toBe(true);
    target.dispose();
  });

  it('allocates no depth buffer: every canvas material sets depthWrite false (controlQuad.tsx)', () => {
    const target = createCanvasTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(target.depthBuffer).toBe(false);
    target.dispose();
  });

  it('samples linearly without mipmaps, as Godot keeps one mip level (edge case)', () => {
    const target = createCanvasTarget(64, 64, 'Probe', canvasColorSpaceOf(false));
    expect(target.texture.minFilter).toBe(THREE.LinearFilter);
    expect(target.texture.magFilter).toBe(THREE.LinearFilter);
    expect(target.texture.generateMipmaps).toBe(false);
    target.dispose();
  });
});

describe('createCanvasTarget in a linear canvas', () => {
  /** An HDR target is `R16G16B16A16_SFLOAT`, and its sRGB view is the same format (`texture_storage.cpp:4541-4547`). */
  it('stores linear half floats, which keep a value above 1', () => {
    const target = createCanvasTarget(64, 64, 'Probe', LINEAR_CANVAS);
    expect(target.texture.type).toBe(THREE.HalfFloatType);
    expect(target.texture.internalFormat).toBe('RGBA16F');
    expect(target.texture.colorSpace).toBe(THREE.LinearSRGBColorSpace);
    target.dispose();
  });

  it('marks its texture for a raw sRGB multiply, as a non-HDR canvas consumer reads the stored numbers', () => {
    const target = createCanvasTarget(64, 64, 'Probe', LINEAR_CANVAS);
    expect(holdsSrgbBytes(target.texture)).toBe(true);
    target.dispose();
  });
});

describe('createCopyTarget', () => {
  it('has the size it is given', () => {
    const target = createCopyTarget(48, 20);
    expect([target.width, target.height]).toEqual([48, 20]);
    target.dispose();
  });

  it('holds colour only, since a copy never depth-tests', () => {
    const target = createCopyTarget(48, 20);
    expect(target.depthBuffer).toBe(false);
    target.dispose();
  });

  it('accepts a 1 px side, the smallest target a viewport has', () => {
    const target = createCopyTarget(1, 40);
    expect([target.width, target.height]).toEqual([1, 40]);
    target.dispose();
  });
});

describe('createAccumulationTarget', () => {
  it('makes a plain target for no layers, with one texture for each attachment', () => {
    const target = createAccumulationTarget(THREE.FloatType, { attachments: 2, layers: null });
    expect(target).not.toBeInstanceOf(THREE.WebGLArrayRenderTarget);
    expect(target.textures).toHaveLength(2);
    target.dispose();
  });

  it('makes an array target of the given layers', () => {
    const target = createAccumulationTarget(THREE.FloatType, { attachments: 1, layers: 3 });
    expect(target).toBeInstanceOf(THREE.WebGLArrayRenderTarget);
    expect(target.depth).toBe(3);
    target.dispose();
  });

  it('stores raw values, sampled linear and clamped, with no depth or stencil', () => {
    const target = createAccumulationTarget(THREE.HalfFloatType, { attachments: 2, layers: 2 });
    expect([target.depthBuffer, target.stencilBuffer]).toEqual([false, false]);
    for (const texture of target.textures) {
      expect(texture.type).toBe(THREE.HalfFloatType);
      expect(texture.colorSpace).toBe(THREE.NoColorSpace);
      expect([texture.minFilter, texture.magFilter]).toEqual([THREE.LinearFilter, THREE.LinearFilter]);
      expect([texture.wrapS, texture.wrapT]).toEqual([THREE.ClampToEdgeWrapping, THREE.ClampToEdgeWrapping]);
    }
    target.dispose();
  });
});
