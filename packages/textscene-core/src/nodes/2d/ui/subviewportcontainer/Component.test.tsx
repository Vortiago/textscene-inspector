/**
 * `<SubViewportContainer>`, the native painter (parity table in
 * `../../viewport/subviewport/comparison.md`). It samples `ViewportTextureEntry.texture` directly:
 * every sub-viewport kind publishes a WebGL texture, so there is one consumption path.
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
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  ViewportTextureProvider,
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
import { createCanvasTarget, createSceneTarget } from '../../../viewport/subviewport/offscreenViewport';
import { quadsSampling } from '../../../../r3f/controls/native/testing/quadsSampling';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';
// Side-effect: the Control painters and the node registrations
// `viewportContentKind` classifies against.
import '../../../../r3f/controls/index';
import '../../../../r3f/nodes/index';
import { ViewportTexturePublisher, viewportEntry } from '../../../../r3f/testing/ViewportTexturePublisher';

function node(name: string, type: string, properties: object, children: TscnNode[] = []): TscnNode {
  return { name, type, children, properties: { name, ...properties } } as TscnNode;
}

function containerSolveNode(
  containerProps: object,
  viewportProps: object = {},
  viewportChildren: TscnNode[] = []
): SolveNode {
  const containerNode = node('Booth', 'SubViewportContainer', containerProps, [
    node(
      'View',
      'SubViewport',
      { size: { x: 200, y: 150 }, transparent_bg: false, ...viewportProps },
      viewportChildren
    ),
  ]);
  return { ...solveNode(), path: 'Booth', node: containerNode };
}

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 150 };

/** Registers a raw pass (no real render work) so a cycle can be manufactured directly. */
function PassRegistrar({ path, dependsOn }: { path: string; dependsOn: string[] }) {
  const register = useRegisterViewportPass();
  useEffect(() => register(path, { dependsOn, render: () => {} }), [register, path, dependsOn]);
  return null;
}

function fakeEntry(): ViewportTextureEntry {
  return viewportEntry(new THREE.Texture(), { x: 200, y: 150 });
}

async function mount(children: ReactNode) {
  return ReactThreeTestRenderer.create(<ViewportTextureProvider>{children}</ViewportTextureProvider>);
}

describe('<SubViewportContainer>', () => {
  it('samples the published ViewportTextureRegistry texture directly on a textured quad', async () => {
    const entry = fakeEntry();
    const renderer = await mount(
      <>
        <ViewportTexturePublisher path="Booth/View" entry={entry} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({})}
          rect={RECT}
          renderOrder={0}
        />
      </>
    );
    const mesh = quadsSampling(renderer.scene, entry.plain.texture)[0];
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
     * A registry where "Booth/View" and "Other" depend on each other. "Other" registers first, so
     * `orderViewportPasses`' DFS, which visits in registration order (`passOrder.ts`'s tests),
     * reports "Booth/View" as the offending sampler.
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
            <ViewportTexturePublisher path="Booth/View" entry={entry} />
            <SubViewportContainer
              {...painterEnv()}
              solveNode={containerSolveNode({})}
              rect={RECT}
              renderOrder={0}
            />
          </ViewportPassProvider>
        </ViewportTextureProvider>
      );
      const textured = quadsSampling(renderer.scene, entry.plain.texture);
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
 * A sub-viewport draws its own Controls into its target (`subviewport_container.cpp:134-144`), so
 * the container draws the quad alone. A live draw would composite them twice, since only the quad
 * carries the container's tint.
 */
describe('<SubViewportContainer> — the surface draws the target only', () => {
  const CONTENT: Record<string, [string, string]> = {
    'Control-only': ['Backdrop', 'ColorRect'],
    '2D': ['Shape', 'Polygon2D'],
    '3D': ['Mesh', 'MeshInstance3D'],
  };

  it.each(Object.keys(CONTENT))('draws no Control of a %s viewport live', async (kind) => {
    const [name, type] = CONTENT[kind]!;
    const renderer = await mount(
      <>
        <ViewportTexturePublisher path="Booth/View" entry={fakeEntry()} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({}, {}, [node(name, type, {}), node('Backdrop', 'ColorRect', {})])}
          rect={RECT}
          renderOrder={0}
        />
      </>
    );
    const names = renderer.scene.findAll(() => true).map((n) => (n.instance as THREE.Object3D).name);
    expect(names.filter((n) => n.includes('Backdrop'))).toEqual([]);
  });
});

