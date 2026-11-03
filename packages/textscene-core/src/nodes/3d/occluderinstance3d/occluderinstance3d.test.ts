/**
 * OccluderInstance3D registration: it is parsed, and it draws nothing by design
 * (ADR-0008).
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { OccluderInstance3D } from './Component';
import { parseOccluderInstance3D } from './parser';
import './index';
import './index.r3f';

describe('OccluderInstance3D registration', () => {
  it('registers the parse that keeps the occluder reference', () => {
    const registration = nodeRegistry.getRegistration('OccluderInstance3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseOccluderInstance3D);
  });

  it('registers the component that mounts the AABB of the occluder', () => {
    expect(nodeComponentRegistry.get('OccluderInstance3D')).toBe(OccluderInstance3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.renderIntentOf('OccluderInstance3D')).toBe('transform-only');
  });
});
