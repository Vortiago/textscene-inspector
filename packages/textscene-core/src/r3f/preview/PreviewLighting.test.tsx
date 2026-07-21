/**
 * The preview lighting yields to the scene, per node type, independently.
 *
 * Scenes are built through the real parser so the node shapes are the ones the
 * dispatcher actually renders, and the whole `<TscnSceneContents>` tree is
 * mounted rather than `<PreviewLighting>` alone — the question this answers is
 * "how many lights does this scene end up with", which is exactly what a
 * double-lighting bug gets wrong.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { TscnSceneContents } from '../TscnCanvas';
import { HierarchyProvider } from '../contexts/HierarchyContext';
import { SelectionProvider } from '../contexts/SelectionContext';
import { ViewportModeProvider } from '../contexts/ViewportModeContext';
import { createSceneGraphFromTscnScene } from '../../core/SceneGraph';
import { TscnParser } from '../../parser/TscnParser';

import '../nodes/index';

async function render(sceneText: string, viewport?: { sun?: boolean; environment?: boolean }) {
  const graph = createSceneGraphFromTscnScene(new TscnParser().parse(sceneText));
  return ReactThreeTestRenderer.create(
    <HierarchyProvider value={{ sceneGraph: graph, panelId: 'p' }}>
      <SelectionProvider>
        <ViewportModeProvider
          initialShowPreviewSun={viewport?.sun ?? true}
          initialShowPreviewEnvironment={viewport?.environment ?? true}
        >
          <TscnSceneContents />
        </ViewportModeProvider>
      </SelectionProvider>
    </HierarchyProvider>
  );
}

const scene = (body: string) => `[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n${body}`;

const MESH = `
[node name="Cube" type="MeshInstance3D" parent="."]
`;

const DIRECTIONAL = `
[node name="Sun" type="DirectionalLight3D" parent="."]
`;

const OMNI = `
[node name="Lamp" type="OmniLight3D" parent="."]
`;

const directionalCount = (
  renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>
) => renderer.scene.findAllByType('DirectionalLight').length;

describe('preview sun yielding', () => {
  it('lights a scene that brought no light of its own', async () => {
    expect(directionalCount(await render(scene(MESH)))).toBe(1);
  });

  it('steps aside for the scene’s own DirectionalLight3D', async () => {
    // One light, not two: the scene's. Doubling them is the bug this replaced.
    expect(directionalCount(await render(scene(DIRECTIONAL)))).toBe(1);
  });

  it('stays for a scene lit only by an OmniLight3D', async () => {
    // Godot's counter is cast_to<DirectionalLight3D>; an omni does not match,
    // and a scene lit only by a lamp keeps the preview sun.
    expect(directionalCount(await render(scene(OMNI)))).toBe(1);
  });

  it('yields once, however many directional lights the scene has', async () => {
    const renderer = await render(scene(`${DIRECTIONAL}\n[node name="Fill" type="DirectionalLight3D" parent="."]\n`));
    expect(directionalCount(renderer)).toBe(2);
  });

  it('yields to a DirectionalLight3D that is hidden — the counter never reads `visible`', async () => {
    const renderer = await render(
      scene(`
[node name="Sun" type="DirectionalLight3D" parent="."]
visible = false
`)
    );
    expect(directionalCount(renderer)).toBe(1);
  });

  it('goes away when the user turns the preview sun off', async () => {
    expect(directionalCount(await render(scene(MESH), { sun: false }))).toBe(0);
  });
});

describe('preview environment yielding', () => {
  const WORLD_ENV = `
[node name="WorldEnvironment" type="WorldEnvironment" parent="."]
`;

  it('leaves the preview sun alone when the scene brings a WorldEnvironment', async () => {
    // The two previews are independent counters: an environment takes away the
    // sky, never the sun. A single combined rule would leave this scene dark.
    expect(directionalCount(await render(scene(WORLD_ENV)))).toBe(1);
  });

  it('still lights a scene carrying both, with exactly the scene’s own sun', async () => {
    expect(directionalCount(await render(scene(`${DIRECTIONAL}${WORLD_ENV}`)))).toBe(1);
  });

  // Whether the preview ENVIRONMENT mounted is not observable from the scene
  // graph — it applies itself to `scene.background`/`scene.environment` through
  // a GPU render that the headless test renderer cannot run. The decision is
  // covered at its seam in godotPreviewLighting.test.ts, and the pixels by the
  // `preview-lighting` visual golden.
});
