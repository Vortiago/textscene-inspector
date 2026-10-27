/**
 * The light pass's soft shadow defines as the hosts mount it: inside `<TscnSceneContents>`, set on
 * each lit material before every render.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from './TscnCanvas';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { SelectionProvider } from './contexts/SelectionContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { isNodeIcon } from './editorHelpers';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph.testkit';
import { TscnParser } from '../parser/TscnParser';
import { DIRECTIONAL_SOFT_SHADOWS, LIGHT_SOFT_SHADOWS } from './shadowFilter/softShadowSearch';
import { fireSceneRender } from './testing/fireSceneRender';

import './nodes/index';

/** The defines of the box's material after one render of the box beside `lights`. */
async function definesAfterRender(lights: string): Promise<Record<string, unknown>> {
  const sceneText = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="Box"]

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("Box")
${lights}`;
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(sceneText));
  const renderer = await ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <SelectionProvider>
        <ViewportModeProvider initialShowPreviewSun={false} initialShowPreviewEnvironment={false}>
          <TscnSceneContents />
        </ViewportModeProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
  const scene = renderer.scene.instance as THREE.Scene;
  const camera = new THREE.PerspectiveCamera();
  scene.updateMatrixWorld();
  camera.updateMatrixWorld();
  fireSceneRender(scene, camera);
  const [box] = renderer.scene
    .findAllByType('Mesh')
    .map((mesh) => mesh.instance as THREE.Mesh)
    .filter((mesh) => !isNodeIcon(mesh));
  const defines = (box!.material as THREE.Material & { defines?: Record<string, unknown> }).defines ?? {};
  await renderer.unmount();
  return defines;
}

describe('the light pass soft shadow defines', () => {
  it('compiles the positional search for an omni light with a size and a shadow', async () => {
    const defines = await definesAfterRender(`[node name="Omni" type="OmniLight3D" parent="."]
shadow_enabled = true
light_size = 0.5
`);
    expect(defines).toHaveProperty(LIGHT_SOFT_SHADOWS);
    expect(defines).not.toHaveProperty(DIRECTIONAL_SOFT_SHADOWS);
  });

  it('compiles the directional search for a sun with an angular distance and a shadow', async () => {
    const defines = await definesAfterRender(`[node name="Sun" type="DirectionalLight3D" parent="."]
shadow_enabled = true
light_angular_distance = 2.0
`);
    expect(defines).toHaveProperty(DIRECTIONAL_SOFT_SHADOWS);
    expect(defines).not.toHaveProperty(LIGHT_SOFT_SHADOWS);
  });

  it('compiles no search for lights without a size, which saves two texture units (edge case)', async () => {
    const defines = await definesAfterRender(`[node name="Omni" type="OmniLight3D" parent="."]
shadow_enabled = true

[node name="Sun" type="DirectionalLight3D" parent="."]
shadow_enabled = true
`);
    expect(defines).not.toHaveProperty(LIGHT_SOFT_SHADOWS);
    expect(defines).not.toHaveProperty(DIRECTIONAL_SOFT_SHADOWS);
  });
});
