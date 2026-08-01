/**
 * SoftBody3D registration: parsed and validated, not yet rendered.
 *
 * Registering NO component is the point: the dispatcher falls back to
 * GenericNodeFallback, and `rendersOwnVisual` reports 'not-implemented' so the
 * tree and inspector keep saying so until someone draws it.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { parseMeshInstance3D } from '../../../3d/meshinstance3d/parser';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
import './index';

describe('SoftBody3D registration', () => {
  it('reuses MeshInstance3D\'s parser, the ancestor that reads its properties', () => {
    const registration = nodeRegistry.getRegistration('SoftBody3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseMeshInstance3D);
  });

  it('registers no render component, so it still reads as not implemented', () => {
    expect(nodeComponentRegistry.get('SoftBody3D')).toBeUndefined();
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MySoftBody3D" type="SoftBody3D" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('SoftBody3D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
