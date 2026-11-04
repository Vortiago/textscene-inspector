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
import {
  AnimatedValueProvider,
  animatedValueKey,
  useAnimatedValueRegistry,
  type AnimatedValueRegistry,
} from '../../../r3f/contexts/AnimatedValueContext';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext';
import { buildSceneGraph, tscnSceneToParsedScene } from '../../../core/SceneGraph';

/** The light cookie the SubViewport lighting tests seed. */
export const COOKIE = 'res://light.png';

/** A fake loader holding a 64 by 64 cookie at `COOKIE`, which happy-dom cannot decode. */
export function cookieLoader() {
  const fake = createFakeResourceLoader();
  const texture = new THREE.Texture();
  (texture as unknown as { image: object }).image = { width: 64, height: 64 };
  fake.textures.seed(COOKIE, texture);
  return fake.loader;
}

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
  /** Whether the renderer cleared the colour of its target at the start of this draw. */
  clearsColor: boolean;
  /** The colour the renderer cleared or painted the background with, as sRGB hex. */
  clearColor: string;
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

/** Writes the animated value registry into `captured`. */
function CaptureAnimatedValues({ captured }: { captured: { current: AnimatedValueRegistry | null } }) {
  captured.current = useAnimatedValueRegistry();
  return null;
}

/** Pushes `visible` to the node at `path`, as an AnimationPlayer track does. */
export function driveVisible(registry: AnimatedValueRegistry, path: string, isVisible: boolean): void {
  registry.set(animatedValueKey(path, 'visible'), [isVisible ? 1 : 0]);
}

/** What a test does to the scene between frames. */
export interface FrameControls {
  animated: AnimatedValueRegistry;
  /** Mounts the nodes of `tscn` over the ones mounted, as an edit to the scene does. */
  replaceScene(tscn: string): Promise<void>;
}

/**
 * The scenes each of `frames` frames of `tscn` draws, in order, each with the target bound at that
 * moment. `beforeFrame` runs before each frame.
 */
export async function framesOf(
  tscn: string,
  frames: number,
  beforeFrame: (frame: number, controls: FrameControls) => void | Promise<void> = () => {}
): Promise<PassDraw[][]> {
  const fake = createFakeResourceLoader();
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const animated: { current: AnimatedValueRegistry | null } = { current: null };
  const parsedFirst = new TscnParser().parse(tscn);
  const sceneGraph = buildSceneGraph(
    tscnSceneToParsedScene(
      'res://test.tscn',
      parsedFirst.nodes,
      parsedFirst.externalResources,
      parsedFirst.internalResources
    )
  );
  const treeOf = (source: string) => {
    const parsed = new TscnParser().parse(source);
    return (
      <HierarchyProvider value={{ sceneGraph, panelId: 'test' }}>
        <AnimatedValueProvider>
          <CaptureAnimatedValues captured={animated} />
          <SceneStack workspace="2d" loader={fake.loader} scene={parsed}>
            <ViewportModeProvider initialShowPreviewEnvironment={false}>
              <ViewportPassStack captured={captured}>
                <CanvasWorldScope>
                  <NodeDispatcher nodes={parsed.nodes} />
                </CanvasWorldScope>
              </ViewportPassStack>
            </ViewportModeProvider>
          </SceneStack>
        </AnimatedValueProvider>
      </HierarchyProvider>
    );
  };
  const renderer = await ReactThreeTestRenderer.create(treeOf(tscn));
  const controls: FrameControls = {
    get animated() {
      return animated.current!;
    },
    replaceScene: async (source) => {
      await ReactThreeTestRenderer.act(async () => renderer.update(treeOf(source)));
      await settleLoads();
    },
  };
  await settleLoads();
  const perFrame: PassDraw[][] = [];
  for (let frame = 0; frame < frames; frame++) {
    const draws: PassDraw[] = [];
    await ReactThreeTestRenderer.act(async () => beforeFrame(frame, controls));
    await withStubbedGl(
      captured.current!,
      {
        onRender: (bound, scene, camera) =>
          draws.push({
            scene,
            camera,
            bound,
            background: (scene as THREE.Scene).background,
            clearsColor: captured.current!.autoClearColor,
            clearColor: captured.current!.getClearColor(new THREE.Color()).getHexString(),
            reached: meshesReached(scene, camera),
          }),
      },
      () => renderer.advanceFrames(1, 16)
    );
    perFrame.push(draws);
  }
  return perFrame;
}

/** The scenes one frame of `tscn` draws, in order, each with the target bound at that moment. */
export async function drawsOf(tscn: string): Promise<PassDraw[]> {
  return (await framesOf(tscn, 1))[0]!;
}
