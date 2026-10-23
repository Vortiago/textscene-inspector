import { describe, expect, it } from 'vitest';
import { addAtIndex, insertAtIndex, orderAmongPlaced } from './siblingIndex';

const named = (name: string, index?: number) => ({ name, ...(index === undefined ? {} : { index }) });
const namesOf = (nodes: readonly { name: string }[]) => nodes.map((n) => n.name);

describe('addAtIndex', () => {
  const siblings = [named('A'), named('B'), named('C')];

  it('appends a node that states no index', () => {
    expect(namesOf(addAtIndex(siblings, named('N')))).toEqual(['A', 'B', 'C', 'N']);
  });

  it('moves a node to the index it states', () => {
    expect(namesOf(addAtIndex(siblings, named('N', 0)))).toEqual(['N', 'A', 'B', 'C']);
    expect(namesOf(addAtIndex(siblings, named('N', 2)))).toEqual(['A', 'B', 'N', 'C']);
  });

  it('keeps a node last when its index is the last place or past it', () => {
    expect(namesOf(addAtIndex(siblings, named('N', 3)))).toEqual(['A', 'B', 'C', 'N']);
    expect(namesOf(addAtIndex(siblings, named('N', 9)))).toEqual(['A', 'B', 'C', 'N']);
  });

  it('appends a node whose index is negative', () => {
    expect(namesOf(addAtIndex(siblings, named('N', -1)))).toEqual(['A', 'B', 'C', 'N']);
  });

  it('leaves the siblings it was given as they were', () => {
    addAtIndex(siblings, named('N', 0));
    expect(namesOf(siblings)).toEqual(['A', 'B', 'C']);
  });
});

describe('insertAtIndex', () => {
  it('places the node in the array it was given', () => {
    const siblings = [named('A'), named('B')];
    insertAtIndex(siblings, named('N', 1));
    insertAtIndex(siblings, named('M'));
    expect(namesOf(siblings)).toEqual(['A', 'N', 'B', 'M']);
  });
});

describe('orderAmongPlaced', () => {
  it('keeps the written order for nodes that state no index', () => {
    expect(namesOf(orderAmongPlaced([named('A'), named('B')], 2))).toEqual(['A', 'B']);
  });

  it('puts a node that states index=0 before the node written above it', () => {
    expect(namesOf(orderAmongPlaced([named('A'), named('B', 0)], 2))).toEqual(['B', 'A']);
  });

  it('adds several nodes in turn, each among the ones before it', () => {
    // Among three placed siblings P: M P N P P L.
    expect(namesOf(orderAmongPlaced([named('N', 1), named('M', 0), named('L')], 3))).toEqual(['M', 'N', 'L']);
  });

  it('counts the placed siblings, so an index past them keeps the written order', () => {
    expect(namesOf(orderAmongPlaced([named('A'), named('B', 2)], 1))).toEqual(['A', 'B']);
    expect(namesOf(orderAmongPlaced([named('A'), named('B', 1)], 1))).toEqual(['B', 'A']);
  });
});
