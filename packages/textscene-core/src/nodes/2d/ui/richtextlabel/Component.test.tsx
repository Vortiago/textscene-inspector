/**
 * `<RichTextLabel>` — the native (WebGL canvas) painter for
 * RichTextLabel: one `<TextRun>` mesh per (line, contiguous bbcode-style-run)
 * pair. Assertions are scene-graph structure and material properties, never
 * pixels — `pnpm ref:godot` is the pixel-measurement tool.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { BOLD_DISTANCE_BIAS, ITALIC_SKEW, RICH_TEXT_LABEL_UNDERLINE_ALPHA, richTextLabelMinimumSize } from './nativeSolver';
import { RichTextLabel } from './Component';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(path: string, properties: Record<string, unknown>): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type: 'RichTextLabel', children: [], properties: { name, ...properties } };
  return { ...emptySolveNode(), path, node: tscnNode };
}

function expectedLinear(r: number, g: number, b: number): THREE.Color {
  return new THREE.Color().setRGB(r, g, b, THREE.SRGBColorSpace);
}

async function render(properties: Record<string, unknown>, rect: Rect2 = { x: 0, y: 0, w: 300, h: 200 }) {
  return ReactThreeTestRenderer.create(
    <RichTextLabel {...painterEnv()} solveNode={solveNode('RTL', properties)} rect={rect} renderOrder={5} />
  );
}

function meshesOf(renderer: Awaited<ReturnType<typeof render>>): THREE.Mesh[] {
  return renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
}

describe('<RichTextLabel> (isolated painter contract)', () => {
  it('draws exactly one mesh for plain (bbcode-disabled) single-line text', async () => {
    const renderer = await render({ text: 'Hello', bbcodeEnabled: false });
    expect(meshesOf(renderer)).toHaveLength(1);
  });

  it('draws no mesh for empty text', async () => {
    const renderer = await render({ text: '' });
    expect(meshesOf(renderer)).toHaveLength(0);
  });

  it('draws a separate mesh per bbcode style-run on the same line', async () => {
    const renderer = await render({ text: 'plain [b]bold[/b]', bbcodeEnabled: true });
    expect(meshesOf(renderer).length).toBeGreaterThanOrEqual(2);
  });

  it('forwards renderOrder to every mesh, not just the first', async () => {
    const renderer = await render({ text: 'plain [b]bold[/b] [i]italic[/i]', bbcodeEnabled: true });
    const meshes = meshesOf(renderer);
    expect(meshes.length).toBeGreaterThanOrEqual(3);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(5);
  });

  it('a [b] run\'s material carries BOLD_DISTANCE_BIAS; a plain run in the same text carries 0', async () => {
    const renderer = await render({ text: 'plain [b]bold[/b]', bbcodeEnabled: true });
    const materials = meshesOf(renderer).map((m) => m.material as THREE.ShaderMaterial);
    const biases = materials.map((m) => m.uniforms.uDistanceBias!.value as number);
    expect(biases).toContain(BOLD_DISTANCE_BIAS);
    expect(biases).toContain(0);
  });

  it(
    "a [b] run with no bold_font_size override draws its glyphs at Godot's FALLBACK font size (16px), " +
      'not normal_font_size — scene/theme/default_theme.cpp:1200 leaves bold_font_size at its own -1 ' +
      'sentinel, which Theme::get_font_size (scene/resources/theme.cpp:658-661) never falls through to a ' +
      'sibling key for, only to ThemeDB::get_fallback_font_size() (16)',
    async () => {
      const renderer = await render({
        text: 'A[b]A[/b]',
        bbcodeEnabled: true,
        themeOverrideFontSizes: { normal_font_size: 32 },
      });
      const meshes = meshesOf(renderer);
      expect(meshes).toHaveLength(2);
      const widthOf = (mesh: THREE.Mesh) => {
        const pos = (mesh.geometry as THREE.BufferGeometry).getAttribute('position');
        return pos.getX(1) - pos.getX(0); // TR.x - TL.x, the first (only) glyph's own ink width.
      };
      const plainWidth = widthOf(meshes[0]!);
      const boldWidth = widthOf(meshes[1]!);
      // Atlas 'A' bitmap width 32 @ bake 42 (openSansAtlas.ts). At 32px: 32*32/42.
      // At the 16px fallback: 32*16/42 — exactly HALF the plain run's width,
      // since normal_font_size (32) here is exactly double the 16px fallback.
      // Float32Array-backed geometry (three's own BufferAttribute) — 4 digits
      // clears its precision loss without loosening the assertion's INTENT.
      expect(plainWidth).toBeCloseTo((32 * 32) / 42, 4);
      expect(boldWidth).toBeCloseTo((32 * 16) / 42, 4);
      expect(boldWidth).toBeCloseTo(plainWidth / 2, 4);
    }
  );

  it('an [i] run\'s geometry is sheared relative to an otherwise-identical plain run (skew, not a material uniform)', async () => {
    const plain = await render({ text: 'AB', bbcodeEnabled: false });
    const italic = await render({ text: '[i]AB[/i]', bbcodeEnabled: true });
    const plainPos = (meshesOf(plain)[0]!.geometry as THREE.BufferGeometry).getAttribute('position');
    const italicPos = (meshesOf(italic)[0]!.geometry as THREE.BufferGeometry).getAttribute('position');
    // A real per-vertex shear moves the top (index 0) and bottom (index 2) of
    // the SAME glyph by different amounts, proportional to each vertex's own
    // depth below the line top (TextRun.test.tsx's own skew fixture proves
    // the same shape) — a uniform translation would move both identically.
    const topDx = italicPos.getX(0) - plainPos.getX(0);
    const bottomDx = italicPos.getX(2) - plainPos.getX(2);
    expect(topDx).not.toBe(0);
    expect(topDx).not.toBeCloseTo(bottomDx, 3);
    expect(ITALIC_SKEW).not.toBe(0);
  });

  it('an [u] run draws an extra underline-stroke mesh (a flat PlaneGeometry quad, not glyph geometry); a plain run draws none', async () => {
    const plain = await render({ text: 'AB', bbcodeEnabled: false });
    const underlined = await render({ text: '[u]AB[/u]', bbcodeEnabled: true });
    const strokesOf = (r: Awaited<ReturnType<typeof render>>) =>
      meshesOf(r).filter((m) => m.geometry.type === 'PlaneGeometry');
    expect(strokesOf(plain)).toHaveLength(0);
    expect(strokesOf(underlined)).toHaveLength(1);
  });

  it(
    "the underline stroke's material carries the run's own colour (ControlQuad's meshBasicMaterial, sRGB-space " +
      "same as every other native chrome quad) at RICH_TEXT_LABEL_UNDERLINE_ALPHA times its opacity " +
      "(default_theme.cpp:1231's underline_alpha=50, rich_text_label.cpp:1237), same RGB as the text",
    async () => {
      const renderer = await render({ text: '[color=#e0a030][u]AB[/u][/color]', bbcodeEnabled: true });
      const meshes = meshesOf(renderer);
      const stroke = meshes.find((m) => m.geometry.type === 'PlaneGeometry')!;
      const text = meshes.find((m) => !(m.geometry.type === 'PlaneGeometry'))!;
      const strokeMat = stroke.material as THREE.MeshBasicMaterial;
      const textMat = text.material as THREE.ShaderMaterial;
      const textColor = textMat.uniforms.uColor!.value as THREE.Vector3;
      const textOpacity = textMat.uniforms.uOpacity!.value as number;
      // The text run's own uColor is already sRGB->linear-converted (TextRun.tsx);
      // ControlQuad's meshBasicMaterial takes an sRGB THREE.Color (three's own
      // colour-management path does the same conversion on upload), so compare
      // both against the SAME independently-computed expectation this file
      // already uses for the text-run case below.
      const expected = expectedLinear(0xe0 / 255, 0xa0 / 255, 0x30 / 255);
      expect(strokeMat.color.r).toBeCloseTo(expected.r, 5);
      expect(strokeMat.color.g).toBeCloseTo(expected.g, 5);
      expect(strokeMat.color.b).toBeCloseTo(expected.b, 5);
      expect(textColor.x).toBeCloseTo(expected.r, 5);
      expect(strokeMat.opacity).toBeCloseTo(textOpacity * RICH_TEXT_LABEL_UNDERLINE_ALPHA, 6);
    }
  );

  it('resolves a [color=#e0a030] run to that RGBA, independent of the default text colour', async () => {
    const renderer = await render({ text: '[color=#e0a030]x[/color]', bbcodeEnabled: true });
    const mat = meshesOf(renderer)[0]!.material as THREE.ShaderMaterial;
    const expected = expectedLinear(0xe0 / 255, 0xa0 / 255, 0x30 / 255);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(expected.r, 5);
    expect(uColor.y).toBeCloseTo(expected.g, 5);
    expect(uColor.z).toBeCloseTo(expected.b, 5);
  });

  it('multiplies the ambient inherited tint by self_modulate onto every run (0.5 * 0.5 = 0.25)', async () => {
    const node = solveNode('RTL', { text: 'A', selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 0.5 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
        <RichTextLabel {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 200, h: 200 }} renderOrder={0} />
      </Modulate2DContext.Provider>
    );
    const mat = meshesOf(renderer)[0]!.material as THREE.ShaderMaterial;
    // own(sRGB) = inherited(.5,.5,.5,1) * self_modulate(.5,.5,.5,.5) * default_color(1,1,1,1) = (.25,.25,.25,.5)
    const expected = expectedLinear(0.25, 0.25, 0.25);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(expected.r, 6);
    expect(mat.uniforms.uOpacity!.value).toBeCloseTo(0.5, 6);
  });

  it('honours autowrap_mode: the default (WORD_SMART) wraps into more lines than OFF at the same narrow rect', async () => {
    const text = 'This label wraps across multiple lines once it runs out of horizontal space.';
    const rect: Rect2 = { x: 0, y: 0, w: 240, h: 400 };
    const off = await render({ text, autowrapMode: 0 }, rect);
    const wrapped = await render({ text }, rect);
    expect(meshesOf(off)).toHaveLength(1);
    expect(meshesOf(wrapped).length).toBeGreaterThan(1);
  });

  it('is transparent, non-depth-writing, and every material spreads the shared clip planes hook (edge: empty list)', async () => {
    const renderer = await render({ text: 'plain [b]bold[/b]', bbcodeEnabled: true });
    for (const mesh of meshesOf(renderer)) {
      const mat = mesh.material as THREE.ShaderMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.clippingPlanes).toEqual([]);
    }
  });
});

describe('<RichTextLabel> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('draws through the real registry entry, at the walker-solved rect, honouring fit_content minimum size', async () => {
    controlComponentRegistry.register({ typeName: 'RichTextLabel', Component: RichTextLabel });
    controlSolverRegistry.clear();
    controlSolverRegistry.registerMinimumSize('RichTextLabel', richTextLabelMinimumSize);
    const root = solveNode('Root', {
      text: 'Hi',
      fitContent: true,
      autowrapMode: 0,
      anchorLeft: 0,
      anchorTop: 0,
      anchorRight: 0,
      anchorBottom: 0,
      offsetLeft: 0,
      offsetTop: 0,
      offsetRight: 100,
      offsetBottom: 200,
    });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );
    expect(renderer.scene.findAllByType('Mesh').length).toBeGreaterThan(0);

    controlComponentRegistry.clear();
    controlSolverRegistry.clear();
  });
});

/**
 * The SCENE-FONT (canvas-kind `FontMetrics`) path end to end. RichTextLabel
 * has no alignment pass at all — a line's y is its own box top,
 * `lineIndex * linePitchPx` — so this pins that the placement carries no
 * atlas-bake anchor, which would be invisible on the atlas path (where it
 * would read as the correct total) and wrong here by
 * `ascentPx - base*fontSizePx/42` px.
 */
