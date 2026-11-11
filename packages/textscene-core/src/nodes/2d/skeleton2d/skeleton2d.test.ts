/** Skeleton2D registers its parse and the component that drives its bones (ADR-0045). */

import { describe, expect, it, vi } from 'vitest';
import { nodeRegistry } from '../../../core/NodeRegistry';
import { nodeComponentRegistry } from '../../../r3f/NodeComponentRegistry';
import { TscnParser } from '../../../parser/TscnParser';
import { readFixture } from '../../../linter/testing/fixtureCheck';
import * as logger from '../../../logger';
import { Skeleton2D } from './Component';
import { parseSkeleton2D } from './parser';
import './index';
import './index.r3f';

describe('Skeleton2D registration', () => {
  it('registers its own parse', () => {
    expect(nodeRegistry.getRegistration('Skeleton2D')?.parser).toBe(parseSkeleton2D);
  });

  it('registers the component that drives the bones', () => {
    expect(nodeComponentRegistry.get('Skeleton2D')).toBe(Skeleton2D);
  });

  it('registers a drive that draws nothing of its own (ADR-0045)', () => {
    expect(nodeComponentRegistry.renderIntentOf('Skeleton2D')).toBe('transform-only');
  });

  it('reads its own fixture through the lenient parser, with the reference to its stack', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {});

    const scene = new TscnParser().parse(readFixture('unit-skeleton-2d.tscn'));
    const skeleton = scene.nodes[0]?.children[0];

    expect(skeleton?.type).toBe('Skeleton2D');
    expect(skeleton?.properties).toMatchObject({
      position: { x: 10, y: 20 },
      modificationStack: 'SubResource("SkeletonModificationStack2D_stack")',
    });
    expect(scene.internalResources?.map((r) => r.type)).toContain('SkeletonModificationStack2D');
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining('Unsupported node type'));

    warnSpy.mockRestore();
  });
});
