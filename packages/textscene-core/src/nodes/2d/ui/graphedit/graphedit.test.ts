/** GraphEdit registration — parser wiring. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseGraphEdit } from './parser';
import './index';

describe('GraphEdit registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('GraphEdit');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseGraphEdit);
  });
});
