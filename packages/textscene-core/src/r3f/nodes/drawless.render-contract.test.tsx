/**
 * A type that draws nothing of its own (`transform-only` or `pending`) renders its subtree as its
 * nearest Godot base does: Node3D, Node2D or Node. Godot draws none of these types at runtime, so a
 * Bone2D or an AudioListener3D places and hides its children exactly as that base would.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import type { TscnNode } from '../../parser/types';
import { NodeDispatcher } from '../NodeDispatcher';
import { SelectionProvider } from '../contexts/SelectionContext';
import { CanvasWorkspaceProvider, type CanvasWorkspace } from '../contexts/CanvasWorkspaceContext';
import { nodeComponentRegistry } from '../NodeComponentRegistry';
import { descendsFrom } from '../../godot/nodeBaseTypes.js';
import { parseNode2D } from '../../nodes/base/node2d/parser';

// Side-effect import: registers every node component (same barrel the apps use).
import './index';

/** Drivers of other nodes: each draws nothing, but its own component reads its animation data. */
const DRIVER_TYPES_WITH_OWN_COMPONENT = ['AnimationPlayer', 'AnimationTree'];

const DRAWLESS_TYPES = nodeComponentRegistry
  .getAllTypeNames()
  .filter((type) => nodeComponentRegistry.renderIntentOf(type) !== 'draws')
  .filter((type) => !DRIVER_TYPES_WITH_OWN_COMPONENT.includes(type))
  .sort();

type Base = 'Node3D' | 'Node2D' | 'Node';

function baseOf(type: string): Base {
  if (descendsFrom(type, 'Node3D')) return 'Node3D';
  if (descendsFrom(type, 'Node2D')) return 'Node2D';
  return 'Node';
}

function workspaceOf(base: Base): CanvasWorkspace {
  return base === 'Node2D' ? '2d' : '3d';
}

/** A hidden, moved and turned subject with one child, in the space its base defines. */
function hiddenMovedSubject(type: string, base: Base): TscnNode {
  if (base === 'Node2D') {
    const heading = (name: string, nodeType: string) => ({
      type: 'node',
      attributes: { type: nodeType, name },
    });
    const kid: TscnNode = {
      name: 'Kid',
      type: 'Node2D',
      children: [],
      properties: parseNode2D(heading('Kid', 'Node2D'), {}),
    };
    const properties = parseNode2D(heading('Subject', type), {
      position: 'Vector2(30, 40)',
      rotation: '0.5',
      visible: 'false',
    });
    return { name: 'Subject', type, children: [kid], properties };
  }
  const kid: TscnNode = { name: 'Kid', type: 'Node3D', children: [], properties: { name: 'Kid' } };
  const transform = {
    basis_x: { x: 0, y: 1, z: 0 },
    basis_y: { x: -1, y: 0, z: 0 },
    basis_z: { x: 0, y: 0, z: 1 },
    origin: { x: 2, y: 3, z: 4 },
  };
  return {
    name: 'Subject',
    type,
    children: [kid],
    properties: { name: 'Subject', transform, visible: false },
  };
}

/** Where the child lands and whether it shows, read from the rendered scene. */
async function renderedKid(subject: TscnNode, workspace: CanvasWorkspace) {
  const renderer = await ReactThreeTestRenderer.create(
    <CanvasWorkspaceProvider workspace={workspace}>
      <SelectionProvider>
        <NodeDispatcher nodes={[subject]} />
      </SelectionProvider>
    </CanvasWorkspaceProvider>
  );
  const kid = renderer.scene.findByProps({ name: 'Kid' }).instance as THREE.Object3D;
  kid.updateWorldMatrix(true, false);
  let isShown = kid.visible;
  for (let ancestor = kid.parent; ancestor; ancestor = ancestor.parent) isShown &&= ancestor.visible;
  return { world: kid.matrixWorld.toArray(), isShown };
}

describe('drawless types render their subtree as their Godot base does', () => {
  it('derives a non-trivial set, so an empty filter cannot vacuously pass', () => {
    expect(DRAWLESS_TYPES.length).toBeGreaterThan(100);
    expect(DRAWLESS_TYPES).toEqual(expect.arrayContaining(['Bone2D', 'AudioListener3D', 'Timer']));
  });

  it.each(DRAWLESS_TYPES)('%s places and hides its child as its base does', async (type) => {
    const base = baseOf(type);
    const workspace = workspaceOf(base);

    const actual = await renderedKid(hiddenMovedSubject(type, base), workspace);
    const expected = await renderedKid(hiddenMovedSubject(base, base), workspace);

    expect(actual).toEqual(expected);
  });
});
