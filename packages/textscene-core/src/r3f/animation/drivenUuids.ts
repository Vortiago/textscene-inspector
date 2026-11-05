/**
 * The uuids of the objects a mixer's actions drive. A bound clip names each track by its target's
 * uuid (`trackTargets.ts`), so the set is read off the track names, once for each clip.
 */

import type { AnimationAction, AnimationClip } from 'three';
import { perObject } from '../../utils/perObject';
import { splitTrackName } from './trackTargets';

const uuidsDrivenBy = perObject((clip: AnimationClip): readonly string[] => [
  ...new Set(clip.tracks.map((track) => splitTrackName(track.name).path)),
]);

/** The uuids that `actions` move. Built again when the map changes size, as a rebuilt mixer's does. */
export const drivenUuids = perObject(
  (actions: ReadonlyMap<string, AnimationAction>): ReadonlySet<string> =>
    new Set([...actions.values()].flatMap((action) => uuidsDrivenBy(action.getClip()))),
  { stamp: (actions) => actions.size }
);
