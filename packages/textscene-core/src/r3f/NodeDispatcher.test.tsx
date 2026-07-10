/**
 * Tests for the NodeDispatcher recursive walker:
 *   - Routes registered types through the registered Component.
 *   - Falls back to GenericNodeFallback for unknown types.
 *   - Wraps each subtree in a NodePathProvider so descendants can read
 *     their own TSCN path.
 */
import type React from 'react';
import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import type { TscnNode } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { nodeComponentRegistry, type NodeComponentProps } from './NodeComponentRegistry';
import { SelectionProvider } from './contexts/SelectionContext';
import { useNodePath } from './contexts/NodePathContext';

// All node-type components self-register on import. Pull in the barrel.
import './nodes/index';

function makeNode(name: string, type: string, children: TscnNode[] = []): TscnNode {
  return {
    name,
    type,
    children,
    properties: {},
  };
}

function renderWithProviders(content: React.ReactElement) {
  return ReactThreeTestRenderer.create(
    <SelectionProvider>{content}</SelectionProvider>
  );
}

describe('<NodeDispatcher>', () => {
  it('routes a registered node type through its registered component', async () => {
    const nodes: TscnNode[] = [makeNode('Root', 'Node3D')];
    const renderer = await renderWithProviders(<NodeDispatcher nodes={nodes} />);

    // Node3D renders a <group name="Root">; verify it landed in the scene.
    const groups = renderer.scene.findAllByType('Group');
    const named = groups.filter((g) => g.instance.name === 'Root');
    expect(named.length).toBeGreaterThan(0);
  });

  it('falls back to GenericNodeFallback for unknown types', async () => {
    const nodes: TscnNode[] = [makeNode('Mystery', 'NotARealType')];
    const renderer = await renderWithProviders(<NodeDispatcher nodes={nodes} />);

    // GenericNodeFallback tags its group with userData.isPlaceholder = true.
    const groups = renderer.scene.findAllByType('Group');
    const placeholder = groups.find((g) => g.instance.userData.isPlaceholder === true);
    expect(placeholder).toBeDefined();
    expect(placeholder?.instance.userData.nodeType).toBe('NotARealType');
  });

  it('recursively renders children and provides their joined path via context', async () => {
    let capturedPath: string | null | undefined = undefined;

    function PathProbe(_: NodeComponentProps) {
      // Read inside a child component to exercise the NodePathProvider chain.
      capturedPath = useNodePath();
      return <group name="probe" />;
    }

    // Register a one-off node type for this test. The registry's
    // duplicate-overwrite semantics are intentional (HMR-friendly), so
    // we don't bother restoring afterwards — no other test references
    // the 'Probe' type.
    nodeComponentRegistry.register({ typeName: 'Probe', Component: PathProbe });

    const nodes: TscnNode[] = [
      makeNode('Outer', 'Node3D', [makeNode('Inner', 'Probe')]),
    ];

    await renderWithProviders(<NodeDispatcher nodes={nodes} />);

    expect(capturedPath).toBe('Outer/Inner');
  });

  it('PERF (WI-213): attaches pointer handlers to exactly ONE delegated root, not one per node', async () => {
    // Before event delegation, every node's wrapper group carried its own
    // copy of the four pointer handlers — R3F treats every object with a
    // registered handler as its own interactive raycast root, so a mesh at
    // depth d was triangle-tested once per ancestor on every pointer move.
    // `object.__r3f.eventCount` is R3F's own per-object handler count.
    const nodes: TscnNode[] = [
      makeNode('Root', 'Node3D', [
        makeNode('Child', 'Node3D', [makeNode('Grandchild', 'Node3D')]),
      ]),
    ];
    const renderer = await renderWithProviders(<NodeDispatcher nodes={nodes} />);

    const scene = renderer.scene.instance as unknown as THREE.Object3D;
    let interactiveCount = 0;
    scene.traverse((object) => {
      const r3f = (object as unknown as { __r3f?: { eventCount?: number } }).__r3f;
      if (r3f?.eventCount) interactiveCount++;
    });

    expect(interactiveCount).toBe(1);
  });
});
