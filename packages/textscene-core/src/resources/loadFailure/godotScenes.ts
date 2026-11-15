/** The scene cache as Godot's loader answers it: a scene that fails to load is no scene. */

import type { TscnScene } from '../../parser/types';
import type { CacheSource } from '../../r3f/cacheSources';
import { perObject } from '../../utils/perObject';
import type { ResourceLoader } from '../ResourceLoader';

/**
 * A scene whose outcome is still to load answers as parsed, and its outcome is requested in a
 * microtask, since a tree is built inside `getSnapshot`, where a request is forbidden.
 */
export const godotScenes = perObject((loader: ResourceLoader): CacheSource<TscnScene> => {
  /** Written only by `getCached` and its microtask: the outcomes asked for and not yet requested. */
  const queued = new Set<string>();
  const requestOutcome = (path: string) => {
    if (queued.has(path)) return;
    queued.add(path);
    queueMicrotask(() => {
      queued.delete(path);
      const outcomes = loader.loadOutcomes;
      if (outcomes.getCached(path) === undefined && !outcomes.isLoading(path)) outcomes.request(path);
    });
  };
  return {
    getCached(path) {
      const scene = loader.scenes.getCached(path);
      if (!scene) return scene;
      const outcome = loader.loadOutcomes.getCached(path);
      if (outcome === undefined) requestOutcome(path);
      return outcome?.isFailed ? null : scene;
    },
  };
});

export function isFailedToLoad(loader: ResourceLoader, path: string): boolean {
  return loader.loadOutcomes.getCached(path)?.isFailed === true;
}
