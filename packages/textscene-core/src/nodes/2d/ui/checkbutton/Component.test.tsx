/**
 * `<CheckButton>` render contract: a toggle-switch icon, always drawn at the right edge, and
 * optional label text, over the chrome of a themed state box. Structure, tint and render order only.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { sRGBChannelToLinear } from '../../../../utils/colorSpace';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { CheckButton } from './Component';
import type { CheckButtonProperties } from './types';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import {
  findIconMeshes,
  OWN_ICON_REF,
  OWN_ICON_SCOPE,
  renderUnloaded,
  renderWithOwnIcon,
  findTextMesh,
  worldPosition,
} from '../../../../r3f/controls/native/testing/ownIcon';
import { CHECK_BUTTON_ICONS } from '../../../../r3f/controls/native/themeIcons';
import { drawnStyleBox } from '../../../../r3f/controls/native/testing/drawnStyleBox';
import {
  bundledRunMeshes,
  bundledRuns,
  inkedGlyphCount,
  inkedGlyphCounts,
} from '../../../../r3f/controls/native/testing/bundledRunStub';
import { themeIconSource } from '../../../../r3f/controls/native/themeIconSource';

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

const RECT: Rect2 = { x: 0, y: 0, w: 150, h: 28 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(properties: Partial<CheckButtonProperties> = {}): SolveNode {
  const node: TscnNode = controlNode('MyCheckButton', 'CheckButton', {
    name: 'MyCheckButton',
    ...properties,
  });
  return withThemeItems({ ...emptySolveNode(), path: 'MyCheckButton', node });
}

/** The StyleBox quads: only `<StyleBoxQuad>` builds a geometry with vertex colours. */
function findChromeMeshes(scene: Rendered['scene']): THREE.Mesh[] {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((mesh) => (mesh.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

describe('<CheckButton> (isolated painter contract)', () => {
  it('draws no chrome mesh by default: every default box is a StyleBoxEmpty', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws a themed state box as chrome, as Button does (button.cpp:214-218)', async () => {
    const themed = { ...solveNode({ text: 'Hi' }), styleBoxes: { normal: drawnStyleBox() } };
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={themed} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws no themed state box while flat (button.cpp:216)', async () => {
    const themed = { ...solveNode({ text: 'Hi', flat: true }), styleBoxes: { normal: drawnStyleBox() } };
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={themed} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws the toggle icon even with no text at all (unconditional)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    expect(findIconMeshes(renderer.scene)[0]).toBeDefined();
    expect(findTextMesh(renderer.scene)).toBeUndefined();
  });

  it('the icon sits flush against the RIGHT edge, not the left', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({})} rect={RECT} renderOrder={0} />
    );
    const mesh = findIconMeshes(renderer.scene)[0]!;
    const group = mesh.parent as THREE.Object3D;
    // icon width 32, marginX 6: x = 150 - (32+6) = 112.
    expect(group.position.x).toBe(112);
  });

  it('draws the text mesh when text is present', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(bundledRunMeshes(renderer.scene)[0]).toBeDefined();
  });

  it('uses font_pressed_color (opaque white) when checked and not disabled', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', buttonPressed: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const tint = bundledRuns(renderer.scene)[0]!.tint;
    expect(tint.r).toBeCloseTo(1, 5);
    expect(tint.a).toBeCloseTo(1, 5);
  });

  it('uses font_color (0.875 gray) for an unchecked, non-disabled switch', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const tint = bundledRuns(renderer.scene)[0]!.tint;
    expect(tint.r).toBeCloseTo(0.875, 5);
  });

  it('uses font_disabled_color (alpha 0.5) once disabled', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', disabled: true })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const tint = bundledRuns(renderer.scene)[0]!.tint;
    expect(tint.a).toBeCloseTo(0.5, 5);
  });

  it('applies the walker-composed tint as ONE product, reaching the icon AND text alike', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        tint={painterTint({ r: 0.25, g: 0.25, b: 0.25, a: 1 })}
        solveNode={solveNode({ text: 'Hi' })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const iconMaterial = findIconMeshes(renderer.scene)[0]!.material as THREE.MeshBasicMaterial;
    // button_unchecked_color(1) * own(0.25) = 0.25 in sRGB, linearised.
    expect(iconMaterial.color.r).toBeCloseTo(sRGBChannelToLinear(0.25), 4);

    const textTint = bundledRuns(renderer.scene)[0]!.tint;
    // control_font_color(0.875) * own(0.25) = 0.21875 in sRGB, linearised.
    expect(textTint.r).toBeCloseTo(0.21875, 5);
  });

  it('keeps every mesh inside its own unit of render order (icon and text)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={7} />
    );
    const meshes = renderer.scene.findAllByType('Mesh').map((m) => m.instance as THREE.Mesh);
    expect(meshes.length).toBeGreaterThan(0);
    for (const mesh of meshes) expect(Math.floor(mesh.renderOrder)).toBe(7);
  });

  it("defaults text alignment to LEFT (CheckButton's own constructor override), not Button's CENTER", async () => {
    const rendererLeft = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    const rendererCenter = await ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'Hi', alignment: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const leftGroup = bundledRunMeshes(rendererLeft.scene)[0]!.parent as THREE.Object3D;
    const centerGroup = bundledRunMeshes(rendererCenter.scene)[0]!.parent as THREE.Object3D;
    // marginX(6) alone for the default. An explicit CENTER override shifts it further right.
    expect(leftGroup.position.x).toBe(6);
    expect(centerGroup.position.x).toBeGreaterThan(leftGroup.position.x);
  });

  // `check_button.cpp:135`: `ofs.x = normal_style->get_margin(SIDE_LEFT)` under
  // RTL, against `:137`'s `size.width - (tex_size.width + margin(SIDE_RIGHT))`.
  // `cb_empty`'s X margin is 6 and the vendored toggle is 32 wide, so the LTR
  // arm is 150 - (32 + 6) = 112.
  it('draws the toggle at the LEFT content margin under RTL', async () => {
    const iconX = async (rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckButton
          {...painterEnv()}
          solveNode={{ ...solveNode({ text: 'On' }), rtl }}
          rect={RECT}
          renderOrder={0}
        />
      );
      return findIconMeshes(renderer.scene)[0]!.parent!.position.x;
    };
    expect(await iconX(false)).toBe(112);
    expect(await iconX(true)).toBe(6);
  });

  // `check_button.cpp:109-120` swaps the whole icon table for the `_mirrored`
  // one, a separately authored SVG (`default_theme.cpp:332-335`).
  it('draws the MIRRORED toggle SVG under RTL', async () => {
    const iconSrc = async (rtl: boolean) => {
      const renderer = await ReactThreeTestRenderer.create(
        <CheckButton {...painterEnv()} solveNode={{ ...solveNode({}), rtl }} rect={RECT} renderOrder={0} />
      );
      const material = findIconMeshes(renderer.scene)[0]!.material as THREE.MeshBasicMaterial;
      return (material.map!.image as { src?: string }).src;
    };
    expect(await iconSrc(false)).toBe(themeIconSource(CHECK_BUTTON_ICONS.unchecked, 1));
    expect(await iconSrc(true)).toBe(themeIconSource(CHECK_BUTTON_ICONS.uncheckedMirrored, 1));
  });
});

