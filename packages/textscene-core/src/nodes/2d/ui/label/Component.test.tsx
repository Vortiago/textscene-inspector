/**
 * `<Label>` — the native (WebGL canvas) painter for Label: the first
 * Control that draws text through the shared MSDF text engine. Assertions are
 * scene-graph structure (mesh count, group position, material uniforms) —
 * pixels are `pnpm ref:godot`'s job.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Label } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(path: string, properties: Record<string, unknown>): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type: 'Label', children: [], properties: { name, ...properties } };
  // A local theme_override_colors/* reaches `resolveTextTheme` through
  // `n.colors` (the walker folds it in unconditionally), not properties.
  const colors = (properties as { themeOverrideColors?: SolveNode['colors'] }).themeOverrideColors ?? {};
  return { ...emptySolveNode(), path, node: tscnNode, colors };
}

function expectedLinear(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

async function render(properties: Record<string, unknown>, rect: Rect2 = { x: 0, y: 0, w: 200, h: 200 }) {
  return ReactThreeTestRenderer.create(
    <Label {...painterEnv()} solveNode={solveNode('L', properties)} rect={rect} renderOrder={5} />
  );
}

describe('<Label> (isolated painter contract)', () => {
  it('draws exactly one mesh for a single-line text', async () => {
    const renderer = await render({ text: 'AB' });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });

  it('draws one mesh per line for an explicit hard break', async () => {
    const renderer = await render({ text: 'A\nB' });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(2);
  });

  it('forwards renderOrder to every line mesh, not just the first', async () => {
    // Asserted on the meshes: `<TextRun>` takes `renderOrder` directly, so no
    // wrapping group or imperative traverse is involved in getting it there.
    const renderer = await render({ text: 'A\nB\nC' });
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes).toHaveLength(3);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(5);
  });

  it('multiplies the resolved text colour by the walker-composed tint, converted to linear exactly once', async () => {
    const node = solveNode('L', {
      text: 'A',
      themeOverrideColors: { font_color: { r: 0.8, g: 0.4, b: 0.2, a: 0.5 } },
    });
    const renderer = await ReactThreeTestRenderer.create(
      <Label
        {...painterEnv()}
        // The product the walker hands down: inherited(.5,.5,.5,.5) × self_modulate(1,.5,1,1).
        tint={painterTint({ r: 0.5, g: 0.25, b: 0.5, a: 0.5 })}
        solveNode={node}
        rect={{ x: 0, y: 0, w: 200, h: 200 }}
        renderOrder={0}
      />
    );
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    // own(sRGB) = tint(.5,.25,.5,.5) * font_color(.8,.4,.2,.5) = (.4,.1,.1,.25)
    const expected = expectedLinear(0.4, 0.1, 0.1);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(expected.r, 6);
    expect(uColor.y).toBeCloseTo(expected.g, 6);
    expect(uColor.z).toBeCloseTo(expected.b, 6);
    expect(mat.uniforms.uOpacity!.value).toBeCloseTo(0.25, 6);
  });

  it('defaults to opaque WHITE text (Label’s own default_theme.cpp literal), not the shared gray control_font_color', async () => {
    const renderer = await render({ text: 'A' });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    const expected = expectedLinear(1, 1, 1);
    expect(uColor.x).toBeCloseTo(expected.r, 6);
    expect(mat.uniforms.uOpacity!.value).toBe(1);
  });

  it('honours horizontal_alignment (1, CENTER): each line group centers independently by its own width', async () => {
    const renderer = await render({ text: 'A\nAB', horizontalAlignment: 1 }, { x: 0, y: 0, w: 200, h: 200 });
    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as THREE.Group);
    const xs = groups.map((g) => g.position.x).sort((a, b) => a - b);
    // 'A' and 'AB' have different widths, so their center offsets must differ.
    expect(new Set(xs.map((x) => Math.round(x * 1000))).size).toBeGreaterThan(1);
  });

  it('honours vertical_alignment (default TOP): the first line group sits at exactly y=0 — no vbegin, and no painter-side anchor folded into the placement', async () => {
    const renderer = await render({ text: 'A' });
    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as THREE.Group);
    expect(groups.length).toBeGreaterThan(0);
    // three's Y is negated Godot px (rect.ts convention): position.y = -y.
    expect(groups.every((g) => g.position.y === 0)).toBe(true);
  });

  it('honours uppercase: the SAME source text renders WIDER glyphs than lowercase (A/B are wider than a/b in this atlas)', async () => {
    const lower = await render({ text: 'ab', uppercase: false });
    const upper = await render({ text: 'ab', uppercase: true });
    const lowerGeo = (lower.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const upperGeo = (upper.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const extent = (geo: THREE.BufferGeometry) => {
      const pos = geo.getAttribute('position');
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        min = Math.min(min, x);
        max = Math.max(max, x);
      }
      return max - min;
    };
    expect(extent(upperGeo)).toBeGreaterThan(extent(lowerGeo));
  });

  it('honours autowrap_mode: WORD_SMART (3) wraps into more lines than OFF (0) at the same narrow rect', async () => {
    const text = 'This label wraps across multiple lines once it runs out of horizontal space.';
    const rect: Rect2 = { x: 0, y: 0, w: 240, h: 200 };
    const off = await render({ text, autowrapMode: 0 }, rect);
    const wrapped = await render({ text, autowrapMode: 3 }, rect);
    expect(off.scene.findAllByType('Mesh').length).toBe(1);
    expect(wrapped.scene.findAllByType('Mesh').length).toBeGreaterThan(1);
  });

  it('reads theme_override_font_sizes/font_size over the theme default', async () => {
    const small = await render({ text: 'A' });
    const big = await render({ text: 'A', themeOverrideFontSizes: { font_size: 32 } });
    const extent = (geo: THREE.BufferGeometry) => {
      const pos = geo.getAttribute('position');
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < pos.count; i++) {
        max = Math.max(max, pos.getX(i));
        min = Math.min(min, pos.getX(i));
      }
      return max - min;
    };
    const smallGeo = (small.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const bigGeo = (big.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    expect(extent(bigGeo)).toBeCloseTo(extent(smallGeo) * 2, 0);
  });

  it('is transparent, non-depth-writing, and spreads the shared clip planes hook (edge: empty list)', async () => {
    const renderer = await render({ text: 'A' });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.transparent).toBe(true);
    expect(mat.depthWrite).toBe(false);
    expect(mat.clippingPlanes).toEqual([]);
  });

  function quadCount(renderer: Awaited<ReturnType<typeof render>>): number {
    const geometry = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    return geometry.attributes.position!.count / 4;
  }

  it('text_overrun_behavior trims to the rect width, replacing the tail with an ellipsis glyph', async () => {
    const untrimmed = await render({ text: 'AAAAAAAAAAAA' }, { x: 0, y: 0, w: 100, h: 200 });
    expect(quadCount(untrimmed)).toBe(12);

    // OVERRUN_TRIM_ELLIPSIS (3): text_overrun.test.ts derives "AAAAAAAA…" (9
    // ink glyphs) at this same width/font size.
    const trimmed = await render(
      { text: 'AAAAAAAAAAAA', overrunBehavior: 3 },
      { x: 0, y: 0, w: 100, h: 200 }
    );
    expect(quadCount(trimmed)).toBe(9);
  });

  it('clip_text scissors this Label to its own rect (4 axis-aligned planes with no ancestor clip)', async () => {
    const renderer = await render({ text: 'A', clipText: true });
    const mat = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).material as THREE.ShaderMaterial;
    expect(mat.clippingPlanes).toHaveLength(4);
  });

  it('justification_flags without WORD_BOUND (2) leaves a FILL line ragged — the default flags (label.h:46) would have stretched it', async () => {
    const rect = { x: 0, y: 0, w: 200, h: 200 };
    const stretched = await render({ text: 'A B', horizontalAlignment: 3 }, rect);
    const ragged = await render({ text: 'A B', horizontalAlignment: 3, justificationFlags: 0 }, rect);
    const width = (r: Awaited<ReturnType<typeof render>>) => {
      const geo = (r.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
      const xs = geo.attributes.position!.array as Float32Array;
      let max = -Infinity;
      for (let i = 0; i < xs.length; i += 3) max = Math.max(max, xs[i]!);
      return max;
    };
    expect(width(stretched)).toBeGreaterThan(width(ragged));
  });

  it('tab_stops moves the glyph after a tab onto the configured stop', async () => {
    const renderer = await render({ text: 'A\tB', tabStopsPx: [40] });
    const geo = (renderer.scene.findByType('Mesh').instance as THREE.Mesh).geometry as THREE.BufferGeometry;
    const xs = geo.attributes.position!.array as Float32Array;
    // Quad 0 = 'A' (4 verts), quad 1 = 'B' -- its top-left vertex.x is the pen
    // x after the tab, plus the glyph's own small atlas left-bearing offset.
    expect(xs[12]).toBeGreaterThan(39);
    expect(xs[12]).toBeLessThan(42);
  });
});

describe('<Label> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('draws through the real registry entry, at the walker-solved rect, honouring visible === false', async () => {
    controlComponentRegistry.register({ typeName: 'Label', Component: Label });
    controlSolverRegistry.clear();
    const root = solveNode('Root', {
      text: 'Hi',
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 100,
      offsetBottom: 40,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(0);

    controlComponentRegistry.clear();
  });
});
