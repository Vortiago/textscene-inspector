/**
 * Tests the `<RichTextLabel>` painter: one `<TextRun>` per line and style run.
 * It asserts scene-graph structure and materials, never pixels, which
 * `pnpm ref:godot` measures.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import type { FontMetrics } from '../../../../r3f/controls/native/text/fontMetrics';
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { RICH_TEXT_LABEL_UNDERLINE_ALPHA, richTextLabelMinimumSize } from './nativeSolver';
import { RichTextLabel } from './Component';
import {
  SCROLL_BAR_GRABBER_RENDER_ORDER_OFFSET,
  SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET,
} from '../shared/ScrollBarChrome';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

// The bundled canvas face, which a [b] run draws on: the door to register it is shut under vitest,
// and a real face would decode the bundled outlines, which a painter test does not read.
vi.mock('../../../../r3f/controls/native/text/bundledCanvasFace', async () => {
  const { createOpenSansCanvasFontMetrics } =
    await import('../../../../r3f/controls/native/text/openSansCanvasFontMetrics');
  const { withVariation } = await import('../../../../r3f/controls/native/text/fontMetrics');
  const bundled = createOpenSansCanvasFontMetrics('bundled-rtl-test');
  return {
    peekBundledCanvasFace: (atlasFace: FontMetrics) =>
      withVariation(bundled, { embolden: atlasFace.embolden, skew: atlasFace.skew }),
  };
});

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);

function solveNode(
  path: string,
  properties: Record<string, unknown>,
  overrides: Partial<SolveNode> = {}
): SolveNode {
  const name = path.split('/').pop()!;
  // `parseRichTextLabel` fills these defaults, which the painter reads as given.
  const parsedDefaults = {
    justificationFlags: 163,
    clipContents: true,
    scrollActive: true,
    scrollFollowing: false,
    scrollFollowingVisibleCharacters: false,
  };
  const tscnNode: TscnNode = controlNode(name, 'RichTextLabel', { name, ...parsedDefaults, ...properties });
  return { ...emptySolveNode(), path, node: tscnNode, ...overrides };
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
    await vi.waitFor(() => expect(meshesOf(renderer).length).toBeGreaterThanOrEqual(2));
  });

  it('draws a mesh for the marker of each [ul] item, beside the mesh of its text', async () => {
    const list = await render({ text: '[ul]a\nb[/ul]', bbcodeEnabled: true });
    const plain = await render({ text: 'a\nb', bbcodeEnabled: true });
    expect(meshesOf(list)).toHaveLength(meshesOf(plain).length + 2);
  });

  it('forwards renderOrder to every mesh, not just the first', async () => {
    const renderer = await render({ text: 'plain [b]bold[/b] [i]italic[/i]', bbcodeEnabled: true });
    const meshes = meshesOf(renderer);
    expect(meshes.length).toBeGreaterThanOrEqual(3);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(5);
  });

  it("draws a [b] run, Godot's FreeType embolden, on the bundled canvas face; a plain run stays on the atlas", async () => {
    const renderer = await render({ text: 'plain [b]bold[/b]', bbcodeEnabled: true });
    await vi.waitFor(() => expect(meshesOf(renderer)).toHaveLength(2));
    const kinds = meshesOf(renderer).map((m) => (m.material as THREE.Material).type);
    expect(kinds.filter((type) => type === 'ShaderMaterial')).toHaveLength(1);
  });

  it(
    "a [b] run with no bold_font_size override draws at Godot's FALLBACK font size (16px), not " +
      'normal_font_size: default_theme.cpp:1200 leaves bold_font_size at its -1 sentinel, which ' +
      'Theme::get_font_size (theme.cpp:658-661) falls through only to ThemeDB::get_fallback_font_size()',
    async () => {
      const boldHeight = async (fontSizes: Record<string, number>) => {
        const renderer = await render({
          text: '[b]A[/b]',
          bbcodeEnabled: true,
          themeOverrideFontSizes: fontSizes,
        });
        await vi.waitFor(() => expect(meshesOf(renderer)).toHaveLength(1));
        const pos = (meshesOf(renderer)[0]!.geometry as THREE.BufferGeometry).getAttribute('position');
        return pos.getY(0) - pos.getY(2);
      };
      const fallback = await boldHeight({ normal_font_size: 32 });
      expect(fallback).toBe(await boldHeight({ normal_font_size: 32, bold_font_size: 16 }));
      expect(fallback).toBeLessThan(await boldHeight({ normal_font_size: 32, bold_font_size: 32 }));
    }
  );

  it("an [i] run's geometry is sheared relative to an otherwise-identical plain run (skew, not a material uniform)", async () => {
    const plain = await render({ text: 'AB', bbcodeEnabled: false });
    const italic = await render({ text: '[i]AB[/i]', bbcodeEnabled: true });
    const plainPos = (meshesOf(plain)[0]!.geometry as THREE.BufferGeometry).getAttribute('position');
    const italicPos = (meshesOf(italic)[0]!.geometry as THREE.BufferGeometry).getAttribute('position');
    // A shear moves the top (index 0) and bottom (index 2) of one glyph by
    // amounts proportional to their depth below the line top. A uniform
    // translation would move both the same.
    const topDx = italicPos.getX(0) - plainPos.getX(0);
    const bottomDx = italicPos.getX(2) - plainPos.getX(2);
    expect(topDx).not.toBe(0);
    expect(topDx).not.toBeCloseTo(bottomDx, 3);
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
      'same as every other native chrome quad) at RICH_TEXT_LABEL_UNDERLINE_ALPHA times its opacity ' +
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
      // The text run's uColor is already linear (TextRunMesh.tsx), and three converts
      // ControlQuad's sRGB colour on upload, so both compare against the same
      // expectation as the text-run case below.
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

  it("multiplies the walker-composed tint by each RUN's own bbcode colour, in sRGB", async () => {
    // Neither factor is white, so a painter that drops either one fails here.
    const renderer = await ReactThreeTestRenderer.create(
      <RichTextLabel
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode('RTL', { text: '[color=#e0a030]x[/color]', bbcodeEnabled: true })}
        rect={{ x: 0, y: 0, w: 200, h: 200 }}
        renderOrder={0}
      />
    );
    const mat = meshesOf(renderer)[0]!.material as THREE.ShaderMaterial;
    const expected = expectedLinear((0.5 * 0xe0) / 255, (0.5 * 0xa0) / 255, (0.5 * 0x30) / 255);
    const uColor = mat.uniforms.uColor!.value as THREE.Vector3;
    expect(uColor.x).toBeCloseTo(expected.r, 5);
    expect(uColor.y).toBeCloseTo(expected.g, 5);
    expect(uColor.z).toBeCloseTo(expected.b, 5);
  });

  it('multiplies the walker-composed tint onto every run', async () => {
    const node = solveNode('RTL', { text: 'A' });
    const renderer = await ReactThreeTestRenderer.create(
      <RichTextLabel
        {...painterEnv()}
        // The walker's own product: ambient(.5,.5,.5,1) x self_modulate(.5,.5,.5,.5).
        tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 0.5 })}
        solveNode={node}
        rect={{ x: 0, y: 0, w: 200, h: 200 }}
        renderOrder={0}
      />
    );
    const mat = meshesOf(renderer)[0]!.material as THREE.ShaderMaterial;
    // run(sRGB) = tint(.25,.25,.25,.5) * default_color(1,1,1,1) = (.25,.25,.25,.5)
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
    const renderer = await render({ text: 'plain [b]bold[/b]', bbcodeEnabled: true, clipContents: false });
    for (const mesh of meshesOf(renderer)) {
      const mat = mesh.material as THREE.ShaderMaterial;
      expect(mat.transparent).toBe(true);
      expect(mat.depthWrite).toBe(false);
      expect(mat.clippingPlanes).toEqual([]);
    }
  });

  it('tab_stops moves the glyph after a tab onto the configured stop', async () => {
    const withStop = await render({ text: 'A\tB', autowrapMode: 0, tabStopsPx: [40] });
    const withoutStop = await render({ text: 'A\tB', autowrapMode: 0 });
    const secondQuadX = (r: Awaited<ReturnType<typeof render>>) => {
      const geo = meshesOf(r)[0]!.geometry as THREE.BufferGeometry;
      return (geo.attributes.position!.array as Float32Array)[12]!;
    };
    expect(secondQuadX(withStop)).toBeGreaterThan(secondQuadX(withoutStop));
  });

  it('a [p tab_stops] paragraph moves its own tab onto its own stop, and a bare [p] ignores the node stops', async () => {
    const secondQuadX = (r: Awaited<ReturnType<typeof render>>) => {
      const geo = meshesOf(r)[0]!.geometry as THREE.BufferGeometry;
      return (geo.attributes.position!.array as Float32Array)[12]!;
    };
    const props = { autowrapMode: 0, bbcodeEnabled: true, tabStopsPx: [40] };
    const own = await render({ ...props, text: '[p tab_stops=90]A\tB[/p]' });
    const bare = await render({ ...props, text: '[p]A\tB[/p]' });
    const node = await render({ ...props, text: 'A\tB' });
    expect(secondQuadX(own)).toBeGreaterThan(secondQuadX(node));
    expect(secondQuadX(bare)).toBeLessThan(secondQuadX(node));
  });
});

describe('<RichTextLabel> — [hr]', () => {
  const rulesOf = (r: Awaited<ReturnType<typeof render>>) =>
    meshesOf(r).filter((m) => m.geometry.type === 'PlaneGeometry');

  it('draws one solid white quad, 90 percent of the width by 2px, with no texture', async () => {
    const renderer = await render({ text: '[hr]', bbcodeEnabled: true }, { x: 0, y: 0, w: 200, h: 100 });
    const [rule] = rulesOf(renderer);
    const { width, height } = (rule!.geometry as THREE.PlaneGeometry).parameters;
    expect([rulesOf(renderer).length, width, height]).toEqual([1, 180, 2]);
    expect((rule!.material as THREE.MeshBasicMaterial).map).toBeNull();
  });

  it('tints by color= times the walker tint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RichTextLabel
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
        solveNode={solveNode('RTL', { text: '[hr color=#e0a030]', bbcodeEnabled: true })}
        rect={{ x: 0, y: 0, w: 200, h: 100 }}
        renderOrder={5}
      />
    );
    const expected = expectedLinear(0.5 * (0xe0 / 255), 0.5 * (0xa0 / 255), 0.5 * (0x30 / 255));
    const { color } = rulesOf(renderer)[0]!.material as THREE.MeshBasicMaterial;
    expect([color.r, color.g, color.b].map((c) => c.toFixed(5))).toEqual(
      [expected.r, expected.g, expected.b].map((c) => c.toFixed(5))
    );
  });

  it('puts the rule on a line below the text before it', async () => {
    const renderer = await render({ text: 'a[hr]', bbcodeEnabled: true });
    const worldTopOf = (mesh: THREE.Mesh) => {
      mesh.updateWorldMatrix(true, false);
      return new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).y;
    };
    const rule = rulesOf(renderer)[0]!;
    const text = meshesOf(renderer).find((m) => m.geometry.type !== 'PlaneGeometry')!;
    expect(worldTopOf(rule)).toBeLessThan(worldTopOf(text));
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
 * The scene-font (canvas-kind `FontMetrics`) path. A line's y is its box top,
 * so the placement must carry no atlas-bake anchor: the atlas path would hide
 * one, and here it would be off by `ascentPx - base*fontSizePx/42` px.
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
    return meshesOf(renderer).filter(
      (m) => (m.material as THREE.MeshBasicMaterial).map instanceof THREE.CanvasTexture
    );
  }

  it('paints each run through the canvas rasteriser — ONE quad per run, not one per glyph, and no MSDF material', async () => {
    const renderer = await renderWithSceneFont({ text: 'Hello', bbcodeEnabled: false });
    const meshes = canvasMeshes(renderer);
    expect(meshes).toHaveLength(1);
    expect(meshes[0]!.geometry.getAttribute('position').count).toBe(4);
    expect(meshesOf(renderer).every((m) => (m.material as THREE.ShaderMaterial).uniforms === undefined)).toBe(
      true
    );
  });

  it('steps line N down by exactly one linePitchPx from its own box top, with nothing added to line 0', async () => {
    const renderer = await renderWithSceneFont({ text: 'Hi\nHo', bbcodeEnabled: false });
    const meshes = canvasMeshes(renderer);
    expect(meshes).toHaveLength(2);
    // Scene font at 16px: ascentPx = ceil(800*16/1000) = 13, descentPx =
    // ceil(200*16/1000) = 4, and line_separation is 0 (default_theme.cpp:1217),
    // so linePitchPx = 17. three's Y is negated Godot px, with no offset.
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

/**
 * `[img]`: `resolveExtResourcePath` resolves a `res://` path before any
 * `ExtResource` lookup, so these seed only the loader at the path the BBCode names.
 */
