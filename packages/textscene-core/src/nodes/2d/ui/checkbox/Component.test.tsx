/**
 * `<CheckBox>` render contract — icon (always drawn, checked/unchecked/
 * radio variant) + optional label text, NO chrome mesh. Structure/tint/
 * render-order assertions only (pixels are a golden-image concern via
 * `pnpm ref:godot`, not this suite).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
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
    // Every mesh here is either the icon (PlaneGeometry, .parameters) or the
    // text run (BufferGeometry, no .parameters) — none carries a `color`
    // vertex attribute the way a StyleBoxQuad chrome mesh would.
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
    // font_disabled_color, NOT font_pressed_color.
    expect(material.uniforms.uOpacity!.value).toBeCloseTo(0.5, 5);
  });

  it(
    'composes the ambient inherited tint and self_modulate into ONE product, reaching the icon AND text alike',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
          <CheckBox
            {...painterEnv()}
            solveNode={solveNode({ text: 'Hi', selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } })}
            rect={RECT}
            renderOrder={0}
          />
        </Modulate2DContext.Provider>
      );
      // own(sRGB) = ambient(0.5) * self_modulate(0.5) = 0.25.
      const iconMaterial = findIconMesh(renderer.scene)!.material as THREE.MeshBasicMaterial;
      expect(iconMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

      const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, THEN linearised.
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
});

/**
 * The SCENE-FONT (canvas-kind `FontMetrics`) path end to end. CheckBox's own
 * text placement is `check_box.cpp:126-133` + Button's internal-margin
 * reservation, with NOTHING font-kind-specific in it — this pins that, since
 * an atlas-bake anchor leaking back into the placement would be invisible on
 * the atlas path (where it would look like the correct total) and wrong here
 * by `ascentPx - base*fontSizePx/42` px.
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

  it('places the text at the pure check_box.cpp offset — no atlas-bake anchor anywhere in it', async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    // Scene font at 16px: ascentPx = ceil(800*16/1000) = 13, descentPx =
    // ceil(200*16/1000) = 4; CheckBox is Button-family and reads no
    // line_spacing (lineSpacingPx: 0), so linePitchPx = 17 and
    // textNaturalSize.y = 17. contentMargin 4 -> customElementHeight =
    // 28 - 2*4 = 20; y = floor((20 - 17)/2 + 4) = floor(5.5) = 5 (never
    // floored in the source itself, only per-glyph downstream —
    // `buttonBase.ts`'s `layoutButtonContent` has the full citation).
    // x = margin(4) + icon(16) + h_separation(4) = 24. three's Y is negated
    // Godot px.
    const group = mesh.parent as THREE.Object3D;
    expect(group.position.x).toBe(24);
    expect(group.position.y).toBe(-5);
  });

  it("the quad's own top edge is the raster's fixed 4px pad, carrying no font-anchor term of its own", async () => {
    const renderer = await renderWithSceneFont();
    const mesh = findCanvasTextMesh(renderer.scene)!;
    const position = mesh.geometry.getAttribute('position');
    // Vertex order TL, TR, BL, BR; canvasTextPainter.ts's VERTICAL_PAD_PX is 4.
    expect(position.getY(0)).toBeCloseTo(4, 6);
  });
});