describe('<RichTextLabel> — scene-font (canvas-kind FontMetrics) text path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function renderWithSceneFont(properties: Record<string, unknown>) {
    vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    return render(properties);
  }

  function canvasMeshes(renderer: Awaited<ReturnType<typeof render>>): THREE.Mesh[] {
    return meshesOf(renderer).filter((m) => (m.material as THREE.MeshBasicMaterial).map instanceof THREE.CanvasTexture);
  }

  it('paints each run through the canvas rasteriser — ONE quad per run, not one per glyph, and no MSDF material', async () => {
    const renderer = await renderWithSceneFont({ text: 'Hello', bbcodeEnabled: false });
    const meshes = canvasMeshes(renderer);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.geometry.getAttribute('position').count).toBe(4);
    expect(meshesOf(renderer).every((m) => (m.material as THREE.ShaderMaterial).uniforms === undefined)).toBe(true);
  });

  it('steps line N down by exactly one linePitchPx from its own box top, with nothing added to line 0', async () => {
    const renderer = await renderWithSceneFont({ text: 'Hi\nHo', bbcodeEnabled: false });
    const meshes = canvasMeshes(renderer);
    expect(meshes).toHaveLength(2);
    // Scene font at 16px: ascentPx = ceil(800*16/1000) = 13, descentPx =
    // ceil(200*16/1000) = 4; RichTextLabel's own line_separation default is 0
    // (default_theme.cpp:1217), so linePitchPx = 17. three's Y is negated
    // Godot px, and line 0 sits at its own box top with NO offset of any kind.
    const ys = meshes.map((m) => (m.parent as THREE.Object3D).position.y);
    expect(ys[0]).toBeCloseTo(0, 10);
    expect(ys[1]).toBeCloseTo(-17, 10);
  });

  it("each quad's own top edge is the raster's fixed 4px pad, carrying no font-anchor term of its own", async () => {
    const renderer = await renderWithSceneFont({ text: 'Hi', bbcodeEnabled: false });
    const mesh = canvasMeshes(renderer)[0]!;
    // Vertex order TL, TR, BL, BR; canvasTextPainter.ts's VERTICAL_PAD_PX is 4.
    expect(mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(4, 6);
  });
});
