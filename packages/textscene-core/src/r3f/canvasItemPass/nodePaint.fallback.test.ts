/**
 * The paint a node takes in the preview where the pass holds no live path for it. The preview
 * installs no detached paint, so a miss draws flat with a warning instead of throwing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { TscnNode } from '../../parser/types';
import * as logger from '../../logger';
import { installDetachedPaint, installedDetachedPaint, type DetachedPaint } from './detachedPaintSlot';
import { detachedPaint, IN_TREE_ORDER } from './nodePaint';

const node = { name: 'Missed', type: 'Node2D', properties: {}, rawProperties: {}, children: [] } as TscnNode;

describe('detachedPaint in the preview', () => {
  let testPaint: DetachedPaint | null;
  beforeEach(() => {
    testPaint = installedDetachedPaint();
    installDetachedPaint(null);
  });
  afterEach(() => {
    installDetachedPaint(testPaint);
    vi.restoreAllMocks();
  });

  it('draws a node the pass misses at the start of the canvas, with a warning', () => {
    const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const paint = detachedPaint().nodePaint(IN_TREE_ORDER, node);
    expect(paint.own).toBe(0);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Missed'));
  });

  it('lets the children of a node the pass misses read the pass at their own paths', () => {
    vi.spyOn(logger, 'warn').mockImplementation(() => {});
    const parent = { ...node, name: 'Parent', children: [{ ...node, name: 'Child' }] } as TscnNode;
    const paint = detachedPaint().nodePaint(IN_TREE_ORDER, parent);
    expect(detachedPaint().childFrames(IN_TREE_ORDER, parent, paint).children).toEqual([IN_TREE_ORDER]);
  });
});
