/**
 * `<HSplitContainer>` — a SplitContainer draws no chrome beyond the
 * grabber icon, and the icon itself is invisible by default (`autohide`
 * theme default `true`, matching real Godot's own static-render behaviour —
 * see the component's own module doc). These pin: nothing draws with fewer
 * than two sortable children or the default theme, and the icon appears at
 * the expected rect the instant a scene overrides `autohide`.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { HSplitContainer } from './Component';
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

/** Two FILL|EXPAND children — the "Both" fixture row's own shape. */
function bothExpandChildren(): SolveNode[] {
  return [
    solveNode('Left', 'ColorRect', { sizeFlagsHorizontal: EXPAND_FILL, sizeFlagsVertical: EXPAND_FILL }),
    solveNode('Right', 'ColorRect', { sizeFlagsHorizontal: EXPAND_FILL, sizeFlagsVertical: EXPAND_FILL }),
  ];
}

function split(properties: Record<string, unknown>, children: SolveNode[]): SolveNode {
  return solveNode('Split', 'HSplitContainer', properties, children);
}

describe('<HSplitContainer>', () => {
  it('renders nothing under the default theme (autohide=true, no hover/drag a static render ever has)', async () => {
    const node = split({}, bothExpandChildren());
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing with fewer than two sortable children, even with autohide overridden', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 } },
      [solveNode('Only', 'ColorRect', {})]
    );
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing while collapsed, even with autohide overridden', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 }, collapsed: true }, bothExpandChildren());
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing for a HIDDEN or HIDDEN_COLLAPSED dragger, even with autohide overridden', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 }, draggerVisibility: 2 },
      bothExpandChildren()
    );
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('draws exactly one textured quad, at the grabber band centred on the computed split offset, once autohide is overridden', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, bothExpandChildren());
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={5} />
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    // hsplitter.svg is 8x48; draggerPos for an even split of 400 at sep 12 is 194
    // (trunc(400*0.5 - 12*0.5) = 194), so the band centres the icon at x=194+2=196.
    expect(geometry.parameters.width).toBe(8);
    expect(geometry.parameters.height).toBe(48);

    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo(196);
    expect(group.instance.position.y).toBeCloseTo(-6); // -(60-48)/2

    const material = (meshes[0]!.instance as THREE.Mesh).material as THREE.MeshBasicMaterial;
    expect(material.map).toBeInstanceOf(THREE.Texture);
    expect(meshes[0]!.instance.renderOrder).toBe(5);
  });

  it('honours a split_offset override once visible', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 }, splitOffset: 60 },
      bothExpandChildren()
    );
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    // draggerPos = 194 + 60 = 254; icon centres at 254 + (12-8)/2 = 256.
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo(256);
  });

  it('skips a hidden child, drawing the icon between the two remaining sortable children', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, [
      solveNode('Hidden', 'ColorRect', { visible: false }),
      ...bothExpandChildren(),
    ]);
    const renderer = await ReactThreeTestRenderer.create(
      <HSplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.findAllByType('Mesh')).toHaveLength(1);
  });
});
