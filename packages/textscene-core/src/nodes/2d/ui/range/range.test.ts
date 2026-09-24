/**
 * Tests the Range parser registration. A 2D-UI Control registers no
 * `nodeComponentRegistry` component: `index.r3f.ts` registers its painter.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseControl } from '../../../2d/ui/control/parser';
import './index';

describe('Range registration', () => {
  it('registers the Control base parser', () => {
    const registration = nodeRegistry.getRegistration('Range');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseControl);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('Range')).toBeUndefined();
  });
});