/**
 * `SubViewportContainer::recalc_force_viewport_sizes` (`:94`) hands `get_size() / shrink` to
 * `set_size_force`, which takes a `Size2i`, and `Vector2::operator Vector2i`
 * (`core/math/vector2.cpp:213`) truncates: 200 px at shrink 3 forces 66, not 67.
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
        <RectProbe
          path="Booth/View"
          onRect={(r) => {
            seen = r;
          }}
        />
      </ViewportRectProvider>
    );
    // 200/3 = 66.67 -> 66; 150/3 = 50 exactly.
    expect(seen).toEqual({ x: 66, y: 50 });
  });
});

/**
 * With `stretch` on, Godot draws the texture over the container's own rect (`:142`,
 * `draw_texture_rect(..., Rect2(Vector2(), get_size()))`), whatever size the target truncated to.
 * With it off, the texture draws at the viewport's own size (`:144`).
 */
describe('<SubViewportContainer> — the drawn rect', () => {
  /** The world-space extent of the quad that samples `texture`. */
  function drawnSize(renderer: Awaited<ReturnType<typeof mount>>, texture: THREE.Texture) {
    const quad = quadsSampling(renderer.scene, texture)[0];
    quad!.updateWorldMatrix(true, false);
    const size = new THREE.Box3().setFromObject(quad!).getSize(new THREE.Vector3());
    return { x: Math.round(size.x * 1000) / 1000, y: Math.round(size.y * 1000) / 1000 };
  }

  async function mountContainer(
    containerProps: object,
    rect: Rect2,
    entry: ViewportTextureEntry,
    viewportProps: object = {}
  ) {
    return mount(
      <ViewportRectProvider>
        <ViewportTexturePublisher path="Booth/View" entry={entry} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode(containerProps, viewportProps)}
          rect={rect}
          renderOrder={0}
        />
      </ViewportRectProvider>
    );
  }

  it('fills an odd-sized container whose shrink truncates the target', async () => {
    const entry = fakeEntry();
    const renderer = await mountContainer(
      { stretch: true, stretch_shrink: 2 },
      { x: 0, y: 0, w: 301, h: 201 },
      entry
    );
    expect(drawnSize(renderer, entry.plain.texture)).toEqual({ x: 301, y: 201 });
  });

  it('fills a container narrower than the 2-pixel viewport floor', async () => {
    const entry = fakeEntry();
    const renderer = await mountContainer({ stretch: true }, { x: 0, y: 0, w: 1, h: 40 }, entry);
    expect(drawnSize(renderer, entry.plain.texture)).toEqual({ x: 1, y: 40 });
  });

  it('draws past the texture cap at the size Godot gives the viewport', async () => {
    const entry = fakeEntry();
    const renderer = await mountContainer({}, RECT, entry, { size: { x: 20000, y: 150 } });
    expect(drawnSize(renderer, entry.plain.texture)).toEqual({ x: 20000, y: 150 });
  });

  it('lays the surface out at the viewport size, not the capped target, past the cap', async () => {
    const entry = fakeEntry();
    const renderer = await mountContainer({ stretch: true }, { x: 0, y: 0, w: 20000, h: 150 }, entry);
    const quad = quadsSampling(renderer.scene, entry.plain.texture)[0]!;
    expect((quad.geometry as THREE.PlaneGeometry).parameters.width).toBe(20000);
  });

  it('draws at the authored size when the container does not stretch', async () => {
    const entry = fakeEntry();
    const renderer = await mountContainer({}, { x: 0, y: 0, w: 640, h: 480 }, entry);
    expect(drawnSize(renderer, entry.plain.texture)).toEqual({ x: 200, y: 150 });
  });
});

/**
 * The container draws the target's plain view (`subviewport_container.cpp:142,144`), which a canvas
 * filters in sRGB bytes and multiplies by its modulate in sRGB (`texture_storage.cpp:754`).
 */
describe('<SubViewportContainer> — the colour of the surface', () => {
  async function surfaceMaterial(texture: THREE.Texture) {
    const renderer = await mount(
      <>
        <ViewportTexturePublisher path="Booth/View" entry={viewportEntry(texture, { x: 200, y: 150 })} />
        <SubViewportContainer
          {...painterEnv()}
          solveNode={containerSolveNode({})}
          rect={RECT}
          renderOrder={0}
        />
      </>
    );
    return quadsSampling(renderer.scene, texture)[0]!.material as THREE.MeshBasicMaterial;
  }

  it('multiplies a canvas target in sRGB', async () => {
    const target = createCanvasTarget(200, 150, 'View');
    expect((await surfaceMaterial(target.texture)).defines).toEqual({ CANVAS_SRGB_MULTIPLY: '' });
    target.dispose();
  });

  it('keeps the linear multiply for a 3D-content target (edge case)', async () => {
    const target = createSceneTarget(200, 150, 'View');
    expect((await surfaceMaterial(target.texture)).defines?.CANVAS_SRGB_MULTIPLY).toBeUndefined();
    target.dispose();
  });
});
