import { describe, expect, it } from 'vitest';
import { CLEAN_LOAD, fakeGate } from './gate.testkit.mjs';
import { checkTreeRows, DOCK_ROWS } from './treeRowsScenario.mjs';

const failuresOf = (rows, badge) => {
  const gate = fakeGate();
  checkTreeRows(gate, { rows, badge, diagnostics: CLEAN_LOAD });
  return gate.failures;
};

describe('checkTreeRows', () => {
  it("passes Godot's dock rows and the Node3D badge", () => {
    expect(failuresOf(DOCK_ROWS, 'Node3D')).toEqual([]);
  });

  it('fails a row for a node of an instance that is not editable', () => {
    expect(
      failuresOf([...DOCK_ROWS.slice(0, 2), 'Main/Plain/Inner', ...DOCK_ROWS.slice(2)], 'Node3D')
    ).toHaveLength(1);
  });

  it('fails a glTF row with a class Godot does not give it', () => {
    expect(failuresOf(DOCK_ROWS, 'GLBSceneRoot')).toEqual([
      "[tree rows] the Main/Cube row reads the class GLBSceneRoot, expected Node3D as Godot's dock shows it",
    ]);
  });
});
