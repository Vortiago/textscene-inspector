/**
 * Gives the views below a scene whose current cameras are fixed, for a test of what a view draws
 * through a current camera apart from how the scene moves it. Test-only: the `testing/` directories
 * under `src` are excluded from the build.
 */
import type { ReactNode } from 'react';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import type { Scene } from '../../scene/openScene';

/** Each viewport's current camera by the viewport's live path, null for the root window. */
export type CurrentCameraPaths = ReadonlyMap<string | null, string>;

const NONE: CurrentCameraPaths = new Map();

function sceneWithCurrentCameras(cameras3D: CurrentCameraPaths, cameras2D: CurrentCameraPaths): Scene {
  const subscribe = () => () => {};
  return {
    subscribe,
    observe: subscribe,
    currentCamera3D: (viewport: string | null) => cameras3D.get(viewport) ?? null,
    currentCamera2D: (viewport: string | null) => cameras2D.get(viewport) ?? null,
  } as Partial<Scene> as Scene;
}

export function CurrentCameras({
  cameras3D = NONE,
  cameras2D = NONE,
  children,
}: {
  cameras3D?: CurrentCameraPaths;
  cameras2D?: CurrentCameraPaths;
  children: ReactNode;
}) {
  const scene = sceneWithCurrentCameras(cameras3D, cameras2D);
  return (
    <HierarchyProvider value={{ sceneGraph: null, panelId: 'current-cameras', scene }}>
      {children}
    </HierarchyProvider>
  );
}
