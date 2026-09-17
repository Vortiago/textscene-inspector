/**
 * `<GraphFrame>` render contract — panel/titlebar chrome, title text,
 * resizer. Structure/tint assertions only (pixels are a golden-image
 * concern via `pnpm ref:godot`, not this suite).
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { styleBoxTextureBox } from '../../../../r3f/controls/native/parseStyleBox';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { GraphFrame } from './Component';
import type { GraphFrameProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function graphFrame(properties: Partial<GraphFrameProperties> = {}): SolveNode {
  const node: TscnNode = {
    name: 'F',
    type: 'GraphFrame',
    children: [],
    properties: { name: 'F', ...properties } as GraphFrameProperties,
  };
  return { ...emptySolveNode(), path: 'F', node };
}

function chromeMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.geometry as THREE.BufferGeometry).attributes.color !== undefined);
}

function iconMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter(
      (m) =>
        (m.geometry as THREE.BufferGeometry).attributes.color === undefined &&
        (m.material as THREE.ShaderMaterial).uniforms?.uColor === undefined
    );
}

function textMeshes(scene: Rendered['scene']) {
  return scene
    .findAllByType('Mesh')
    .map((m) => m.instance as THREE.Mesh)
    .filter((m) => (m.material as THREE.ShaderMaterial).uniforms?.uColor !== undefined);
}

/** A `panel` slot holding a StyleBoxTexture, as a themed project would author. */
function texturePanel(properties: Partial<GraphFrameProperties> = {}): SolveNode {
  const n = graphFrame(properties);
  return {
    ...n,
    styleBoxes: {
      panel: styleBoxTextureBox({
        texture: 'res://frame.png',
        resources: { externalResources: [], internalResources: [] },
        margin: { left: 4, top: 4, right: 4, bottom: 4 },
        contentMargin: { left: 4, top: 4, right: 4, bottom: 4 },
        expandMargin: { left: 0, top: 0, right: 0, bottom: 0 },
        regionRect: undefined,
        axisStretchHorizontal: 0,
        axisStretchVertical: 0,
        drawCenter: true,
        modulateColor: { r: 1, g: 1, b: 1, a: 1 },
      }),
    },
  };
}

describe('<GraphFrame> — the two tint arms (graph_frame.cpp:113-126)', () => {
  /**
   * `:126` — the untinted arm draws `sb_panel_flat` alone, so a `panel` slot
   * holding a StyleBoxTexture is not drawn at all. That is the engine's own
   * behaviour rather than a gap here: the titlebar still draws, so the frame
   * does not vanish.
   *
   * With tinting ON the other arm (`:120-124`) draws it, MODULATED by
   * `tint_color` — a multiply, where the flat arm substitutes `bg_color`. That
   * arm is not asserted here: it needs a resolved texture, so it belongs to
   * `StyleBoxQuad`'s own loader-backed tests rather than to this painter's.
   */
  it('draws no body panel for a texture slot when tinting is off', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame {...painterEnv()} solveNode={texturePanel()} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(1);
  });

});

describe('<GraphFrame> (isolated painter contract)', () => {
  it('draws exactly two chrome meshes (panel + titlebar) with no title', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame {...painterEnv()} solveNode={graphFrame()} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(2);
    expect(textMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws a text mesh for a non-empty title', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame {...painterEnv()} solveNode={graphFrame({ title: 'Hello' })} rect={RECT} renderOrder={0} />
    );
    expect(textMeshes(renderer.scene).length).toBeGreaterThan(0);
  });

  it('draws no resizer when resizable is unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame {...painterEnv()} solveNode={graphFrame()} rect={RECT} renderOrder={0} />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws no resizer when resizable is true but autoshrink_enabled stays at its true default', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame {...painterEnv()} solveNode={graphFrame({ resizable: true })} rect={RECT} renderOrder={0} />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws the resizer only when resizable AND autoshrink_enabled=false (graph_frame.cpp:133)', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame
        {...painterEnv()}
        solveNode={graphFrame({ resizable: true, autoshrinkEnabled: false })}
        rect={RECT}
        renderOrder={0}
      />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(1);
  });
});

describe('<GraphFrame> chrome placement', () => {
  /** World Y of a mesh, in three space (Godot Y-down is negated by the painter). */
  function worldY(scene: Rendered['scene'], mesh: THREE.Mesh) {
    scene.instance.updateMatrixWorld(true);
    return mesh.getWorldPosition(new THREE.Vector3()).y;
  }

  /** A mesh's own height, from its geometry bounding box. */
  function meshHeight(mesh: THREE.Mesh) {
    mesh.geometry.computeBoundingBox();
    const bb = mesh.geometry.boundingBox!;
    return bb.max.y - bb.min.y;
  }

  it('draws the body panel BELOW the titlebar, not over it (graph_frame.cpp:106-110)', async () => {
    // `Rect2 body_rect(Point2(0, titlebar_rect.size.height), body_size)`.
    // `StyleBoxQuad` takes only a SIZE, so the offset has to come from the
    // group around it.
    const renderer = await ReactThreeTestRenderer.create(
      <GraphFrame {...painterEnv()} solveNode={graphFrame({ title: 'F' })} rect={RECT} renderOrder={0} />
    );
    const [body, titlebar] = chromeMeshes(renderer.scene);
    expect(worldY(renderer.scene, titlebar!)).toBe(0);
    expect(worldY(renderer.scene, body!)).toBe(-meshHeight(titlebar!));
    expect(meshHeight(titlebar!)).toBeGreaterThan(0);
  });
});
