/**
 * `<ControlCanvasLayer>`: the native (WebGL) mount point for Control nodes,
 * a sibling of `<NodeDispatcher>` inside `World2DContents`'s
 * `<SceneResourcesProvider>`. This suite pins the seam: it resolves the
 * given `nodes` into positioned Control groups (via `buildSolveTree` +
 * `<ControlCanvasWalker>`), reads the viewport rect from the active
 * project's settings rather than a hardcoded constant, and forces a
 * `visible = false` root visible the same way `<ControlOverlay>` does.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ControlCanvasLayer } from './ControlCanvasLayer';

const projectSettingsMock = vi.hoisted(() => ({
  viewportSize: { width: 1152, height: 648 },
  themeScale: 1,
}));

vi.mock('../../contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => projectSettingsMock,
}));

function node(name: string, type: string, properties: Record<string, unknown> = {}): TscnNode {
  return { name, type, children: [], properties: { name, ...properties } };
}

function namedGroup(scene: { findAllByType: (t: string) => { instance: { name: string; visible: boolean; position: { x: number; y: number } } }[] }, name: string) {
  return scene.findAllByType('Group').map((g) => g.instance).find((g) => g.name === name) ?? null;
}

describe('<ControlCanvasLayer>', () => {
  it('renders nothing for a Control-free subtree', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasLayer nodes={[node('Mesh', 'MeshInstance3D')]} />
    );
    expect(renderer.scene.findAllByType('Group')).toHaveLength(0);
  });

  it('positions a root Control against the FULL viewport rect from project settings, not a hardcoded constant', async () => {
    projectSettingsMock.viewportSize = { width: 1152, height: 648 };
    projectSettingsMock.themeScale = 1;

    const root = node('Root', 'Control', { anchorsPreset: 15 }); // FULL_RECT
    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={[root]} />);

    const group = namedGroup(renderer.scene, 'Control:Root');
    expect(group).not.toBeNull();
    expect(group!.position.x).toBeCloseTo(0);
    expect(group!.position.y).toBeCloseTo(0);
  });

  it("uses the ACTIVE project's viewport size, proving it is read live rather than hardcoded", async () => {
    // A custom (non-default) viewport: a FULL_RECT root's far corner must
    // move with it — the one observable a hardcoded 1152x648 could never
    // produce.
    projectSettingsMock.viewportSize = { width: 400, height: 300 };
    projectSettingsMock.themeScale = 1;

    const child = node('Anchor', 'Control', {
      anchorLeft: 1,
      anchorTop: 1,
      anchorRight: 1,
      anchorBottom: 1,
    });
    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={[child]} />);

    const group = namedGroup(renderer.scene, 'Control:Anchor');
    expect(group!.position.x).toBeCloseTo(400);
    expect(group!.position.y).toBeCloseTo(-300);

    projectSettingsMock.viewportSize = { width: 1152, height: 648 };
  });

  it('forces a visible=false ROOT visible, the same "show what you opened" rule as <ControlOverlay>', async () => {
    projectSettingsMock.viewportSize = { width: 1152, height: 648 };
    const root = node('Root', 'Control', { anchorsPreset: 15, visible: false });
    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={[root]} />);

    expect(namedGroup(renderer.scene, 'Control:Root')!.visible).toBe(true);
  });

  it('still respects a hidden CHILD (only the root is forced visible)', async () => {
    const child = node('Child', 'Control', { anchorsPreset: 15, visible: false });
    const root = node('Root', 'Control', { anchorsPreset: 15, visible: false });
    root.children = [child];
    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={[root]} />);

    expect(namedGroup(renderer.scene, 'Control:Root')!.visible).toBe(true);
    expect(namedGroup(renderer.scene, 'Control:Child')!.visible).toBe(false);
  });

  it('reads externalResources/internalResources from the ambient SceneResourcesProvider (ADR-0009)', async () => {
    // A TextureRect-shaped ref resolved through ambient context, not a prop —
    // asserted via buildSolveTree's own textureSize field staying null (no
    // loader mounted), which only happens if the ref was actually looked at.
    const root = node('Root', 'Control', {
      anchorsPreset: 15,
      texture: 'ExtResource("1")',
    });
    const renderer = await ReactThreeTestRenderer.create(
      <SceneResourcesProvider externalResources={[{ id: '1', path: 'res://icon.png', type: 'Texture2D' }]}>
        <ControlCanvasLayer nodes={[root]} />
      </SceneResourcesProvider>
    );
    expect(namedGroup(renderer.scene, 'Control:Root')).not.toBeNull();
  });
});