describe('<RichTextLabel> — [img]', () => {
  const IMG = 'res://logo.png';

  function fakeTexture(width: number, height: number): THREE.Texture {
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = { width, height };
    return tex;
  }

  async function renderImage(
    text: string,
    textureSize: [number, number],
    rect: Rect2 = { x: 0, y: 0, w: 300, h: 200 },
    overrides: Partial<SolveNode> = {}
  ) {
    const fake = createFakeResourceLoader();
    fake.textures.seed(IMG, fakeTexture(...textureSize));
    const tree = (
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[]}>
          <RichTextLabel
            {...painterEnv()}
            solveNode={solveNode('RTL', { text, bbcodeEnabled: true }, overrides)}
            rect={rect}
            renderOrder={5}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    return ReactThreeTestRenderer.create(tree);
  }

  // `.type` string, not `instanceof`: `@react-three/fiber` can construct
  // through another copy of `three`, so `instanceof THREE.MeshBasicMaterial`
  // can silently never match.
  function materialOf(mesh: THREE.Mesh): THREE.Material {
    return mesh.material as THREE.Material;
  }

  function imageMeshOf(renderer: Awaited<ReturnType<typeof renderImage>>): THREE.Mesh {
    const mesh = renderer.scene
      .findAllByType('Mesh')
      .find((m) => materialOf(m.instance as THREE.Mesh).type === 'MeshBasicMaterial');
    return mesh!.instance as THREE.Mesh;
  }

  it('draws no quad for an unauthored (natural-size) [img] when the SOLVE has not carried its size onto textureSlots yet', async () => {
    const renderer = await renderImage(`[img]${IMG}[/img]`, [64, 64]);
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it("draws an unauthored (natural-size) [img] at the texture's own size, once buildSolveTree.ts carries it on textureSlots", async () => {
    const renderer = await renderImage(`[img]${IMG}[/img]`, [64, 64], undefined, {
      textureSlots: { [IMG]: { x: 64, y: 64 } },
    });
    const mesh = imageMeshOf(renderer);
    const geometry = mesh.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(64);
    expect(geometry.parameters.height).toBe(64);
  });

  it("draws a quad sized to the authored width×height, regardless of the texture's own natural size", async () => {
    const renderer = await renderImage(`[img=40x20]${IMG}[/img]`, [64, 64]);
    const mesh = imageMeshOf(renderer);
    const geometry = mesh.geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(40);
    expect(geometry.parameters.height).toBe(20);
  });

  // `clip_contents` clips every glyph, image and underline to the control's own rect
  // (`control.cpp:3948`), and RichTextLabel's constructor turns it on (`rich_text_label.cpp:8225`).
  describe('clip_contents', () => {
    const TEXT = `[u]Hi[/u] [img=40x20]${IMG}[/img]`;

    async function clipPlaneCounts(properties: Record<string, unknown>): Promise<number[]> {
      const fake = createFakeResourceLoader();
      fake.textures.seed(IMG, fakeTexture(64, 64));
      const renderer = await ReactThreeTestRenderer.create(
        <ResourceLoaderProvider loader={fake.loader}>
          <SceneResourcesProvider internalResources={[]} externalResources={[]}>
            <RichTextLabel
              {...painterEnv()}
              solveNode={solveNode('RTL', { text: TEXT, bbcodeEnabled: true, ...properties })}
              rect={{ x: 0, y: 0, w: 300, h: 200 }}
              renderOrder={5}
            />
          </SceneResourcesProvider>
        </ResourceLoaderProvider>
      );
      return renderer.scene
        .findAllByType('Mesh')
        .map((m) => ((m.instance as THREE.Mesh).material as THREE.Material).clippingPlanes?.length ?? 0);
    }

    it('gives the text, the underline and the image the label’s own four planes by default', async () => {
      const counts = await clipPlaneCounts({});
      expect(counts.length).toBeGreaterThanOrEqual(3);
      expect(new Set(counts)).toEqual(new Set([4]));
    });

    it('gives them the inherited planes, none here, with clipContents false', async () => {
      expect(new Set(await clipPlaneCounts({ clipContents: false }))).toEqual(new Set([0]));
    });
  });

  it('draws it at its natural size when the value form is a lone width and only a REGION is also present (aspect from the region, not the texture)', async () => {
    const renderer = await renderImage(`[img=40 region=0,0,80,40]${IMG}[/img]`, [64, 64]);
    const mesh = imageMeshOf(renderer);
    const geometry = mesh.geometry as THREE.PlaneGeometry;
    // region 80x40 (2:1) at width 40 -> height 20 (rich_text_label.cpp:4130-4134, float arithmetic).
    expect(geometry.parameters.width).toBe(40);
    expect(geometry.parameters.height).toBe(20);
  });

  it('draws nothing (never throws) for a sized [img] whose texture has not resolved yet', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={createFakeResourceLoader().loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[]}>
          <RichTextLabel
            {...painterEnv()}
            solveNode={solveNode('RTL', { text: `[img=10x10]${IMG}[/img]`, bbcodeEnabled: true })}
            rect={{ x: 0, y: 0, w: 300, h: 200 }}
            renderOrder={5}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(0);
  });

  it('modulates by color= times the walker tint once the texture has loaded', async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(IMG, fakeTexture(10, 10));
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider internalResources={[]} externalResources={[]}>
          <RichTextLabel
            {...painterEnv()}
            tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 1 })}
            solveNode={solveNode('RTL', {
              text: `[img=10x10 color=#e0a030]${IMG}[/img]`,
              bbcodeEnabled: true,
            })}
            rect={{ x: 0, y: 0, w: 300, h: 200 }}
            renderOrder={5}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    const mat = imageMeshOf(renderer).material as THREE.MeshBasicMaterial;
    const expected = expectedLinear(0.5 * (0xe0 / 255), 0.5 * (0xa0 / 255), 0.5 * (0x30 / 255));
    expect(mat.color.r).toBeCloseTo(expected.r, 5);
    expect(mat.color.g).toBeCloseTo(expected.g, 5);
    expect(mat.color.b).toBeCloseTo(expected.b, 5);
  });

  it("windows region= as a UV crop, normalised against the LOADED texture's own pixel size", async () => {
    const renderer = await renderImage(`[img=20x10 region=8,4,16,8]${IMG}[/img]`, [64, 32]);
    const map = imageMeshOf(renderer).material as THREE.MeshBasicMaterial;
    const texture = map.map!;
    // repeat = region size / texture size; offset.y flips, since three's V is bottom-up and Godot's region.y top-down.
    expect(texture.repeat.x).toBeCloseTo(16 / 64, 6);
    expect(texture.repeat.y).toBeCloseTo(8 / 32, 6);
    expect(texture.offset.x).toBeCloseTo(8 / 64, 6);
    expect(texture.offset.y).toBeCloseTo(1 - (4 + 8) / 32, 6);
  });

  it('draws no ATLAS text mesh for an [img]-only paragraph — the placeholder character never reaches TextRun', async () => {
    const renderer = await renderImage(`[img=10x10]${IMG}[/img]`, [64, 64]);
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.every((m) => !(m.material as THREE.ShaderMaterial).uniforms)).toBe(true);
  });

  it('draws both a preceding text run and the image on the same line', async () => {
    const renderer = await renderImage(`hi[img=10x10]${IMG}[/img]`, [64, 64]);
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(1);
    expect(meshes.some((m) => materialOf(m).type === 'MeshBasicMaterial')).toBe(true);
    expect(meshes.some((m) => materialOf(m).type !== 'MeshBasicMaterial')).toBe(true);
  });
});

