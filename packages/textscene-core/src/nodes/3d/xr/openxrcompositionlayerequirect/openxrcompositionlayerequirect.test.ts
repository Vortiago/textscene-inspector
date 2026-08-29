/**
 * OpenXRCompositionLayerEquirect registration: parsed, its own visual still a gap.
 *
 * Godot draws this: `_should_use_fallback_node` (openxr_composition_layer.cpp:196)
 * returns true whenever `openxr_api == nullptr`, which is every run outside a live
 * OpenXR session, and `_create_fallback_node` (:204-206) then makes a real
 * MeshInstance3D shaped by `quad_size`/`radius`/the angles. So this is `pending`,
 * not ADR-0008 `transform-only`: the missing mesh is a gap, not a design decision.
 * The slice registers a base component under that intent, so the badge reads a gap
 * while `visible` and the workspace split still behave.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { parseNode3D } from '../../../base/node3d/parser';
import './index';
import './index.r3f';

describe('OpenXRCompositionLayerEquirect registration', () => {
  it('registers the parseNode3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('OpenXRCompositionLayerEquirect');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    // `pending` keeps the sheet on `unimplemented` rather than `linter-only`;
    // sheets.test.mjs holds the two together.
    expect(nodeComponentRegistry.renderIntentOf('OpenXRCompositionLayerEquirect')).toBe('pending');
    expect(rendersOwnVisual('OpenXRCompositionLayerEquirect')).toBe('not-implemented');
  });
});
