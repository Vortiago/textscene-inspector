/**
 * The samples this renderer's device draws for a viewport's MSAA count. Godot keeps the counts both
 * the colour and the depth attachments support (`rendering_device_driver_vulkan.cpp:1999`), and so
 * does this, from the counts WebGL 2 lists for the colour storage and DEPTH_COMPONENT24.
 */

import { useMemo } from 'react';
import type * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { supportedSampleCount } from '../godot/rendering/msaa';

/**
 * The colour storage of a multisampled target: RGBA8 for an 8-bit target, RGBA16F for the
 * compositor's half-float scene buffer. A device can list fewer counts for one than for the other.
 */
export type ColourStorage = 'RGBA8' | 'RGBA16F';

/**
 * The counts colour and depth share, per context and colour storage. Written only by
 * `sharedSampleCounts`. A context lists the same counts for its life, and the entry goes with the
 * context.
 */
const sharedCounts = new WeakMap<WebGL2RenderingContext, Map<ColourStorage, readonly number[]>>();

/** 0, one sample per pixel, where the context lists no counts: WebGL 1 has no multisampled target. */
function deviceSampleCount(
  gl: THREE.WebGLRenderer,
  requested: number,
  storage: ColourStorage = 'RGBA8'
): number {
  const context = gl.getContext();
  if (requested === 0 || !('getInternalformatParameter' in context)) return 0;
  return supportedSampleCount(requested, sharedSampleCounts(context, storage));
}

/** `deviceSampleCount` for the canvas's own renderer. */
export function useDeviceSampleCount(requested: number, storage: ColourStorage = 'RGBA8'): number {
  const gl = useThree((state) => state.gl);
  return useMemo(() => deviceSampleCount(gl, requested, storage), [gl, requested, storage]);
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
