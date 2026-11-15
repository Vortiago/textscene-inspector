/** What every canvas's renderer runs beside the drawing, mounted by the contents of each canvas. */

import { useEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { installShadowPass } from '../shadowPass.js';
import { SharedTextureRelease } from '../sharedTexture.js';
import { FrameProfiler } from '../frameProfile/FrameProfiler.js';
import { SoftwareRenderingProbe } from '../softwareRendering/SoftwareRenderingProbe.js';
import { TiledUploadDriver } from '../tiledUpload/TiledUploadDriver.js';
import { ViewportPassOrchestrator } from '../contexts/ViewportPassRegistryContext.js';
import { ScreenshotBridge } from '../ScreenshotBridge.js';

/**
 * In the contents, not the canvas file, since `@react-three/test-renderer` mounts the contents with no
 * `<Canvas>`. The screenshot bridge mounts after `children`, so its effect runs after theirs have
 * asked for their resources.
 */
export function CanvasRendererScope({ children }: { children: ReactNode }) {
  const renderer = useThree((state) => state.gl);
  useEffect(() => installShadowPass(renderer), [renderer]);
  return (
    <>
      <SharedTextureRelease />
      <FrameProfiler />
      <SoftwareRenderingProbe />
      <TiledUploadDriver>
        {children}
        <ViewportPassOrchestrator />
        <ScreenshotBridge />
      </TiledUploadDriver>
    </>
  );
}
