/**
 * The relay walk over a bare tree view: the order a move notifies nodes in, and the targets Godot
 * refuses.
 */

import { describe, expect, it } from 'vitest';
import { nodesAMoveReaches, relayOf, type RelayTreeView } from './relayTree';

interface BareNode {
  name: string;
  type: string;
  props?: Record<string, string>;
  children: BareNode[];
  parent?: BareNode;
}

function node(
  name: string,
  type: string,
  children: BareNode[] = [],
  props: Record<string, string> = {}
): BareNode {
  const built: BareNode = { name, type, props, children };
  for (const child of children) child.parent = built;
  return built;
}

/** A view whose NodePath literals name a node of `all` by its name. */
function viewOver(all: readonly BareNode[]): RelayTreeView<BareNode> {
  return {
    typeOf: (n) => n.type,
    rawPropertiesOf: (n) => n.props ?? {},
    childrenOf: (n) => n.children,
    parentOf: (n) => n.parent ?? null,
    isSame: (n, other) => n === other,
    nodeAt: (_, literal) => all.find((n) => literal === `NodePath("${n.name}")`) ?? null,
  };
}

const names = (nodes: readonly BareNode[]): string[] => nodes.map((n) => n.name);

describe('nodesAMoveReaches', () => {
  it('queues the Node3D children before the node they sit under', () => {
    const target = node('T', 'Node3D', [node('A', 'Node3D', [node('A1', 'Node3D')]), node('B', 'Node3D')]);

    expect(names(nodesAMoveReaches(viewOver([]), target, 'Node3D'))).toEqual(['A1', 'A', 'B', 'T']);
  });

  it('queues a CanvasItem before its children', () => {
    const target = node('T', 'Node2D', [node('A', 'Node2D', [node('A1', 'Node2D')]), node('B', 'Node2D')]);

    expect(names(nodesAMoveReaches(viewOver([]), target, 'CanvasItem'))).toEqual(['T', 'A', 'A1', 'B']);
  });

  it('stops at a top_level child and at a child of another family', () => {
    const target = node('T', 'Node3D', [
      node('Top', 'Node3D', [node('Below', 'Node3D')], { top_level: 'true' }),
      node('Plain', 'Node', [node('Under', 'Node3D')]),
    ]);

    expect(names(nodesAMoveReaches(viewOver([]), target, 'Node3D'))).toEqual(['T']);
  });
});

describe('relayOf', () => {
  it('reads the flags from the raw properties, each true unless written false', () => {
    const target = node('T', 'Node3D');
    const relay = node('R', 'RemoteTransform3D', [], {
      remote_path: 'NodePath("T")',
      update_scale: 'false',
    });
    node('Root', 'Node3D', [target, relay]);

    expect(relayOf(viewOver([target]), relay)?.flags).toEqual({
      updatePosition: true,
      updateRotation: true,
      updateScale: false,
      useGlobal: true,
    });
  });

  it('refuses a target above the relay', () => {
    const relay = node('R', 'RemoteTransform3D', [], { remote_path: 'NodePath("Up")' });
    const up = node('Up', 'Node3D', [relay]);

    expect(relayOf(viewOver([up]), relay)).toBeNull();
  });

  it('refuses a target of the other space', () => {
    const target = node('T', 'Node2D');
    const relay = node('R', 'RemoteTransform3D', [], { remote_path: 'NodePath("T")' });
    node('Root', 'Node', [target, relay]);

    expect(relayOf(viewOver([target]), relay)).toBeNull();
  });
});
