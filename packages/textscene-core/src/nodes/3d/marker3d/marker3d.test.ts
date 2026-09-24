/** Marker3D registration: the full slice, with the selection-gated cross (ADR-0018). */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { parseMarker3D } from './parser';
import { Marker3D } from './Component';
import './index';
import './index.r3f';

describe('Marker3D registration', () => {
  it('registers the Marker3D parser', () => {
    const registration = nodeRegistry.getRegistration('Marker3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseMarker3D);
  });

  it('registers the Marker3D render component (axis-cross gizmo)', () => {
    expect(nodeComponentRegistry.get('Marker3D')).toBe(Marker3D);
  });
});
