import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkSceneStats } from './sceneStatsScenario.mjs';

const failuresOf = (counts) => {
  const gate = fakeGate();
  checkSceneStats(gate, { counts, diagnostics: [CLEAN_LOAD, CLEAN_LOAD] });
  return gate.failures;
};

describe('checkSceneStats', () => {
  it("passes Godot's counts", () => {
    expect(failuresOf(['2 nodes', '2 nodes'])).toEqual([]);
  });

  it('fails a count that takes in the nodes of the .glb', () => {
    expect(failuresOf(['3 nodes', '2 nodes'])).toEqual([
      '[scene stats] the nodes of a .glb instance (unit-workspace-glb-instance.tscn): expected 2 nodes, got 3 nodes',
    ]);
  });

  it('fails a count that takes in the nodes of an inherited root', () => {
    expect(failuresOf(['2 nodes', '3 nodes'])).toEqual([
      '[scene stats] an instance whose root inherits (unit-scene-stats-chained-owners.tscn): expected 2 nodes, got 3 nodes',
    ]);
  });
});
