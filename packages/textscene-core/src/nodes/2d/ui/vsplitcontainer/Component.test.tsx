/**
 * `<VSplitContainer>` — the vertical-axis twin of
 * `hsplitcontainer/Component.test.tsx`; see that file's own doc for why
 * the grabber is invisible by default. This pins the TRANSPOSED axis: reading
 * `sizeFlagsVertical` and drawing `vsplitter` (48x8) centred on the ROW split.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { VSplitContainer } from './Component';
import { painterEnv } from '../../../../r3f/controls/native/testing/painterProps';

function solveNode(
  name: string,
  type: string,
  properties: Record<string, unknown>,
  children: SolveNode[] = []
): SolveNode {
  return {
    path: name,
    node: { name, type, children: [], properties: { name, ...properties } } as TscnNode,
    children,
    styleBoxes: {},
    textureSize: null,
  };
}

const EXPAND_FILL = 3;

function bothExpandChildren(): SolveNode[] {
  return [
    solveNode('Top', 'ColorRect', { sizeFlagsVertical: EXPAND_FILL }),
    solveNode('Bottom', 'ColorRect', { sizeFlagsVertical: EXPAND_FILL }),
  ];
}

function split(properties: Record<string, unknown>, children: SolveNode[]): SolveNode {
  return solveNode('Split', 'VSplitContainer', properties, children);
}

describe('<VSplitContainer>', () => {
  it('renders nothing under the default theme', async () => {
    const node = split({}, bothExpandChildren());
    const renderer = await ReactThreeTestRenderer.create(
      <VSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 120, h: 300 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('ignores the HORIZONTAL flags — they do not claim the split axis', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, [
      solveNode('Top', 'ColorRect', { sizeFlagsHorizontal: EXPAND_FILL }),
      solveNode('Bottom', 'ColorRect', { sizeFlagsHorizontal: EXPAND_FILL }),
    ]);
    const renderer = await ReactThreeTestRenderer.create(
      <VSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 120, h: 300 }} renderOrder={0} />
    );
    // Neither counts as expanding on the vertical axis -> rest position 0.
    const group = renderer.scene.findByType('Group');
    // draggerPos = 0; icon centres at 0 + (12-8)/2 = 2 horizontally, 0 + (12-8)/2 = 2 vertically.
    expect(group.instance.position.x).toBeCloseTo((120 - 48) / 2);
    expect(group.instance.position.y).toBeCloseTo(-2);
  });

  it('draws exactly one 48x8 textured quad, centred on the computed row split, once autohide is overridden', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, bothExpandChildren());
    const renderer = await ReactThreeTestRenderer.create(
      <VSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 120, h: 300 }} renderOrder={0} />
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    expect(geometry.parameters.width).toBe(48);
    expect(geometry.parameters.height).toBe(8);

    // draggerPos = trunc(300*0.5 - 12*0.5) = 144; band centres at y=144+2=146.
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo((120 - 48) / 2);
    expect(group.instance.position.y).toBeCloseTo(-146);

    const material = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map).toBeInstanceOf(THREE.Texture);
  });

  it('renders nothing with fewer than two sortable children, even with autohide overridden', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, [solveNode('Only', 'ColorRect', {})]);
    const renderer = await ReactThreeTestRenderer.create(
      <VSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 120, h: 300 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});
