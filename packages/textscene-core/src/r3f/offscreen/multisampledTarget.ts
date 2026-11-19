import { useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { msaaSampleCount, supportedSampleCount } from '../../godot/rendering/msaa';
import { useDisposeOnRelease } from '../useDisposeOnRelease';
import { perObject } from '../../utils/perObject';

/** The GL internal format of a target's colour attachment. */
type ColourStorage = THREE.PixelFormatGPU;

/** three's depth renderbuffer format (r187 `WebGLTextures.js` `getInternalDepthFormat`). */
type DepthStorage = 'DEPTH_COMPONENT24' | 'DEPTH24_STENCIL8';

/**
 * The target `create` builds, multisampled at the count the device draws for `mode` on that target's
 * storage. `create` is stable while the target stays valid. The hook owns the target and disposes it.
 */
export function useMultisampledTarget<Target extends THREE.WebGLRenderTarget>(
  mode: number,
  create: () => Target
): Target {
  const gl = useThree((state) => state.gl);
  const target = useMemo(() => {
    const built = create();
    built.samples = deviceSampleCount(gl, mode, colourStorage(built.texture), depthStorage(built));
    return built;
  }, [gl, mode, create]);
  useDisposeOnRelease(target);
  return target;
}

/**
 * Three's `getInternalFormat` for an RGBA texture (r187 `WebGLTextures.js:132`). A target that takes output
 * like the drawing buffer stores an 8-bit sRGB tag linear (`:2172`), so such a target is linear or
 * pins its format, as `CanvasFrame` pins RGBA8.
 */
function colourStorage(texture: THREE.Texture): ColourStorage {
  if (texture.internalFormat !== null) return texture.internalFormat;
  if (texture.type === THREE.FloatType) return 'RGBA32F';
  if (texture.type === THREE.HalfFloatType) return 'RGBA16F';
  if (texture.type !== THREE.UnsignedByteType) {
    throw new Error(`expected an unsigned byte, half float or float target, got texel type ${texture.type}`);
  }
  const isSrgb = THREE.ColorManagement.getTransfer(texture.colorSpace) === THREE.SRGBTransfer;
  return isSrgb ? 'SRGB8_ALPHA8' : 'RGBA8';
}

const depthStorage = (target: THREE.WebGLRenderTarget): DepthStorage =>
  target.stencilBuffer ? 'DEPTH24_STENCIL8' : 'DEPTH_COMPONENT24';

/** Written only by `sharedSampleCounts`, per storage pair. A context's counts hold for its life. */
const sharedCountsOf = perObject<WebGL2RenderingContext, Map<string, readonly number[]>>(() => new Map());

/** 0, one sample per pixel, where the context lists no counts: WebGL 1 has no multisampled target. */
function deviceSampleCount(
  gl: THREE.WebGLRenderer,
  mode: number,
  colour: ColourStorage,
  depth: DepthStorage
): number {
  const requested = msaaSampleCount(mode);
  const context = gl.getContext();
  if (requested === 0 || !('getInternalformatParameter' in context)) return 0;
  return supportedSampleCount(requested, sharedSampleCounts(context, colour, depth));
}

/** The counts colour and depth both support, as Godot keeps (`rendering_device_driver_vulkan.cpp:1999`). */
function sharedSampleCounts(
  context: WebGL2RenderingContext,
  colour: ColourStorage,
  depth: DepthStorage
): readonly number[] {
  const perStorage = sharedCountsOf(context);
  const key = `${colour} ${depth}`;
  const cached = perStorage.get(key);
  if (cached) return cached;
  const formatOf = (storage: string) => (context as unknown as Record<string, GLenum>)[storage]!;
  const depthCounts = renderbufferSampleCounts(context, formatOf(depth));
  const shared = renderbufferSampleCounts(context, formatOf(colour)).filter((count) =>
    depthCounts.includes(count)
  );
  // A lost context lists no counts, and would keep MSAA off after the browser restores it.
  if (!context.isContextLost()) perStorage.set(key, shared);
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
