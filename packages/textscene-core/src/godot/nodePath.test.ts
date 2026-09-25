import { describe, expect, it } from 'vitest';
import { nodePathNames, nodePathWalkNames } from './nodePath.js';

describe('nodePathNames', () => {
  it.each([
    ['A/B', ['A', 'B']],
    ['A//B', ['A', 'B']],
    ['A/', ['A']],
    ['/root/A', ['root', 'A']],
    ['', []],
  ])('drops every empty segment of %s', (path, names) => {
    expect(nodePathNames(path)).toEqual(names);
  });

  it.each([
    ['./A', ['.', 'A']],
    ['../A', ['..', 'A']],
    ['A/./B', ['A', '.', 'B']],
  ])('keeps %s as names, since the constructor does', (path, names) => {
    // `.` and `..` reach `data->path` and are folded by the walk
    // (node.cpp:1916-1924), not by the constructor.
    expect(nodePathNames(path)).toEqual(names);
  });

  it.each([
    ['A:x', ['A']],
    ['A/B:x:y', ['A', 'B']],
    [':x', []],
  ])('drops the :subname of %s, which the walk never reads', (path, names) => {
    // The constructor splits at the first `:` and keeps only what precedes it
    // as names (node_path.cpp:405-427), so `get_node_or_null` addresses `A`.
    expect(nodePathWalkNames(path)).toEqual(names);
  });

  it('leaves a path with no colon exactly as nodePathNames reads it', () => {
    expect(nodePathWalkNames('./A//B/')).toEqual(nodePathNames('./A//B/'));
  });
});
