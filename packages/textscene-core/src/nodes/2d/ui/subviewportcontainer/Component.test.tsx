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
  return { path: 'Booth', node: containerNode, children: [], styleBoxes: {}, textureSize: null };
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