describe('<CheckButton>: text_overrun_behavior trims the label to its paragraph box (button.cpp:428-432)', () => {
  const inkedCount = (r: Rendered) => inkedGlyphCount(bundledRuns(r.scene)[0]!);

  async function render(properties: Partial<CheckButtonProperties>) {
    return ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'AAAA BBBB CCCC', ...properties })}
        rect={{ x: 0, y: 0, w: 108, h: 28 }}
        renderOrder={0}
      />
    );
  }

  it('draws only the whole words that fit under OVERRUN_TRIM_WORD', async () => {
    // 'AAAA BBBB' is 88.6 px, wider than the 80 px box: the word trim keeps the 4 glyphs of 'AAAA',
    // where the paragraph cut alone keeps the glyphs of 'BBB' too.
    const trimmed = await render({ overrunBehavior: 2 });
    const cut = await render({ overrunBehavior: 0 });
    expect(inkedCount(trimmed)).toBe(4);
    expect(inkedCount(cut)).toBeGreaterThan(4);
  });
});

describe('<CheckButton>: autowrap_mode wraps the label at its paragraph box (button.cpp:428-432)', () => {
  async function render(properties: Partial<CheckButtonProperties>) {
    return ReactThreeTestRenderer.create(
      <CheckButton
        {...painterEnv()}
        solveNode={solveNode({ text: 'alpha bravo charlie', ...properties })}
        rect={{ x: 0, y: 0, w: 100, h: 77 }}
        renderOrder={0}
      />
    );
  }

  it('draws three lines', async () => {
    const wrapped = await render({ autowrapMode: 2 });
    expect(inkedGlyphCounts(wrapped.scene)).toHaveLength(3);
  });

  it('draws one line at AUTOWRAP_OFF', async () => {
    const unwrapped = await render({});
    expect(inkedGlyphCounts(unwrapped.scene)).toHaveLength(1);
  });
});

