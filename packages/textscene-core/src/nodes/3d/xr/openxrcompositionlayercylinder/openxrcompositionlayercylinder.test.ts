/**
 * OpenXRCompositionLayerCylinder registration: parsed, its own visual still a gap. Outside a live OpenXR session
 * `_should_use_fallback_node` (openxr_composition_layer.cpp:196) is true, and `_create_fallback_node`
 * (:204-206) makes a real MeshInstance3D. So the intent is `pending`, not ADR-0008 `transform-only`,
 * and the badge reads a gap while `visible` and the workspace split still behave.
 */

import { describe, expect, it } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { parseNode3D } from '../../../base/node3d/parser';
import './index';
import './index.r3f';

describe('OpenXRCompositionLayerCylinder registration', () => {
  it('registers the parseNode3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('OpenXRCompositionLayerCylinder');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    // `pending` keeps the sheet on `unimplemented` rather than `linter-only`;
    // sheets.test.mjs holds the two together.
    expect(nodeComponentRegistry.renderIntentOf('OpenXRCompositionLayerCylinder')).toBe('pending');
    expect(rendersOwnVisual('OpenXRCompositionLayerCylinder')).toBe('not-implemented');
  });
});
