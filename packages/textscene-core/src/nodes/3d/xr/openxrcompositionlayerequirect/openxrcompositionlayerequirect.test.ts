/**
 * OpenXRCompositionLayerEquirect registration — parsed, and deliberately NOT given a
 * render component.
 *
 * Godot draws this: `_should_use_fallback_node` (openxr_composition_layer.cpp:196)
 * returns true whenever `openxr_api == nullptr`, which is every run outside a live
 * OpenXR session, and `_create_fallback_node` (:204-206) then makes a real
 * MeshInstance3D shaped by `quad_size`/`radius`/the angles. So this is `pending`,
 * not ADR-0008 `transform-only`: the absence of a mesh here is a gap, not a design
 * decision, and registering the base Node3D component would have claimed otherwise
 * in the parity sheet.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
import { parseNode3D } from '../../../base/node3d/parser';
import './index';

describe('OpenXRCompositionLayerEquirect registration', () => {
  it('registers the parseNode3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('OpenXRCompositionLayerEquirect');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('registers NO component, so GenericNodeFallback keeps handling it', () => {
    // `pending` is the absence of a registration, which is what lets the sheet
    // read `unimplemented` rather than `linter-only` — sheets.test.mjs asserts
    // the two agree.
    expect(nodeComponentRegistry.get('OpenXRCompositionLayerEquirect')).toBeUndefined();
    expect(nodeComponentRegistry.isTransformOnly('OpenXRCompositionLayerEquirect')).toBe(false);
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MyOpenXRCompositionLayerEquirect" type="OpenXRCompositionLayerEquirect" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('OpenXRCompositionLayerEquirect');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
