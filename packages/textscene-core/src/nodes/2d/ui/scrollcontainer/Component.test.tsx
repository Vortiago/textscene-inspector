/**
 * `<ScrollContainer>` render contract. Geometry expectations mirror
 * `nativeSolver.test.ts`'s own header: the vertical-bar scenario is
 * `scenes/fixtures/unit-scroll-container.tscn`'s real numbers (own rect
 * 1120x616, Content min 399x800), cross-checked against
 * `pnpm ref:godot --probe` pixels (grabber/track boundary at local y in
 * (475,476), matching the formula's 476.16).
 *
 * Bounding boxes (not a specific vertex index) are asserted throughout: this
 * painter wraps `StyleBoxQuad`'s zero-origin geometry in a `scale={[1,-1,1]}`
 * group (see `Component.tsx`'s own doc for why an un-flipped
 * `styleBoxFlatGeometry` renders upside down around its own origin — masked
 * for a symmetric flat fill like `Panel`'s, but not for an off-centre
 * grabber), so a bounding-box check is what actually proves the flip is
 * correct rather than merely present.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { ControlClipProvider, useControlClipPlanes } from '../../../../r3f/controls/native/controlClipping';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import type { ScrollContainerProperties } from './types';
import { ScrollContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode } from '../../../../r3f/controls/native/testing/solveNode';

// This painter reads `gui/common/snap_controls_to_pixels` off the project
// settings, exactly as `ControlCanvasWalker` does for a Control's own group;
// nothing else here needs the real provider's async load.
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

/** World-space bounding box of a mesh's geometry, via its (fresh) matrixWorld. */
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
    // ScrollBar's track/grabber styleboxes are `flatStyleBox`'d with a
    // rounded corner (`scrollBarCornerRadius`, `nativeTheme.ts`) and NO
    // border, so `anti_aliased`'s default-true `aa_on` branch applies
    // (`styleBoxFlatGeometry.ts`'s anti-aliasing describe block): with no
    // border on any side, the whole fill gets a `aa_size/2` = 0.5px
    // transparent feather ring OUTSIDE the base [1112,1120]x[-616,0] rect —
    // `computeBoundingBox()` includes those alpha-0 vertices, so the box
    // grows by 0.5 on every side (style_box_flat.cpp:584-601).
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
    // Godot-top of the track is world Y ~ 0; the grabber sits there when
    // unscrolled, extending DOWN (negative) by its own size — the flip this
    // painter applies is what makes this the top edge and not the bottom.
    // Both bounds grow 0.5px outward for the same AA feather-ring reason the
    // track's own bounding box does (see the test above).
    expect(box.max.y).toBeCloseTo(0.5, 1);
    expect(box.min.y).toBeCloseTo(-476.66, 1);
  });

  it('draws both bars off subtreeChromeRenderOrder — track +0.25, grabber +0.5 — strictly above every descendant and strictly below the next sibling', async () => {
    // `scene/gui/scroll_container.cpp:919,924` adds `h_scroll`/`v_scroll` via
    // `INTERNAL_MODE_BACK`, which paints them AFTER the whole subtree, not at
    // this node's own paint slot. `subtreeChromeRenderOrder` is
    // `bandBase(layer) + subtreeLastPaintIndex` — the LAST descendant's own
    // renderOrder — and the next sibling gets exactly one past it
    // (`controlRectSolver.ts`'s `assignPaintIndex`), so the fractional
    // offsets below must land strictly inside that one-wide gap.
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 399, y: 800 } });
    const deepestDescendantOrder = 12; // stands in for subtreeLastPaintIndex's own renderOrder.
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
    const orders = bars.map((m) => m.renderOrder).sort((a, b) => a - b);
    expect(orders).toEqual([deepestDescendantOrder + 0.25, deepestDescendantOrder + 0.5]);
    // Strictly above every descendant this node ever draws...
    expect(orders[0]!).toBeGreaterThan(descendant.renderOrder);
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
    // then +0.5 for the AA feather ring's outward growth (see the two tests
    // above) -> -47.5.
    expect(box.max.y).toBeCloseTo(-47.5, 1);
  });
});

/**
 * Godot's `h_scroll`/`v_scroll` are real HScrollBar/VScrollBar Controls added
 * as `INTERNAL_MODE_BACK` children (`scene/gui/scroll_container.cpp:919,924`),
 * so each is its OWN CanvasItem and `Control::_update_canvas_item_transform`
 * floors each one's translation independently of the container's.
 *
 * These assert the DRAWN group's world position rather than a bounding box:
 * the styleboxes' anti-aliasing feather grows every box by 0.5px outward (see
 * the two track/grabber tests above), which is the same magnitude as the snap
 * being measured and would swamp it.
 *
 * `scenes/fixtures/unit-scroll-container-bar-snap.tscn` carries these exact
 * numbers, arbitrated against Godot 4.6.3 at `--mode 2d`: at the container's
 * integer origin (100, 20) the horizontal bar's top edge is crisp between
 * y = 612 (rgb(242, 230, 64), the fill) and y = 613 (rgb(113, 108, 42), the
 * track), and the vertical bar's left edge between x = 992 and x = 993 — the
 * whole-pixel 593/893 below, never the solved 592.5/892.5. That render also
 * shows the feather IS live (the grabber's own fractional right edge at 765.8
 * reads the predicted 0.8-coverage blend), so those crisp edges are a snap and
 * not an absent antialiaser.
 */
