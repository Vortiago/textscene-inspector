/** GraphNode registration — parser wiring. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseGraphNode } from './parser';
import './index';

describe('GraphNode registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('GraphNode');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseGraphNode);
  });
});
