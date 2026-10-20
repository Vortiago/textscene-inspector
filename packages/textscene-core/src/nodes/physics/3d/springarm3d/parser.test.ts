import { describe, expect, it } from 'vitest';
import { parseSpringArm3D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

const arm = heading('SpringArm3D', { name: 'Arm' });

describe('parseSpringArm3D', () => {
  it('reads spring_length on top of the Node3D transform', () => {
    const props = parseSpringArm3D(arm, {
      transform: 'Transform3D(1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0)',
      spring_length: '4.0',
    });

    expect(props.spring_length).toBe(4);
    expect(props.transform?.origin).toEqual({ x: 0, y: 1, z: 0 });
  });

  it('leaves an unauthored spring_length undefined, so the consumer applies the default', () => {
    expect(parseSpringArm3D(arm, {}).spring_length).toBeUndefined();
  });

  it('keeps a negative and a zero spring_length', () => {
    expect(parseSpringArm3D(arm, { spring_length: '-2.0' }).spring_length).toBe(-2);
    expect(parseSpringArm3D(arm, { spring_length: '0.0' }).spring_length).toBe(0);
  });

  it('reads an unreadable spring_length as undefined, not NaN', () => {
    expect(parseSpringArm3D(arm, { spring_length: 'long' }).spring_length).toBeUndefined();
  });

  it('keeps the non-finite spring_length values the file can author', () => {
    expect(parseSpringArm3D(arm, { spring_length: 'inf' }).spring_length).toBe(Infinity);
    expect(parseSpringArm3D(arm, { spring_length: 'inf_neg' }).spring_length).toBe(-Infinity);
    expect(parseSpringArm3D(arm, { spring_length: 'nan' }).spring_length).toBeNaN();
  });
});
