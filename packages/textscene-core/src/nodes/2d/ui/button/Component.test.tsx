/**
 * `<Button>` render contract — chrome (StyleBox) + text + optional
 * icon, composed from `buttonBase.ts` + this node's own theme resolution.
 * Structure/tint/render-order assertions only (pixels are a golden-image
 * concern via `pnpm ref:godot`, not this suite).
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
import { SceneResourcesProvider } from '../../../../r3f/SceneResourcesContext';
import { ResourceLoaderProvider } from '../../../../resources/ResourceLoaderContext';
import { createFakeResourceLoader } from '../../../../resources/testing/createFakeResourceLoader';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { ButtonProperties } from './types';
import { Button } from './Component';
import { buttonMinimumSize } from './nativeSolver';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const ZERO_SIDES = { left: 0, top: 0, right: 0, bottom: 0 };
const ZERO_CORNERS = { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 };
const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const RECT: Rect2 = { x: 0, y: 0, w: 120, h: 32 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

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

function solveNode(
  properties: Partial<ButtonProperties> = {},
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const node: TscnNode = {
    name: 'MyButton',
    type: 'Button',
    children: [],
    properties: { name: 'MyButton', ...properties } as ButtonProperties,
  };
  return { ...emptySolveNode(), path: 'MyButton', node, styleBoxes };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/`<ControlQuad>` do not. */
function findChromeMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms); nothing else in this painter does. */
function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/**
 * `<ControlQuad>` (the icon) is a `PlaneGeometry` — identified by its own
 * `.parameters.width` (set directly by the constructor, so this survives
 * even under a duplicate-three.js-instance test environment where
 * `instanceof THREE.PlaneGeometry` cannot be trusted), distinguishing it from
 * the chrome's hand-built BufferGeometry (no `.parameters` at all) and the
 * text's glyph BufferGeometry (ditto).
 */
function findIconMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

describe('<Button> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the resolved theme_override_styles/normal chrome, not the default fill, when one is present', async () => {
    const override = styleBox({ bgColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({}, { normal: override })} rect={RECT} renderOrder={5} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // Raw sRGB — the StyleBox vertex attribute is decoded per fragment (`StyleBoxQuad.tsx`).
    expect(color.getX(0)).toBeCloseTo(0.9, 4);
  });

  it('falls back to the default-theme button.normal StyleBox when no override resolves', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({}, {})} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6). // Raw sRGB — the StyleBox vertex attribute is decoded per fragment (`StyleBoxQuad.tsx`).
    expect(color.getX(0)).toBeCloseTo(0.1, 5);
    expect(color.getW(0)).toBeCloseTo(0.6, 5);
  });

  it('switches to the default-theme button.disabled StyleBox once disabled=true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({ disabled: true }, {})} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_disabled_color = Color(0.1, 0.1, 0.1, 0.3).
    expect(color.getW(0)).toBeCloseTo(0.3, 5);
  });

  it('flat=true draws NO chrome mesh at all, but still draws the text', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({ flat: true, text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMesh(renderer.scene)).toBeUndefined();
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('draws NO text mesh when text is absent/empty', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it("uses control_font_color (0.875 sRGB) for the NORMAL label, tinted the object's own colour, not an approximation", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const mesh = findTextMesh(renderer.scene)!;
    const material = mesh.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it(
    'uses control_font_disabled_color (alpha 0.5) for the DISABLED label — the exact theme constant, ' +
      'not the DOM overlay\'s 0.6-opacity approximation comparison.md documents closing',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <Button {...painterEnv()} solveNode={solveNode({ text: 'Hi', disabled: true })} rect={RECT} renderOrder={0} />
      );
      const mesh = findTextMesh(renderer.scene)!;
      const material = mesh.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
    }
  );

  it(
    'applies the walker-composed tint as ONE product, reaching chrome AND text alike',
    async () => {
      const flat = styleBox({ bgColor: { r: 1, g: 1, b: 1, a: 1 } });
      const renderer = await ReactThreeTestRenderer.create(
        <Button {...painterEnv()}
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

  it('forwards renderOrder to the chrome mesh and to the text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    expect(findChromeMesh(renderer.scene)!.renderOrder).toBe(7);
    // `<TextRun>` takes `renderOrder` itself now, so every mesh carries it —
    // no reliance on a group-order cascade an intermediate group could reset.
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(7);
  });
});

describe('<Button> — icon (ControlQuad), via ResourceLoader/SceneResources', () => {
  const ICON_PATH = 'res://icon.png';

  function fakeTexture(w: number, h: number): THREE.Texture {
    const tex = new THREE.Texture();
    (tex as unknown as { image: { width: number; height: number } }).image = { width: w, height: h };
    return tex;
  }

  async function renderWithIcon(properties: Partial<ButtonProperties>, iconSize: { w: number; h: number }) {
    const fake = createFakeResourceLoader();
    fake.textures.seed(ICON_PATH, fakeTexture(iconSize.w, iconSize.h));
    return ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider externalResources={[{ id: '1', type: 'Texture2D', path: ICON_PATH }]}>
          <Button {...painterEnv()}
            solveNode={solveNode({ icon: 'ExtResource("1")', ...properties })}
            rect={RECT}
            renderOrder={0}
          />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
  }

  it('draws no icon quad at all when the node has no icon reference', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findIconMesh(renderer.scene)).toBeUndefined();
  });

  it('draws the resolved icon texture as a ControlQuad once it loads', async () => {
    const renderer = await renderWithIcon({}, { w: 16, h: 16 });
    const mesh = findIconMesh(renderer.scene);
    expect(mesh).toBeDefined();
    const material = mesh!.material as THREE.MeshBasicMaterial;
    expect(material.map).not.toBeNull();
  });

  it('tints the icon opaque white (icon_normal_color) in the NORMAL state', async () => {
    const renderer = await renderWithIcon({}, { w: 16, h: 16 });
    const material = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(1, 5);
  });

  it('tints the icon to 0.4 alpha (icon_disabled_color) in the DISABLED state', async () => {
    const renderer = await renderWithIcon({ disabled: true }, { w: 16, h: 16 });
    const material = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
    expect(material.opacity).toBeCloseTo(0.4, 5);
  });

  it('forwards renderOrder to the icon mesh too', async () => {
    const fake = createFakeResourceLoader();
    fake.textures.seed(ICON_PATH, fakeTexture(16, 16));
    const renderer = await ReactThreeTestRenderer.create(
      <ResourceLoaderProvider loader={fake.loader}>
        <SceneResourcesProvider externalResources={[{ id: '1', type: 'Texture2D', path: ICON_PATH }]}>
          <Button {...painterEnv()} solveNode={solveNode({ icon: 'ExtResource("1")' })} rect={RECT} renderOrder={9} />
        </SceneResourcesProvider>
      </ResourceLoaderProvider>
    );
    expect(findIconMesh(renderer.scene)!.renderOrder).toBe(9);
  });
});

