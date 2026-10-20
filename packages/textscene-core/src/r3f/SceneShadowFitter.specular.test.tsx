/**
 * The light pass's specular amounts as the hosts mount it: inside `<TscnSceneContents>`, written
 * for each omni, spot and directional light before every render. `renderThrough` plays the part of
 * `WebGLRenderer.render`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import { TscnParser } from '../parser/TscnParser';
import { LIGHT_SPECULARS, installLightSpecularUniforms } from './lightSpecular/lightSpecular';
import { litUniformArray } from './testing/litUniformArray';

import './nodes/index';

type Renderer = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

async function renderScene(lights: string): Promise<Renderer> {
  const sceneText = `[gd_scene format=3]

[node name="Root" type="Node3D"]
${lights}`;
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

/** The first `count` amounts the lit materials read after one render. */
function amountsAfterRender(renderer: Renderer, count: number): number[] {
  const scene = renderer.scene.instance as THREE.Scene;
  const camera = new THREE.PerspectiveCamera();
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
  installLightSpecularUniforms();
  return [...litUniformArray(LIGHT_SPECULARS).subarray(0, count)];
}

describe('the light pass specular amounts', () => {
  it("writes twice an omni light's light_specular, as Godot's light buffer holds it", async () => {
    const renderer = await renderScene(`[node name="Omni" type="OmniLight3D" parent="."]
light_specular = 0.25
`);
    expect(amountsAfterRender(renderer, 1)).toEqual([0.5]);
  });

  it("writes a directional light's light_specular as it is", async () => {
    const renderer = await renderScene(`[node name="Sun" type="DirectionalLight3D" parent="."]
light_specular = 0.25
`);
    expect(amountsAfterRender(renderer, 1)).toEqual([0.25]);
  });

  it("gives a shadowed directional light's sun the light's amount (edge case)", async () => {
    const renderer = await renderScene(`[node name="Sun" type="DirectionalLight3D" parent="."]
shadow_enabled = true
light_specular = 0.25
`);
    expect(amountsAfterRender(renderer, 1)).toEqual([0.25]);
    let suns = 0;
    renderer.scene.instance.traverse((object) => {
      if ((object as { isSunLight?: boolean }).isSunLight) suns += 1;
    });
    expect(suns).toBe(1);
  });
});
