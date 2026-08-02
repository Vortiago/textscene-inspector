/**
 * GPUParticles2D registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseNode2D } from '../../../base/node2d/parser';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
import './index';

describe('GPUParticles2D registration', () => {
  it('registers the Node2D base parser', () => {
    const registration = nodeRegistry.getRegistration('GPUParticles2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('GPUParticles2D')).toBeUndefined();
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n' +
        '[node name="MyGPUParticles2D" type="GPUParticles2D" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('GPUParticles2D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
