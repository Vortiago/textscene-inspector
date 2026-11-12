/**
 * MultiMeshInstance3D registration: parsed, validated and drawn.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseGeometryInstance3D } from '../geometryinstance3d/parser';
import './index';
import './index.r3f';

describe('MultiMeshInstance3D registration', () => {
  it('registers the GeometryInstance3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('MultiMeshInstance3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseGeometryInstance3D);
  });

  it('registers a component that draws', () => {
    expect(nodeComponentRegistry.renderIntentOf('MultiMeshInstance3D')).toBe('draws');
    expect(rendersOwnVisual('MultiMeshInstance3D')).toBe('draws');
  });
});
