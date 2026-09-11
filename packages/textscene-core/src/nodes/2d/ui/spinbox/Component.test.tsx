/**
 * `<SpinBox>` render contract — field chrome (LineEdit-style) + one clipped
 * run of formatted text + up/down stepper icons. No button background mesh
 * absent an explicit `theme_override_styles/*` override (both are `StyleBoxEmpty`
 * in the default theme). Structure/tint/render-order assertions only (pixels
 * are a golden-image concern via `pnpm ref:godot`, not this suite).
 */
import { afterEach, describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import type { StyleBoxFlatData } from '../../../../r3f/controls/native/styleBoxFlat';
import { controlSolverRegistry } from '../../../../r3f/controls/native/solverRegistry';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { SpinBox } from './Component';
import type { SpinBoxProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 100, h: 30 };

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
  const node: TscnNode = {
    name: 'MySpinBox',
    type: 'SpinBox',
    children: [],
    properties: { name: 'MySpinBox', ...properties } as SpinBoxProperties,
  };
  return { ...emptySolveNode(), path: 'MySpinBox', node, styleBoxes };
}

/** A `<StyleBoxQuad>` mesh — the only kind carrying a `color` vertex attribute. */
function findChromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

/** `<TextRun>`'s mesh carries the MSDF `ShaderMaterial` (`uColor`/`uOpacity` uniforms). */
function findTextMesh(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .find((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** The two arrow icon `ControlQuad` meshes — `PlaneGeometry`, in source order (up, then down). */
function findIconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as unknown as { parameters?: { width?: number } }).parameters?.width === 16);
}

function fillColor(mesh: THREE.Mesh) {
  const color = (mesh.geometry as THREE.BufferGeometry).attributes.color as THREE.BufferAttribute;
  for (let i = 0; i < color.count; i++) {
    if (color.getX(i) > 0.0001) return { r: color.getX(i), g: color.getY(i), b: color.getZ(i), a: color.getW(i) };
  }
  throw new Error('no fill vertex found');
}

describe('<SpinBox> — field chrome + text', () => {
  afterEach(() => {
    controlSolverRegistry.clear();
  });

  it('draws the default-theme "normal" field box while editable, and formats the value with prefix/suffix', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox {...painterEnv()} solveNode={solveNode({ prefix: '$', suffix: 'kg', value: 5, step: 1 })} rect={RECT} renderOrder={0} />
    );
    const fields = findChromeMeshes(renderer.scene);
    expect(fields.length).toBe(1);
    // style_normal_color = Color(0.1, 0.1, 0.1, 0.6).
    expect(fillColor(fields[0]!).a).toBeCloseTo(0.6, 5);
    expect(findTextMesh(renderer.scene)).toBeDefined();
  });

  it('switches to the "read_only" field box once editable=false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox {...painterEnv()} solveNode={solveNode({ editable: false })} rect={RECT} renderOrder={0} />
    );
    const fields = findChromeMeshes(renderer.scene);
    // style_disabled_color = Color(0.1, 0.1, 0.1, 0.3).
    expect(fillColor(fields[0]!).a).toBeCloseTo(0.3, 5);
  });

  it('draws no button-background mesh at all absent a theme_override_styles override (StyleBoxEmpty defaults)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox {...painterEnv()} solveNode={solveNode()} rect={RECT} renderOrder={0} />
    );
    // The ONE chrome mesh with vertex colours is the field itself.
    expect(findChromeMeshes(renderer.scene).length).toBe(1);
  });

  it('draws an up_background override once one is authored', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox {...painterEnv()} solveNode={solveNode({}, { up_background: FAKE_STYLEBOX })} rect={RECT} renderOrder={0} />
    );
    expect(findChromeMeshes(renderer.scene).length).toBe(2);
  });

  it('draws a field_and_buttons_separator override once one is authored', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox
        {...painterEnv()}
        solveNode={solveNode({}, { field_and_buttons_separator: FAKE_STYLEBOX })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(findChromeMeshes(renderer.scene).length).toBe(2);
  });
});

describe('<SpinBox> — stepper icons', () => {
  it('always draws both arrow icons', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox {...painterEnv()} solveNode={solveNode()} rect={RECT} renderOrder={0} />
    );
    expect(findIconMeshes(renderer.scene).length).toBe(2);
  });

  it('dims the up icon once the value is at max without allow_greater', async () => {
    const atMax = await ReactThreeTestRenderer.create(
      <SpinBox
        {...painterEnv()}
        solveNode={solveNode({ minValue: 0, maxValue: 10, value: 10, step: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const belowMax = await ReactThreeTestRenderer.create(
      <SpinBox
        {...painterEnv()}
        solveNode={solveNode({ minValue: 0, maxValue: 10, value: 5, step: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const [upAtMax] = findIconMeshes(atMax.scene);
    const [upBelowMax] = findIconMeshes(belowMax.scene);
    const opacityAtMax = (upAtMax!.material as THREE.MeshBasicMaterial).opacity;
    const opacityBelowMax = (upBelowMax!.material as THREE.MeshBasicMaterial).opacity;
    expect(opacityAtMax).toBeLessThan(opacityBelowMax);
  });

  it('dims BOTH icons when not editable, whatever the value', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox
        {...painterEnv()}
        solveNode={solveNode({ editable: false, minValue: 0, maxValue: 10, value: 5, step: 1 })}
        rect={RECT}
        renderOrder={0}
      />
    );
    const [up, down] = findIconMeshes(renderer.scene);
    expect((up!.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.5, 5);
    expect((down!.material as THREE.MeshBasicMaterial).opacity).toBeCloseTo(0.5, 5);
  });
});

describe('<SpinBox> — render order', () => {
  it('forwards renderOrder to the field chrome and the text mesh', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SpinBox {...painterEnv()} solveNode={solveNode({ value: 3, step: 1 })} rect={RECT} renderOrder={7} />
    );
    const fields = findChromeMeshes(renderer.scene);
    expect(fields[0]!.renderOrder).toBe(7);
    expect(findTextMesh(renderer.scene)!.renderOrder).toBe(7);
  });
});
