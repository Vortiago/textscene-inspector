/**
 * Tests that OpenXRBindingModifierEditor is parsed and validated but registers no component: the
 * dispatcher falls back to GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector say so.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parsePanelContainer } from '../panelcontainer/parser';
import './index';

describe('OpenXRBindingModifierEditor registration', () => {
  it('registers the PanelContainer base parser', () => {
    const registration = nodeRegistry.getRegistration('OpenXRBindingModifierEditor');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parsePanelContainer);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('OpenXRBindingModifierEditor')).toBeUndefined();
  });
});
