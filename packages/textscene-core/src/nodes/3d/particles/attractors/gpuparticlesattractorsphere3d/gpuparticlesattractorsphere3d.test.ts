/**
 * GPUParticlesAttractorSphere3D registration — parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../../r3f/NodeComponentRegistry';
import { parseNode3D } from '../../../../base/node3d/parser';
import { TscnParser } from '../../../../../parser/TscnParser';
import * as logger from '../../../../../logger';
import './index';

describe('GPUParticlesAttractorSphere3D registration', () => {
  it('registers the Node3D base parser', () => {
    const registration = nodeRegistry.getRegistration('GPUParticlesAttractorSphere3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('GPUParticlesAttractorSphere3D')).toBeUndefined();
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MyGPUParticlesAttractorSphere3D" type="GPUParticlesAttractorSphere3D" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('GPUParticlesAttractorSphere3D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