describe('<RichTextLabel> scrollbar (rich_text_label.cpp:3801-3830)', () => {
  const TALL_BOX: Rect2 = { x: 0, y: 0, w: 160, h: 40 };
  const TEXT = 'Wave rift over quiet stone and amber light';

  /** The bar's track and grabber: `renderOrder` 5 is the node's, and the bar draws above its text. */
  async function barMeshes(properties: Record<string, unknown>, rect: Rect2) {
    const renderer = await render({ text: TEXT, ...properties }, rect);
    const meshes = meshesOf(renderer);
    return {
      tracks: meshes.filter((m) => m.renderOrder === 5 + SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET),
      grabbers: meshes.filter((m) => m.renderOrder === 5 + SCROLL_BAR_GRABBER_RENDER_ORDER_OFFSET),
    };
  }

  it('draws the track and the grabber when the text is taller than the rect', async () => {
    const { tracks, grabbers } = await barMeshes({}, TALL_BOX);
    expect(tracks).toHaveLength(1);
    expect(grabbers).toHaveLength(1);
    // The bar's own origin is the rect's right edge less its 8px: x 152.
    expect(tracks[0]!.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(152, 6);
  });

  it('mirrors the bar to the left edge under an RTL layout', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <RichTextLabel
        {...painterEnv()}
        solveNode={solveNode('RTL', { text: TEXT }, { rtl: true })}
        rect={TALL_BOX}
        renderOrder={5}
      />
    );
    const track = meshesOf(renderer).find((m) => m.renderOrder === 5 + SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET);
    expect(track?.getWorldPosition(new THREE.Vector3()).x).toBeCloseTo(0, 6);
  });

  it('draws no bar when scroll_active is false', async () => {
    const { tracks } = await barMeshes({ scrollActive: false }, TALL_BOX);
    expect(tracks).toHaveLength(0);
  });

  it('draws no bar when the text fits the rect', async () => {
    const { tracks } = await barMeshes({}, { x: 0, y: 0, w: 160, h: 80 });
    expect(tracks).toHaveLength(0);
  });
});

