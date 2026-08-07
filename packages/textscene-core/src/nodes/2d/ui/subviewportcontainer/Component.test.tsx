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
import { SubViewportContainer } from './Component';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

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
          solveNode={containerSolveNode({}, {}, [bar])}
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
