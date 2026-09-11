/**
 * `<SplitContainer>` — same invisibility rules as `hsplitcontainer/Component.tsx`
 * (autohide default true, <2 sortable children, collapsed, hidden dragger),
 * plus `vertical` read from THIS node's own properties at runtime rather
 * than fixed by type. Pins both axes against `hsplitcontainer`'s/
 * `vsplitcontainer`'s own already-verified numbers.
 */
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import * as THREE from 'three';
import type { TscnNode } from '../../../../parser/types';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { SplitContainer } from './Component';
import { painterEnv, painterTint } from '../../../../r3f/controls/native/testing/painterProps';
import { solveNode as emptySolveNode } from '../../../../r3f/controls/native/testing/solveNode';

function solveNode(
  name: string,
  type: string,
  properties: Record<string, unknown>,
  children: SolveNode[] = []
): SolveNode {
  return {
    ...emptySolveNode(),
    path: name,
    node: { name, type, children: [], properties: { name, ...properties } } as TscnNode,
    children,
  };
}

const EXPAND_FILL = 3;

function expandChildren(axisFlag: 'sizeFlagsHorizontal' | 'sizeFlagsVertical'): SolveNode[] {
  return [
    solveNode('First', 'ColorRect', { [axisFlag]: EXPAND_FILL }),
    solveNode('Second', 'ColorRect', { [axisFlag]: EXPAND_FILL }),
  ];
}

function split(properties: Record<string, unknown>, children: SolveNode[]): SolveNode {
  return solveNode('Split', 'SplitContainer', properties, children);
}

describe('<SplitContainer> — invisibility (axis-independent)', () => {
  it('renders nothing under the default theme (autohide=true)', async () => {
    const node = split({}, expandChildren('sizeFlagsHorizontal'));
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing with fewer than two sortable children, even with autohide overridden', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, [solveNode('Only', 'ColorRect', {})]);
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });

  it('renders nothing while collapsed, even with autohide overridden', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 }, collapsed: true },
      expandChildren('sizeFlagsHorizontal')
    );
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={0} />
    );
    expect(renderer.scene.children).toHaveLength(0);
  });
});

describe('<SplitContainer> — horizontal axis (vertical absent, Godot default false)', () => {
  it('draws hsplitter (8x48) at the computed split offset', async () => {
    const node = split({ themeOverrideConstants: { autohide: 0 } }, expandChildren('sizeFlagsHorizontal'));
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 400, h: 60 }} renderOrder={5} />
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    // Same fixture shape as hsplitcontainer/Component.test.tsx: draggerPos =
    // trunc(400*0.5 - 12*0.5) = 194, icon centres at x=194+2=196, y=-(60-48)/2=-6.
    expect(geometry.parameters.width).toBe(8);
    expect(geometry.parameters.height).toBe(48);
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo(196);
    expect(group.instance.position.y).toBeCloseTo(-6);
  });
});

describe('<SplitContainer> — vertical axis (vertical: true)', () => {
  it('draws vsplitter (48x8) at the computed split offset', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 }, vertical: true },
      expandChildren('sizeFlagsVertical')
    );
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 60, h: 400 }} renderOrder={5} />
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    expect(meshes).toHaveLength(1);
    const geometry = (meshes[0]!.instance as THREE.Mesh).geometry as THREE.PlaneGeometry;
    // draggerPos = trunc(400*0.5 - 12*0.5) = 194; barRect y=194,h=12; icon
    // (48x8) centres at x=(60-48)/2=6, y=194+(12-8)/2=196.
    expect(geometry.parameters.width).toBe(48);
    expect(geometry.parameters.height).toBe(8);
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo(6);
    expect(group.instance.position.y).toBeCloseTo(-196);
  });

  it('ignores the HORIZONTAL flags — they do not claim the split axis', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 }, vertical: true },
      expandChildren('sizeFlagsHorizontal')
    );
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer {...painterEnv()} solveNode={node} rect={{ x: 0, y: 0, w: 60, h: 400 }} renderOrder={0} />
    );
    // Neither child expands on the split axis -> rest position 0, clamped by
    // each child's own (zero here) minimum size: draggerPos stays 0.
    const group = renderer.scene.findByType('Group');
    expect(group.instance.position.x).toBeCloseTo((60 - 48) / 2);
    expect(group.instance.position.y).toBeCloseTo(-((12 - 8) / 2));
  });

  it('draws the grabber icon through the walker-composed tint', async () => {
    const node = split(
      { themeOverrideConstants: { autohide: 0 }, vertical: true },
      expandChildren('sizeFlagsVertical')
    );
    const renderer = await ReactThreeTestRenderer.create(
      <SplitContainer
        {...painterEnv()}
        tint={painterTint({ r: 0.5, g: 0.5, b: 0.5, a: 0.5 })}
        solveNode={node}
        rect={{ x: 0, y: 0, w: 60, h: 400 }}
        renderOrder={0}
      />
    );
    const material = (renderer.scene.findByType('Mesh').instance as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    expect(material.color.r).toBeCloseTo(new THREE.Color().setRGB(0.5, 0.5, 0.5, THREE.SRGBColorSpace).r, 6);
    expect(material.opacity).toBeCloseTo(0.5, 6);
  });
});