describe('<RichTextLabel> visible_characters (rich_text_label.cpp:943-947,668-671)', () => {
  const TEXT = 'Hello world';

  /** The text meshes, one per drawn line and run: `renderOrder` 5 is the node's, and the bar draws above it. */
  async function textMeshCount(properties: Record<string, unknown>, rect: Rect2) {
    const renderer = await render({ text: TEXT, ...properties }, rect);
    return meshesOf(renderer).filter((m) => m.renderOrder === 5).length;
  }

  it('draws no mesh at zero characters', async () => {
    expect(await textMeshCount({ visibleCharacters: 0 }, { x: 0, y: 0, w: 300, h: 100 })).toBe(0);
  });

  it('draws the whole text at -1 characters', async () => {
    expect(await textMeshCount({ visibleCharacters: -1 }, { x: 0, y: 0, w: 75, h: 100 })).toBe(2);
  });

  // `Hello wor` fits the 75px rect on one line and `Hello world` does not. Before Shaping shapes only
  // the prefix, so it keeps one line. After Shaping wraps the whole text and hides glyphs, so "wor" stays on line two.
  it('wraps the shown prefix again under Before Shaping and not under After Shaping', async () => {
    const rect = { x: 0, y: 0, w: 75, h: 100 };
    expect(await textMeshCount({ visibleCharacters: 9, visibleCharactersBehavior: 0 }, rect)).toBe(1);
    expect(await textMeshCount({ visibleCharacters: 9, visibleCharactersBehavior: 1 }, rect)).toBe(2);
  });

  // The parser counted 12 characters (an `[img]` Godot never loaded included), the text draws 11. A ratio written
  // last takes the characters it draws: 11 * 0.82 is 9, so one line. Without the ratio, 12 shows everything.
  it('derives the characters of a ratio from the text it draws', async () => {
    const rect = { x: 0, y: 0, w: 75, h: 100 };
    const staleCount = { visibleCharacters: 12, visibleRatio: 0.82 };
    expect(await textMeshCount({ ...staleCount, visibleRatioDrives: true }, rect)).toBe(1);
    expect(await textMeshCount(staleCount, rect)).toBe(2);
  });

  // `unit-rich-text-label-visible-characters-follow.tscn`: the bar shows over text that fits.
  it('shows the bar over text that fits when scroll_following_visible_characters is set', async () => {
    const renderer = await render(
      { text: TEXT, scrollFollowingVisibleCharacters: true },
      { x: 0, y: 0, w: 300, h: 100 }
    );
    const tracks = meshesOf(renderer).filter(
      (m) => m.renderOrder === 5 + SCROLL_BAR_TRACK_RENDER_ORDER_OFFSET
    );
    expect(tracks).toHaveLength(1);
  });
});
