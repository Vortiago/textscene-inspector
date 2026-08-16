/**
 * `<LineEdit>` render contract — chrome (StyleBox) + one clipped run of
 * text (placeholder/text/secret echo), no caret/selection/IME. Structure/
 * tint/clip/render-order assertions only (pixels are a golden-image concern
 * via `pnpm ref:godot`, not this suite).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { ControlClipProvider } from '../../../../r3f/controls/native/controlClipping';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { LineEditProperties } from './types';
import { LineEdit } from './Component';
import { lineEditMinimumSize } from './nativeSolver';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 30 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(
  properties: Partial<LineEditProperties> = {},
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const node: TscnNode = {
    name: 'MyLineEdit',
    type: 'LineEdit',
    children: [],
    properties: { name: 'MyLineEdit', ...properties } as LineEditProperties,
  };
  return { ...emptySolveNode(), path: 'MyLineEdit', node, styleBoxes };
}

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };

function styleBox(overrides: Partial<StyleBoxFlatData> = {}): StyleBoxFlatData {
  return {
    bgColor: { r: 0.2, g: 0.3, b: 0.4, a: 1 },
    borderColor: { r: 0, g: 0, b: 0, a: 1 },
    borderWidth: { ...ZERO_SIDES },
    cornerRadius: { ...ZERO_CORNERS },
    expandMargin: { ...ZERO_SIDES },
    contentMargin: { left: 4, top: 4, right: 4, bottom: 4 },
    drawCenter: true,
    borderBlend: false,
    antiAliased: true,
    aaSize: 1,
    cornerDetail: 8,
    skew: { x: 0, y: 0 },
    shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
    shadowSize: 0,
    shadowOffset: { x: 0, y: 0 },
    ...overrides,
  };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>` does not. */
function findChromeMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/**
 * The FILL colour of a chrome mesh — NOT necessarily vertex 0: LineEdit's own
 * stylebox draws a border ring (its bottom border) BEFORE the centre fill
 * (`styleBoxFlatGeometry.ts`'s `drawRoundedRectangle` call order), so vertex 0
 * is the border colour whenever one is present. The fill's `r` channel is
 * never exactly 0 in this suite's fixtures (unlike the border, always black),
 * so the first non-zero-`r` vertex is unambiguously the fill.
 */
function findFillColor(mesh: THREE.Mesh): { r: number; g: number; b: number; a: number } {
  const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < color.count; i++) {
    if (color.getX(i) > 0.0001) {
      return { r: color.getX(i), g: color.getY(i), b: color.getZ(i), a: color.getW(i) };
    }
  }
  throw new Error('no fill vertex found in chrome mesh');
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms); the chrome does not. */
function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** The `<group position=[x,-y,0]>` directly wrapping the text mesh — its own local x/y give the pen offset. */
function findTextGroup(scene: Rendered['scene']) {
  return scene
    .findAllByType('Group')
    .map((g) => g.instance)
    .find((g) =>
      g.children.some(
        (c) =>
          (c as THREE.Mesh).material &&
          ((c as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.uColor !== undefined
      )
    );
}

describe('<LineEdit> — chrome (StyleBoxQuad)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the default-theme "normal" StyleBox (with its bottom border) while editable', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const fill = findFillColor(mesh);
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6), read raw — the StyleBox
    // vertex attribute is decoded per fragment (`StyleBoxQuad.tsx`).
    expect(fill.r).toBeCloseTo(0.1, 5);
    expect(fill.a).toBeCloseTo(0.6, 5);
  });

  it('switches to the default-theme "read_only" StyleBox once editable=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ editable: false })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const fill = findFillColor(mesh);
    // style_disabled_color = Color(0.1, 0.1, 0.1, 0.3).
    expect(fill.a).toBeCloseTo(0.3, 5);
  });

  it('draws a resolved theme_override_styles/normal chrome, not the default fill, when one is present', async () => {
    const override = styleBox({ bgColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({}, { normal: override })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const fill = findFillColor(mesh);
    expect(fill.r).toBeCloseTo(0.9, 4);
  });

  it('flat=true draws NO chrome mesh at all, but still draws the text', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ flat: true, text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMesh(renderer.scene)).toBeUndefined();
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('forwards renderOrder to the chrome mesh and the text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    expect(findChromeMesh(renderer.scene)!.renderOrder).toBe(7);
    expect(findTextMesh(renderer.scene)!.renderOrder).toBe(7);
  });
});

