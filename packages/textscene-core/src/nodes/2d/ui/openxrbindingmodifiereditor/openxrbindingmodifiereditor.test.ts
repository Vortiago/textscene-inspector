/**
 * OpenXRBindingModifierEditor registration: parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
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

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n' +
        '[node name="MyOpenXRBindingModifierEditor" type="OpenXRBindingModifierEditor" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('OpenXRBindingModifierEditor');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
