/**
 * ColorPicker registration: parsed and validated, not yet rendered.
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
import { parseVBoxContainer } from '../vboxcontainer/parser';
import './index';

describe('ColorPicker registration', () => {
  it('registers the VBoxContainer base parser', () => {
    const registration = nodeRegistry.getRegistration('ColorPicker');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseVBoxContainer);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('ColorPicker')).toBeUndefined();
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n' +
        '[node name="MyColorPicker" type="ColorPicker" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('ColorPicker');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
