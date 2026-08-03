/**
 * Tests for the NodeDispatcher recursive walker:
 *   - Routes registered types through the registered Component.
 *   - Falls back to GenericNodeFallback for unknown types.
 *   - Wraps each subtree in a NodePathProvider so descendants can read
 *     their own TSCN path.
 */
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type * as THREE from 'three';
import type { TscnNode } from '../parser/types';
import { NodeDispatcher } from './NodeDispatcher';
import { nodeComponentRegistry, type NodeComponentProps } from './NodeComponentRegistry';
import { SelectionProvider } from './contexts/SelectionContext';
import { useNodePath } from './contexts/NodePathContext';
import { CanvasWorkspaceProvider } from './contexts/CanvasWorkspaceContext';

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

describe('<NodeDispatcher> per-node error boundary (#216)', () => {
  function Bomb(_: NodeComponentProps): never {
    throw new Error('node render exploded');
  }
  nodeComponentRegistry.register({ typeName: 'Bomb', Component: Bomb });

  it('a crashing node falls back to a placeholder instead of blanking the whole viewport', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const nodes: TscnNode[] = [
      makeNode('Root', 'Node3D', [
        makeNode('GoodSibling', 'Node3D'),
        makeNode('BadNode', 'Bomb'),
      ]),
    ];
    const renderer = await renderWithProviders(<NodeDispatcher nodes={nodes} />);

    // The good sibling still rendered — the crash didn't blank the tree.
    const groups = renderer.scene.findAllByType('Group');
    expect(groups.some((g) => g.instance.name === 'GoodSibling')).toBe(true);

    // The crashed node's wrapper shows a magenta placeholder (the SAME
    // visual language as a missing resource) instead of vanishing outright.
    const meshes = renderer.scene.findAllByType('Mesh');
    const placeholder = meshes.find((m) => {
      const mat = (m.instance as THREE.Mesh).material as { color?: THREE.Color };
      return mat.color && mat.color.r > 0.9 && mat.color.g < 0.1 && mat.color.b > 0.9;
    });
    expect(placeholder).toBeDefined();

    consoleSpy.mockRestore();
  });

  it('does not throw past NodeDispatcher — the render commits successfully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const nodes: TscnNode[] = [makeNode('OnlyBad', 'Bomb')];
    await expect(renderWithProviders(<NodeDispatcher nodes={nodes} />)).resolves.toBeDefined();

    consoleSpy.mockRestore();
  });

  it('positions the placeholder near a crashing CanvasItem (2D) node\'s authored position, not the 3D-transform origin', async () => {
    // A CanvasItem-registered type's properties are Node2DProperties-shaped
    // (position/rotation/scale), not Node3DProperties (a combined
    // `transform`) — reading `.transform` off them is always undefined, so
    // the FALLBACK must route through the 2D transform math (node2dGroupProps)
    // instead of silently collapsing to the origin.
    function Bomb2D(_: NodeComponentProps): never {
      throw new Error('2D node render exploded');
    }
    nodeComponentRegistry.register({ typeName: 'Bomb2D', Component: Bomb2D, canvasItem: true });

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const node: TscnNode = {
      name: 'BadNode2D',
      type: 'Bomb2D',
      children: [],
      properties: {
        name: 'BadNode2D',
        position: { x: 3, y: 4 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        skew: 0,
        z_index: 0,
        z_as_relative: true,
        show_behind_parent: false,
        modulate: { r: 1, g: 1, b: 1, a: 1 },
        self_modulate: { r: 1, g: 1, b: 1, a: 1 },
      },
    };
    const renderer = await renderWithProviders(
      <CanvasWorkspaceProvider workspace="2d">
        <NodeDispatcher nodes={[node]} />
      </CanvasWorkspaceProvider>
    );

    const meshes = renderer.scene.findAllByType('Mesh');
    const placeholder = meshes.find((m) => {
      const mat = (m.instance as THREE.Mesh).material as { color?: THREE.Color };
      return mat.color && mat.color.r > 0.9 && mat.color.g < 0.1 && mat.color.b > 0.9;
    });
    expect(placeholder).toBeDefined();
    // node2dGroupProps: x unchanged, y negated (Godot +Y-down -> three.js +Y-up).
    const wrapperGroup = placeholder!.parent!;
    expect(wrapperGroup.instance.position.x).toBe(3);
    expect(wrapperGroup.instance.position.y).toBe(-4);

    consoleSpy.mockRestore();
  });
});