describe('<LineEdit> — text: placeholder vs text vs secret echo', () => {
  it('draws NO text mesh when text and placeholder_text are both absent', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('draws the placeholder at font_placeholder_color (alpha 0.6) when text is empty', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit
        {...painterEnv()}
        solveNode={solveNode({ placeholderText: 'Enter text' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.6, 5);
  });

  it('draws real text at font_color (alpha 1) when editable, even with a placeholder also set', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'Ada', placeholderText: 'Enter text' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it('draws real text at font_uneditable_color (alpha 0.5) once editable=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'Read only', editable: false })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it('a non-editable EMPTY field still shows its placeholder (not font_uneditable_color) — using_placeholder wins', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit
        {...painterEnv()}
        solveNode={solveNode({ editable: false, placeholderText: 'Enter text' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.6, 5);
  });

  it('secret=true substitutes an ASCII secret_character repeated to the text length (glyph count survives the atlas)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit
        {...painterEnv()}
        solveNode={solveNode({ text: 'hunter2', secret: true, secretCharacter: '*' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const mesh = findTextMesh(renderer.scene)!;
    const indexAttr = (mesh.geometry as THREE.BufferGeometry).index!;
    // 6 indices (two triangles) per glyph quad; 'hunter2' is 7 characters.
    expect(indexAttr.count).toBe(7 * 6);
  });

  it(
    'the DEFAULT secret character — U+2022 BULLET, what LineEdit ships with when the scene overrides nothing — ' +
      'draws one quad per character, exactly like an ASCII override',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'hunter2', secret: true })} rect={RECT} renderOrder={0} />
      );
      const mesh = findTextMesh(renderer.scene)!;
      const indexAttr = (mesh.geometry as THREE.BufferGeometry).index!;
      // The un-overridden path must not be the degenerate one: an atlas missing
      // this glyph drew ZERO quads here while every ASCII override drew the full
      // run, so the default — the only spelling most scenes ever use — was the
      // one spelling that rendered nothing.
      expect(indexAttr.count).toBe(7 * 6);
    }
  );
});

describe('<LineEdit> — alignment', () => {
  it('CENTER places the text run further right than LEFT (the default) for the same string', async () => {
    const leftRenderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const centerRenderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'Hi', alignment: 1 })} rect={RECT} renderOrder={0} />
    );
    const leftX = findTextGroup(leftRenderer.scene)!.position.x;
    const centerX = findTextGroup(centerRenderer.scene)!.position.x;
    expect(centerX).toBeGreaterThan(leftX);
  });
});

describe('<LineEdit> — tint composition', () => {
  it(
    'applies the walker-composed tint as ONE product, reaching chrome AND text alike',
    async () => {
      const flat = styleBox({ bgColor: { r: 1, g: 1, b: 1, a: 1 } });
      const renderer = await ReactThreeTestRenderer.create(
        <LineEdit
          {...painterEnv()}
          // The walker's own product: ambient(0.5) x self_modulate(0.5) = 0.25.
          tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 1 })}
          solveNode={solveNode({ text: 'Hi' }, { normal: flat })}
          rect={RECT}
          renderOrder={0}
        />
      );
      const chromeColor = (findChromeMesh(renderer.scene)!.geometry as THREE.BufferGeometry).attributes
        .color as THREE.BufferAttribute;
      // The StyleBox's own white bgColor x tint(0.25) = 0.25, in sRGB.
      expect(chromeColor.getX(0)).toBeCloseTo(0.25, 4);

      const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, THEN linearised.
      expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
    }
  );
});

