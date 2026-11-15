/**
 * The render targets an offscreen pass draws into: a 3D world's tonemapped target and a canvas's
 * target, in the storage Godot gives each.
 */

import * as THREE from 'three';
import { takeOutputLikeDrawingBuffer } from '../outputTarget';
import { markSrgbBytes } from '../srgbByteTextures';
import { pinColorSpace } from '../../resources/textures/textureView';
import type { CanvasColorSpace } from '../canvasColorSpace';

/**
 * The target the tonemap pass of a 3D world writes, which holds no depth: the world draws into its
 * own buffer (`r3f/environment/offscreenToneMap.ts`). Godot tonemaps each viewport into its own
 * target as sRGB-encoded 8-bit texels (`tonemap.glsl` `linear_to_srgb`), so the storage is SRGB8_ALPHA8, which
 * encodes on write and decodes on sample in hardware. The LINEAR tag keeps the shader from encoding
 * too: an sRGB tag would stack a shader encode on the hardware encode. A viewport that uses HDR
 * skips the encode and stores linear half floats (`renderer_scene_render_rd.cpp:744`), as its canvas does.
 */
export function createSceneTarget(
  width: number,
  height: number,
  name: string,
  space: CanvasColorSpace
): THREE.WebGLRenderTarget {
  if (space.isLinear) return createLinearCanvasTarget(width, height, name);
  const target = createTarget(width, height, name);
  // Pinned: R3F stamps `SRGBColorSpace` on a target bound to an albedo `map`, and three reads
  // this pass's output space from the tag, so the stamp would add an sRGB OETF (1.5-6.5x too bright).
  pinColorSpace(target.texture, THREE.LinearSRGBColorSpace);
  target.texture.internalFormat = 'SRGB8_ALPHA8';
  return target;
}

/**
 * The target of a pass that draws canvas items, the 2D world's or the Controls'. Godot's canvas
 * draws after the tonemap pass (`RendererViewport::_draw_viewport`) and writes its sRGB numbers
 * straight into an `R8G8B8A8_UNORM` target (`renderer_canvas_render_rd.cpp:671,729`,
 * `texture_storage.cpp:3568-3569`). So three encodes into RGBA8, as into the drawing buffer, and
 * blends and filters the encoded bytes. An sRGB tag alone would allocate SRGB8_ALPHA8. It holds no
 * depth: a 2D pass draws into a `CanvasFrame`, which does. A linear canvas writes its linear values
 * into an `R16G16B16A16_SFLOAT` target instead (`texture_storage.cpp:4541-4547`).
 */
export function createCanvasTarget(
  width: number,
  height: number,
  name: string,
  space: CanvasColorSpace
): THREE.WebGLRenderTarget {
  if (space.isLinear) return createLinearCanvasTarget(width, height, name);
  const target = createTarget(width, height, name);
  storeSrgbBytes(target.texture);
  return target;
}

/**
 * Linear half floats, whose sRGB view is the same format (`texture_storage.cpp:3569,3645-3647`), so
 * every consumer reads the stored values: a 3D one as linear, and a non-HDR canvas as if they were
 * its sRGB bytes, which the mark tells it.
 */
function createLinearCanvasTarget(width: number, height: number, name: string): THREE.WebGLRenderTarget {
  const target = createTarget(width, height, name, THREE.HalfFloatType);
  pinColorSpace(target.texture, THREE.LinearSRGBColorSpace);
  target.texture.internalFormat = 'RGBA16F';
  markSrgbBytes(target.texture);
  return target;
}

/** Makes `texture` the storage of canvas bytes: RGBA8 under a pinned sRGB tag, marked as bytes. */
export function storeSrgbBytes(texture: THREE.Texture): void {
  pinColorSpace(texture, THREE.SRGBColorSpace);
  texture.internalFormat = 'RGBA8';
  // An explicit mark, not a rule on RGBA8 under an sRGB tag: CanvasFrame has that shape too.
  markSrgbBytes(texture);
}

/** The shape of one target: its attachments, and the layers of an array target, null for a plain one. */
interface TargetShape {
  readonly attachments: number;
  readonly layers: number | null;
}

/**
 * A target that the 2D light pass sums its lights into: a plain target for a null `layers`, else an
 * array target of that many layers.
 */
export function createAccumulationTarget(
  type: THREE.TextureDataType,
  { attachments, layers }: TargetShape
): THREE.WebGLRenderTarget {
  // NoColorSpace writes the raw sRGB-space value.
  // The pass draws with `depthTest` off and samples its shadows, so it needs no depth or stencil.
  const options = { type, depthBuffer: false, stencilBuffer: false, count: attachments };
  const rt =
    layers === null
      ? new THREE.WebGLRenderTarget(1, 1, options)
      : new THREE.WebGLArrayRenderTarget(1, 1, layers, options);
  for (const texture of rt.textures) {
    texture.colorSpace = THREE.NoColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
  }
  return rt;
}

/** A colour-only target of `width` by `height`, which a view copies a target into. */
export function createCopyTarget(width: number, height: number): THREE.WebGLRenderTarget {
  return new THREE.WebGLRenderTarget(width, height, { depthBuffer: false });
}

/**
 * A target that takes its pass's output as the drawing buffer does, with Godot's sampler: linear,
 * and one mip level (`texture_storage.cpp:3585`), so minification and magnification follow one
 * rule. Not the SubViewport's `canvas_item_default_texture_filter`: Godot passes that to the items
 * drawn into the viewport (`renderer_viewport.cpp:688`), not to sampling its texture.
 */
function createTarget(
  width: number,
  height: number,
  name: string,
  type: THREE.TextureDataType = THREE.UnsignedByteType
): THREE.WebGLRenderTarget {
  const target = new THREE.WebGLRenderTarget(width, height, {
    depthBuffer: false,
    stencilBuffer: false,
    type,
  });
  target.texture.name = `${name}::target`;
  target.texture.minFilter = THREE.LinearFilter;
  target.texture.magFilter = THREE.LinearFilter;
  target.texture.generateMipmaps = false;
  takeOutputLikeDrawingBuffer(target);
  return target;
}
