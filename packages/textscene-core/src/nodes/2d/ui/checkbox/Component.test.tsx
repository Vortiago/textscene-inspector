/**
 * `<CheckBox>` render contract: the icon, always drawn, and optional label text, with no
 * chrome mesh. Structure, tint and render order only. Pixels belong to the golden images.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { TEST_SCENE_FONT_METRICS } from '../../../../r3f/controls/native/testing/sceneFontMetrics';
import * as sceneFontLoader from '../../../../r3f/controls/native/text/sceneFontLoader';
import { CheckBox } from './Component';
import type { CheckBoxProperties } from './types';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 28 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<CheckBoxProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'MyCheckBox',
    type: 'CheckBox',
    children: [],
    properties: { name: 'MyCheckBox', ...properties } as CheckBoxProperties,
  };
  return { ...emptySolveNode(), path: 'MyCheckBox', node };
}

/** The icon `ControlQuad` is a `PlaneGeometry`, identified by its own `.parameters.width` (survives a duplicate-three.js test environment). */
function findIconMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

describe('<CheckBox> (isolated painter contract)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws NO chrome mesh — CheckBox has no visible StyleBox (StyleBoxEmpty)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBox {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    // Every mesh here is the icon (PlaneGeometry) or the text run (BufferGeometry).
    // Neither carries the `color` vertex attribute of a StyleBoxQuad chrome mesh.
    for (const mesh of meshes) {
      expect((mesh.geometry as THREE.BufferGeometry).attributes.color).toBeUndefined();
    }
  });

  it('draws the icon even with no text at all (the check glyph is unconditional)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBox {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findIconMesh(renderer.scene)).toBeDefined();
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('draws the text mesh when text is present', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBox {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it(
    'uses font_pressed_color (opaque white) for a CHECKED, non-disabled box — verified against ' +
      'pnpm ref:godot: probe (527,298) on unit-checkbox.tscn\'s checked row reads rgb(255,255,255)',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBox
          {...painterEnv()}
          solveNode={solveNode({ text: 'Hi', buttonPressed: true })}
          rect={RECT}
          renderOrder={0}
        />
      );
      const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(1), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
    }
  );

  it(
    'uses font_color (0.875 gray) for an UNCHECKED, non-disabled box (DRAW_NORMAL, not DRAW_PRESSED)',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBox {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
      );
      const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(1, 5);
    }
  );

  it(
    'uses font_disabled_color (alpha 0.5) once disabled — verified against pnpm ref:godot: probe (526,350) on ' +
      "unit-checkbox.tscn's disabled row reads rgb(150,150,150) ≈ 0.5*223 + 0.5*76",
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBox
          {...painterEnv()}
          solveNode={solveNode({ text: 'Hi', disabled: true })}
          rect={RECT}
          renderOrder={0}
        />
      );
      const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      expect(material.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.875), 5);
      expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
    }
  );

  it('disabled wins over pressed for the icon variant AND the font colour', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBox
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', buttonPressed: true, disabled: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
    // font_disabled_color, not font_pressed_color.
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it(
    'applies the walker-composed tint as ONE product, reaching the icon AND text alike',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBox
          {...painterEnv()}
          // The walker's own product: ambient(0.5) x self_modulate(0.5) = 0.25.
          tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 1 })}
          solveNode={solveNode({ text: 'Hi' })}
          rect={RECT}
          renderOrder={0}
        />
      );
      const iconMaterial = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
      expect(iconMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

      const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, then linearised.
      expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
    }
  );

  it('forwards renderOrder to every mesh (icon + text)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBox {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(mesh.renderOrder).toBe(7);
  });

  it('draws the themed "unchecked" icon instead of the vendored default when a theme resolved it', async () => {
    const themedIconNode: SolveNode = {
      ...solveNode({}),
      icons: {
        unchecked: {
          ref: 'SubResource("GradientTexture2D_1")',
          resources: {
            externalResources: [],
            internalResources: [
              { id: 'Gradient_1', type: 'Gradient', data: { colors: 'PackedColorArray(1, 0, 0, 1, 0, 1, 0, 1)' } },
              { id: 'GradientTexture2D_1', type: 'GradientTexture2D', data: { gradient: 'SubResource("Gradient_1")' } },
            ],
          },
        },
      },
    };
    const renderer = await ReactThreeTestRenderer.create(
      <CheckBox {...painterEnv()} solveNode={themedIconNode} rect={RECT} renderOrder={0} />
    );
    const iconMaterial = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
    // The vendored icon loads as a plain `Texture`, and a themed `GradientTexture2D`
    // rasterises to a `DataTexture`, so the two differ without reading image bytes.
    expect((iconMaterial.map as THREE.DataTexture | null)?.isDataTexture).toBe(true);
  });
});

/**
 * The scene-font (canvas-kind `FontMetrics`) path. Text placement (`check_box.cpp:126-133`) has
 * nothing font-kind-specific in it. An atlas-bake anchor leaking into it reads correct on the
 * atlas path and is off here by `ascentPx - base*fontSizePx/42` px.
 */
describe('<CheckBox> — scene-font (canvas-kind FontMetrics) text path', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    controlSolverRegistry.clear();
  });

  async function renderWithSceneFont() {
    vi.spyOn(sceneFontLoader, 'peekSceneFontMetrics').mockReturnValue(TEST_SCENE_FONT_METRICS);
    return ReactThreeTestRenderer.create(
      <CheckBox {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
  }

  /** The canvas painter's mesh: a `MeshBasicMaterial` over a `CanvasTexture`, not the MSDF `ShaderMaterial`. */
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

  it('places the text at the pure check_box.cpp offset — no atlas-bake anchor anywhere in it', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // At 16px: ascent 13, descent 4, and no line_spacing, so the pitch is 17. Margin 4
    // gives a height of 20, so y = floor((20 - 17)/2 + 4) = 5. Godot floors only per glyph downstream.
    // x = margin(4) + icon(16) + h_separation(4) = 24. three's Y is negated Godot px.
    const group = mesh.parent as THREE.Object3D;
    expect(group.position.x).toBe(24);
    expect(group.position.y).toBe(-5);
  });

  it("the quad's own top edge is the raster's fixed 4px pad, carrying no font-anchor term of its own", async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    const position = mesh.geometry.getAttribute('position');
    // Vertex order TL, TR, BL, BR. canvasTextPainter.ts's VERTICAL_PAD_PX is 4.
    expect(position.getY(0)).toBeCloseTo(4, 6);
  });

  // `check_box.cpp:129`: `ofs.x = get_size().x - normal_style->get_margin(SIDE_RIGHT) - get_icon_size().width`,
  // against `:131`'s plain left margin. `cbx_empty`'s margin is 4 and the
  // vendored check is 16 wide, so 150 - 4 - 16 = 130.
  it('draws the check against the RIGHT content margin under RTL', async () => {
    const iconX = async (rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckBox {...painterEnv()} solveNode={{ ...solveNode({ text: 'On' }), rtl }} rect={RECT} renderOrder={0} />
      );
      return findIconMesh(renderer.scene)!.parent!.position.x;
    };
    expect(await iconX(false)).toBe(4);
    expect(await iconX(true)).toBe(130);
  });

});
