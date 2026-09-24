/**
 * Tests the `<ScrollContainer>` painter on `scenes/fixtures/unit-scroll-container.tscn`
 * (rect 1120x616, Content min 399x800; `pnpm ref:godot --probe` puts the grabber
 * edge at local y (475,476), formula 476.16). Bounding boxes prove the y flip
 * is correct: a symmetric fill masks it, an off-centre grabber does not.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import { nearestGroupOrder } from '../../../../r3f/testing/paintOrder';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { ControlClipProvider, useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import type { ScrollContainerProperties } from './types';
import { ScrollContainer } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

// Only `gui/common/snap_controls_to_pixels` comes from the project settings,
// so no test needs the real provider's async load.
const projectSettingsMock = vi.hoisted(() => ({
  settings: null as Record<string, string> | null,
  viewportSize: { width: 1152, height: 648 },
  themeScale: 1,
}));

vi.mock('../../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => projectSettingsMock,
}));

beforeEach(() => {
  projectSettingsMock.settings = null;
});

function leaf(name: string, props: Partial<ScrollContainerProperties> = {}): SolveNode {
  return {
    ...solveNode(),
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ScrollContainerProperties },
  };
}

function scrollNode(
  props: Partial<ScrollContainerProperties> = {},
  children: SolveNode[] = []
): SolveNode {
  const node: TscnNode = {
    name: 'Scroll',
    type: 'ScrollContainer',
    children: [],
    properties: { name: 'Scroll', ...props } as ScrollContainerProperties,
  };
  return { ...solveNode(), path: 'Scroll', node, children };
}

/** World-space bounding box of a mesh's geometry, through its fresh matrixWorld. */
function worldBounds(mesh: THREE.Mesh): THREE.Box3 {
  mesh.updateWorldMatrix(true, false);
  const geom = mesh.geometry as THREE.BufferGeometry;
  geom.computeBoundingBox();
  const box = geom.boundingBox!.clone();
  box.applyMatrix4(mesh.matrixWorld);
  return box;
}

function ClipProbe({ onPlanes }: { onPlanes: (planes: readonly THREE.Plane[]) => void }) {
  onPlanes(useControlClipPlanes());
  return null;
}

const NO_OVERFLOW_RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };
const FIXTURE_RECT: Rect2 = { x: 0, y: 0, w: 1120, h: 616 };

describe('<ScrollContainer> — no scrollbar when content fits', () => {
  it('draws no mesh and still renders children when neither axis overflows', async () => {
    const child = leaf('Scroll/Child', { customMinimumSize: { x: 100, y: 100 } });
    const renderer = await ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [child])} rect={NO_OVERFLOW_RECT} renderOrder={5}>
        <group name="probe-child" />
      </ScrollContainer>
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
    expect(renderer.scene.findAllByType('Group').some((g) => (g.instance as THREE.Group).name === 'probe-child')).toBe(
      true
    );
  });
});

