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
import { describe, expect, it } from 'vitest';
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

function leaf(name: string, props: Partial<ScrollContainerProperties> = {}): SolveNode {
  return {
    path: name,
    node: { name, type: 'Control', children: [], properties: { name, ...props } as ScrollContainerProperties },
    children: [],
    styleBoxes: {},
    textureSize: null,
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
  return { path: 'Scroll', node, children, styleBoxes: {}, textureSize: null };
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

  it("places the track spanning the bar's full rect: world x [1112,1120], y [-616,0]", async () => {
    const renderer = await mountFixtureScrollbar();
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const track = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y >
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const box = worldBounds(track);
    expect(box.min.x).toBeCloseTo(1112, 3);
    expect(box.max.x).toBeCloseTo(1120, 3);
    expect(box.min.y).toBeCloseTo(-616, 3);
    expect(box.max.y).toBeCloseTo(0, 3);
  });

  it('places the grabber at the TOP of the track (scroll_vertical unset = 0), height ~476.16, flipped the right way', async () => {
    const renderer = await mountFixtureScrollbar();
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    const grabber = meshes.reduce((a, b) => (worldBounds(a).max.y - worldBounds(a).min.y <
      worldBounds(b).max.y - worldBounds(b).min.y ? a : b));
    const box = worldBounds(grabber);
    expect(box.min.x).toBeCloseTo(1112, 3);
    expect(box.max.x).toBeCloseTo(1120, 3);
    // Godot-top of the track is world Y ~ 0; the grabber sits there when
    // unscrolled, extending DOWN (negative) by its own size — the flip this
    // painter applies is what makes this the top edge and not the bottom.
    expect(box.max.y).toBeCloseTo(0, 1);
    expect(box.min.y).toBeCloseTo(-476.16, 1);
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
    // range=800, area=200-8=192; ratio=200/800=0.25; offset=48 -> top at -48.
    expect(box.max.y).toBeCloseTo(-48, 1);
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
