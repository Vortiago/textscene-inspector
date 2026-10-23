/** The node a `[connection]` end names: its path first, then its id trail. */

import { describe, expect, it } from 'vitest';
import { connectionEndResolver } from './connectionEnd';
import { seatScene } from './sceneTreeBuilder';
import type { NodeOrigin, TscnNode } from './types';

function node(name: string, parent?: string, extras: Partial<TscnNode> = {}): TscnNode {
  const heading: TscnNode = {
    rawProperties: {},
    type: 'Node3D',
    name,
    properties: {},
    children: [],
    ...extras,
  };
  return parent === undefined ? heading : { ...heading, parent };
}

/** One origin per node, in order, each with the `unique_id=` its entry in `ids` gives (0 where absent). */
function originsOf(nodes: TscnNode[], ids: Record<string, number>): NodeOrigin<TscnNode>[] {
  return nodes.map((heading, i) => ({
    node: heading,
    line: i + 1,
    declaredParent: heading.parent,
    uniqueId: ids[heading.name] ?? 0,
  }));
}

/** A root, `Button` (id 7), the instance `Body` (id 9) and `Lost` (id 5), whose `parent=` names nothing. */
const button = node('Button', '.');
const lost = node('Lost', 'Gone');
const nodes = [node('Root'), button, node('Body', '.', { instance: 'ExtResource("1")' }), lost];
const origins = originsOf(nodes, { Button: 7, Body: 9, Lost: 5 });
const seating = seatScene(origins);
const endOf = connectionEndResolver(origins, seating);
const buttonSeat = seating.seated.get(button);

describe('connectionEndResolver', () => {
  it('finds the node a path walks to, and ignores an id trail it does not need', () => {
    expect(endOf('Button', [9])).toEqual({ status: 'found', node: buttonSeat });
  });

  it('simplifies the written path, as the loader stores it', () => {
    expect(endOf('Gone/../Button', undefined)).toEqual({ status: 'found', node: buttonSeat });
  });

  it('finds the placed heading an id trail names where the path misses', () => {
    expect(endOf('Gone', [7])).toEqual({ status: 'found', node: buttonSeat });
  });

  it.each([
    ['continues into an instanced scene', [9, 4], 'unknowable'],
    ['names no heading', [99], 'missing'],
    ['is absent', undefined, 'missing'],
    ['names a heading Godot re-rooted, which is not at its own path', [5], 'missing'],
  ] as const)('answers by status where the path misses and the trail %s', (_case, trail, status) => {
    expect(endOf('Gone', trail && [...trail]).status).toBe(status);
  });

  it('finds nothing for a trail that names a heading of a scene Godot refuses to instantiate', () => {
    // A later heading with no parent= refuses the scene, so Godot re-roots nothing and `Lost` stays unplaced.
    const refusing = [node('Root'), node('Lost', 'Gone'), node('Stray')];
    const refusingOrigins = originsOf(refusing, { Lost: 7 });
    const refused = connectionEndResolver(refusingOrigins, seatScene(refusingOrigins));
    expect(refused('Gone', [7]).status).toBe('missing');
  });
});
