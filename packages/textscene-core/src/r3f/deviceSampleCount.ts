/**
 * The samples this renderer's device draws for a viewport's MSAA count. Godot keeps the counts both
 * the colour and the depth attachments support (`rendering_device_driver_vulkan.cpp:1999`), and so
 * does this, from the counts WebGL 2 lists for RGBA8 and DEPTH_COMPONENT24.
 */

import type * as THREE from 'three';
import { supportedSampleCount } from '../godot/rendering/msaa';

/** 0, one sample per pixel, where the context lists no counts: WebGL 1 has no multisampled target. */
export function deviceSampleCount(gl: THREE.WebGLRenderer, requested: number): number {
  const context = gl.getContext();
  if (requested === 0 || !('getInternalformatParameter' in context)) return 0;
  const depthCounts = renderbufferSampleCounts(context, context.DEPTH_COMPONENT24);
  const shared = renderbufferSampleCounts(context, context.RGBA8).filter((count) =>
    depthCounts.includes(count)
  );
  return supportedSampleCount(requested, shared);
}

function renderbufferSampleCounts(context: WebGL2RenderingContext, format: GLenum): number[] {
  const counts = context.getInternalformatParameter(
    context.RENDERBUFFER,
    format,
    context.SAMPLES
  ) as Int32Array | null;
  return Array.from(counts ?? []);
}