describe('<LineEdit> — content-rect clipping', () => {
  it("clips its own text to the content rect (inset by the ACTIVE stylebox's margins), narrower than the full outer rect", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial & {
      clippingPlanes?: THREE.Plane[];
    };
    const planes = material.clippingPlanes!;
    expect(planes.length).toBeGreaterThanOrEqual(4);
    // Inside the margin-inset content box.
    const inside = new THREE.Vector3(100, -15, 0);
    expect(planes.every((p) => p.distanceToPoint(inside) >= 0)).toBe(true);
    // Inside the OUTER rect (200x30) but past the 4px right content margin.
    const pastContentRight = new THREE.Vector3(199, -15, 0);
    expect(planes.some((p) => p.distanceToPoint(pastContentRight) < 0)).toBe(true);
  });

  it('merges its own content-rect planes onto whatever it inherited from an ancestor', async () => {
    const inheritedPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
    const renderer = await ReactThreeTestRenderer.create(
      <ControlClipProvider value={{ planes: [inheritedPlane], rect: null }}>
        <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
      </ControlClipProvider>
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial & {
      clippingPlanes?: THREE.Plane[];
    };
    expect(material.clippingPlanes).toContain(inheritedPlane);
  });
});

describe('<LineEdit> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('honours visible === false on the LineEdit node itself (the WALKER hides the group, not this painter)', async () => {
    controlComponentRegistry.register({ typeName: 'LineEdit', Component: LineEdit });
    controlSolverRegistry.clear();
    controlSolverRegistry.registerMinimumSize('LineEdit', lineEditMinimumSize);
    const root = solveNode({ anchorsPreset: 15, visible: false, text: 'Hi' });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as { visible: boolean; name: string });
    const rootGroup = groups.find((g) => g.name === 'LineEdit:MyLineEdit');
    expect(rootGroup).toBeDefined();
    expect(rootGroup!.visible).toBe(false);

    controlComponentRegistry.clear();
    controlSolverRegistry.clear();
  });
});

/**
 * The SCENE-FONT (canvas-kind `FontMetrics`) path end to end. LineEdit's own
 * text placement is `line_edit.cpp:1392-1427`'s `x_ofs`/`y_ofs`, with NOTHING
 * font-kind-specific in it — this pins that, since an atlas-bake anchor
 * leaking back into the placement would be invisible on the atlas path (where
 * it would read as the correct total) and wrong here by
 * `ascentPx - base*fontSizePx/42` px.
 */
describe('<LineEdit> — scene-font (canvas-kind FontMetrics) text path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    controlSolverRegistry.clear();
  });

  async function renderWithSceneFont() {
    vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    return ReactThreeTestRenderer.create(
      <LineEdit {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
  }

  /** The canvas painter's mesh — a plain `MeshBasicMaterial` over a `CanvasTexture`, never the MSDF `ShaderMaterial` `findTextMesh` looks for. */
  function findCanvasTextMesh(scene: Rendered['scene']) {
    return scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .find((m) => (m.material as THREE.MeshBasicMaterial).map instanceof THREE.CanvasTexture);
  }

  it('paints the run through the canvas rasteriser — ONE quad, not one per glyph, and no MSDF material', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene);
    expect(mesh).toBeDefined();
    expect(mesh!.geometry.getAttribute('position').count).toBe(4);
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('places the text at the pure line_edit.cpp offset — no atlas-bake anchor anywhere in it', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Scene font at 16px: ascentPx = ceil(800*16/1000) = 13, descentPx =
    // ceil(200*16/1000) = 4; LineEdit sets no line_spacing, so linePitchPx =
    // 17 and textHeightPx = 17. contentMargin 4 -> y_area = trunc(30-4-4) = 22,
    // y_ofs = trunc(4 + (22-17)/2) = trunc(6.5) = 6; x_ofs = 4 (LEFT).
    // three's Y is negated Godot px.
    const group = mesh.parent as THREE.Object3D;
    expect(group.position.x).toBe(4);
    expect(group.position.y).toBe(-6);
  });

  it("the quad's own top edge is the raster's fixed 4px pad, carrying no font-anchor term of its own", async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Vertex order TL, TR, BL, BR; canvasTextPainter.ts's VERTICAL_PAD_PX is 4.
    expect(mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(4, 6);
  });
});
