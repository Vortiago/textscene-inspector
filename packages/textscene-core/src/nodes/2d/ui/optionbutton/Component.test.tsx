/**
 * Tests the `<OptionButton>` render contract: StyleBox chrome, the selected item's text and the chevron
 * arrow. It asserts structure, tint and render order only: pixels belong to the golden images and
 * `pnpm ref:godot`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { textQuadCounts } from '../../../../r3f/controls/native/testing/textQuadCounts';
import { OptionButton } from './Component';
import type { OptionButtonProperties } from './types';
import { controlNode, solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import {
  findIconMeshes,
  findTextMesh,
  OWN_ICON_REF,
  OWN_ICON_SCOPE,
  renderUnloaded,
  renderWithOwnIcon,
  worldPosition,
} from '../../../../r3f/controls/native/testing/ownIcon';

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 32 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<OptionButtonProperties> = {}): SolveNode {
  const node: TscnNode = controlNode('MyOptionButton', 'OptionButton', {
    name: 'MyOptionButton',
    ...properties,
  });
  return { ...emptySolveNode(), path: 'MyOptionButton', node };
}

const ITEMS = [
  { text: 'Easy', id: 0 },
  { text: 'Normal', id: 1 },
  { text: 'Hard', id: 2 },
];

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>`/`<ControlQuad>` do not. */
function findChromeMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** The arrow `ControlQuad` is a `PlaneGeometry`, identified by its own `.parameters.width`. */
function findArrowMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find(
      (m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined
    );
}

describe('<OptionButton> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the chrome StyleBox using the default-theme normal fill', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6).
    // Raw sRGB: the StyleBox vertex attribute is decoded per fragment (`StyleBoxQuad.tsx`).
    expect(color.getX(0)).toBeCloseTo(0.1, 5);
    expect(color.getW(0)).toBeCloseTo(0.6, 5);
  });

  it('switches to the disabled fill once disabled=true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({ disabled: true })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    expect(color.getW(0)).toBeCloseTo(0.3, 5);
  });

  it('draws the pressed fill once button_pressed=true (style_pressed_color)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ buttonPressed: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
    expect(color.getX(0)).toBeCloseTo(0, 5);
    expect(color.getW(0)).toBeCloseTo(0.6, 5);
  });

  it('uses control_font_pressed_color for the label once button_pressed=true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1, buttonPressed: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(1, 5);
  });

  it('skips the chrome StyleBox when flat, keeping the arrow', async () => {
    // `OptionButton : Button`, and Button's `if (!flat)` (`button.cpp:216`) paints the stylebox beneath
    // everything OptionButton draws. The minimum size keeps the margins either way (`button.cpp:525`).
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({ flat: true })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMesh(renderer.scene)).toBeUndefined();
    expect(findArrowMesh(renderer.scene)).toBeDefined();
  });

  it('always draws the chevron arrow, even with zero items (has_theme_icon is unconditional)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findArrowMesh(renderer.scene)).toBeDefined();
  });

  it('draws NO text mesh when selected is absent/out of range', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 99 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it("draws the SELECTED item's text, not the first item's", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('uses control_font_color (0.875 sRGB) for the NORMAL label', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
  });

  it('uses control_font_disabled_color (alpha 0.5) for the DISABLED label', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1, disabled: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it('applies the walker-composed tint as ONE product, reaching chrome, arrow AND text alike', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        // The walker's own product: ambient(0.5) x self_modulate(0.5) = 0.25.
        tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 1 })}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const chromeColor = (findChromeMesh(renderer.scene)!.geometry as THREE.BufferGeometry).attributes
      .color as THREE.BufferAttribute;
    expect(chromeColor.getX(0)).toBeCloseTo(0.1 * 0.25, 4);

    const arrowMaterial = findArrowMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
    expect(arrowMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

    const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, then linearised.
    expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
  });

  it('forwards renderOrder to every mesh (chrome, arrow, text)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={7}
      />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThanOrEqual(3);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(7);
  });
});

/**
 * The scene-font path (canvas-kind `FontMetrics`) end to end. OptionButton's placement
 * (`option_button.cpp:113-121` plus Button's internal margin) has nothing font-kind-specific, so an
 * atlas-bake anchor leaking into it reads correct on the atlas path and is `ascentPx - base*fontSizePx/42` px off here.
 */