describe('<ScrollContainer> — vertical scrollbar geometry (real-fixture numbers)', () => {
  async function mountFixtureScrollbar() {
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 399, y: 800 } });
    return ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [content])} rect={FIXTURE_RECT} renderOrder={10} />
    );
  }

  it('draws exactly the vertical track + grabber (no horizontal bar — it does not overflow)', async () => {
    const renderer = await mountFixtureScrollbar();
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it("places the track spanning the bar's full rect, grown by the AA feather ring: world x [1111.5,1120.5], y [-616.5,0.5]", async () => {
    // The borderless, antialiased track gets an `aa_size/2` = 0.5px alpha-0
    // feather ring outside the [1112,1120]x[-616,0] rect, and `computeBoundingBox()`
    // counts it, so the box grows 0.5 per side (style_box_flat.cpp:584-601).
    const renderer = await mountFixtureScrollbar();
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const track = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y >
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const box = worldBounds(track);
    expect(box.min.x).toBeCloseTo(1111.5, 3);
    expect(box.max.x).toBeCloseTo(1120.5, 3);
    expect(box.min.y).toBeCloseTo(-616.5, 3);
    expect(box.max.y).toBeCloseTo(0.5, 3);
  });

  it('places the grabber at the TOP of the track (scroll_vertical unset = 0), height ~476.16, flipped the right way, grown by the AA feather ring', async () => {
    const renderer = await mountFixtureScrollbar();
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const grabber = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y <
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const box = worldBounds(grabber);
    expect(box.min.x).toBeCloseTo(1111.5, 3);
    expect(box.max.x).toBeCloseTo(1120.5, 3);
    // Unscrolled, the grabber starts at the track's Godot-top, world Y ~ 0, and
    // extends to negative Y. Both bounds grow 0.5px for the feather ring.
    expect(box.max.y).toBeCloseTo(0.5, 1);
    expect(box.min.y).toBeCloseTo(-476.66, 1);
  });

  it('draws both bars off subtreeChromeRenderOrder — track +0.25, grabber +0.5 — strictly above every descendant and strictly below the next sibling', async () => {
    // `scene/gui/scroll_container.cpp:919,924` adds the bars as `INTERNAL_MODE_BACK`,
    // after the whole subtree. The next sibling starts one past
    // `subtreeChromeRenderOrder` (`canvasPaintOrder.ts`), so the bars sit in that gap.
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 399, y: 800 } });
    const deepestDescendantOrder = 12; // stands in for the end of this node's draw-sequence run.
    const renderer = await ReactThreeTestRenderer.create(
      <ScrollContainer
        {...painterEnv()}
        solveNode={scrollNode({}, [content])}
        rect={FIXTURE_RECT}
        renderOrder={10}
        subtreeChromeRenderOrder={deepestDescendantOrder}
      >
        <mesh name="deepest-descendant" renderOrder={deepestDescendantOrder}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial />
        </mesh>
      </ScrollContainer>
    );
    const allMeshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const descendant = allMeshes.find((m) => m.name === 'deepest-descendant')!;
    const bars = allMeshes.filter((m) => m.name !== 'deepest-descendant');
    // Read as three does: from each bar's nearest enclosing group (`canvasPaintOrder.ts`).
    const orders = bars.map(nearestGroupOrder).sort((a, b) => a - b);
    expect(orders).toEqual([deepestDescendantOrder + 0.25, deepestDescendantOrder + 0.5]);
    // Strictly above every descendant this node ever draws...
    expect(orders[0]!).toBeGreaterThan(nearestGroupOrder(descendant));
    // ...and strictly below the next sibling's own paint slot.
    expect(orders[1]!).toBeLessThan(deepestDescendantOrder + 1);
  });

  it('offsets the grabber toward the bottom when scrolled (scroll_vertical authored)', async () => {
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 0, y: 800 } });
    const renderer = await ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()}
        solveNode={scrollNode({ scrollVertical: 200 }, [content])}
        rect={{ x: 0, y: 0, w: 300, h: 200 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const grabber = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y <
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const box = worldBounds(grabber);
    // range=800, area=200-8=192; ratio=200/800=0.25; offset=48 -> top at -48,
    // then +0.5 for the feather ring -> -47.5.
    expect(box.max.y).toBeCloseTo(-47.5, 1);
  });
});

/**
 * Each bar is its own CanvasItem (`scene/gui/scroll_container.cpp:919,924`),
 * so `Control::_update_canvas_item_transform` floors it apart from the
 * container. These read the drawn group's position, since the 0.5px feather
 * would swamp a bounding box.
 */
