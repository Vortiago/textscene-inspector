/**
 * The tree-row eye button: `SelectionContext.hiddenNodePaths` sets `visible` on
 * the dispatcher's wrapper `<group>`, or the object stays rendered.
 */
import { describe, expect, it } from 'vitest';
import type * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider } from './contexts/SelectionContext';
import { HiddenSeeder } from './testing/HiddenSeeder';

import './nodes/index';

function makeNode(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return { rawProperties: {}, name, type, children, properties: {} };
}

interface WrapperInstance {
  visible: boolean;
  name: string;
  children: WrapperInstance[];
  parent: WrapperInstance | null;
  type: string;
}

function findWrappingGroup(
  scene: { findAllByType: (t: string) => { instance: WrapperInstance }[] },
  nodeName: string
): WrapperInstance | null {
  // The dispatcher's wrapper sits above the Component's own named group.
  const named = scene
    .findAllByType('Group')
    .map((g) => g.instance)
    .find((g) => g.name === nodeName);
  if (!named) return null;
  return named.parent ?? null;
}

describe('<NodeDispatcher> visibility wire-up (WI-UX-1)', () => {
  it('sets visible=false on the wrapping group when its path is hidden', async () => {
    const nodes: TscnNode[] = [makeNode('Alpha', 'Node3D'), makeNode('Beta', 'Node3D')];

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <HiddenSeeder paths={['Alpha']} />
        <NodeDispatcher nodes={nodes} />
      </SelectionProvider>
    );

    const alphaWrapper = findWrappingGroup(renderer.scene, 'Alpha');
    const betaWrapper = findWrappingGroup(renderer.scene, 'Beta');

    expect(alphaWrapper).not.toBeNull();
    expect(betaWrapper).not.toBeNull();
    expect(alphaWrapper!.visible).toBe(false);
    expect(betaWrapper!.visible).toBe(true);
  });

  it('hides descendant geometry when an ancestor is hidden (THREE short-circuits)', async () => {
    const nodes: TscnNode[] = [makeNode('Parent', 'Node3D', [makeNode('Child', 'Node3D')])];

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <HiddenSeeder paths={['Parent']} />
        <NodeDispatcher nodes={nodes} />
      </SelectionProvider>
    );

    const parentWrapper = findWrappingGroup(renderer.scene, 'Parent');
    const childWrapper = findWrappingGroup(renderer.scene, 'Child');

    expect(parentWrapper).not.toBeNull();
    expect(childWrapper).not.toBeNull();
    expect(parentWrapper!.visible).toBe(false);
    // The child's wrapper stays `visible=true`: three hides it through the
    // parent chain, so the dispatcher walks no path tree.
    expect(childWrapper!.visible).toBe(true);
  });

  it('leaves all wrappers visible by default when no paths are hidden', async () => {
    const nodes: TscnNode[] = [makeNode('Solo', 'Node3D')];

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={nodes} />
      </SelectionProvider>
    );

    const soloWrapper = findWrappingGroup(renderer.scene, 'Solo');
    expect(soloWrapper).not.toBeNull();
    expect(soloWrapper!.visible).toBe(true);
  });
});

/** Whether three's render reaches `object`: it and every ancestor are visible. */
function isRendered(object: THREE.Object3D): boolean {
  for (let current: THREE.Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
}

function omniLight(properties: Record<string, unknown>): TscnNode {
  return {
    rawProperties: {},
    name: 'Lamp',
    type: 'OmniLight3D',
    children: [],
    properties: {
      name: 'Lamp',
      light_color: 'Color(1, 1, 1, 1)',
      light_energy: 1,
      omni_range: 5,
      omni_attenuation: 1,
      ...properties,
    },
  };
}

describe("<NodeDispatcher> Godot's `visible`", () => {
  it('hides a Node3D-derived node whose visible is false', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={[omniLight({ visible: false })]} />
      </SelectionProvider>
    );
    const light = renderer.scene.findByType('PointLight').instance as THREE.PointLight;
    expect(isRendered(light)).toBe(false);
  });

  it('shows a Node3D-derived node whose visible is unset', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={[omniLight({})]} />
      </SelectionProvider>
    );
    const light = renderer.scene.findByType('PointLight').instance as THREE.PointLight;
    expect(isRendered(light)).toBe(true);
  });

  it('leaves a type outside the Node3D family to its own component', async () => {
    const node = { ...makeNode('Plain', 'Node'), properties: { name: 'Plain', visible: false } };
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={[node]} />
      </SelectionProvider>
    );
    expect(findWrappingGroup(renderer.scene, 'Plain')!.visible).toBe(true);
  });
});