describe('<OptionButton>: scene-font (canvas-kind FontMetrics) text path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    controlSolverRegistry.clear();
  });

  async function renderWithSceneFont() {
    vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    return ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: ITEMS, selected: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
  }

  /** The canvas painter's mesh: a plain `MeshBasicMaterial` over the raster's `DataTexture`, never the MSDF `ShaderMaterial` `findTextMesh` looks for. */
  function findCanvasTextMesh(scene: Rendered['scene']) {
    return scene
      .findAllByType('Mesh')
      .map((m) => m.instance as THREE.Mesh)
      .find((m) => (m.material as THREE.MeshBasicMaterial).map instanceof THREE.DataTexture);
  }

  it('paints the selected item through the canvas rasteriser — ONE quad, not one per glyph, and no MSDF material', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene);
    expect(mesh).toBeDefined();
    expect(mesh!.geometry.getAttribute('position').count).toBe(4);
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('places the text at the pure option_button.cpp offset — no atlas-bake anchor anywhere in it', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Scene font at 16px: ascent ceil(800*16/1000) = 13, descent 4, and a Button-family control reads no
    // line_spacing, so textNaturalSize.y = 17. OptionButton's margins are 8 by 4 (default_theme.cpp:212-215),
    // so customElementHeight = 32 - 8 = 24 and y = floor((24 - 17)/2 + 4) = 7, floored per glyph downstream
    // (`layoutButtonContent`). x = styleMargin.left = 8, and three's Y is negated Godot px.
    const group = mesh.parent as THREE.Object3D;
    expect(group.position.x).toBe(8);
    expect(group.position.y).toBe(-7);
  });

  it("the quad's own top edge is the raster's fixed 4px pad, carrying no font-anchor term of its own", async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Vertex order TL, TR, BL, BR; canvasTextPainter.ts's VERTICAL_PAD_PX is 4.
    expect(mesh.geometry.getAttribute('position').getY(0)).toBeCloseTo(4, 6);
  });

  // `option_button.cpp:126`: under RTL the arrow sits `arrow_margin` in from the leading edge, against
  // `:128`'s `size.width - arrow width - arrow_margin`. With `arrow_margin` 4 and the 12-wide chevron, the
  // LTR arm is 150 - 12 - 4 = 134.
  it('draws the arrow at arrow_margin from the LEFT edge under RTL', async () => {
    const arrowX = async (rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <OptionButton
          {...painterEnv()}
          solveNode={{ ...solveNode({ items: ITEMS, selected: 1 }), rtl }}
          rect={RECT}
          renderOrder={0}
        />
      );
      return findArrowMesh(renderer.scene)!.parent!.position.x;
    };
    expect(await arrowX(false)).toBe(134);
    expect(await arrowX(true)).toBe(4);
  });
});

describe('<OptionButton>: text_overrun_behavior trims the label to its paragraph box (button.cpp:428-432)', () => {
  const glyphQuadCount = (r: Rendered) => findTextMesh(r.scene)!.geometry.attributes.position!.count / 4;

  async function render(properties: Partial<OptionButtonProperties>) {
    return ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'AAAA BBBB CCCC', id: 0 }], selected: 0, ...properties })}
        rect={{ x: 0, y: 0, w: 112, h: 32 }}
        renderOrder={0}
      />
    );
  }

  it('draws only the whole words that fit under OVERRUN_TRIM_WORD', async () => {
    // 'AAAA BBBB' is 88.6 px, wider than the 80 px box: the word trim keeps 'AAAA' (4 quads), where the
    // paragraph cut alone keeps the glyphs of 'BBB' too.
    const trimmed = await render({ overrunBehavior: 2 });
    const cut = await render({ overrunBehavior: 0 });
    expect(glyphQuadCount(trimmed)).toBe(4);
    expect(glyphQuadCount(cut)).toBeGreaterThan(4);
  });
});

describe('<OptionButton>: autowrap_mode wraps the drawn label though the box keeps one line (button.cpp:428-432)', () => {
  async function render(properties: Partial<OptionButtonProperties>) {
    return ReactThreeTestRenderer.create(
      <OptionButton
        {...painterEnv()}
        solveNode={solveNode({ items: [{ text: 'alpha bravo charlie', id: 0 }], selected: 0, ...properties })}
        rect={{ x: 0, y: 0, w: 100, h: 40 }}
        renderOrder={0}
      />
    );
  }

  it('draws three lines', async () => {
    const wrapped = await render({ autowrapMode: 2 });
    expect(textQuadCounts(wrapped.scene)).toEqual([5, 5, 7]);
  });

  it('draws one line at AUTOWRAP_OFF', async () => {
    const unwrapped = await render({});
    expect(textQuadCounts(unwrapped.scene)).toHaveLength(1);
  });
});

describe("<OptionButton>: the selected item's icon (option_button.cpp:424, button.cpp:333-405)", () => {
  const ICON_ITEMS = [
    { text: 'Easy', id: 0 },
    { text: 'Hard', id: 1, icon: OWN_ICON_REF },
  ];
  const painter = (selected: number) => (
    <OptionButton
      {...painterEnv()}
      solveNode={{
        ...solveNode({ items: ICON_ITEMS, selected }),
        resources: OWN_ICON_SCOPE,
        textureSize: { x: 12, y: 12 },
        textureSlots: { icon: { x: 12, y: 12 } },
      }}
      rect={RECT}
      renderOrder={0}
    />
  );
  const groupOf = (mesh: THREE.Mesh) => mesh.parent!.position;

  it('draws the icon at the left margin, ahead of the arrow', async () => {
    const [icon, arrow] = findIconMeshes((await renderWithOwnIcon(painter(1), { w: 12, h: 12 })).scene);
    expect([groupOf(icon!).x, groupOf(icon!).y]).toEqual([8, -10]);
    expect(groupOf(arrow!).x).toBe(134);
  });

  it('moves the label past the icon and h_separation: 8 + 12 + 4', async () => {
    const renderer = await renderWithOwnIcon(painter(1), { w: 12, h: 12 });
    expect(worldPosition(findTextMesh(renderer.scene)!).x).toBe(24);
  });

  it('draws only the arrow for a selected item without an icon', async () => {
    const renderer = await renderWithOwnIcon(painter(0), { w: 12, h: 12 });
    expect(findIconMeshes(renderer.scene)).toHaveLength(1);
  });

  it("lays the label out for the solver's icon size before the texture loads", async () => {
    const unloaded = await renderUnloaded(painter(1));
    const loaded = await renderWithOwnIcon(painter(1), { w: 12, h: 12 });
    expect(findIconMeshes(unloaded.scene)).toHaveLength(1);
    expect(worldPosition(findTextMesh(unloaded.scene)!).x).toBe(worldPosition(findTextMesh(loaded.scene)!).x);
  });
});
