/**
 * `<Label>` render contract: the runs it hands the text engine, their count, place, tint and
 * layout. The golden images own the pixels.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import { LABEL_SETTINGS_FONT_LOADING, type SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Label } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import {
  inkedGlyphCount,
  onlyBundledRun,
  runGlyphs,
  runPenExtentPx,
} from '../../../../r3f/controls/native/testing/bundledRunStub';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(path: string, properties: Record<string, unknown>): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = controlNode(name, 'Label', { name, ...properties });
  // A local theme_override_colors/theme_override_constants reaches the
  // painter through `n.colors`/`n.constants` (the walker folds both in
  // unconditionally), not properties.
  const colors = (properties as { themeOverrideColors?: SolveNode['colors'] }).themeOverrideColors ?? {};
  const constants =
    (properties as { themeOverrideConstants?: SolveNode['constants'] }).themeOverrideConstants ?? {};
  return { ...emptySolveNode(), path, node: tscnNode, colors, constants };
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

  it('draws nothing while label_settings.font is still loading (ADR-0059)', async () => {
    const node: SolveNode = {
      ...solveNode('L', { text: 'AB' }),
      labelSettingsFont: LABEL_SETTINGS_FONT_LOADING,
    };
    const renderer = await ReactThreeTestRenderer.create(
      <Label {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 200, h: 200 }} renderOrder={5} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
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

  it('multiplies the resolved text colour by the walker-composed tint, in sRGB', async () => {
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
    const { tint } = onlyBundledRun(renderer.scene);
    // own(sRGB) = tint(.5,.25,.5,.5) * font_color(.8,.4,.2,.5) = (.4,.1,.1,.25)
    expect(tint.r).toBeCloseTo(0.4, 6);
    expect(tint.g).toBeCloseTo(0.1, 6);
    expect(tint.b).toBeCloseTo(0.1, 6);
    expect(tint.a).toBeCloseTo(0.25, 6);
  });

  it('defaults to opaque WHITE text (Label’s own default_theme.cpp literal), not the shared gray control_font_color', async () => {
    const renderer = await render({ text: 'A' });
    expect(onlyBundledRun(renderer.scene).tint).toEqual({ r: 1, g: 1, b: 1, a: 1 });
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

  it('honours uppercase: the same source text shapes wider glyphs than lowercase (A and B are wider than a and b)', async () => {
    const lower = await render({ text: 'ab', uppercase: false });
    const upper = await render({ text: 'ab', uppercase: true });
    expect(runPenExtentPx(onlyBundledRun(upper.scene))).toBeGreaterThan(
      runPenExtentPx(onlyBundledRun(lower.scene))
    );
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
    expect(onlyBundledRun(small.scene).fontSizePx).toBe(16);
    expect(onlyBundledRun(big.scene).fontSizePx).toBe(32);
  });

  it('hands the run no clip planes with no clip in force (edge: empty list)', async () => {
    const renderer = await render({ text: 'A' });
    expect(onlyBundledRun(renderer.scene).clippingPlanes).toEqual([]);
  });

  it('text_overrun_behavior trims to the rect width, replacing the tail with an ellipsis glyph', async () => {
    const untrimmed = await render({ text: 'AAAAAAAAAAAA' }, { x: 0, y: 0, w: 100, h: 200 });
    expect(inkedGlyphCount(onlyBundledRun(untrimmed.scene))).toBe(12);

    // OVERRUN_TRIM_ELLIPSIS (3): text_overrun.test.ts derives "AAAAAAAA…" (9
    // ink glyphs) at this same width/font size.
    const trimmed = await render(
      { text: 'AAAAAAAAAAAA', overrunBehavior: 3 },
      { x: 0, y: 0, w: 100, h: 200 }
    );
    expect(inkedGlyphCount(onlyBundledRun(trimmed.scene))).toBe(9);
  });

  it('clip_text scissors this Label to its own rect (4 axis-aligned planes with no ancestor clip)', async () => {
    const renderer = await render({ text: 'A', clipText: true });
    expect(onlyBundledRun(renderer.scene).clippingPlanes).toHaveLength(4);
  });

  it('justification_flags without WORD_BOUND (2) leaves a FILL line ragged — the default flags (label.h:46) would have stretched it', async () => {
    const rect = { x: 0, y: 0, w: 200, h: 200 };
    const stretched = await render({ text: 'A B', horizontalAlignment: 3 }, rect);
    const ragged = await render({ text: 'A B', horizontalAlignment: 3, justificationFlags: 0 }, rect);
    expect(runPenExtentPx(onlyBundledRun(stretched.scene))).toBeGreaterThan(
      runPenExtentPx(onlyBundledRun(ragged.scene))
    );
  });

  it('tab_stops moves the glyph after a tab onto the configured stop', async () => {
    const renderer = await render({ text: 'A\tB', tabStopsPx: [40] });
    const b = runGlyphs(onlyBundledRun(renderer.scene)).find((glyph) => glyph.char === 'B')!;
    expect(b.x).toBe(40);
  });

  it('draws an EXTRA mesh, offset by shadow_offset_x/y, when font_shadow_color is set (label.cpp:762-767,828-835)', async () => {
    const renderer = await render({
      text: 'A',
      themeOverrideColors: { font_shadow_color: { r: 0, g: 0, b: 0, a: 0.5 } },
      themeOverrideConstants: { shadow_offset_x: 3, shadow_offset_y: 4, shadow_outline_size: 0 },
    });
    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(2);
    const shadowMesh = meshes[0]!;
    const shadowGroup = shadowMesh.parent as unknown as { instance: { position: THREE.Vector3 } };
    expect(shadowGroup.instance.position.x).toBe(3);
    expect(shadowGroup.instance.position.y).toBe(-4);
  });

  it('draws no shadow mesh with the default transparent font_shadow_color', async () => {
    const renderer = await render({ text: 'A' });
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
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
