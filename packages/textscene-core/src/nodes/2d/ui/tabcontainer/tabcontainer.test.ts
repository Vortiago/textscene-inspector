import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { parseTabContainer } from './parser';
import './index';
import './index.r3f';

describe('TabContainer registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('TabContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseTabContainer);
  });

  it('registers no 3D node component — TabContainer is a 2D-UI Control, drawn through the native painter', () => {
    expect(nodeComponentRegistry.get('TabContainer')).toBeUndefined();
  });

  it('registers a native (WebGL canvas) painter', () => {
    expect(controlComponentRegistry.get('TabContainer')).toBeDefined();
  });
});
