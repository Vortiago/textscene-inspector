/** ReflectionProbe registration: its own parser, and a component that draws. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../r3f/nodeSupport';
import { parseReflectionProbe } from './parser';
import { ReflectionProbe } from './Component';
import './index';
import './index.r3f';

describe('ReflectionProbe registration', () => {
  it('registers its own parser', () => {
    expect(nodeRegistry.getRegistration('ReflectionProbe')!.parser).toBe(parseReflectionProbe);
  });

  it('registers its component as one that draws', () => {
    expect(nodeComponentRegistry.get('ReflectionProbe')).toBe(ReflectionProbe);
    expect(rendersOwnVisual('ReflectionProbe')).toBe('draws');
  });
});
