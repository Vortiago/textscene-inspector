import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { controlComponentRegistry } from '../../../../r3f/controls/ControlComponentRegistry';
import { parseTabBar } from './parser';
import './index';
import './index.r3f';

describe('TabBar registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('TabBar');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseTabBar);
  });

  it('registers no 3D node component — TabBar is a 2D-UI Control, drawn through the native painter', () => {
    expect(nodeComponentRegistry.get('TabBar')).toBeUndefined();
  });

  it('registers a native (WebGL canvas) painter', () => {
    expect(controlComponentRegistry.get('TabBar')).toBeDefined();
  });
});
