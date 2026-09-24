/**
 * BaseButton registration: parsed and validated. It registers no `nodeComponentRegistry`
 * component, so the dispatcher falls back to GenericNodeFallback and `rendersOwnVisual`
 * reports 'not-implemented' in the tree and the inspector.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseControl } from '../../../2d/ui/control/parser';
import './index';

describe('BaseButton registration', () => {
  it('registers the Control base parser', () => {
    const registration = nodeRegistry.getRegistration('BaseButton');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseControl);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('BaseButton')).toBeUndefined();
  });
});
