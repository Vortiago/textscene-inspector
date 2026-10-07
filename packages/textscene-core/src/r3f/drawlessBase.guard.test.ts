/**
 * Every type that draws nothing of its own (`transform-only` or `pending`) renders through the base
 * component of its Godot parent chain, so it keeps that base's transform and `visible` handling.
 */
import { describe, it, expect } from 'vitest';
import './nodes/index'; // side-effect: register every slice's render component
import { nodeComponentRegistry, type NodeComponent } from './NodeComponentRegistry';
import { descendsFrom } from '../godot/nodeBaseTypes.js';
import { Node3D } from '../nodes/base/node3d/Component';
import { Node2D } from '../nodes/base/node2d/Component';
import { Node } from '../nodes/node/Component';

/** Drivers of other nodes: each draws nothing, but its own component plays the animation. */
const DRIVER_TYPES_WITH_OWN_COMPONENT = ['AnimationPlayer', 'AnimationTree'];

function baseComponentOf(type: string): NodeComponent {
  if (descendsFrom(type, 'Node3D')) return Node3D;
  if (descendsFrom(type, 'Node2D')) return Node2D;
  return Node;
}

const DRAWLESS_TYPES = nodeComponentRegistry
  .getAllTypeNames()
  .filter((type) => nodeComponentRegistry.renderIntentOf(type) !== 'draws')
  .filter((type) => !DRIVER_TYPES_WITH_OWN_COMPONENT.includes(type))
  .sort();

describe('drawless types render through their base component', () => {
  it('derives a non-trivial set, so an empty filter cannot vacuously pass', () => {
    expect(DRAWLESS_TYPES.length).toBeGreaterThan(100);
    expect(DRAWLESS_TYPES).toEqual(expect.arrayContaining(['Bone2D', 'AudioListener3D', 'Timer']));
  });

  it('gives each one the component of its nearest Node3D, Node2D or Node base', () => {
    const misrouted = DRAWLESS_TYPES.filter(
      (type) => nodeComponentRegistry.get(type) !== baseComponentOf(type)
    );
    expect(misrouted).toEqual([]);
  });
});
