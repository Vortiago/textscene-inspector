/**
 * `<GraphNode>` render contract: panel/titlebar chrome, title text, per-slot
 * ports and slot boxes, and resizer. Structure and tint only: the golden images
 * own the pixels.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { Rect2 } from '../../../../r3f/controls/native/rect';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';
import { GraphNode } from './Component';
import { defaultGraphNodeSlot } from './parser';
import type { GraphNodeProperties } from './types';

const RECT: Rect2 = { x: 0, y: 0, w: 200, h: 100 };

type Rendered = Awaited<ReturnType<typeof ReactThreeTestRenderer.create>>;

function graphNode(properties: Partial<GraphNodeProperties> = {}, children: SolveNode[] = []): SolveNode {
  const node: TscnNode = {
    name: 'N',
    type: 'GraphNode',
    children: [],
    properties: { name: 'N', slots: new Map(), ...properties } as GraphNodeProperties,
  };
  return { ...emptySolveNode(), path: 'N', node, children };
}

/** A StyleBoxQuad chrome mesh carries a `color` vertex attribute; a ControlQuad (icon/text) does not. */
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

describe('<GraphNode> (isolated painter contract)', () => {
  it('draws exactly two chrome meshes (panel + titlebar) with no children/title/slots', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} solveNode={graphNode()} rect={RECT} renderOrder={0} />
    );
    expect(chromeMeshes(renderer.scene)).toHaveLength(2);
    expect(textMeshes(renderer.scene)).toHaveLength(0);
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws a text mesh for a non-empty title', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} solveNode={graphNode({ title: 'Hello' })} rect={RECT} renderOrder={0} />
    );
    expect(textMeshes(renderer.scene).length).toBeGreaterThan(0);
  });

  it('draws no resizer icon when resizable is unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} solveNode={graphNode()} rect={RECT} renderOrder={0} />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws the resizer icon when resizable is true', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} solveNode={graphNode({ resizable: true })} rect={RECT} renderOrder={0} />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(1);
  });

  it('draws one port icon per enabled side of a declared slot', async () => {
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: { name: 'c', type: 'Control', children: [], properties: { name: 'c' } },
    };
    const slots = new Map([[0, { ...defaultGraphNodeSlot(), leftEnabled: true, rightEnabled: true }]]);
    const env = painterEnv();
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...env}
        solveNode={graphNode({ slots }, [child])}
        rect={RECT}
        renderOrder={0}
        childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
      />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(2);
  });

  it('draws no ports for a slot with both sides disabled (the default)', async () => {
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: { name: 'c', type: 'Control', children: [], properties: { name: 'c' } },
    };
    const slots = new Map([[0, defaultGraphNodeSlot()]]);
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        solveNode={graphNode({ slots }, [child])}
        rect={RECT}
        renderOrder={0}
        childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
      />
    );
    expect(iconMeshes(renderer.scene)).toHaveLength(0);
  });

  it('draws THREE chrome meshes when a declared slot draws its own stylebox', async () => {
    const child: SolveNode = {
      ...emptySolveNode(),
      path: 'N/c',
      node: { name: 'c', type: 'Control', children: [], properties: { name: 'c' } },
    };
    const slots = new Map([[0, { ...defaultGraphNodeSlot(), drawStylebox: true }]]);
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode
        {...painterEnv()}
        solveNode={graphNode({ slots }, [child])}
        rect={RECT}
        renderOrder={0}
        childRects={new Map([['N/c', { x: 0, y: 40, w: 100, h: 20 }]])}
      />
    );
    // panel + titlebar + the slot stylebox
    expect(chromeMeshes(renderer.scene)).toHaveLength(3);
  });
});

describe('<GraphNode> chrome placement', () => {
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

  it('draws the body panel BELOW the titlebar, not over it (graph_node.cpp:634-641)', async () => {
    // `Rect2 body_rect(0, titlebar_rect.size.height, ...)`. `StyleBoxQuad`
    // takes only a size, so the offset has to come from the group around it.
    const renderer = await ReactThreeTestRenderer.create(
      <GraphNode {...painterEnv()} solveNode={graphNode({ title: 'N' })} rect={RECT} renderOrder={0} />
    );
    // titlebar height = the title's own line height (23 at font size 16) plus
    // the `titlebar` StyleBox's 4px top and bottom margins
    // (`make_flat_stylebox(..., 4, 4, 4, 4)`, `default_theme.cpp:794`) = 31.
    const [body, titlebar] = chromeMeshes(renderer.scene);
    expect(worldY(renderer.scene, titlebar!)).toBe(0);
    expect(worldY(renderer.scene, body!)).toBe(-31);
    expect(meshHeight(titlebar!)).toBeGreaterThan(0);
  });
});
