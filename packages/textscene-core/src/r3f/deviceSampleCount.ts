/**
 * The samples this renderer's device draws for a viewport's MSAA count. Godot keeps the counts both
 * the colour and the depth attachments support (`rendering_device_driver_vulkan.cpp:1999`), and so
 * does this, from the counts WebGL 2 lists for the colour storage and DEPTH_COMPONENT24.
 */

import { useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { supportedSampleCount } from '../godot/rendering/msaa';

/**
 * The colour storage of a multisampled target: RGBA8 for an 8-bit linear target, SRGB8_ALPHA8 for an
 * 8-bit target under an sRGB tag, RGBA16F for the compositor's half-float scene buffer. A device can
 * list different counts for each.
 */
export type ColourStorage = 'RGBA8' | 'SRGB8_ALPHA8' | 'RGBA16F';

/**
 * The counts colour and depth share, per context and colour storage. Written only by
 * `sharedSampleCounts`. A context lists the same counts for its life, and the entry goes with the
 * context.
 */
const sharedCounts = new WeakMap<WebGL2RenderingContext, Map<ColourStorage, readonly number[]>>();

/**
 * The samples the canvas's renderer draws for `requested`: 0, one sample per pixel, where the
 * context lists no counts, since WebGL 1 has no multisampled target.
 */
export function useDeviceSampleCount(requested: number, storage: ColourStorage = 'RGBA8'): number {
  const gl = useThree((state) => state.gl);
  return useMemo(() => {
    const context = gl.getContext();
    if (requested === 0 || !('getInternalformatParameter' in context)) return 0;
    return supportedSampleCount(requested, sharedSampleCounts(context, storage));
  }, [gl, requested, storage]);
}

function sharedSampleCounts(context: WebGL2RenderingContext, storage: ColourStorage): readonly number[] {
  const perStorage = sharedCounts.get(context) ?? new Map<ColourStorage, readonly number[]>();
  const cached = perStorage.get(storage);
  if (cached) return cached;
  const depthCounts = renderbufferSampleCounts(context, context.DEPTH_COMPONENT24);
  const shared = renderbufferSampleCounts(context, context[storage]).filter((count) =>
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
