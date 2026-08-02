/**
 * CheckButton registration: parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseButton } from '../button/parser';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
import './index';

describe('CheckButton registration', () => {
  it('registers the Button base parser', () => {
    const registration = nodeRegistry.getRegistration('CheckButton');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseButton);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('CheckButton')).toBeUndefined();
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Control"]\n\n' +
        '[node name="MyCheckButton" type="CheckButton" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('CheckButton');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
