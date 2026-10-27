/**
 * A SubViewport pass draws no editor gizmo and no node icon. Godot's gizmos live in the editor
 * viewport alone, and an icon aligned to the editor camera would draw skewed through the camera of
 * the viewport.
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
