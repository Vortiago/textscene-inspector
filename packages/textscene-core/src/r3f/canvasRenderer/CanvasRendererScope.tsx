import { useEffect, type ReactNode } from 'react';
import { useThree } from '@react-three/fiber';
import { installShadowPass } from '../shadowPass.js';
import { SharedTextureRelease } from '../sharedTexture.js';
import { FrameProfiler } from '../frameProfile/FrameProfiler.js';
import { SoftwareRenderingProbe } from '../softwareRendering/SoftwareRenderingProbe.js';
import { TiledUploadDriver } from '../tiledUpload/TiledUploadDriver.js';
import { ViewportPassOrchestrator } from '../contexts/ViewportPassRegistryContext.js';

// In the contents, as the test renderer mounts no `<Canvas>`.
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
      </TiledUploadDriver>
    </>
  );
}
