/** The volumetric fog pass one renderer shares between every scene it draws with fog. */

import type * as THREE from 'three';
import { VolumetricFogPass } from './volumetricFogPass.js';

interface SharedPass {
  pass: VolumetricFogPass;
  users: number;
  /** The users of each scene. The last one to release forgets the scene's view volumes. */
  sceneUsers: Map<THREE.Scene, number>;
}

/** Written only by `acquireVolumetricFogPass` and the release it returns. */
// eslint-disable-next-line no-restricted-syntax -- the entry counts its users, and the last release deletes it
const shared = new WeakMap<THREE.WebGLRenderer, SharedPass>();

/**
 * The renderer's volumetric fog pass, for one user that draws `scene`. Every fog program reads one
 * volume, so the scenes one renderer draws share the pass, each preparing it before its own render.
 * Several Environments of one scene share its view volumes until the last of them releases, and the
 * last release of all disposes the pass.
 */
export function acquireVolumetricFogPass(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene
): {
  pass: VolumetricFogPass;
  release: () => void;
} {
  const entry = shared.get(renderer) ?? { pass: new VolumetricFogPass(), users: 0, sceneUsers: new Map() };
  shared.set(renderer, entry);
  entry.users++;
  entry.sceneUsers.set(scene, (entry.sceneUsers.get(scene) ?? 0) + 1);
  let isReleased = false;
  return {
    pass: entry.pass,
    release: () => {
      if (isReleased) return;
      isReleased = true;
      releaseScene(entry, scene);
      entry.users--;
      if (entry.users > 0) return;
      entry.pass.dispose();
      shared.delete(renderer);
    },
  };
}

function releaseScene(entry: SharedPass, scene: THREE.Scene): void {
  const users = entry.sceneUsers.get(scene)! - 1;
  if (users > 0) {
    entry.sceneUsers.set(scene, users);
    return;
  }
  entry.sceneUsers.delete(scene);
  entry.pass.forget(scene);
}
