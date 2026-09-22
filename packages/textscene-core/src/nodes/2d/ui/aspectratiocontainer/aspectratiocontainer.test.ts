/** AspectRatioContainer registration — parser. Render registration: `index.r3f.test.ts`. */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { parseAspectRatioContainer } from './parser';
import './index';

describe('AspectRatioContainer registration', () => {
  it('registers its own parser', () => {
    const registration = nodeRegistry.getRegistration('AspectRatioContainer');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseAspectRatioContainer);
  });
});
