/**
 * A SubViewport pass draws no editor chrome: no gizmo, no node icon, no selection or hover box and
 * no grid. Godot's editor overlays live in the editor viewport alone, and an icon aligned to the
 * editor camera would draw skewed through the camera of the viewport.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { waitFor } from '@testing-library/react';
import { TscnParser } from '../../../parser/TscnParser';
import { NodeDispatcher } from '../../../r3f/NodeDispatcher';
import {
  ViewportPassOrchestrator,
  ViewportPassProvider,
} from '../../../r3f/contexts/ViewportPassRegistryContext';
import { ViewportTextureProvider } from '../../../r3f/contexts/ViewportTextureContext';
import { isEditorHelper, isNodeIcon } from '../../../r3f/editorHelpers';
import { CaptureRenderer } from '../../../r3f/testing/CaptureRenderer';
import { SceneStack } from '../../../r3f/testing/SceneStack';
import { InWorld } from '../../../r3f/testing/InWorld';
import { withStubbedGl } from '../../../r3f/testing/stubbedGl';
import { createFakeResourceLoader } from '../../../resources/testing/createFakeResourceLoader';
import { TscnSceneContents } from '../../../r3f/TscnCanvas';
import { HierarchyProvider } from '../../../r3f/contexts/HierarchyContext';
import { SelectionProvider } from '../../../r3f/contexts/SelectionContext';
import { ViewportModeProvider } from '../../../r3f/contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../../../core/SceneGraph.testkit';
import { HoverSeeder } from '../../../r3f/testing/HoverSeeder';
import { SelectSeeder } from '../../../r3f/testing/SelectSeeder';

import '../../../r3f/nodes/index';

const SCENE = `[gd_scene format=3]

[node name="Root" type="Node3D"]

[node name="Viewport" type="SubViewport" parent="."]
own_world_3d = true

[node name="Camera3D" type="Camera3D" parent="Viewport"]

[node name="Light" type="OmniLight3D" parent="Viewport"]
`;

interface PassSnapshot {
  chromeCount: number;
  visibleChromeCount: number;
  visibleIconCount: number;
}

/** What each render call of the test renderer sees of the editor chrome in the scene it draws. */
async function renderedChrome(): Promise<PassSnapshot[]> {
  const parsed = new TscnParser().parse(SCENE);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <SceneStack loader={createFakeResourceLoader().loader} scene={parsed} workspace="3d" showGizmos>
      <ViewportTextureProvider>
        <ViewportPassProvider>
          <InWorld>
            <NodeDispatcher nodes={parsed.nodes} />
          </InWorld>
          <CaptureRenderer captured={captured} />
          <ViewportPassOrchestrator />
        </ViewportPassProvider>
      </ViewportTextureProvider>
    </SceneStack>
  );
  const passes: PassSnapshot[] = [];
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (_, renderedScene) => {
          const chrome: THREE.Object3D[] = [];
          renderedScene.traverse((object) => isEditorHelper(object) && chrome.push(object));
          const visible: THREE.Object3D[] = [];
          renderedScene.traverseVisible((object) => isEditorHelper(object) && visible.push(object));
          let visibleIconCount = 0;
          renderedScene.traverseVisible((object) => isNodeIcon(object) && visibleIconCount++);
          passes.push({
            chromeCount: chrome.length,
            visibleChromeCount: visible.length,
            visibleIconCount,
          });
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(passes.length).toBeGreaterThan(0);
  });
  return passes;
}

describe('<SubViewport> pass', () => {
  it('draws none of the editor chrome its scene holds', async () => {
    const viewportPasses = (await renderedChrome()).filter((pass) => pass.chromeCount > 0);
    expect(viewportPasses.length).toBeGreaterThan(0);
    expect(viewportPasses.every((pass) => pass.visibleChromeCount === 0 && pass.visibleIconCount === 0)).toBe(
      true
    );
  });
});

/** A shared-world viewport whose pass draws the main scene, with the light and box beside it. */
const SHARED_WORLD_SCENE = `[gd_scene format=3]

[sub_resource type="BoxMesh" id="BoxMesh_1"]

[node name="Root" type="Node3D"]

[node name="Box" type="MeshInstance3D" parent="."]
mesh = SubResource("BoxMesh_1")

[node name="Light" type="OmniLight3D" parent="."]

[node name="Viewport" type="SubViewport" parent="."]

[node name="Camera3D" type="Camera3D" parent="Viewport"]
`;

/** Whether `object` draws only in the editor: chrome, a node icon or the ground grid. */
function isEditorOnly(object: THREE.Object3D): boolean {
  return isEditorHelper(object) || isNodeIcon(object) || object instanceof THREE.GridHelper;
}

/** How many editor-only objects each render of the canvas's whole editor stack leaves visible. */
async function visibleEditorOnlyPerRender(): Promise<number[]> {
  const parsed = new TscnParser().parse(SHARED_WORLD_SCENE);
  const graph = createSceneGraphFromTscnScene(parsed);
  const captured: { current: THREE.WebGLRenderer | null } = { current: null };
  const renderer = await ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <ViewportModeProvider initialShowGizmos initialShowGrid>
        <SelectionProvider>
          <SelectSeeder path="Light" />
          <HoverSeeder path="Box" />
          <ViewportTextureProvider>
            <ViewportPassProvider>
              <TscnSceneContents />
              <CaptureRenderer captured={captured} />
            </ViewportPassProvider>
          </ViewportTextureProvider>
        </SelectionProvider>
      </ViewportModeProvider>
    </HierarchyProvider>
  );
  const counts: number[] = [];
  await waitFor(async () => {
    await withStubbedGl(
      captured.current!,
      {
        onRender: (bound, renderedScene) => {
          if (bound?.texture.name !== 'Viewport::world') return;
          let visible = 0;
          renderedScene.traverseVisible((object) => isEditorOnly(object) && visible++);
          counts.push(visible);
        },
      },
      () => renderer.advanceFrames(1, 16)
    );
    expect(counts.length).toBeGreaterThan(0);
  });
  return counts;
}

describe('<SubViewport> pass in a shared world', () => {
  it('draws none of the editor chrome the main scene holds', async () => {
    expect(Math.max(...(await visibleEditorOnlyPerRender()))).toBe(0);
  });
});
