/**
 * `<SpinBox>` render contract: its painter draws the stepper icons, with no button background
 * without a `theme_override_styles/*` override (both are `StyleBoxEmpty` by default), and the walk
 * draws its internal LineEdit field. It asserts structure, tint and render order, not pixels.
 */
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../godot/math/rect2';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { walked, WALK_VIEWPORT } from '../../../../r3f/controls/native/testing/walk';
import '../../../../r3f/controls/index';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import {
  controlNode,
  solveNode as emptySolveNode,
  withThemeItems,
} from '../../../../r3f/controls/native/testing/solveNode';
import { SpinBox } from './Component';
import { countTintSplit, splitTints } from '../../../../r3f/controls/native/testing/tintSplit';
import type { SpinBoxProperties } from './types';
import {
  bundledRunMeshes,
  bundledRuns,
  runGlyphs,
} from '../../../../r3f/controls/native/testing/bundledRunStub';

vi.mock('../../../../r3f/contexts/ProjectSettingsContext', () => ({
  useProjectSettings: () => ({ settings: null, viewportSize: { width: 1152, height: 648 }, themeScale: 1 }),
}));

// A run of the bundled face is a stub mesh that carries its props, so no test decodes the font.
vi.mock('../../../../r3f/controls/native/text/BundledCanvasRun', async () => ({
  default: (await import('../../../../r3f/controls/native/testing/bundledRunStub')).BundledRunStub,
}));

/** Wider than the field's minimum plus the buttons block, so the solve keeps the authored width. */
const RECT: Rect2 = { x: 0, y: 0, w: 140, h: 30 };

const FAKE_STYLEBOX: StyleBoxFlatData = {
  bgColor: { r: 0.9, g: 0.1, b: 0.1, a: 1 },
  borderColor: { r: 0, g: 0, b: 0, a: 1 },
  borderWidth: { left: 0, top: 0, right: 0, bottom: 0 },
  cornerRadius: { topLeft: 0, topRight: 0, bottomRight: 0, bottomLeft: 0 },
  expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
  contentMargin: { left: 0, top: 0, right: 0, bottom: 0 },
  drawCenter: true,
  borderBlend: false,
  antiAliased: true,
  aaSize: 1,
  cornerDetail: 8,
  skew: { x: 0, y: 0 },
  shadowColor: { r: 0, g: 0, b: 0, a: 0.6 },
  shadowSize: 0,
  shadowOffset: { x: 0, y: 0 },
};

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function solveNode(
  properties: Partial<SpinBoxProperties> = {},
  styleBoxes: Record<string, StyleBoxFlatData> = {}
): SolveNode {
  const node: TscnNode = controlNode('MySpinBox', 'SpinBox', {
    name: 'MySpinBox',
    offsetRight: RECT.w,
    offsetBottom: RECT.h,
    ...properties,
  });
  return withThemeItems({ ...emptySolveNode(), path: 'MySpinBox', node, styleBoxes });
}

function painted(spinBox: SolveNode, renderOrder = 0) {
  return ReactThreeTestRenderer.create(
    <SpinBox {...painterEnv()} solveNode={spinBox} rect={RECT} renderOrder={renderOrder} />
  );
}

/** A `<StyleBoxQuad>` mesh, the only kind carrying a `color` vertex attribute. */
function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** The two arrow icon `ControlQuad` meshes (`PlaneGeometry`), in source order: up, then down. */
function findIconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width === 16);
}

function fillColor(mesh: THREE.Mesh) {
  const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < color.count; i++) {
    if (color.getX(i) > 0.0001)
      return { r: color.getX(i), g: color.getY(i), b: color.getZ(i), a: color.getW(i) };
  }
  throw new Error('no fill vertex found');
}

