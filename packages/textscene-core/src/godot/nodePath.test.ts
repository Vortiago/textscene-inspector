import { describe, expect, it } from 'vitest';
import { nodePathNames } from './nodePath.js';

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
    // `.` and `..` reach `data->path` and are folded by the WALK
    // (node.cpp:1916-1924), not by the constructor.
    expect(nodePathNames(path)).toEqual(names);
  });
});
