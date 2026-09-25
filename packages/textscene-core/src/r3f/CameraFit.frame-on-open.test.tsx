/**
 * Framing on load is opt-in: Godot's editor opens every scene at a fixed orbit
 * (`Node3DEditorViewport::Cursor`) and leaves framing to F. It is also cheaper, since
 * the fixed distance leaves most of a large scene outside the frustum.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { CameraFit } from './TscnCanvas';
import { HierarchyProvider } from './contexts/HierarchyContext';
import { ViewportModeProvider } from './contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../core/SceneGraph';
import { TscnParser } from '../parser/TscnParser';
import * as frameSceneBoundsModule from './frameSceneBounds';

async function mount(frameOnOpen: boolean) {
  const graph = createSceneGraphFromTscnScene(
    new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n[node name="Cube" type="MeshInstance3D" parent="."]\n'
    )
  );
  const spy = vi.spyOn(frameSceneBoundsModule, 'frameSceneBounds').mockImplementation(() => {});
  vi.useFakeTimers();
  await ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <ViewportModeProvider initialFrameOnOpen={frameOnOpen}>
        <CameraFit />
      </ViewportModeProvider>
    </HierarchyProvider>
  );
  vi.advanceTimersByTime(2000);
  vi.useRealTimers();
  return spy;
}

describe('CameraFit', () => {
  it('leaves the camera where Godot would leave it by default', async () => {
    const spy = await mount(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('frames the scene once the user asks for it', async () => {
    const spy = await mount(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
