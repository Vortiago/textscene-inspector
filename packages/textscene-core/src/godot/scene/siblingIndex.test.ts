import { describe, expect, it } from 'vitest';
import { addAtIndex, insertAtIndex } from './siblingIndex';

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

  it('adds several nodes in turn, each against the siblings placed before it', () => {
    expect(namesOf(addAtIndex(siblings, named('M', 1), named('N', 1)))).toEqual(['A', 'N', 'M', 'B', 'C']);
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
