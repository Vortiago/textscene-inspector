/**
 * The fitter as the hosts mount it: inside `<TscnSceneContents>`, fitting the
 * preview sun and an authored sun before each render. The test renderer draws
 * nothing, so `renderThrough` plays the part of `WebGLRenderer.render`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { DirectionalShadowFitter } from './DirectionalShadowFitter';
import { directionalShadowUserData } from './declaration';
import { TscnSceneContents } from '../TscnCanvas';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import { TscnParser } from '../../parser/TscnParser';

import '../nodes/index';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

const UNFITTED_LEFT = new THREE.DirectionalLight().shadow.camera.left;

async function renderScene(sceneText: string): Promise<Renderer> {
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(sceneText));
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <SelectionProvider>
        <ViewportModeProvider initialShowPreviewSun initialShowPreviewEnvironment={false}>
          <TscnSceneContents />
        </ViewportModeProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

function onlyDirectionalLight(renderer: Renderer): THREE.DirectionalLight {
  return renderer.scene.findByType('DirectionalLight').instance as THREE.DirectionalLight;
}

/** What `WebGLRenderer.render` does before its shadow pass: matrices, then the scene hook. */
function renderThrough(renderer: Renderer, camera: THREE.Camera): void {
  const scene = renderer.scene.instance as THREE.Scene;
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
}

function cameraAt(x: number): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 4000);
  camera.position.set(x, 10, 40);
  camera.lookAt(x, 0, 0);
  return camera;
}

const scene = (body: string) => `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n${body}`;

describe('<DirectionalShadowFitter> in the scene contents', () => {
  it('fits the preview sun before a render', async () => {
    const renderer = await renderScene(scene('\n[node name="Cube" type="MeshInstance3D" parent="."]\n'));
    renderThrough(renderer, cameraAt(0));
    expect(onlyDirectionalLight(renderer).shadow.camera.left).not.toBe(UNFITTED_LEFT);
  });

  it('fits an authored sun wherever its node stands', async () => {
    const renderer = await renderScene(
      scene(`
[node name="Sun" type="DirectionalLight3D" parent="."]
transform = Transform3D(1, 0, 0, 0, 0.5, 0.866025, 0, -0.866025, 0.5, 500, 40, -900)
shadow_enabled = true
directional_shadow_max_distance = 80.0
`)
    );
    renderThrough(renderer, cameraAt(0));
    const light = onlyDirectionalLight(renderer);
    // The box spans the camera's view, not a fixed patch round the node.
    expect(light.shadow.camera.right - light.shadow.camera.left).toBeGreaterThan(80);
  });

  it('leaves a sun without shadows alone (edge case)', async () => {
    const renderer = await renderScene(scene('\n[node name="Sun" type="DirectionalLight3D" parent="."]\n'));
    renderThrough(renderer, cameraAt(0));
    expect(onlyDirectionalLight(renderer).shadow.camera.left).toBe(UNFITTED_LEFT);
  });
});

describe('<DirectionalShadowFitter> on its own', () => {
  async function mountWithLight(): Promise<{ renderer: Renderer; light: THREE.DirectionalLight }> {
    const light = new THREE.DirectionalLight();
    light.castShadow = true;
    light.userData = directionalShadowUserData({ maxDistance: 50, pancakeSize: 20, depthBias: 0, normalBias: 2 });
    const renderer = await ReactThreeTestRenderer.create(
      <>
        <primitive object={light} />
        <DirectionalShadowFitter />
      </>
    );
    return { renderer, light };
  }

  it('fits a declared light it finds in the scene', async () => {
    const { renderer, light } = await mountWithLight();
    renderThrough(renderer, cameraAt(0));
    expect(light.shadow.camera.left).not.toBe(UNFITTED_LEFT);
  });

  it('fits each render to its own camera, in any order', async () => {
    const { renderer, light } = await mountWithLight();
    renderThrough(renderer, cameraAt(0));
    const mainLeft = light.shadow.camera.left;
    renderThrough(renderer, cameraAt(500));
    expect(light.shadow.camera.left).not.toBeCloseTo(mainLeft, 3);
    renderThrough(renderer, cameraAt(0));
    expect(light.shadow.camera.left).toBeCloseTo(mainLeft, 9);
  });

  it('stops fitting once unmounted (edge case)', async () => {
    const { renderer, light } = await mountWithLight();
    const scene = renderer.scene.instance as THREE.Scene;
    await renderer.unmount();
    scene.add(light);
    renderThrough(renderer, cameraAt(0));
    expect(light.shadow.camera.left).toBe(UNFITTED_LEFT);
  });

  it('renders nothing into the scene', async () => {
    const renderer = await ReactThreeTestRenderer.create(<DirectionalShadowFitter />);
    expect(renderer.scene.children).toHaveLength(0);
  });
});
