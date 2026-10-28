/**
 * The work the Seating does for a heading does not grow with the other headings: an id trail finds
 * its heading through one index, and an `owner=` resolves only for a heading that gets a seat.
 */
import { describe, expect, it } from 'vitest';
import { seatScene } from './sceneTreeBuilder';
import { node } from './testing/seatingKit';
import type { NodeOrigin, TscnNode } from './types';

const HEADINGS = 1000;

/** The index of ids, the trail headings the scene keeps, and the heading a trail names read each id once. */
const READS_PER_HEADING = 3;

function origin(heading: TscnNode, parts: Partial<NodeOrigin<TscnNode>> = {}): NodeOrigin<TscnNode> {
  return { node: heading, line: 1, declaredParent: heading.parent, uniqueId: 0, ...parts };
}

/** `origins`, each with its `uniqueId` behind a getter that counts the reads in `reads.count`. */
function countingUniqueIds(origins: NodeOrigin<TscnNode>[]): {
  origins: NodeOrigin<TscnNode>[];
  reads: { count: number };
} {
  const reads = { count: 0 };
  const counted = origins.map((heading) => {
    const id = heading.uniqueId;
    return Object.defineProperty({ ...heading }, 'uniqueId', {
      get: () => {
        reads.count++;
        return id;
      },
      enumerable: true,
    }) as NodeOrigin<TscnNode>;
  });
  return { origins: counted, reads };
}

/** A root with a landing heading, then `HEADINGS` headings built by `heading`. */
function manyHeadings(heading: (index: number) => NodeOrigin<TscnNode>): NodeOrigin<TscnNode>[] {
  return [
    origin(node('Root')),
    origin(node('Landing', '.'), { uniqueId: 7 }),
    ...Array.from({ length: HEADINGS }, (_, index) => heading(index)),
  ];
}

describe('seatScene id-trail lookups', () => {
  it('reads each heading id a bounded number of times for broken owner paths', () => {
    const { origins, reads } = countingUniqueIds(
      manyHeadings((i) => origin(node(`N${i}`, '.', { owner: 'Nowhere/Here' }), { ownerIdTrail: [7] }))
    );

    seatScene(origins);

    expect(reads.count).toBeLessThanOrEqual(READS_PER_HEADING * origins.length);
  });

  it('reads each heading id a bounded number of times for broken parent paths', () => {
    const { origins, reads } = countingUniqueIds(
      manyHeadings((i) => origin(node(`N${i}`, 'Nowhere/Here'), { idTrail: [7] }))
    );

    seatScene(origins);

    expect(reads.count).toBeLessThanOrEqual(READS_PER_HEADING * origins.length);
  });

  it('still seats a node whose owner path lands through the trail', () => {
    const origins = manyHeadings((i) =>
      origin(node(`N${i}`, '.', { owner: 'Nowhere/Here' }), { ownerIdTrail: [7] })
    );

    const { roots } = seatScene(origins);

    expect(roots[0]!.children.find((child) => child.name === 'N0')!.owner).toBe('Landing');
  });
});

describe('seatScene owner resolution', () => {
  /** A scene whose `Recovered` heading is seated by the id trail `idTrail` on `Landing`, counting the reads of its `owner=`. */
  function ownerReadsFor(landing: TscnNode, idTrail: number[]): number {
    let ownerReads = 0;
    const recovered = node('Recovered', 'Nowhere/Here');
    Object.defineProperty(recovered, 'owner', {
      get: () => {
        ownerReads++;
        return 'Landing';
      },
      enumerable: true,
    });

    seatScene([origin(node('Root')), origin(landing, { uniqueId: 7 }), origin(recovered, { idTrail })]);

    return ownerReads;
  }

  it('does not resolve the owner of a heading in a file Godot refuses to instantiate', () => {
    const recovered = node('Recovered', 'Nowhere/Here');
    let ownerReads = 0;
    Object.defineProperty(recovered, 'owner', {
      get: () => {
        ownerReads++;
        return 'Landing';
      },
      enumerable: true,
    });

    seatScene([
      origin(node('Root')),
      origin(node('Landing', '.'), { uniqueId: 7 }),
      origin(recovered, { idTrail: [7] }),
      origin(node('Stray')),
    ]);

    expect(ownerReads).toBe(0);
  });

  it('resolves the owner of a heading the id trail lands in this tree', () => {
    expect(ownerReadsFor(node('Landing', '.'), [7])).toBeGreaterThan(0);
  });
});
