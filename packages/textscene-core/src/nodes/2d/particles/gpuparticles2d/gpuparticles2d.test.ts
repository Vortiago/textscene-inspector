/**
 * GPUParticles2D registration — parsed and validated, not yet rendered.
 *
 * The slice registers a base component under `renderIntent: 'pending'`, so the
 * badge reads a gap while `visible` and the workspace split still behave.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { rendersOwnVisual } from '../../../../r3f/nodeSupport';
import { parseNode2D } from '../../../base/node2d/parser';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
import './index';
import './index.r3f';

describe('GPUParticles2D registration', () => {
  it('registers the Node2D base parser', () => {
    const registration = nodeRegistry.getRegistration('GPUParticles2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('registers a base component as a declared gap, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.renderIntentOf('GPUParticles2D')).toBe('pending');
    expect(rendersOwnVisual('GPUParticles2D')).toBe('not-implemented');
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
