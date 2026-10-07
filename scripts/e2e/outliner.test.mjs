import { describe, expect, it } from 'vitest';
import { fakeGate } from './gate.testkit.mjs';
import { checkNodePaths } from './outliner.mjs';

function failuresOf(expected, actual) {
  const gate = fakeGate();
  checkNodePaths(gate, '[tree]', expected, actual);
  return gate.failures;
}

describe('checkNodePaths', () => {
  it('records nothing for two identical path lists in the same order', () => {
    expect(failuresOf(['Root', 'Root/Box'], ['Root', 'Root/Box'])).toEqual([]);
  });

  it('records a dropped row as missing', () => {
    expect(failuresOf(['Root', 'Root/Box', 'Root/Title'], ['Root', 'Root/Box'])).toEqual([
      '[tree] lists [Root, Root/Box], expected [Root, Root/Box, Root/Title] (missing: [Root/Title], extra: [])',
    ]);
  });

  it('records an unexpected row as extra', () => {
    expect(failuresOf(['Root', 'Root/Box'], ['Root', 'Root/Box', 'Root/Ghost'])).toEqual([
      '[tree] lists [Root, Root/Box, Root/Ghost], expected [Root, Root/Box] (missing: [], extra: [Root/Ghost])',
    ]);
  });

  it('records a renamed row on both sides', () => {
    expect(failuresOf(['Root', 'Root/Box'], ['Root', 'Root/Renamed'])).toEqual([
      '[tree] lists [Root, Root/Renamed], expected [Root, Root/Box] (missing: [Root/Box], extra: [Root/Renamed])',
    ]);
  });

  it('records the same rows in a different order, with nothing missing or extra', () => {
    expect(failuresOf(['Root', 'Root/Box', 'Root/Title'], ['Root', 'Root/Title', 'Root/Box'])).toEqual([
      '[tree] lists [Root, Root/Title, Root/Box], expected [Root, Root/Box, Root/Title] (missing: [], extra: [])',
    ]);
  });

  it('records a tree that was never read (edge case)', () => {
    expect(failuresOf(['Root'], undefined)).toEqual([
      '[tree] lists [], expected [Root] (missing: [Root], extra: [])',
    ]);
  });
});
