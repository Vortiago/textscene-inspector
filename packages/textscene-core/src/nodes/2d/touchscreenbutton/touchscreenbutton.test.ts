/** TouchScreenButton registration: the parser, and the component that draws `texture_normal`. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseTouchScreenButton } from './parser';
import './index';
import './index.r3f';

describe('TouchScreenButton registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('TouchScreenButton');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseTouchScreenButton);
  });

  it('registers a drawing component, so the badge no longer reads a gap', () => {
    expect(nodeComponentRegistry.renderIntentOf('TouchScreenButton')).toBe('draws');
    expect(rendersOwnVisual('TouchScreenButton')).toBe('draws');
  });
});