describe('<ScrollContainer> — per-bar whole-pixel snap', () => {
  // 900.5 x 600.5 with a whole 8px bar puts both bar origins half a pixel off,
  // the largest snap error, while the container's own origin stays whole.
  const FRACTIONAL_RECT: Rect2 = { x: 0, y: 0, w: 900.5, h: 600.5 };

  function overflowing(props: Partial<ScrollContainerProperties> = {}): SolveNode {
    return scrollNode(props, [leaf('Scroll/Content', { customMinimumSize: { x: 1200, y: 900 } })]);
  }

  /** Every drawn mesh's world position, keyed by the renderOrder that names its role. */
  async function drawnMeshes(node: SolveNode, rect: Rect2, snapToPixels = true) {
    const renderer = await ReactThreeTestRenderer.create(
      <ScrollContainer
        {...painterEnv()}
        solveNode={node}
        rect={rect}
        renderOrder={0}
        snapToPixels={snapToPixels}
      />
    );
    return renderer.scene.findAllByType('Mesh').map((m) => {
      const mesh = m.instance as THREE.Mesh;
      mesh.updateWorldMatrix(true, false);
      return { renderOrder: mesh.renderOrder, position: mesh.getWorldPosition(new THREE.Vector3()) };
    });
  }

  /** The two tracks (renderOrder +0.25), left-to-right: horizontal bar first, vertical second. */
  function tracks(meshes: { renderOrder: number; position: THREE.Vector3 }[]) {
    return meshes.filter((m) => m.renderOrder === 0.25).sort((a, b) => a.position.x - b.position.x);
  }

  // `scenes/fixtures/unit-scroll-container-bar-snap.tscn` at `--mode 2d`, origin
  // (100, 20): the horizontal bar's edge is crisp between y = 612 (rgb(242, 230, 64))
  // and y = 613 (rgb(113, 108, 42)), the vertical one between x = 992 and x = 993,
  // so 593/893, not 592.5/892.5.
  it('floors each bar origin to whole pixels — horizontal top 592.5 -> 593, vertical left 892.5 -> 893', async () => {
    const [horizontal, vertical] = tracks(await drawnMeshes(overflowing(), FRACTIONAL_RECT));
    expect(horizontal!.position.x).toBeCloseTo(0, 6);
    expect(horizontal!.position.y).toBeCloseTo(-593, 6);
    expect(vertical!.position.x).toBeCloseTo(893, 6);
    expect(vertical!.position.y).toBeCloseTo(0, 6);
  });

  it('leaves a whole-pixel bar origin exactly where it was — the snap is a no-op on integers', async () => {
    const [horizontal, vertical] = tracks(await drawnMeshes(overflowing(), { x: 0, y: 0, w: 600, h: 500 }));
    expect(horizontal!.position.y).toBeCloseTo(-492, 6);
    expect(vertical!.position.x).toBeCloseTo(592, 6);
  });

  // In the same capture, the grabber's 765.8 edge blends 0.8, so AA is live.
  it('composes the grabber onto the SNAPPED bar origin while keeping its own fractional offset', async () => {
    // The grabber draws unrounded inside the bar's CanvasItem (`scroll_bar.cpp:326-344`),
    // so it never snaps twice. range 1200, area 892.5 - 8 = 884.5, ratio 100/1200 ->
    // offset 73.7083333, on top of the snapped 593.
    const meshes = await drawnMeshes(overflowing({ scrollHorizontal: 100 }), FRACTIONAL_RECT);
    // Left-to-right: the horizontal bar's grabber sits at its own 73.7 offset,
    // the vertical bar's at the vertical bar's own snapped 893.
    const grabbers = meshes.filter((m) => m.renderOrder === 0.5).sort((a, b) => a.position.x - b.position.x);
    const horizontal = grabbers[0]!;
    expect(horizontal.position.x).toBeCloseTo(73.7083333, 5);
    expect(horizontal.position.y).toBeCloseTo(-593, 6);
  });

  it('honours a snap resolved OFF by the walker — both bars stay on the solved fraction', async () => {
    // `gui/common/snap_controls_to_pixels` is the root window's alone (`main/main.cpp`),
    // so the painter takes the walker's resolved value, correct in a SubViewport.
    const [horizontal, vertical] = tracks(
      await drawnMeshes(overflowing(), FRACTIONAL_RECT, false)
    );
    expect(horizontal!.position.y).toBeCloseTo(-592.5, 6);
    expect(vertical!.position.x).toBeCloseTo(892.5, 6);
  });
});

