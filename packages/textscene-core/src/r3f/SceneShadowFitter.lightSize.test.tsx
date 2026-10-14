/**
 * The light pass's light sizes as the hosts mount it: inside `<TscnSceneContents>`, written for each
 * light before every render.
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
import { LIGHT_SIZES, installLightSizeUniforms } from './lightSize/lightSize';
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

/** The first `count` sizes the lit materials read after one render. */
function sizesAfterRender(renderer: Renderer, count: number): number[] {
  const scene = renderer.scene.instance as THREE.Scene;
  const camera = new THREE.PerspectiveCamera();
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  const beforeRender = scene.onBeforeRender as (...args: unknown[]) => void;
  beforeRender.call(scene, null, scene, camera, null);
  installLightSizeUniforms();
  return [...litUniformArray(LIGHT_SIZES).subarray(0, count)];
}

describe('the light pass light sizes', () => {
  it("writes an omni light's light_size", async () => {
    const renderer = await renderScene(`[node name="Omni" type="OmniLight3D" parent="."]
light_size = 0.5
`);
    expect(sizesAfterRender(renderer, 1)).toEqual([0.5]);
  });

  it("writes a spot light's light_size", async () => {
    const renderer = await renderScene(`[node name="Spot" type="SpotLight3D" parent="."]
light_size = 0.25
`);
    expect(sizesAfterRender(renderer, 1)).toEqual([0.25]);
  });

  it('writes zero for a light without light_size (edge case)', async () => {
    const renderer = await renderScene(`[node name="Omni" type="OmniLight3D" parent="."]
`);
    expect(sizesAfterRender(renderer, 1)).toEqual([0]);
  });

  it("writes a shadowed directional light's angular distance as Godot's size", async () => {
    const renderer = await renderScene(`[node name="Sun" type="DirectionalLight3D" parent="."]
shadow_enabled = true
light_angular_distance = 5.0
`);
    const [size] = sizesAfterRender(renderer, 1);
    expect(size).toBeCloseTo(1 - Math.cos((5 * Math.PI) / 180), 7);
  });

  it('writes zero for a directional light whose shadow is off, as no soft shadow is drawn (edge case)', async () => {
    const renderer = await renderScene(`[node name="Sun" type="DirectionalLight3D" parent="."]
light_angular_distance = 5.0
`);
    expect(sizesAfterRender(renderer, 1)).toEqual([0]);
  });
});
