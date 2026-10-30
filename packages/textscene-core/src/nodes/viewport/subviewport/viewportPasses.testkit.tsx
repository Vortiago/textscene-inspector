/** The providers a SubViewport's offscreen pass runs under in a test, with the renderer captured. */
import type { ReactNode } from 'react';
import type * as THREE from 'three';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';

/** Mounts `children` where a pass publishes and runs, and writes the renderer into `captured`. */
export function ViewportPassStack({
  captured,
  children,
}: {
  captured: { current: THREE.WebGLRenderer | null };
  children: ReactNode;
}) {
  return (
    <ViewportTextureProvider>
      <ViewportPassProvider>
        {children}
        <CaptureRenderer captured={captured} />
        <ViewportPassOrchestrator />
      </ViewportPassProvider>
    </ViewportTextureProvider>
  );
}
