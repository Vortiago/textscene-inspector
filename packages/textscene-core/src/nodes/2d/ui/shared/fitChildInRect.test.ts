/**
 * `Container::as_sortable_control` (`scene/gui/container.cpp:143-155`) — which
 * children a container arranges at all, and the four ways a child falls out of
 * that list.
 */
import { describe, expect, it } from 'vitest';
import type { SolveNode } from '../../../../r3f/controls/native/solveTree';
import { isSortableControl } from './fitChildInRect';

function child(properties: Record<string, unknown>, extra: Partial<SolveNode> = {}): SolveNode {
  return {
    path: 'Root/Child',
    node: { name: 'Child', type: 'Label', children: [], properties },
    children: [],
    skippedAncestors: null,
    hidden: false,
    ...extra,
  } as unknown as SolveNode;
}

describe('isSortableControl', () => {
  it('arranges an ordinary visible child', () => {
    expect(isSortableControl(child({}))).toBe(true);
  });

  it('skips an invisible child rather than laying out an empty slot', () => {
    expect(isSortableControl(child({ visible: false }))).toBe(false);
  });

  it('skips a child the eye toggle hid', () => {
    expect(isSortableControl(child({}, { hidden: true }))).toBe(false);
  });

  it('skips a promoted child, which the container’s own cast never reaches', () => {
    const promoted = child({}, {
      skippedAncestors: { transform: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 } },
    } as Partial<SolveNode>);
    expect(isSortableControl(promoted)).toBe(false);
  });

  it('skips a top_level child, whose flag the cast rejects before visibility', () => {
    // `if (!c || c->is_set_as_top_level()) return nullptr;` (container.cpp:144-146)
    // — ahead of every visibility mode, so even `SortableVisibilityMode::IGNORE`
    // drops it.
    expect(isSortableControl(child({ topLevel: true }))).toBe(false);
  });
});
