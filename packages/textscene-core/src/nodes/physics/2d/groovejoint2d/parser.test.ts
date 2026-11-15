import { describe, expect, it } from 'vitest';
import { parseGrooveJoint2D } from './parser';
import { heading } from '../../../../parser/testing/parserKit';

describe('parseGrooveJoint2D', () => {
  // groove_joint_2d.h:40-41
  it('defaults length to 50 and initial_offset to 25', () => {
    const props = parseGrooveJoint2D(heading('GrooveJoint2D', { name: 'Groove' }), {});
    expect([props.length, props.initial_offset]).toEqual([50, 25]);
  });

  it('reads the authored length and initial_offset, negative values included', () => {
    const props = parseGrooveJoint2D(heading('GrooveJoint2D', { name: 'Groove' }), {
      length: '-80',
      initial_offset: '0',
      position: 'Vector2(4, 5)',
    });
    expect([props.length, props.initial_offset, props.position]).toEqual([-80, 0, { x: 4, y: 5 }]);
  });
});
