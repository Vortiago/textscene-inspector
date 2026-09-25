/**
 * GPUParticles3D draws no particles, but it is still a Node3D: its transform,
 * its `visible` flag and its exclusion from the 2D canvas are lost to a bare
 * `GenericNodeFallback`. So the slice registers the base under
 * `renderIntent: 'pending'`, and no golden covers this type.
 */

import { describe, expect, it } from 'vitest';
import ReactThreeTestRenderer from '@react-three/test-renderer';
import { Node3D } from '../../../base/node3d/Component';
import type { Node3DProperties, Transform3D } from '../../../base/node3d/types';
import type { TscnNode } from '../../../../parser/types';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { drawsInWorkspace } from '../../../../r3f/nodeWorkspaceVisibility';
import { NodeDispatcher } from '../../../../r3f/NodeDispatcher';
import { SelectionProvider } from '../../../../r3f/contexts/SelectionContext';
import '../../../../r3f/nodes/index';

function makeNode(properties: Node3DProperties): TscnNode {
  return {
    name: properties.name ?? 'GPUParticles3D',
    type: 'GPUParticles3D' as const,
    children: [],
    properties,
  };
}

describe('<Node3D> (gpuparticles3d component)', () => {
  it('renders a named group', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'MyGPUParticles' })} />
    );
    expect(renderer.scene.findByProps({ name: 'MyGPUParticles' })).toBeDefined();
  });

  it('applies transform origin to position', async () => {
    const idTransform: Transform3D = {
      basis_x: { x: 1, y: 0, z: 0 },
      basis_y: { x: 0, y: 1, z: 0 },
      basis_z: { x: 0, y: 0, z: 1 },
      origin: { x: 1, y: 2, z: 3 },
    };
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'Positioned', transform: idTransform })} />
    );
    const group = renderer.scene.findByProps({ name: 'Positioned' });
    expect(group.instance.position.x).toBe(1);
    expect(group.instance.position.y).toBe(2);
    expect(group.instance.position.z).toBe(3);
  });

  it('hides the group when visible is false, without crashing', async () => {
    const renderer = await ReactThreeTestRenderer.create(
      <Node3D node={makeNode({ name: 'HiddenParticles', visible: false })} />
    );
    const group = renderer.scene.findByProps({ name: 'HiddenParticles' });
    expect(group.instance.visible).toBe(false);
  });

  it('honours visible = false through the dispatcher, not just in isolation', async () => {
    // The test above mounts Node3D directly. This one checks that dispatching the type
    // still reaches a component that carries `visible`.
    const renderer = await ReactThreeTestRenderer.create(
      <SelectionProvider>
        <NodeDispatcher nodes={[makeNode({ name: 'HiddenEmitter', visible: false })]} />
      </SelectionProvider>
    );
    const group = renderer.scene.findByProps({ name: 'HiddenEmitter' });
    expect(group.instance.visible).toBe(false);
  });
});

describe('GPUParticles3D render intent', () => {
  it('reports the emitter as a gap, not as finished', () => {
    // Godot draws particles here and we do not, so the tree badge must say so.
    expect(rendersOwnVisual('GPUParticles3D')).toBe('not-implemented');
  });

  it('keeps the emitter and its 3D subtree out of the 2D world canvas', () => {
    // An unregistered type answers `true` here, which drags a 3D subtree into
    // the 2D canvas of any scene that carries one.
    expect(drawsInWorkspace('GPUParticles3D', '2d')).toBe(false);
    expect(drawsInWorkspace('GPUParticles3D', '3d')).toBe(true);
  });
});
