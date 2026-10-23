/**
 * The per-canvas services every top-level `<Canvas>` mounts once: shared texture release, the
 * frame profile and the software renderer probe.
 */

import { SharedTextureRelease } from './sharedTexture.js';
import { FrameProfiler } from './frameProfile/FrameProfiler.js';
import { SoftwareRenderingProbe } from './softwareRendering/SoftwareRenderingProbe.js';

export function CanvasServices() {
  return (
    <>
      <SharedTextureRelease />
      <FrameProfiler />
      <SoftwareRenderingProbe />
    </>
  );
}