describe('<SpinBox> painter: button backgrounds', () => {
  it('draws no chrome at all absent a theme_override_styles override (StyleBoxEmpty defaults)', async () => {
    const renderer = await painted(solveNode());
    expect(findChromeMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws an up_background override once one is authored', async () => {
    const renderer = await painted(solveNode({}, { up_background: FAKE_STYLEBOX }));
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws a field_and_buttons_separator override once one is authored', async () => {
    const renderer = await painted(solveNode({}, { field_and_buttons_separator: FAKE_STYLEBOX }));
    expect(findChromeMeshes(renderer.scene)).toHaveLength(1);
  });

  it('leaves the field to the internal LineEdit: no text run of its own', async () => {
    const renderer = await painted(solveNode({ value: 5, step: 1 }));
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(0);
  });
});

describe('<SpinBox> painter: stepper icons', () => {
  it('always draws both arrow icons', async () => {
    const renderer = await painted(solveNode());
    expect(findIconMeshes(renderer.scene)).toHaveLength(2);
  });

  it('dims the up icon once the value is at max without allow_greater', async () => {
    const atMax = await painted(solveNode({ minValue: 0, maxValue: 10, value: 10, step: 1 }));
    const belowMax = await painted(solveNode({ minValue: 0, maxValue: 10, value: 5, step: 1 }));
    const [upAtMax] = findIconMeshes(atMax.scene);
    const [upBelowMax] = findIconMeshes(belowMax.scene);
    const opacityAtMax = (upAtMax!.material as THREE.MeshBasicMaterial).opacity;
    const opacityBelowMax = (upBelowMax!.material as THREE.MeshBasicMaterial).opacity;
    expect(opacityAtMax).toBeLessThan(opacityBelowMax);
  });

  it('dims BOTH icons when not editable, whatever the value', async () => {
    const renderer = await painted(
      solveNode({ editable: false, minValue: 0, maxValue: 10, value: 5, step: 1 })
    );
    const [up, down] = findIconMeshes(renderer.scene);
    expect((up!.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.5, 5);
    expect((down!.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.5, 5);
  });

  it('forwards renderOrder to the arrows', async () => {
    const renderer = await painted(solveNode(), 7);
    expect(findIconMeshes(renderer.scene).map((m) => m.renderOrder)).toEqual([7, 7]);
  });

  it('tints the arrows with tint, and draws nothing with childTint', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox
        {...painterEnv()}
        {...splitTints}
        solveNode={solveNode({ value: 42 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(countTintSplit(renderer.scene)).toEqual({ own: 2, child: 0 });
  });
});

describe('<SpinBox> in the walk: the internal LineEdit field', () => {
  it('draws the default-theme "normal" field box while editable, and the value with prefix and suffix', async () => {
    const renderer = await walked(solveNode({ prefix: '$', suffix: 'kg', value: 5, step: 1 }));
    const fields = findChromeMeshes(renderer.scene);
    expect(fields).toHaveLength(1);
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6).
    expect(fillColor(fields[0]!).a).toBeCloseTo(0.6, 5);
    expect(bundledRunMeshes(renderer.scene)).toHaveLength(1);
  });

  it('switches to the "read_only" field box once editable=false', async () => {
    const renderer = await walked(solveNode({ editable: false }));
    // style_disabled_color = Color(0.1, 0.1, 0.1, 0.3).
    expect(fillColor(findChromeMeshes(renderer.scene)[0]!).a).toBeCloseTo(0.3, 5);
  });
});

describe('<SpinBox> in the walk: RTL layout', () => {
  /** The widest button icon is the vendored 16, so the buttons block is 18 wide. */
  const BUTTONS_BLOCK_WIDTH = 18;
  /** Under RTL the SpinBox's own offsets mirror in the viewport too (`control.cpp:1785-1787`). */
  const SPIN_BOX_LEFT_RTL = WALK_VIEWPORT.w - RECT.w;

  const fieldLeft = async (rtl: boolean) => {
    const renderer = await walked({ ...solveNode({ value: 5, step: 1 }), rtl });
    return findChromeMeshes(renderer.scene)[0]!.getWorldPosition(new THREE.Vector3()).x;
  };

  it('draws the field right of the buttons block under RTL (spin_box.cpp:394-395)', async () => {
    expect(await fieldLeft(true)).toBeCloseTo(SPIN_BOX_LEFT_RTL + BUTTONS_BLOCK_WIDTH, 5);
  });

  it('leaves the field at the SpinBox origin under LTR', async () => {
    expect(await fieldLeft(false)).toBeCloseTo(0, 5);
  });

  it('right-aligns the field text under RTL, as the internal LineEdit reads the same direction (line_edit.cpp:1399-1403)', async () => {
    const textLeft = async (rtl: boolean) => {
      const renderer = await walked({ ...solveNode({ value: 5, step: 1 }), rtl });
      return bundledRunMeshes(renderer.scene)[0]!.getWorldPosition(new THREE.Vector3()).x;
    };
    expect(await textLeft(true)).toBeGreaterThan(
      (await textLeft(false)) + SPIN_BOX_LEFT_RTL + BUTTONS_BLOCK_WIDTH
    );
  });
});

describe('<SpinBox> in the walk: field text direction (line_edit.cpp:3103-3112)', () => {
  /** The characters of the drawn glyphs, left to right. */
  async function drawnCharacters(locale: string): Promise<string[]> {
    const renderer = await walked({
      ...solveNode({ prefix: '$', value: -12.5, step: 0.5, localizeNumeralSystem: false }),
      locale,
    });
    return [...runGlyphs(bundledRuns(renderer.scene)[0]!)]
      .sort((a, b) => a.x - b.x)
      .map((glyph) => glyph.char);
  }

  it('draws the prefix as the first glyph under a left-to-right locale', async () => {
    expect((await drawnCharacters('en'))[0]).toBe('$');
  });

  it('draws the prefix as the last glyph under a right-to-left locale', async () => {
    expect((await drawnCharacters('ar')).at(-1)).toBe('$');
  });
});