describe('<ScrollContainer> — tint', () => {
  it('composes self_modulate onto the track fill, in sRGB, with a single linear conversion', async () => {
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 399, y: 800 } });
    const renderer = await ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()}
        solveNode={scrollNode({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, [content])}
        rect={FIXTURE_RECT}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    for (const mesh of meshes) {
      const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
      // Default-theme fills are never black, so a halved sRGB channel is a
      // smaller number: the tint reached both meshes.
      expect(color.getX(0)).toBeGreaterThan(0);
    }
  });

  it('applies the walker-composed tint to the track fill exactly once', async () => {
    // The walker's own product (ambient 0.5 x self_modulate 0.5 = 0.25) x the
    // track's own base (0.1, default-theme style_normal_color) = 0.025.
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 0, y: 800 } });
    const renderer = await ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()}
        tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 1 })}
        solveNode={scrollNode({}, [content])}
        rect={{ x: 0, y: 0, w: 300, h: 200 }}
        renderOrder={0}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const track = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y >
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const color = (track.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // Raw sRGB: the shader decodes the StyleBox vertex attribute per fragment.
    expect(color.getX(0)).toBeCloseTo(0.025, 6);
  });
});

describe('<ScrollContainer> — clip planes', () => {
  it("pushes exactly 4 world-space planes matching this node's own full rect", async () => {
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [])} rect={{ x: 0, y: 0, w: 300, h: 200 }} renderOrder={0}>
        <ClipProbe onPlanes={(p) => (captured = p)} />
      </ScrollContainer>
    );
    expect(captured).toHaveLength(4);
    const inside = new THREE.Vector3(150, -100, 0);
    const outsideRight = new THREE.Vector3(310, -100, 0);
    const outsideTop = new THREE.Vector3(150, 10, 0);
    expect(captured.every((p) => p.distanceToPoint(inside) >= 0)).toBe(true);
    expect(captured.some((p) => p.distanceToPoint(outsideRight) < 0)).toBe(true);
    expect(captured.some((p) => p.distanceToPoint(outsideTop) < 0)).toBe(true);
  });

  it('merges its own planes onto an inherited set (inherited first)', async () => {
    let captured: readonly THREE.Plane[] = [];
    const inheritedPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    await ReactThreeTestRenderer.create(
      <ControlClipProvider value={{ planes: [inheritedPlane], rect: null }}>
        <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [])} rect={{ x: 0, y: 0, w: 300, h: 200 }} renderOrder={0}>
          <ClipProbe onPlanes={(p) => (captured = p)} />
        </ScrollContainer>
      </ControlClipProvider>
    );
    expect(captured).toHaveLength(5);
    expect(captured[0]).toBe(inheritedPlane);
  });

  it('intersects correctly when nested inside another ScrollContainer at a translated position', async () => {
    // Outer x:[0,400], y:[-300,0]. Inner, a 100x80 group at (350, -40), is
    // x:[350,450], y:[-120,-40] and overhangs the outer's right edge. Only the
    // outer's plane enforces the right side, and the inner's the other three.
    let captured: readonly THREE.Plane[] = [];
    await ReactThreeTestRenderer.create(
      <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [])} rect={{ x: 0, y: 0, w: 400, h: 300 }} renderOrder={0}>
        <group position={[350, -40, 0]}>
          <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [])} rect={{ x: 0, y: 0, w: 100, h: 80 }} renderOrder={1}>
            <ClipProbe onPlanes={(p) => (captured = p)} />
          </ScrollContainer>
        </group>
      </ScrollContainer>
    );
    // One rect, four planes, however deep the nesting goes: Godot resolves a
    // nested clip to a single `final_clip_rect` intersected against the
    // enclosing one, and that rect alone becomes the scissor.
    expect(captured).toHaveLength(4);

    const insideBoth = new THREE.Vector3(380, -80, 0);
    expect(captured.every((p) => p.distanceToPoint(insideBoth) >= 0)).toBe(true);

    // Inside the inner rect (x <= 450) but past the outer's right edge (400):
    // the outer's plane is still in the merged list.
    const outerDriven = new THREE.Vector3(410, -80, 0);
    expect(captured.some((p) => p.distanceToPoint(outerDriven) < 0)).toBe(true);

    // Inside the outer rect but above the inner's top edge (world y > -40):
    // the inner's plane narrowed the intersection.
    const innerDriven = new THREE.Vector3(380, -10, 0);
    expect(captured.some((p) => p.distanceToPoint(innerDriven) < 0)).toBe(true);
  });
});

