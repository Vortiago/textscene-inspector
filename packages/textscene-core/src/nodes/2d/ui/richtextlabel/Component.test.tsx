/**
 * `<RichTextLabel>` — the native (WebGL canvas) painter for
 * RichTextLabel: one `<TextRun>` mesh per (line, contiguous bbcode-style-run)
 * pair. Assertions are scene-graph structure and material properties, never
 * pixels — `pnpm ref:godot` is the pixel-measurement tool.
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
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { BOLD_DISTANCE_BIAS, ITALIC_SKEW, RICH_TEXT_LABEL_UNDERLINE_ALPHA, richTextLabelMinimumSize } from './nativeSolver';
import { RichTextLabel } from './Component';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(path: string, properties: Record<string, unknown>): SolveNode {
  const name = path.split('/').pop()!;
  const tscnNode: TscnNode = { name, type: 'RichTextLabel', children: [], properties: { name, ...properties } };
  return { path, node: tscnNode, children: [], styleBoxes: {}, textureSize: null };
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

  it('multiplies inherited modulate by self_modulate (0.5 * 0.5 = 0.25, not 0.125 — never re-applying this node\'s own modulate)', async () => {
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
