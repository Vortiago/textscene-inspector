import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkWorkspace } from './workspaceScenario.mjs';

const failuresOf = (run) => {
  const gate = fakeGate();
  checkWorkspace(gate, { diagnostics: CLEAN_LOAD, nodeCount: '2 nodes', ...run });
  return gate.failures;
};

describe('checkWorkspace', () => {
  it('passes a Control root in 2D and its .glb in 3D', () => {
    expect(failuresOf({ controlRoot: '2D', glbRoot: '3D' })).toEqual([]);
  });

  it('fails a Control root that opens in 3D', () => {
    expect(failuresOf({ controlRoot: '3D', glbRoot: '3D' })).toEqual([
      '[workspace] a Control root: expected the 2D view, got 3D',
    ]);
  });

  it('fails a .glb that keeps the 2D view', () => {
    expect(failuresOf({ controlRoot: '2D', glbRoot: '2D' })).toEqual([
      '[workspace] a .glb opened on its own: expected the 3D view, got 2D',
    ]);
  });

  it('fails a count that takes in the nodes of the .glb', () => {
    expect(failuresOf({ controlRoot: '2D', glbRoot: '3D', nodeCount: '3 nodes' })).toEqual([
      '[workspace] the node count: expected 2 nodes, got 3 nodes',
    ]);
  });
});
