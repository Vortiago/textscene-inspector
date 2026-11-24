import { describe, expect, it } from 'vitest';
import { cameraFailures, MISSING_MESSAGE, REFUSED_MESSAGE } from './cameraFailures.mjs';

const PASSING = {
  overFromGameView: { 'Rig/Front': 0, Above: 0 },
  gizmoPixels: { 'Rig/Front': 600, Above: 560 },
  changedBetweenCameras: 9000,
  changedFromFreshEditor: 0,
  refused: REFUSED_MESSAGE,
  missing: MISSING_MESSAGE,
  settle: {
    overFromShot: { mountScene: 0, TscnCanvas: 0 },
    settleMs: { mountScene: 900, TscnCanvas: 900, editor: 800 },
    missing: MISSING_MESSAGE,
    keptMissing: MISSING_MESSAGE,
  },
};

const failuresOf = (results) => cameraFailures({ results: { ...PASSING, ...results }, errors: [] });

describe('cameraFailures', () => {
  it('passes a view that drew what the game draws through each camera', () => {
    expect(failuresOf({})).toEqual([]);
  });

  it('fails a view with no gizmo whose picture through a camera is not the game’s', () => {
    expect(failuresOf({ overFromGameView: { 'Rig/Front': 1, Above: 0 } })).toEqual([
      "camera: through Rig/Front with no gizmo: expected no pixel past residue from the game's view, got 1",
    ]);
  });

  it('fails a view whose gizmos key changed nothing', () => {
    expect(failuresOf({ gizmoPixels: { 'Rig/Front': 600, Above: 0 } })).toEqual([
      'camera: through Above: expected the gizmos to change at least 100 pixels, got 0',
    ]);
  });

  it('fails a view that did not move to the new camera', () => {
    expect(failuresOf({ changedBetweenCameras: 0 })).toEqual([
      'camera: a new camera: expected at least 2000 changed pixels, got 0',
    ]);
  });

  it('fails a null that left the editor camera off its start orbit', () => {
    expect(failuresOf({ changedFromFreshEditor: 300 })).toEqual([
      'camera: null: expected the frame of a fresh 3D mount, got 300 changed pixels',
    ]);
  });

  it('fails an update that took a MeshInstance3D', () => {
    expect(failuresOf({ refused: null })).toEqual([
      `camera: a MeshInstance3D: expected "${REFUSED_MESSAGE}", got null`,
    ]);
  });

  it('fails a settled view whose camera path still names no node', () => {
    expect(failuresOf({ missing: null })).toEqual([
      `camera: a path to no node: expected settled to reject with "${MISSING_MESSAGE}", got null`,
    ]);
  });

  it('fails a fresh view whose capture at settled does not show its camera', () => {
    expect(
      failuresOf({ settle: { ...PASSING.settle, overFromShot: { mountScene: 10798, TscnCanvas: 0 } } })
    ).toEqual([
      'camera: a fresh mountScene through Rig/Front: expected its capture at settled to show that camera, got 10798 pixels past residue',
    ]);
  });

  it('fails a view through the editor camera that never settled', () => {
    const settleMs = { ...PASSING.settle.settleMs, editor: 'expected a settled view' };
    expect(failuresOf({ settle: { ...PASSING.settle, settleMs } })).toEqual([
      'camera: camera null: expected settled to resolve, got "expected a settled view"',
    ]);
  });

  it('fails a TscnCanvas ref whose settled took a camera path that names no node', () => {
    expect(failuresOf({ settle: { ...PASSING.settle, missing: null } })).toEqual([
      `camera: a TscnCanvas ref to no node: expected settled to reject with "${MISSING_MESSAGE}", got null`,
    ]);
  });

  it('fails a TscnCanvas ref that stopped checking the camera once the prop was left out', () => {
    expect(failuresOf({ settle: { ...PASSING.settle, keptMissing: null } })).toEqual([
      `camera: a TscnCanvas ref with camera left out: expected settled to reject with "${MISSING_MESSAGE}", got null`,
    ]);
  });
});
