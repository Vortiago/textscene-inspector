import { describe, expect, it } from 'vitest';
import { parseJoint3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

const joint = heading('PinJoint3D', { name: 'Joint' });

describe('parseJoint3D', () => {
  it('reads node_a and node_b on top of the Node3D transform', () => {
    const props = parseJoint3D(joint, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
      node_a: 'NodePath("../BodyA")',
      node_b: 'NodePath("../BodyB")',
    });

    expect(props.node_a).toBe('../BodyA');
    expect(props.node_b).toBe('../BodyB');
    expect(props.transform?.origin).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('leaves unauthored paths undefined, as Godot draws no body for an empty path', () => {
    const props = parseJoint3D(joint, {});
    expect(props.node_a).toBeUndefined();
    expect(props.node_b).toBeUndefined();
  });

  it('reads an empty or unreadable path as undefined', () => {
    const props = parseJoint3D(joint, { node_a: 'NodePath("")', node_b: '42' });
    expect(props.node_a).toBeUndefined();
    expect(props.node_b).toBeUndefined();
  });

  it('keeps a path that climbs and one that walks a unique name', () => {
    const props = parseJoint3D(joint, { node_a: 'NodePath("../../Rig/Arm")', node_b: 'NodePath("%Hand")' });
    expect(props.node_a).toBe('../../Rig/Arm');
    expect(props.node_b).toBe('%Hand');
  });
});
