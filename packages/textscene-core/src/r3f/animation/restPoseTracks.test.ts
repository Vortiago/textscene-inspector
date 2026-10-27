import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { composeTracksOntoRestPose } from './restPoseTracks';

const UUID = 'uuid-1';
const rest = (
  position: THREE.Vector3,
  quaternion = new THREE.Quaternion(),
  scale = new THREE.Vector3(1, 1, 1)
) => new Map([[UUID, new THREE.Matrix4().compose(position, quaternion, scale)]]);

describe('composeTracksOntoRestPose', () => {
  it('adds a position track to the rest position', () => {
    const track = new THREE.VectorKeyframeTrack(`${UUID}.position`, [0, 1], [0, 0, 0, 0, 1.5, 0]);

    const [composed] = composeTracksOntoRestPose([track], rest(new THREE.Vector3(1.5, 0.5, 0)));

    expect(Array.from(composed!.values)).toEqual([1.5, 0.5, 0, 1.5, 2, 0]);
  });

  it('turns a position track by the rest rotation and scales it by the rest scale', () => {
    const quarterTurnAboutY = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const track = new THREE.VectorKeyframeTrack(`${UUID}.position`, [0], [1, 0, 0]);

    const [composed] = composeTracksOntoRestPose(
      [track],
      rest(new THREE.Vector3(0, 0, 0), quarterTurnAboutY, new THREE.Vector3(2, 2, 2))
    );

    expect(Array.from(composed!.values).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0, -2]);
  });

  it('multiplies a scale track by the rest scale', () => {
    const track = new THREE.VectorKeyframeTrack(`${UUID}.scale`, [0], [1, 2, 3]);

    const [composed] = composeTracksOntoRestPose(
      [track],
      rest(new THREE.Vector3(), undefined, new THREE.Vector3(2, 2, 2))
    );

    expect(Array.from(composed!.values)).toEqual([2, 4, 6]);
  });

  it('turns a quaternion track by the rest rotation', () => {
    const quarterTurnAboutY = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const track = new THREE.QuaternionKeyframeTrack(`${UUID}.quaternion`, [0], [0, 0, 0, 1]);

    const [composed] = composeTracksOntoRestPose([track], rest(new THREE.Vector3(), quarterTurnAboutY));

    expect(Array.from(composed!.values).map((v) => Math.round(v * 1e6) / 1e6)).toEqual(
      quarterTurnAboutY.toArray().map((v) => Math.round(v * 1e6) / 1e6)
    );
  });

  it('merges the three rotation components into one quaternion track, since Euler components do not compose', () => {
    const times = [0, 1];
    const tracks = (['x', 'y', 'z'] as const).map(
      (axis, i) =>
        new THREE.NumberKeyframeTrack(`${UUID}.rotation[${axis}]`, times, i === 1 ? [0, Math.PI / 2] : [0, 0])
    );

    const composed = composeTracksOntoRestPose(tracks, rest(new THREE.Vector3()));

    expect(composed.map((track) => track.name)).toEqual([`${UUID}.quaternion`]);
    expect(Array.from(composed[0]!.values.slice(4)).map((v) => Math.round(v * 1e4) / 1e4)).toEqual([
      0, 0.7071, 0, 0.7071,
    ]);
  });

  it("reads the rotation components in Godot's YXZ order", () => {
    const angles = { x: 0.4, y: 0.9, z: 0.2 };
    const tracks = (['x', 'y', 'z'] as const).map(
      (axis) => new THREE.NumberKeyframeTrack(`${UUID}.rotation[${axis}]`, [0], [angles[axis]])
    );
    const expected = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(angles.x, angles.y, angles.z, 'YXZ')
    );

    const [composed] = composeTracksOntoRestPose(tracks, rest(new THREE.Vector3()));

    Array.from(composed!.values).forEach((value, i) => expect(value).toBeCloseTo(expected.toArray()[i]!, 5));
  });

  it('leaves a rotation with a component missing as it is', () => {
    const track = new THREE.NumberKeyframeTrack(`${UUID}.rotation[y]`, [0], [1]);

    expect(composeTracksOntoRestPose([track], rest(new THREE.Vector3()))).toEqual([track]);
  });

  it('leaves a track of a node with no rest pose as it is', () => {
    const track = new THREE.VectorKeyframeTrack('other.position', [0], [1, 2, 3]);

    expect(composeTracksOntoRestPose([track], rest(new THREE.Vector3(5, 5, 5)))).toEqual([track]);
  });

  it('keeps the interpolation of the track it composes', () => {
    const track = new THREE.VectorKeyframeTrack(
      `${UUID}.position`,
      [0, 1],
      [0, 0, 0, 1, 0, 0],
      THREE.InterpolateDiscrete
    );

    const [composed] = composeTracksOntoRestPose([track], rest(new THREE.Vector3(1, 0, 0)));

    expect(composed!.getInterpolation()).toBe(THREE.InterpolateDiscrete);
  });
});
