/**
 * `<SubViewportContainer>` — the native (WebGL canvas) painter for
 * `SubViewportContainer` (Godot-parity table in
 * `../../viewport/subviewport/comparison.md`). Samples the published
 * `ViewportTextureEntry.texture` directly — every sub-viewport kind (3D,
 * 2D-world, and the native Control-raster pass) publishes a WebGL texture,
 * so there is exactly one consumption path.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { useEffect, type ReactNode } from 'react';
import * as THREE from 'three';

const warnCalls: unknown[][] = [];
vi.mock('../../../../logger.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../logger.js')>();
  return {
    ...actual,
    warn: (...args: unknown[]) => {
      warnCalls.push(args);
    },
  };
});

// `gui/common/snap_controls_to_pixels` is the ROOT window's setting; this
// painter's Controls live in a SubViewport, which never receives it.
const projectSettingsMock = vi.hoisted(() => ({
  settings: null as Record<string, string> | null,
  viewportSize: { width: 1152, height: 648 },
  themeScale: 1,
}));

vi.mock('../../../../r3f/contexts/ProjectSettingsContext', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../r3f/contexts/ProjectSettingsContext')>();
  return { ...actual, useProjectSettings: () => projectSettingsMock };
});

import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  ViewportTextureProvider,
  useRegisterViewportTexture,
  type ViewportTextureEntry,
} from '../../../../r3f/contexts/ViewportTextureContext';
import {
  ViewportPassProvider,
  useRegisterViewportPass,
} from '../../../../r3f/contexts/ViewportPassRegistryContext';
import {
  ViewportRectProvider,
  useViewportRect,
  type ViewportRect,
} from '../../../../r3f/contexts/ViewportRectContext';
import { SubViewportContainer } from './Component';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
// Side-effect: the Control painters and the node registrations
// `viewportContentKind` classifies against.
import '../../../../r3f/controls/index';
import '../../../../r3f/nodes/index';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

function containerSolveNode(
  containerProps: object,
  viewportProps: object = {},
  viewportChildren: TscnNode[] = []
): SolveNode {
  const containerNode = node('Booth', 'SubViewportContainer', containerProps, [
    node('View', 'SubViewport', { size: { x: 200, y: 150 }, transparent_bg: false, ...viewportProps }, viewportChildren),
  ]);
  return { ...solveNode(), path: 'Booth', node: containerNode };
}

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 150 };

/** Publishes a texture entry at `path` for the lifetime of this component. */
function Publisher({ path, entry }: { path: string; entry: ViewportTextureEntry }) {
  const register = useRegisterViewportTexture();
  useEffect(() => register(path, entry), [register, path, entry]);
  return null;
}

/** Registers a raw pass (no real render work) so a cycle can be manufactured directly. */
function PassRegistrar({ path, dependsOn }: { path: string; dependsOn: string[] }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, { dependsOn, render: () => {} }), [register, path, dependsOn]);
  return null;
}

function fakeEntry(): ViewportTextureEntry {
  return { texture: new THREE.Texture(), size: { x: 200, y: 150 } };
}

async function mount(children: ReactNode) {
  return ReactThreeTestRenderer.create(<ViewportTextureProvider>{children}</ViewportTextureProvider>);
}

describe('<SubViewportContainer>', () => {
  it('samples the published ViewportTextureRegistry texture directly on a textured quad', async () => {
    const entry = fakeEntry();
    const renderer = await mount(
      <>
        <Publisher path="Booth/View" entry={entry} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({})}
          rect={RECT}
          renderOrder={0}
        />
      </>
    );
    const mesh = renderer.scene
      .findAll(() => true)
      .map((n) => n.instance as THREE.Mesh)
      .find((m) => (m.material as THREE.MeshBasicMaterial | undefined)?.map === entry.texture);
    expect(mesh).toBeDefined();
  });

  it('renders nothing extra for a nested SubViewport with no published entry yet', async () => {
    const renderer = await mount(
      <SubViewportContainer
        {...painterEnv()}
        solveNode={containerSolveNode({})}
        rect={RECT}
        renderOrder={0}
      />
    );
    const textured = renderer.scene
      .findAll(() => true)
      .map((n) => n.instance as THREE.Mesh)
      .filter((m) => (m.material as THREE.MeshBasicMaterial | undefined)?.map instanceof THREE.Texture);
    expect(textured).toHaveLength(0);
  });

  /**
   * `scene/main/viewport.h` initialises `snap_controls_to_pixels` to `true` on
   * every Viewport, and `main/main.cpp` hands the project setting to
   * `sml->get_root()` alone — so a project that opts out leaves a
   * SubViewport's own Controls snapped.
   *
   * Measured through Godot 4.6.3 on
   * `scenes/fixtures/subviewport-snap-off/unit-subviewport-snap-off.tscn`
   * (root window reporting `is_snap_controls_to_pixels_enabled() == false`,
   * its SubViewport reporting `true`): a four-deep chain of 0.5 offsets draws
   * its leaf at (102, 62) in the root window and at (104, 64) inside the
   * sub-viewport.
   */
  it('snaps its sub-viewport’s own Controls even when the project opts out', async () => {
    projectSettingsMock.settings = { 'gui/common/snap_controls_to_pixels': 'false' };
    try {
      // MIXED, so this container's LIVE arm is the one under test — a
      // Control-only viewport is drawn by `ControlRasterPass`, whose own suite
      // asserts the same rule for that route.
      const mesh = node('Mesh', 'MeshInstance3D', {});
      const bar = node('Bar', 'ColorRect', {
        anchorLeft: 0,
        anchorTop: 0,
        anchorRight: 0,
        anchorBottom: 0,
        offsetLeft: 100.5,
        offsetTop: 60.5,
        offsetRight: 140.5,
        offsetBottom: 100.5,
      });
      const renderer = await mount(
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({}, {}, [mesh, bar])}
          rect={RECT}
          renderOrder={0}
        />
      );
      const group = renderer.scene
        .findAll(() => true)
        .map((n) => n.instance as THREE.Object3D)
        .find((o) => o.name === 'ColorRect:Bar');

      expect(group?.position.x).toBeCloseTo(101);
      expect(group?.position.y).toBeCloseTo(-61);
    } finally {
      projectSettingsMock.settings = null;
    }
  });

  describe('a cyclic pass', () => {
    /**
     * A registry state where "Booth/View" and "Other" depend on each other.
     * "Other" registers FIRST so `orderViewportPasses`' DFS (which visits in
     * registration order) reports "Booth/View" — the pass this test cares
     * about — as the offending sampler; see `passOrder.ts`'s own tests for
     * why registration order decides which of a cycle's two nodes that is.
     */
    function CyclicRegistration() {
      return (
        <>
          <PassRegistrar path="Other" dependsOn={['Booth/View']} />
          <PassRegistrar path="Booth/View" dependsOn={['Other']} />
        </>
      );
    }

    it('renders the fallback surface instead of sampling the (unusable) texture', async () => {
      const entry = fakeEntry();
      const renderer = await ReactThreeTestRenderer.create(
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <CyclicRegistration />
            <Publisher path="Booth/View" entry={entry} />
            <SubViewportContainer
              {...painterEnv()}
              solveNode={containerSolveNode({})}
              rect={RECT}
              renderOrder={0}
            />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );
      const textured = renderer.scene
        .findAll(() => true)
        .map((n) => n.instance as THREE.Mesh)
        .filter((m) => (m.material as THREE.MeshBasicMaterial | undefined)?.map === entry.texture);
      expect(textured).toHaveLength(0);
      const outlines = renderer.scene.findAllByType('LineSegments');
      expect(outlines.length).toBeGreaterThan(0);
    });

    it('logs a warning naming the node path', async () => {
      warnCalls.length = 0;
      await ReactThreeTestRenderer.create(
        <ViewportTextureProvider>
          <ViewportPassProvider>
            <CyclicRegistration />
            <SubViewportContainer
              {...painterEnv()}
              solveNode={containerSolveNode({})}
              rect={RECT}
              renderOrder={0}
            />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );
      const matched = warnCalls.filter((args) => String(args[0]).includes('Booth/View'));
      expect(matched.length).toBeGreaterThan(0);
    });
  });
});

