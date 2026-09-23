/**
 * Tests that OpenXRInteractionProfileEditor is parsed and validated but registers no component: the
 * dispatcher falls back to GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector say so.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseHBoxContainer } from '../hboxcontainer/parser';
import './index';

describe('OpenXRInteractionProfileEditor registration', () => {
  it('registers the HBoxContainer parser', () => {
    const registration = nodeRegistry.getRegistration('OpenXRInteractionProfileEditor');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseHBoxContainer);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('OpenXRInteractionProfileEditor')).toBeUndefined();
  });
});