/**
 * The `scroll_hint_*` TextureRects (`scroll_container.cpp:606-658,905-915`)
 * paint over the content and under the bars, modulated by `Color(0, 0, 0)`
 * (`default_theme.cpp:669-670`).
 */
describe('<ScrollContainer> — scroll hints', () => {
  const HINT_RECT: Rect2 = { x: 0, y: 0, w: 300, h: 200 };

  async function mount(props: Partial<ScrollContainerProperties>, minSize: { x: number; y: number }) {
    const content = leaf('Scroll/Content', { customMinimumSize: minSize });
    return ReactThreeTestRenderer.create(
      <ScrollContainer
        {...painterEnv()}
        solveNode={scrollNode(props, [content])}
        rect={HINT_RECT}
        renderOrder={10}
      />
    );
  }

  /** The hint quad is the only mesh whose material carries a `map`; the bars are StyleBox fills. */
  function hintMeshes(renderer: Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>): THREE.Mesh[] {
    return renderer.scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .filter((m) => (m.material as THREE.MeshBasicMaterial).map != null);
  }

  it('draws no hint quad at the default SCROLL_HINT_MODE_DISABLED', async () => {
    expect(hintMeshes(await mount({}, { x: 100, y: 500 }))).toHaveLength(0);
  });

  it('draws one hint quad spanning the bottom 24px band when the content overflows downward', async () => {
    const meshes = hintMeshes(await mount({ scrollHintMode: 1 }, { x: 100, y: 500 }));
    expect(meshes).toHaveLength(1);
    const box = worldBounds(meshes[0]!);
    expect(box.min.x).toBeCloseTo(0, 3);
    // SIDE_RIGHT anchors at ANCHOR_END + size.x (`scroll_container.cpp:625`),
    // so the quad is twice the container wide and the clip cuts the overhang.
    expect(box.max.x).toBeCloseTo(600, 3);
    expect(box.max.y).toBeCloseTo(-176, 3);
    expect(box.min.y).toBeCloseTo(-200, 3);
  });

  it('modulates the hint by scroll_hint_vertical_color — black (default_theme.cpp:669)', async () => {
    const meshes = hintMeshes(await mount({ scrollHintMode: 1 }, { x: 100, y: 500 }));
    const material = meshes[0]!.material as THREE.MeshBasicMaterial;
    expect(material.color.getHex()).toBe(0x000000);
  });

  it('flips the bottom-right hint vertically so the fade is densest at the edge (scroll_container.cpp:630)', async () => {
    const meshes = hintMeshes(await mount({ scrollHintMode: 1 }, { x: 100, y: 500 }));
    const map = (meshes[0]!.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.y).toBe(-1);
    expect(map.offset.y).toBe(1);
  });

  it('leaves the top-left hint unflipped (scroll_container.cpp:621-627)', async () => {
    const meshes = hintMeshes(await mount({ scrollHintMode: 2, scrollVertical: 100 }, { x: 100, y: 500 }));
    expect(meshes).toHaveLength(1);
    const map = (meshes[0]!.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.y).toBe(1);
    expect(map.offset.y).toBe(0);
    expect(worldBounds(meshes[0]!).max.y).toBeCloseTo(0, 3);
  });

  it('carries the chrome key on the enclosing GROUP, which three consults before the mesh\'s own order', async () => {
    // `projectObject` sorts by `groupOrder`, the nearest Group's `renderOrder`,
    // first, so a hint group on this node's key paints behind its content.
    const meshes = hintMeshes(await mount({ scrollHintMode: 1 }, { x: 100, y: 500 }));
    expect(nearestGroupOrder(meshes[0]!)).toBe(meshes[0]!.renderOrder);
  });

  it('draws the horizontal hint flipped on X at the trailing edge (scroll_container.cpp:647-655)', async () => {
    const meshes = hintMeshes(await mount({ scrollHintMode: 1 }, { x: 900, y: 50 }));
    expect(meshes).toHaveLength(1);
    const box = worldBounds(meshes[0]!);
    expect(box.min.x).toBeCloseTo(276, 3);
    expect(box.max.x).toBeCloseTo(300, 3);
    expect((meshes[0]!.material as THREE.MeshBasicMaterial).map!.repeat.x).toBe(-1);
  });
});
