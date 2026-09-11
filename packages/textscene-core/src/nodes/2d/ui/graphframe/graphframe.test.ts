/** GraphFrame registration — parser wiring. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseGraphFrame } from './parser';
import './index';

describe('GraphFrame registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('GraphFrame');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseGraphFrame);
  });
});
