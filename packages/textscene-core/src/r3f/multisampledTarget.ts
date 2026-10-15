/**
 * Multisampled render targets at the samples this renderer's device draws for a Godot MSAA mode.
 * Godot keeps the counts both the colour and the depth attachments support, for the format each
 * really has (`rendering_device_driver_vulkan.cpp:1999`). This takes the colour storage from the
 * target's own texture, as three allocates it, and the depth storage DEPTH_COMPONENT24.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { msaaSampleCount, supportedSampleCount } from '../godot/rendering/msaa';

/** What decides a target's colour storage, which a texture carries. */
export type TargetTexture = Pick<THREE.Texture, 'type' | 'colorSpace' | 'internalFormat'>;

/** The GL internal format of a target's colour attachment. */
type ColourStorage = THREE.PixelFormatGPU;

/**
 * The target `create` builds, multisampled at the count the device draws for `mode` on that target's
 * storage. `create` is stable while the target stays valid. The hook owns the target and disposes it.
 */
export function useMultisampledTarget(
  mode: number,
  create: () => THREE.WebGLRenderTarget
): THREE.WebGLRenderTarget {
  const gl = useThree((state) => state.gl);
  const target = useMemo(() => {
    const built = create();
    built.samples = deviceSampleCount(gl, mode, targetStorage(built));
    return built;
  }, [gl, mode, create]);
  useEffect(() => () => target.dispose(), [target]);
  return target;
}

/** The samples for `mode` on a buffer another library builds, from the texture it gives that buffer. */
export function useSampleCount(mode: number, texture: TargetTexture): number {
  const gl = useThree((state) => state.gl);
  const storage = colourStorage(texture, false);
  return useMemo(() => deviceSampleCount(gl, mode, storage), [gl, mode, storage]);
}

function targetStorage(target: THREE.WebGLRenderTarget): ColourStorage {
  const takesOutputLikeDrawingBuffer = (target as { isXRRenderTarget?: boolean }).isXRRenderTarget === true;
  return colourStorage(target.texture, takesOutputLikeDrawingBuffer);
}

/**
 * Three's `getInternalFormat` for an RGBA texture (`WebGLTextures.js:129`). A target that takes output
 * like the drawing buffer stores an 8-bit sRGB tag linear (`WebGLTextures.js:2120`).
 */
function colourStorage(texture: TargetTexture, forcesLinearStorage: boolean): ColourStorage {
  if (texture.internalFormat !== null) return texture.internalFormat;
  if (texture.type === THREE.FloatType) return 'RGBA32F';
  if (texture.type === THREE.HalfFloatType) return 'RGBA16F';
  if (texture.type !== THREE.UnsignedByteType) {
    throw new Error(`expected an unsigned byte, half float or float target, got texel type ${texture.type}`);
  }
  const isSrgb = THREE.ColorManagement.getTransfer(texture.colorSpace) === THREE.SRGBTransfer;
  return isSrgb && !forcesLinearStorage ? 'SRGB8_ALPHA8' : 'RGBA8';
}

/**
 * The counts colour and depth share, per context and colour storage. Written only by
 * `sharedSampleCounts`. A context lists the same counts for its life, and the entry goes with the
 * context.
 */
const sharedCounts = new WeakMap<WebGL2RenderingContext, Map<ColourStorage, readonly number[]>>();

/** 0, one sample per pixel, where the context lists no counts: WebGL 1 has no multisampled target. */
function deviceSampleCount(gl: THREE.WebGLRenderer, mode: number, storage: ColourStorage): number {
  const requested = msaaSampleCount(mode);
  const context = gl.getContext();
  if (requested === 0 || !('getInternalformatParameter' in context)) return 0;
  return supportedSampleCount(requested, sharedSampleCounts(context, storage));
}

function sharedSampleCounts(context: WebGL2RenderingContext, storage: ColourStorage): readonly number[] {
  const perStorage = sharedCounts.get(context) ?? new Map<ColourStorage, readonly number[]>();
  const cached = perStorage.get(storage);
  if (cached) return cached;
  const depthCounts = renderbufferSampleCounts(context, context.DEPTH_COMPONENT24);
  const colourFormat = (context as unknown as Record<ColourStorage, GLenum>)[storage];
  const shared = renderbufferSampleCounts(context, colourFormat).filter((count) =>
    depthCounts.includes(count)
  );
  // A lost context lists no counts, and would keep MSAA off after the browser restores it.
  if (!context.isContextLost()) sharedCounts.set(context, perStorage.set(storage, shared));
  return shared;
}

function renderbufferSampleCounts(context: WebGL2RenderingContext, format: GLenum): number[] {
  const counts = context.getInternalformatParameter(
    context.RENDERBUFFER,
    format,
    context.SAMPLES
  ) as Int32Array | null;
  return Array.from(counts ?? []);
}