/**
 * A sub-viewport's Controls reach the canvas by exactly ONE route.
 *
 * `viewportContentKind` (`viewport/subviewport/viewportContent.ts`) already
 * decides which rasterizer owns a target: a Control-only (`'dom'`) viewport is
 * drawn by `ControlRasterPass` into the texture this quad samples, so drawing
 * the same subtree live alongside it composites it twice — and only the quad
 * copy carries the container's `self_modulate`. The live arm exists for a MIXED
 * viewport, whose offscreen pass renders the non-Control half alone.
 */
describe('<SubViewportContainer> — one route per sub-viewport', () => {
  /** Every named group the walk emitted, so a live-drawn Control is visible by name. */
  function groupNames(renderer: Awaited<ReturnType<typeof mount>>): string[] {
    return renderer.scene
      .findAll(() => true)
      .map((n) => (n.instance as THREE.Object3D).name)
      .filter((name) => name.length > 0);
  }

  it('does not ALSO draw a Control-only sub-viewport live — the raster texture is the whole picture', async () => {
    const renderer = await mount(
      <>
        <Publisher path="Booth/View" entry={fakeEntry()} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({}, {}, [node('Backdrop', 'ColorRect', {})])}
          rect={RECT}
          renderOrder={0}
        />
      </>
    );
    expect(groupNames(renderer).filter((n) => n.includes('Backdrop'))).toEqual([]);
  });

  it('still draws a MIXED viewport’s Controls live, over the pass that rendered its 3D half', async () => {
    const renderer = await mount(
      <>
        <Publisher path="Booth/View" entry={fakeEntry()} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({}, {}, [
            node('Mesh', 'MeshInstance3D', {}),
            node('Backdrop', 'ColorRect', {}),
          ])}
          rect={RECT}
          renderOrder={0}
        />
      </>
    );
    expect(groupNames(renderer).filter((n) => n.includes('Backdrop')).length).toBeGreaterThan(0);
  });
});

/**
 * `SubViewportContainer::recalc_force_viewport_sizes` (`:94`) hands
 * `get_size() / shrink` to `set_size_force`, which takes a `Size2i` — and
 * `Vector2::operator Vector2i` (`core/math/vector2.cpp:213`) truncates. A
 * container 200 px wide at shrink 3 forces 66, not the 67 a round would give.
 */
describe('<SubViewportContainer> — the forced sub-viewport size truncates', () => {
  function RectProbe({ path, onRect }: { path: string; onRect: (r: ViewportRect | null) => void }) {
    const rect = useViewportRect(path);
    useEffect(() => onRect(rect), [rect, onRect]);
    return null;
  }

  it('truncates `get_size() / shrink` rather than rounding it', async () => {
    let seen: ViewportRect | null = null;
    await mount(
      <ViewportRectProvider>
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({ stretch: true, stretch_shrink: 3 })}
          rect={{ x: 0, y: 0, w: 200, h: 150 }}
          renderOrder={0}
        />
        <RectProbe path="Booth/View" onRect={(r) => { seen = r; }} />
      </ViewportRectProvider>
    );
    // 200/3 = 66.67 -> 66; 150/3 = 50 exactly.
    expect(seen).toEqual({ x: 66, y: 50 });
  });
});
