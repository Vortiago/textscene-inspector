/**
 * `<LineEditNative>` render contract — chrome (StyleBox) + one clipped run of
 * text (placeholder/text/secret echo), no caret/selection/IME. Structure/
 * tint/clip/render-order assertions only (pixels are a golden-image concern
 * via `pnpm ref:godot`, not this suite).
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { nativeTheme } from '../../../../r3f/controls/native/nativeTheme';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { ControlCanvasWalker } from '../../../../r3f/controls/native/ControlCanvasWalker';
import { controlComponentRegistry, type ControlComponent } from '../../../../r3f/controls/ControlComponentRegistry';
import { Modulate2DContext } from '../../../../r3f/canvasItemModulate';
import { ControlClipProvider } from '../../../../r3f/controls/native/controlClipping';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import type { ControlProperties } from '../control/types';
import { LineEditNative } from './NativeComponent';
import { lineEditMinimumSize } from './nativeSolver';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

const VIEWPORT: Rect2 = { x: 0, y: 0, w: 1152, h: 648 };
const THEME = nativeTheme(1);
const DomStub: ControlComponent = () => null;
const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 30 };

function solveNode(
  properties: Partial<ControlProperties> = {},
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const node: TscnNode = {
    name: 'MyLineEdit',
    type: 'LineEdit',
    children: [],
    properties: { name: 'MyLineEdit', ...properties } as ControlProperties,
  };
  return { path: 'MyLineEdit', node, children: [], styleBoxes, textureSize: null };
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
    ...overrides,
  };
}

/** Every `<StyleBoxQuad>` mesh carries a `color` vertex attribute; `<TextRun>` does not. */
function findChromeMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
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
function findTextMesh(scene: { findAllByType: (t: string) => { instance: THREE.Mesh }[] }) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** The `<group position=[x,-y,0]>` directly wrapping the text mesh — its own local x/y give the pen offset. */
function findTextGroup(scene: {
  findAllByType: (t: string) => { instance: THREE.Object3D; children: { instance: THREE.Object3D }[] }[];
}) {
  return scene
    .findAllByType('Group')
    .map((g) => g.instance)
    .find((g) => g.children.some((c) => (c as THREE.Mesh).material && ((c as THREE.Mesh).material as THREE.ShaderMaterial).uniforms?.uColor !== undefined));
}

describe('<LineEditNative> — chrome (StyleBoxQuad)', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the default-theme "normal" StyleBox (with its bottom border) while editable', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const fill = findFillColor(mesh);
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6): sRGBChannelToLinear(0.1) ≈ 0.0100228.
    expect(fill.r).toBeCloseTo(0.0100228, 5);
    expect(fill.a).toBeCloseTo(0.6, 5);
  });

  it('switches to the default-theme "read_only" StyleBox once editable=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({ editable: false })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const fill = findFillColor(mesh);
    // style_disabled_color = Color(0.1, 0.1, 0.1, 0.3).
    expect(fill.a).toBeCloseTo(0.3, 5);
  });

  it('draws a resolved theme_override_styles/normal chrome, not the default fill, when one is present', async () => {
    const override = styleBox({ bgColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 } });
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({}, { normal: override })} rect={RECT} renderOrder={0} />
    );
    const mesh = findChromeMesh(renderer.scene)!;
    const fill = findFillColor(mesh);
    expect(fill.r).toBeCloseTo(sRGBChannelToLinear(0.9), 4);
  });

  it('flat=true draws NO chrome mesh at all, but still draws the text', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({ flat: true, text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMesh(renderer.scene)).toBeUndefined();
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('forwards renderOrder to the chrome mesh and the text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    expect(findChromeMesh(renderer.scene)!.renderOrder).toBe(7);
    expect(findTextMesh(renderer.scene)!.renderOrder).toBe(7);
  });
});

describe('<LineEditNative> — text: placeholder vs text vs secret echo', () => {
  it('draws NO text mesh when text and placeholder_text are both absent', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('draws the placeholder at font_placeholder_color (alpha 0.6) when text is empty', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative
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
      <LineEditNative
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
      <LineEditNative
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
      <LineEditNative
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
      <LineEditNative
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
    'the DEFAULT bullet secret character (•) has no glyph in the vendored ASCII atlas, so its echoed run draws ' +
      'zero visible quads — a real atlas-coverage gap, not a substitution-logic bug',
    async () => {
      const renderer = await ReactThreeTestRenderer.create(
        <LineEditNative {...painterEnv()} solveNode={solveNode({ text: 'hunter2', secret: true })} rect={RECT} renderOrder={0} />
      );
      const mesh = findTextMesh(renderer.scene)!;
      const indexAttr = (mesh.geometry as THREE.BufferGeometry).index!;
      expect(indexAttr.count).toBe(0);
    }
  );
});

describe('<LineEditNative> — alignment', () => {
  it('CENTER places the text run further right than LEFT (the default) for the same string', async () => {
    const leftRenderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const centerRenderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({ text: 'Hi', alignment: 1 })} rect={RECT} renderOrder={0} />
    );
    const leftX = findTextGroup(leftRenderer.scene)!.position.x;
    const centerX = findTextGroup(centerRenderer.scene)!.position.x;
    expect(centerX).toBeGreaterThan(leftX);
  });
});

describe('<LineEditNative> — tint composition', () => {
  it(
    'composes self_modulate onto chrome AND text, in the SAME product, without re-applying this node\'s own ' +
      'modulate (the ambient Modulate2DContext already carries it)',
    async () => {
      const flat = styleBox({ bgColor: { r: 1, g: 1, b: 1, a: 1 } });
      const renderer = await ReactThreeTestRenderer.create(
        <Modulate2DContext.Provider value={{ r: 0.5, g: 0.5, b: 0.5, a: 1 }}>
          <LineEditNative
            {...painterEnv()}
            solveNode={solveNode({ text: 'Hi', selfModulate: { r: 0.5, g: 0.5, b: 0.5, a: 1 } }, { normal: flat })}
            rect={RECT}
            renderOrder={0}
          />
        </Modulate2DContext.Provider>
      );
      const chromeColor = (findChromeMesh(renderer.scene)!.geometry as THREE.BufferGeometry).attributes
        .color as THREE.BufferAttribute;
      // own(sRGB) = ambient(0.5) * self_modulate(0.5) = 0.25, NOT 0.125 (squared).
      expect(chromeColor.getX(0)).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

      const textMaterial = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial;
      // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, THEN linearised.
      expect(textMaterial.uniforms.uColor!.value.x).toBeCloseTo(sRGBChannelToLinear(0.21875), 5);
    }
  );
});

describe('<LineEditNative> — content-rect clipping', () => {
  it("clips its own text to the content rect (inset by the ACTIVE stylebox's margins), narrower than the full outer rect", async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <LineEditNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
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
      <ControlClipProvider value={[inheritedPlane]}>
        <LineEditNative {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
      </ControlClipProvider>
    );
    const material = findTextMesh(renderer.scene)!.material as THREE.ShaderMaterial & {
      clippingPlanes?: THREE.Plane[];
    };
    expect(material.clippingPlanes).toContain(inheritedPlane);
  });
});

describe('<LineEditNative> registered through <ControlCanvasWalker> (end-to-end walker plumbing)', () => {
  it('honours visible === false on the LineEdit node itself (the WALKER hides the group, not this painter)', async () => {
    controlComponentRegistry.register({ typeName: 'LineEdit', Component: DomStub, Native: LineEditNative });
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
