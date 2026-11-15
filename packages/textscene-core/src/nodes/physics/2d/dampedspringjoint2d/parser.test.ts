import { describe, expect, it } from 'vitest';
import { parseDampedSpringJoint2D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseDampedSpringJoint2D', () => {
  // damped_spring_joint_2d.h:43
  it('defaults length to 50', () => {
    expect(parseDampedSpringJoint2D(heading('DampedSpringJoint2D', { name: 'Spring' }), {}).length).toBe(50);
  });

  it('reads the authored length, 0 and negative values included', () => {
    const read = (length: string) =>
      parseDampedSpringJoint2D(heading('DampedSpringJoint2D', { name: 'Spring' }), { length }).length;
    expect([read('0'), read('-12.5')]).toEqual([0, -12.5]);
  });
});