describe("<CheckButton>: Button's inherited icon (button.cpp:333-405)", () => {
  async function render(properties: Partial<CheckButtonProperties>, rtl = false) {
    const node: SolveNode = {
      ...solveNode({ icon: OWN_ICON_REF, ...properties }),
      resources: OWN_ICON_SCOPE,
      textureSize: { x: 12, y: 12 },
      textureSlots: { icon: { x: 12, y: 12 } },
      rtl,
    };
    return renderWithOwnIcon(<CheckButton {...painterEnv()} solveNode={node} rect={RECT} renderOrder={0} />, {
      w: 12,
      h: 12,
    });
  }
  const groupOf = (mesh: THREE.Mesh) => mesh.parent!.position;

  it('draws no second quad without an icon', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <CheckButton {...painterEnv()} solveNode={solveNode({ text: 'Hi' })} rect={RECT} renderOrder={0} />
    );
    expect(findIconMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws the icon at the left margin and the toggle at the right edge, 12 px square', async () => {
    const [icon, toggle] = findIconMeshes((await render({ text: 'Hi' })).scene);
    // The toggle keeps x = 150 - (32 + 6). The icon starts at the margin 6 and floors y: 4 + (20 - 12) / 2.
    expect([groupOf(toggle!).x, groupOf(toggle!).y]).toEqual([112, -6]);
    expect([groupOf(icon!).x, groupOf(icon!).y]).toEqual([6, -8]);
    const { parameters } = icon!.geometry as THREE.PlaneGeometry;
    expect([parameters.width, parameters.height]).toEqual([12, 12]);
  });

  it('draws a RIGHT icon before the toggle and its separation', async () => {
    const [icon] = findIconMeshes((await render({ text: 'Hi', iconAlignment: 2 })).scene);
    expect(groupOf(icon!).x).toBe(96);
  });

  it('draws a LEFT icon at the right margin, the toggle being on the left, under RTL', async () => {
    const [icon, toggle] = findIconMeshes((await render({ text: 'Hi' }, true)).scene);
    expect(groupOf(toggle!).x).toBe(6);
    expect(groupOf(icon!).x).toBe(132);
  });

  it('dims the icon to icon_disabled_color alpha 0.4', async () => {
    const [icon] = findIconMeshes((await render({ disabled: true })).scene);
    expect((icon!.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.4, 5);
  });

  it("lays the label out for the solver's icon size before the texture loads", async () => {
    const node: SolveNode = {
      ...solveNode({ icon: OWN_ICON_REF, text: 'Hi' }),
      resources: OWN_ICON_SCOPE,
      textureSize: { x: 12, y: 12 },
      textureSlots: { icon: { x: 12, y: 12 } },
    };
    const painter = <CheckButton {...painterEnv()} solveNode={node} rect={RECT} renderOrder={0} />;
    const unloaded = await renderUnloaded(painter);
    const loaded = await renderWithOwnIcon(painter, { w: 12, h: 12 });
    // Only the toggle draws until the icon loads, yet the label is already where the solver sized it.
    expect(findIconMeshes(unloaded.scene)).toHaveLength(1);
    expect(worldPosition(findTextMesh(unloaded.scene)!).x).toBe(worldPosition(findTextMesh(loaded.scene)!).x);
  });
});
