/** Where a heading's `parent_id_path=` seats it, over the headings of one scan. */
import { describe, expect, it } from 'vitest';
import { idTrailEnd } from './idTrail';
import type { NodeOrigin, RawNode } from './types';

function origin(
  name: string,
  parts: { uniqueId?: number; idTrail?: number[]; instance?: string } = {}
): NodeOrigin<RawNode> {
  const node: RawNode = {
    name,
    type: 'Node3D',
    children: [],
    rawProperties: {},
    ...(parts.instance ? { instance: parts.instance } : {}),
  };
  return { node, line: 1, declaredParent: '.', uniqueId: parts.uniqueId ?? 0, idTrail: parts.idTrail };
}

const placed = () => true;

describe('idTrailEnd', () => {
  it('lands a one-id trail on the placed heading that owns the id', () => {
    const origins = [origin('Root'), origin('Mid', { uniqueId: 20 }), origin('Orphan', { idTrail: [20] })];
    expect(idTrailEnd(origins, 2, placed)).toEqual({ kind: 'lands', heading: 1 });
  });

  it('gives nothing for a heading with no trail', () => {
    expect(idTrailEnd([origin('Root'), origin('Orphan')], 1, placed)).toBeUndefined();
  });

  it('gives nothing for a trail that names no heading', () => {
    const origins = [origin('Root'), origin('Orphan', { idTrail: [99] })];
    expect(idTrailEnd(origins, 1, placed)).toBeUndefined();
  });

  it('gives nothing when the named heading is not placed (edge case)', () => {
    const origins = [origin('Root'), origin('Mid', { uniqueId: 20 }), origin('Orphan', { idTrail: [20] })];
    expect(idTrailEnd(origins, 2, ({ node }) => node.name !== 'Mid')).toBeUndefined();
  });

  it('follows a two-id trail through an instance into its scene (edge case)', () => {
    const origins = [
      origin('Root'),
      origin('Inst', { uniqueId: 20, instance: 'ExtResource("1")' }),
      origin('Orphan', { idTrail: [20, 5] }),
    ];
    expect(idTrailEnd(origins, 2, placed)).toEqual({ kind: 'inBase', heading: 1 });
  });
});
