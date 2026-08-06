/**
 * Skeleton2D registration — it is parsed, and it draws nothing on purpose
 * (ADR-0008) rather than for want of an implementation.
 */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../parser/TscnParser';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import * as logger from '../../../logger';
import { parseNode2D } from '../../base/node2d/parser';
import { Node2D } from '../../base/node2d/Component';
import './index';
import './index.r3f';

describe('Skeleton2D registration', () => {
  it('registers the parseNode2D parse it reuses', () => {
    const registration = nodeRegistry.getRegistration('Skeleton2D');
    expect(registration).not.toBeNull();
    expect(registration!.parser).toBe(parseNode2D);
  });

  it('reuses the Node2D component so children keep their transform space', () => {
    expect(nodeComponentRegistry.get('Skeleton2D')).toBe(Node2D);
  });

  it('declares drawing nothing, so the sheet may claim linter-only', () => {
    expect(nodeComponentRegistry.isTransformOnly('Skeleton2D')).toBe(true);
  });

  it('lands in the lenient parser tree with its type preserved and no fallback warning', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(
      '[gd_scene format=3]\n\n[node name="Root" type="Node2D"]\n\n' +
        '[node name="MySkeleton2D" type="Skeleton2D" parent="."]\n'
    );

    const node = scene.nodes[0]?.children[0];
    expect(node?.type).toBe('Skeleton2D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });

  it('reads its own fixture through the lenient parser, stack sub-resource and all', () => {
    // The fixture carries a SkeletonModificationStack2D sub-resource, a type
    // the previewer models nowhere. The strict side is covered by
    // linterParser.test.ts; this is the path the previewer actually takes, and
    // it must survive the unknown resource rather than drop the node with it.
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(readFixture('unit-skeleton-2d.tscn'));
    const skeleton = scene.nodes[0]?.children[0];

    expect(skeleton?.type).toBe('Skeleton2D');
    // `properties` is what parseNode2D produced, so it holds the Node2D
    // transform and nothing else: `modification_stack` survives only in the raw
    // bag, which is exactly the divergence the sheet records.
    expect(skeleton?.rawProperties?.modification_stack).toBe(
      'SubResource("SkeletonModificationStack2D_stack")'
    );
    expect(skeleton?.properties).toMatchObject({ position: { x: 10, y: 20 } });
    expect(scene.internalResources?.map((r) => r.type)).toContain('SkeletonModificationStack2D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
