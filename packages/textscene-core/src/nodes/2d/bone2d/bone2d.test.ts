/**
 * Bone2D registration: it is parsed with its rest pose and gizmo keys, and it draws its kite gizmo.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseBone2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import { Bone2D } from './Component';
import './index';
import './index.r3f';

describe('Bone2D registration', () => {
  it('registers the Bone2D parse', () => {
    const registration = nodeRegistry.getRegistration('Bone2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseBone2D);
  });

  it('reads the rest pose', () => {
    const props = parseBone2D(heading('Bone2D', { name: 'Upper' }), {
      rest: 'Transform2D(1, 0, 0, 1, 100, 0)',
    });
    expect(props.rest).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 100, ty: 0 });
  });

  it('defaults an unwritten rest to all zeros, as the constructor sets it', () => {
    const props = parseBone2D(heading('Bone2D', { name: 'Unrested' }), {});
    expect(props.rest).toEqual({ a: 0, b: 0, c: 0, d: 0, tx: 0, ty: 0 });
  });

  it('registers the Bone2D component, which draws the kite gizmo', () => {
    expect(nodeComponentRegistry.get('Bone2D')).toBe(Bone2D);
    expect(nodeComponentRegistry.renderIntentOf('Bone2D')).toBe('draws');
  });
});

describe('Bone2D gizmo keys', () => {
  const read = (properties: Record<string, string>) =>
    parseBone2D(heading('Bone2D', { name: 'Upper' }), properties);

  it('defaults to the constructor values of skeleton_2d.cpp:490-493', () => {
    const props = read({});
    expect(props).toMatchObject({ length: 16, bone_angle: 0, auto_calculate_length_and_angle: true });
    expect(props.show_bone_gizmo).toBe(true);
  });

  it('reads the four keys, the angle in radians as set_bone_angle stores it', () => {
    const props = read({
      auto_calculate_length_and_angle: 'false',
      length: '40',
      bone_angle: '90',
      'editor_settings/show_bone_gizmo': 'false',
    });
    expect(props.auto_calculate_length_and_angle).toBe(false);
    expect(props.length).toBe(40);
    expect(props.bone_angle).toBeCloseTo(Math.PI / 2, 12);
    expect(props.show_bone_gizmo).toBe(false);
  });
});