describe('<ScrollContainer> — per-bar whole-pixel snap', () => {
  // 900.5 x 600.5: the bar thickness is a whole 8 px at every theme scale, so
  // both bar origins land exactly half a pixel off — the largest error the
  // snap can produce — while the container's own origin stays whole and
  // cannot mask it.
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

  it('composes the grabber onto the SNAPPED bar origin while keeping its own fractional offset', async () => {
    // The grabber is drawn by `ScrollBar`'s own NOTIFICATION_DRAW inside the
    // bar's CanvasItem (`scroll_bar.cpp:326-344` — a plain `Rect2` from
    // `get_grabber_offset()`, no cast, no rounding), so it is never snapped a
    // second time. range 1200, area 892.5 - 8 = 884.5, ratio 100/1200 ->
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
    // The painter takes the walker's OWN resolved value rather than re-reading
    // `gui/common/snap_controls_to_pixels`: that project setting is the root
    // window's alone (`main/main.cpp`), so a painter reading it directly is
    // wrong for every Control inside a SubViewport.
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
      // Untinted default-theme fills are never fully black; a halved sRGB
      // channel through the linear conversion is a distinctly smaller number
      // than the untinted equivalent — enough to prove the tint reached both
      // meshes without needing the theme's exact literal here.
      expect(color.getX(0)).toBeGreaterThan(0);
    }
  });

  it('composes self_modulate with the ambient ONCE, not squared (mirrors PanelContainer)', async () => {
    // own(sRGB) = ambient(0.5) * self_modulate(0.5) * track's own base (0.1,
    // default-theme style_normal_color) = 0.025 — NOT 0.0125, which squaring
    // the ambient a second time (own re-applying modulate on top of what the
    // walker already folded in) would produce.
    const content = leaf('Scroll/Content', { customMinimumSize: { x: 0, y: 800 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
        <ScrollContainer {...painterEnv()}
          solveNode={scrollNode({ selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, [content])}
          rect={{ x: 0, y: 0, w: 300, h: 200 }}
          renderOrder={0}
        />
      </Modulate2DContext.Provider>
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const track = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y >
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const color = (track.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // sRGBChannelToLinear(0.025) ≈ 0.0019349845.
    expect(color.getX(0)).toBeCloseTo(0.0019349845, 6);
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
      <ControlClipProvider value={[inheritedPlane]}>
        <ScrollContainer {...painterEnv()} solveNode={scrollNode({}, [])} rect={{ x: 0, y: 0, w: 300, h: 200 }} renderOrder={0}>
          <ClipProbe onPlanes={(p) => (captured = p)} />
        </ScrollContainer>
      </ControlClipProvider>
    );
    expect(captured).toHaveLength(5);
    expect(captured[0]).toBe(inheritedPlane);
  });

  it('intersects correctly when nested inside another ScrollContainer at a translated position', async () => {
    // Outer: 400x300 own rect at the world origin (no ancestor offset in this
    // isolated mount). Inner: mounted via a group positioned at (350, -40) —
    // exactly how the walker places a nested Control — with its OWN 100x80
    // rect, DELIBERATELY placed so it overhangs the outer's right edge:
    // inner's world rect is x:[350,450], y:[-120,-40], while outer's is
    // x:[0,400], y:[-300,0]. That asymmetry is the actual proof (mirrors the
    // spike's widget B): the right boundary can only be enforced by the
    // OUTER's own plane (inner's alone would allow up to x=450), while the
    // other three sides are enforced by the INNER's tighter rect.
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
    // 4 outer + 4 inner, concatenated (ScrollContainer never REPLACES what it inherited).
    expect(captured).toHaveLength(8);

    const insideBoth = new THREE.Vector3(380, -80, 0);
    expect(captured.every((p) => p.distanceToPoint(insideBoth) >= 0)).toBe(true);

    // Outer-driven rejection: well within the INNER's own local rect (x <=
    // 450), but past the OUTER's right edge (400) — only correct if the
    // OUTER's own plane, not just the inner's, is still in the merged list.
    const outerDriven = new THREE.Vector3(410, -80, 0);
    expect(captured.some((p) => p.distanceToPoint(outerDriven) < 0)).toBe(true);

    // Inner-driven rejection: inside the OUTER's own rect entirely, but above
    // the INNER's top edge (world y > -40) — only correct if the INNER's
    // tighter plane narrowed the intersection past what the outer alone allows.
    const innerDriven = new THREE.Vector3(380, -10, 0);
    expect(captured.some((p) => p.distanceToPoint(innerDriven) < 0)).toBe(true);
  });
});
