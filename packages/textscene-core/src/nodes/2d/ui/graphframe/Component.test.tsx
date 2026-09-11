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
