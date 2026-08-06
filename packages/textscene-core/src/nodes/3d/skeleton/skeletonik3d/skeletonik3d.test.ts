/**
 * SkeletonIK3D registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../../parser/TscnParser';
import * as logger from '../../../../logger';
import { parseNode3D } from '../../../base/node3d/parser';
import { Node3D } from '../../../base/node3d/Component';
import './index';
import './index.r3f';

describe('SkeletonIK3D registration', () => {
  it('registers the parseNode3D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('SkeletonIK3D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode3D);
  });

  it('reuses the Node3D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('SkeletonIK3D')).toBe(Node3D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('SkeletonIK3D')).toBe(true);
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node3D"]\n\n' +
        '[node name="MySkeletonIK3D" type="SkeletonIK3D" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('SkeletonIK3D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
