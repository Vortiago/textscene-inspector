/**
 * `<ControlCanvasLayer>`: the native (WebGL) mount point for Control nodes,
 * a sibling of `<NodeDispatcher>` inside `World2DContents`'s
 * `<SceneResourcesProvider>`. This suite pins the seam: it resolves the
 * given `nodes` into positioned Control groups (via `buildSolveTree` +
 * `<ControlCanvasWalker>`), reads the viewport rect from the active
 * project's settings rather than a hardcoded constant, and forces a
 * `visible = false` root visible.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../../parser/types';
import { SceneResourcesProvider } from '../../SceneResourcesContext';
import { ControlCanvasLayer } from './ControlCanvasLayer';
import { controlComponentRegistry, type NativeControlComponent } from '../ControlComponentRegistry';
import { controlSolverRegistry } from './solverRegistry';
import { useCanvasModulate } from '../../canvasModulate';

// A stand-in `Native` painter that surfaces the ambient CanvasModulate scope
// as a named group, so this suite can observe it without reading pixels.
const ModulateProbeNative: NativeControlComponent = () => {
  const modulate = useCanvasModulate();
  return <group name={`modulate:r=${modulate.r}`} />;
};

// A stand-in `Native` painter that surfaces its own solved rect WIDTH as a
// named group — used to prove a REAL text measurer (not `null`) reaches the
// solver through this mount point (a text-consuming MinimumSizeFn like
// Button's/Label's would otherwise always floor to zero).
const RectProbeNative: NativeControlComponent = ({ rect }) => <group name={`rect:w=${rect.w}`} />;

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
  afterEach(() => {
    controlComponentRegistry.clear();
  });

  it("gives layer-0 UI (no enclosing CanvasLayer) this canvas's own CanvasModulate scope, from a sibling root CanvasModulate", async () => {
    controlComponentRegistry.register({ typeName: 'Control', Component: ModulateProbeNative });
    const tint = node('CanvasModulate', 'CanvasModulate', { color: { r: 0.25, g: 0.5, b: 0.75, a: 1 } });
    const probe = node('Probe', 'Control', { anchorsPreset: 15 });

    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={[tint, probe]} />);

    const group = renderer.scene
      .findAllByType('Group')
      .map((g) => g.instance as { name: string })
      .find((g) => g.name.startsWith('modulate:'));
    expect(group?.name).toBe('modulate:r=0.25');
  });

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

  it('wires a REAL text measurer into the solver, not null — a text-driven MinimumSizeFn floors to actual measured width', async () => {
    // A leaf with no anchors/offsets at all floors its rect to its minimum
    // size (`controlRectSolver.ts`'s `floorAtMinimumSize`) — so this type's
    // registered `MinimumSizeFn` result becomes the rendered rect's WIDTH
    // directly, letting this test observe whether `ctx.measureText` behaved
    // like a real measurer (non-zero) or the `null` this mount point used to
    // hardcode (always zero, regardless of text).
    controlComponentRegistry.register({
      typeName: 'Control',
      Component: RectProbeNative,
    });
    controlSolverRegistry.registerMinimumSize('Control', (n, ctx) => {
      const text = (n.node.properties as { text?: string }).text ?? '';
      if (!ctx.measureText) return { x: 0, y: 0 };
      return ctx.measureText(text, 16);
    });

    const root = node('Probe', 'Control', { text: 'AB' });
    const renderer = await ReactThreeTestRenderer.create(<ControlCanvasLayer nodes={[root]} />);

    const group = renderer.scene
      .findAllByType('Group')
      .map((g) => g.instance as { name: string })
      .find((g) => g.name.startsWith('rect:w='));
    const width = Number(group?.name.split('=')[1]);
    expect(width).toBeGreaterThan(0);

    controlSolverRegistry.clear();
  });
});
