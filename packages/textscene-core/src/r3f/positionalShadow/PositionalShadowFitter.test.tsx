/**
 * The fitter as the hosts mount it: inside `<TscnSceneContents>`, fitting each omni and spot light
 * before every render. The test renderer draws nothing, so `renderThrough` plays the part of
 * `WebGLRenderer.render`, which calls `scene.onBeforeRender` first.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { PositionalShadowFitter } from './PositionalShadowFitter';
import { positionalShadowUserData } from './declaration';
import { renderWithShadowAtlas, ViewportShadowAtlas } from './viewportShadowAtlas';
import { ROOT_POSITIONAL_SHADOW_ATLAS } from '../../godot/positionalShadowAtlas';
import { TscnSceneContents } from '../TscnCanvas';
import { EDITOR_CAMERA_FOV, editorCameraPosition } from '../godotEditorCamera';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import { TscnParser } from '../../parser/TscnParser';

import '../nodes/index';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

async function renderScene(sceneText: string): Promise<Renderer> {
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(sceneText));
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <SelectionProvider>
        <ViewportModeProvider initialShowPreviewSun={false} initialShowPreviewEnvironment={false}>
          <TscnSceneContents />
        </ViewportModeProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

/** What `WebGLRenderer.render` does before its shadow pass: matrices, then the scene hook. */
function renderThrough(renderer: Renderer, camera: THREE.Camera): void {
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
}

/** Godot's editor view of a scene: the fixed orbit round the origin. */
function editorCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(EDITOR_CAMERA_FOV, 955 / 756, 0.05, 4000);
  camera.position.set(...editorCameraPosition());
  camera.lookAt(0, 0, 0);
  return camera;
}

/**
 * `count` spot lights in a row along +x, each 3 units over a cube and shining down. A range of 100
 * makes every light's slot request the largest slot from the editor view.
 */
function spotRow(count: number): string {
  const lights = Array.from(
    { length: count },
    (_, i) => `
[node name="Light${i}" type="SpotLight3D" parent="."]
transform = Transform3D(-1, 0, 0, 0, 0, 1, 0, 1, 0, ${i * 4}, 3, 0)
spot_range = 100.0
spot_angle = 25.0
shadow_enabled = true
`
  );
  return `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n${lights.join('')}`;
}

function spotLights(renderer: Renderer): THREE.SpotLight[] {
  return renderer.scene.findAllByType('SpotLight').map((node) => node.instance as THREE.SpotLight);
}

describe('<PositionalShadowFitter> in the scene contents', () => {
  it('gives the lights first in the tree the smaller slots once the 1024 slots run out', async () => {
    // Measured in Godot 4.6.3: of nine or ten such lights, the first in the file draws the
    // softer shadow of a 512 slot, and the second of nine keeps 1024.
    const renderer = await renderScene(spotRow(10));
    renderThrough(renderer, editorCamera());
    expect(spotLights(renderer).map((light) => light.shadow.mapSize.x)).toEqual([
      512, 512, 1024, 1024, 1024, 1024, 1024, 1024, 1024, 1024,
    ]);
  });

  it('gives every light the largest slot while the atlas has room (edge case)', async () => {
    const renderer = await renderScene(spotRow(8));
    renderThrough(renderer, editorCamera());
    expect(spotLights(renderer).every((light) => light.shadow.mapSize.x === 1024)).toBe(true);
  });

  it('stops fitting once unmounted (error case)', async () => {
    const renderer = await renderScene(spotRow(1));
    const scene = renderer.scene.instance as THREE.Scene;
    await renderer.unmount();
    expect(scene.onBeforeRender).toBe(THREE.Object3D.prototype.onBeforeRender);
  });
});

/** A casting spot light that declares its shadow, at the origin and shining down -z. */
function declaredSpot(): THREE.SpotLight {
  const light = new THREE.SpotLight(0xffffff, 1, 8, Math.PI / 4);
  light.castShadow = true;
  light.userData = positionalShadowUserData({ normalBias: 1, softShadowScale: 2 });
  light.target.position.set(0, 0, -1);
  return light;
}

/** Looks down -z from `depth` in front of the origin, with a square 90-degree view. */
function cameraAt(depth: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(90, 1, 0.05, 1000);
  camera.position.set(0, 0, depth);
  return camera;
}

describe('<PositionalShadowFitter> on its own', () => {
  async function mountWithLight(): Promise<{ renderer: Renderer; light: THREE.SpotLight }> {
    const light = declaredSpot();
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <primitive object={light} />
        <primitive object={light.target} />
        <PositionalShadowFitter />
      </>
    );
    return { renderer, light };
  }

  it('fits a render outside any SubViewport pass in the root viewport’s atlas', async () => {
    const { renderer, light } = await mountWithLight();
    renderThrough(renderer, cameraAt(5));
    expect(light.shadow.mapSize.x).toBe(ROOT_POSITIONAL_SHADOW_ATLAS.size / 4);
  });

  it('fits a SubViewport pass in that viewport’s own atlas, and keeps each viewport’s map', async () => {
    const { renderer, light } = await mountWithLight();
    const subViewport = new ViewportShadowAtlas({ size: 2048, quadrantShadows: [4, 4, 16, 64] });
    renderThrough(renderer, cameraAt(5));
    const rootMap = new THREE.WebGLRenderTarget(1024, 1024);
    light.shadow.map = rootMap;
    renderWithShadowAtlas(subViewport, () => renderThrough(renderer, cameraAt(5)));
    expect(light.shadow.mapSize.x).toBe(512);
    expect(light.shadow.map).toBeNull();
    light.shadow.map = new THREE.WebGLRenderTarget(512, 512);
    renderThrough(renderer, cameraAt(5));
    // The steady scene reallocates nothing: the main view finds its own map again.
    expect(light.shadow.map).toBe(rootMap);
    expect(light.shadow.mapSize.x).toBe(1024);
  });

  it('fits nothing for a light that declared nothing (edge case)', async () => {
    const { renderer, light } = await mountWithLight();
    light.userData = {};
    light.shadow.mapSize.set(64, 64);
    renderThrough(renderer, cameraAt(5));
    expect(light.shadow.mapSize.x).toBe(64);
  });
});
