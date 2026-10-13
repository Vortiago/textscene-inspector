/**
 * The light pass's area light uniforms as the hosts mount it: inside `<TscnSceneContents>`, written
 * for each AreaLight3D before every render. `renderThrough` plays the part of `WebGLRenderer.render`.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';
import { TscnParser } from '../parser/TscnParser';
import { AREA_LIGHT_FALLOFFS, installAreaLightUniforms } from './areaLight/areaLightFalloff';
import { litUniformArray } from './testing/litUniformArray';

import './nodes/index';

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

function renderThrough(renderer: Renderer): void {
  const scene = renderer.scene.instance as THREE.Scene;
  const camera = new THREE.PerspectiveCamera();
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
}

function areaLightScene(lights: string): string {
  return `[gd_scene format=3]

[node name="Root" type="Node3D"]
${lights}`;
}

/** The falloffs the lit materials read now. */
function areaLightFalloffs(): Float32Array {
  installAreaLightUniforms();
  return litUniformArray(AREA_LIGHT_FALLOFFS);
}

describe('the light pass for area lights', () => {
  it("writes each area light's range, attenuation and specular amount", async () => {
    const renderer = await renderScene(
      areaLightScene(`
[node name="Area" type="AreaLight3D" parent="."]
area_range = 4.0
area_attenuation = 2.0
light_specular = 0.25
`)
    );
    renderThrough(renderer);
    expect([...areaLightFalloffs().subarray(0, 3)]).toEqual([4, 2, 0.5]);
  });

  it('gives a hidden area light no slot', async () => {
    const renderer = await renderScene(
      areaLightScene(`
[node name="Hidden" type="AreaLight3D" parent="."]
visible = false
area_range = 1.0

[node name="Shown" type="AreaLight3D" parent="."]
area_range = 8.0
`)
    );
    renderThrough(renderer);
    expect(areaLightFalloffs()[0]).toBe(8);
  });
});
