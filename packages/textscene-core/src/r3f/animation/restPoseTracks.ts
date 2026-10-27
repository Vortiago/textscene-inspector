/**
 * Composes the transform tracks of a node Godot makes a bone onto its rest pose (`boneRest.ts`).
 * Each key composes alone, so a rest with a shear composes approximately.
 */

import {
  Euler,
  type EulerOrder,
  type KeyframeTrack,
  type Matrix4,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three';
import { composeOntoRest, type LocalPose } from '../../resources/formats/glb/boneRest';

const ROTATION_COMPONENT = /^(.+)\.rotation\[([xyz])\]$/;

/** The order Godot reads a node's Euler angles in, which the rotation components of a track are written in. */
export const GODOT_EULER_ORDER: EulerOrder = 'YXZ';

/**
 * `tracks` with the transform tracks of each object in `restByUuid` composed onto its rest pose. A
 * track is named `<uuid>.<property>`, as `bindClip` leaves it. The three `rotation[x|y|z]` tracks
 * become one `quaternion` track, because Euler components do not compose with a rotation.
 */
export function composeTracksOntoRestPose(
  tracks: readonly KeyframeTrack[],
  restByUuid: ReadonlyMap<string, Matrix4>
): KeyframeTrack[] {
  const rotations = rotationComponents(tracks);
  return tracks.flatMap((track): KeyframeTrack[] => {
    const uuid = track.name.slice(0, track.name.indexOf('.'));
    const rest = restByUuid.get(uuid);
    if (!rest) return [track];
    const component = ROTATION_COMPONENT.exec(track.name);
    if (component) {
      const trio = rotations.get(uuid)!;
      // A rotation with a component missing has nothing to merge, so it stays as it is.
      if (!trio[0] || !trio[1] || !trio[2]) return [track];
      return component[2] === 'x' ? [rotationTrack(trio, rest, `${uuid}.quaternion`)] : [];
    }
    return [composeTrack(track, rest)];
  });
}

/** The x, y and z rotation tracks of each object, in that order. */
function rotationComponents(tracks: readonly KeyframeTrack[]): Map<string, KeyframeTrack[]> {
  const byUuid = new Map<string, KeyframeTrack[]>();
  for (const track of tracks) {
    const component = ROTATION_COMPONENT.exec(track.name);
    if (!component) continue;
    const found = byUuid.get(component[1]!) ?? [];
    found['xyz'.indexOf(component[2]!)] = track;
    byUuid.set(component[1]!, found);
  }
  return byUuid;
}

function composeTrack(track: KeyframeTrack, rest: Matrix4): KeyframeTrack {
  const property = track.name.slice(track.name.indexOf('.'));
  switch (property) {
    case '.position':
      return mapKeys(
        track,
        new Vector3(),
        VectorKeyframeTrack,
        (v) => onRest(rest, { position: v }).position
      );
    case '.scale':
      return mapKeys(track, new Vector3(), VectorKeyframeTrack, (v) => onRest(rest, { scale: v }).scale);
    case '.quaternion':
      return mapKeys(
        track,
        new Quaternion(),
        QuaternionKeyframeTrack,
        (q) => onRest(rest, { quaternion: q }).quaternion
      );
    default:
      return track;
  }
}

const ORIGIN = new Vector3();
const NO_TURN = new Quaternion();
const UNIT = new Vector3(1, 1, 1);
const _local: LocalPose = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };
const _composed: LocalPose = { position: new Vector3(), quaternion: new Quaternion(), scale: new Vector3() };

/** The pose `part` takes on `rest`, with each part a track does not drive at its identity. The caller reads it at once. */
function onRest(rest: Matrix4, part: Partial<LocalPose>): LocalPose {
  _local.position.copy(part.position ?? ORIGIN);
  _local.quaternion.copy(part.quaternion ?? NO_TURN);
  _local.scale.copy(part.scale ?? UNIT);
  return composeOntoRest(rest, _local, _composed);
}

function withInterpolation<T extends KeyframeTrack>(composed: T, track: KeyframeTrack): T {
  composed.setInterpolation(track.getInterpolation());
  return composed;
}

/** `track` with `compose` applied to each key, read into `value` and written back. */
function mapKeys<T extends Vector3 | Quaternion, K extends KeyframeTrack>(
  track: KeyframeTrack,
  value: T,
  Track: new (name: string, times: number[], values: number[]) => K,
  compose: (value: T) => T
): K {
  const stride = track.getValueSize();
  const values = Array.from(track.values);
  for (let i = 0; i < values.length; i += stride) {
    compose(value.fromArray(values, i) as T).toArray(values, i);
  }
  return withInterpolation(new Track(track.name, Array.from(track.times), values), track);
}

function rotationTrack([x, y, z]: KeyframeTrack[], rest: Matrix4, name: string): QuaternionKeyframeTrack {
  const times = Array.from(x!.times);
  const euler = new Euler(0, 0, 0, GODOT_EULER_ORDER);
  const quaternion = new Quaternion();
  const values = times.flatMap((_, i) => {
    quaternion.setFromEuler(euler.set(x!.values[i]!, y!.values[i]!, z!.values[i]!));
    return onRest(rest, { quaternion }).quaternion.toArray();
  });
  return withInterpolation(new QuaternionKeyframeTrack(name, times, values), x!);
}