describe('<Button> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('honours visible === false on the Button node itself (the WALKER hides the group, not this painter)', async () => {
    controlComponentRegistry.register({ typeName: 'Button', Component: Button });
    controlSolverRegistry.clear();
    controlSolverRegistry.registerMinimumSize('Button', buttonMinimumSize);
    const root = solveNode({ anchorsPreset: 15, visible: false, text: 'Hi' });

    const renderer = await ReactThreeTestRenderer.create(
      <ControlCanvasWalker tree={[root]} generation={0} viewport={VIEWPORT} theme={THEME} measurer={null} />
    );

    const groups = renderer.scene.findAllByType('Group').map((g) => g.instance as { visible: boolean; name: string });
    const rootGroup = groups.find((g) => g.name === 'Button:MyButton');
    expect(rootGroup).toBeDefined();
    expect(rootGroup!.visible).toBe(false);

    controlComponentRegistry.clear();
    controlSolverRegistry.clear();
  });
});

/**
 * The SCENE-FONT (canvas-kind `FontMetrics`) path end to end. Button's own
 * text placement is `button.cpp:233-456` (`buttonBase.ts`'s
 * `layoutButtonContent`), with NOTHING font-kind-specific in it — this pins
 * that, since an atlas-bake anchor leaking back into the placement would be
 * invisible on the atlas path (where it would read as the correct total) and
 * wrong here by `ascentPx - base*fontSizePx/42` px.
 */
describe('<Button> — scene-font (canvas-kind FontMetrics) text path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    controlSolverRegistry.clear();
  });

  async function renderWithSceneFont() {
    vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    return ReactThreeTestRenderer.create(
      <Button {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
  }

  /** The canvas painter's mesh — a plain `MeshBasicMaterial` over a `CanvasTexture`, never the MSDF `ShaderMaterial` `findTextMesh` looks for. */
  function findCanvasTextMesh(scene: Rendered['scene']) {
    return scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .find((m) => (m.material as THREE.MeshBasicMaterial).map instanceof THREE.CanvasTexture);
  }

  it('paints the label through the canvas rasteriser — ONE quad, not one per glyph, and no MSDF material', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene);
    expect(mesh).toBeDefined();
    expect(mesh!.geometry.getAttribute('position').count).toBe(4);
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('places the text at the pure button.cpp offset — no atlas-bake anchor anywhere in it', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Scene font at 16px: ascentPx = ceil(800*16/1000) = 13, descentPx =
    // ceil(200*16/1000) = 4; Button sets no line_spacing, so linePitchPx = 17
    // and textNaturalSize = (2 chars * 500*16/1000 = 16, 17). Default theme
    // contentMargin 4 -> customElementSize = (112, 24), drawable = the same
    // (no icon); y = floor((24 - 17)/2 + 4) = floor(7.5) = 7 — `text_ofs.y`
    // itself is never floored in the source, but the per-glyph floor it DOES
    // apply downstream (`text_server_adv.cpp:4083`) lands on the identical
    // pixel once ascent (always whole here) is added back, so flooring here
    // is equivalent (`buttonBase.ts`'s `layoutButtonContent` has the full
    // citation); alignment defaults to CENTER, so x = 4 + (112 - 16)/2 = 52.
    // three's Y is negated Godot px.
    const group = mesh.parent as THREE.Object3D;
    expect(group.position.x).toBe(52);
    expect(group.position.y).toBe(-7);
  });

  it("the quad's own top edge is the raster's fixed 4px pad, carrying no font-anchor term of its own", async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Vertex order TL, TR, BL, BR; canvasTextPainter.ts's VERTICAL_PAD_PX is 4.
    expect(mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(4, 6);
  });
});
