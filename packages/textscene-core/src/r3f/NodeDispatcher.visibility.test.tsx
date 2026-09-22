/**
 * Regression test for tree-row eye-button visibility.
 *
 * Pins the wire from `SelectionContext.hiddenNodePaths` to the
 * `visible` flag on the per-node wrapping `<group>` in `NodeDispatcher`.
 * Without this, the tree-row eye button toggles only CSS dimming and
 * the corresponding object stays rendered.
 */
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { SelectionProvider, useSelection } from './contexts/SelectionContext';

import './nodes/index';

function makeNode(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return {
    name,
    type,
    children,
    properties: {},
  };
}

function HiddenPathSeeder({ paths }: { paths: readonly string[] }) {
  const { toggleHidden } = useSelection();
  useEffect(() => {
    for (const p of paths) toggleHidden(p);
  }, [paths, toggleHidden]);
  return null;
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
  nodeName: string,
): WrapperInstance | null {
  // DispatchedNode wraps each subtree in a <group>, then renders the
  // node's Component (e.g. Node3D's <group name={node.name}>). Walk up
  // from the named group to find the dispatcher's wrapper.
  const named = scene
    .findAllByType('Group')
    .map((g) => g.instance)
    .find((g) => g.name === nodeName);
  if (!named) return null;
  return named.parent ?? null;
}

describe('<NodeDispatcher> visibility wire-up (WI-UX-1)', () => {
  it('sets visible=false on the wrapping group when its path is hidden', async () => {
    const nodes: TscnNode[] = [
      makeNode('Alpha', 'Node3D'),
      makeNode('Beta', 'Node3D'),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <HiddenPathSeeder paths={['Alpha']} />
        <NodeDispatcher nodes={nodes} />
      </SelectionProvider>,
    );

    const alphaWrapper = findWrappingGroup(renderer.scene, 'Alpha');
    const betaWrapper = findWrappingGroup(renderer.scene, 'Beta');

    expect(alphaWrapper).not.toBeNull();
    expect(betaWrapper).not.toBeNull();
    expect(alphaWrapper!.visible).toBe(false);
    expect(betaWrapper!.visible).toBe(true);
  });

  it('hides descendant geometry when an ancestor is hidden (THREE short-circuits)', async () => {
    const nodes: TscnNode[] = [
      makeNode('Parent', 'Node3D', [makeNode('Child', 'Node3D')]),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <HiddenPathSeeder paths={['Parent']} />
        <NodeDispatcher nodes={nodes} />
      </SelectionProvider>,
    );

    const parentWrapper = findWrappingGroup(renderer.scene, 'Parent');
    const childWrapper = findWrappingGroup(renderer.scene, 'Child');

    expect(parentWrapper).not.toBeNull();
    expect(childWrapper).not.toBeNull();
    expect(parentWrapper!.visible).toBe(false);
    // The Child's own wrapper is still `visible=true` — THREE walks
    // the parent chain to compute effective visibility. Asserting both
    // confirms ancestor-hide propagates through THREE without the
    // dispatcher having to walk the path tree itself.
    expect(childWrapper!.visible).toBe(true);
  });

  it('leaves all wrappers visible by default when no paths are hidden', async () => {
    const nodes: TscnNode[] = [
      makeNode('Solo', 'Node3D'),
    ];

    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={nodes} />
      </SelectionProvider>,
    );

    const soloWrapper = findWrappingGroup(renderer.scene, 'Solo');
    expect(soloWrapper).not.toBeNull();
    expect(soloWrapper!.visible).toBe(true);
  });
});
