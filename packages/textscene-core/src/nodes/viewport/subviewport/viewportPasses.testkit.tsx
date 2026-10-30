/** The providers a SubViewport's offscreen pass runs under in a test, with the renderer captured. */
import type { ReactNode } from 'react';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import { CanvasWorldScope } from '../../../r3f/environment/WorldEnvironmentScope';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { settleLoads } from '../../../r3f/testing/settleLoads';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
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

/** One `gl.render` of a frame, with what was bound and what the scene held at that moment. */
export interface PassDraw {
  scene: THREE.Object3D;
  camera: THREE.Camera;
  bound: THREE.WebGLRenderTarget | null;
  /** The scene's background when the draw ran, which the pass sets and restores around it. */
  background: THREE.Scene['background'];
  /** The names of the objects above each mesh this draw reaches: visible, and on the camera's layers. */
  reached: string[];
}

function meshesReached(scene: THREE.Object3D, camera: THREE.Camera): string[] {
  const names = new Set<string>();
  const visit = (object: THREE.Object3D, path: string[]): void => {
    if (!object.visible) return;
    const here = [...path, object.name];
    if (object instanceof THREE.Mesh && object.layers.test(camera.layers)) here.forEach((n) => names.add(n));
    object.children.forEach((child) => visit(child, here));
  };
  visit(scene, []);
  return [...names];
}

/** The scenes one frame of `tscn` draws, in order, each with the target bound at that moment. */
export async function drawsOf(tscn: string): Promise<PassDraw[]> {
  const parsed = new TscnParser().parse(tscn);
  const fake = createFakeResourceLoader();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
      <ViewportModeProvider initialShowPreviewEnvironment={false}>
        <ViewportPassStack captured={captured}>
          <CanvasWorldScope>
            <NodeDispatcher nodes={parsed.nodes} />
          </CanvasWorldScope>
        </ViewportPassStack>
      </ViewportModeProvider>
    </SceneStack>
  );
  await settleLoads();
  const draws: PassDraw[] = [];
  await withStubbedGl(
    captured.current!,
    {
      onRender: (bound, scene, camera) =>
        draws.push({
          scene,
          camera,
          bound,
          background: (scene as THREE.Scene).background,
          reached: meshesReached(scene, camera),
        }),
    },
    () => renderer.advanceFrames(1, 16)
  );
  return draws;
}
