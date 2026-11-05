/**
 * Bone2D registration: it is parsed with its rest pose, and it draws nothing on purpose
 * (ADR-0008), not for want of an implementation.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseBone2D } from './parser';
import { heading } from '../../../parser/testing/parserKit';
import { Node2D } from '../../base/node2d/Component';
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

  it('reuses the Node2D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('Bone2D')).toBe(Node2D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('Bone2D')).toBe('transform-only');
  });
});
