/**
 * Container registration: the parser, and no node component, so the
 * dispatcher falls back to GenericNodeFallback and `rendersOwnVisual`
 * reports 'not-implemented'.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseControl } from '../../../2d/ui/control/parser';
import './index';

describe('Container registration', () => {
  it('registers the Control base parser', () => {
    const registration = nodeRegistry.getRegistration('Container');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseControl);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('Container')).toBeUndefined();
  });
});
